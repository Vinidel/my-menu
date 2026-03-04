import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type QueueRow = {
  msg_id: number;
  read_ct: number;
  message: {
    jobId?: string;
    versionId?: string;
  };
};

type StoragePage = {
  page: number;
  bucket: string;
  path: string;
  mime: string;
};

type MenuItem = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  priceCents?: number;
  extras?: Array<{ id: string; name: string; priceCents?: number }>;
  removableIngredients?: Array<{ id: string; name: string }>;
};

type ExtractedMenuPayload = {
  items?: unknown;
  issues?: unknown;
  extras?: unknown;
  adicionais?: unknown;
};

const MAX_QUEUE_ATTEMPTS = 5;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 90_000;
const MULTI_IMAGE_MIN_TIMEOUT_MS = 120_000;

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  const workerSecret = (Deno.env.get("MENU_IMPORT_WORKER_SECRET") ?? "").trim();
  if (workerSecret) {
    const incomingSecret = request.headers.get("x-worker-secret")?.trim() ?? "";
    if (!incomingSecret || incomingSecret !== workerSecret) {
      return json({ ok: false, message: "Unauthorized worker invocation." }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, message: "Missing Supabase env vars." }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error: queueReadError } = await supabase.rpc("menu_import_queue_read", {
    p_visibility_timeout_seconds: 60,
    p_limit: 1,
  });

  if (queueReadError) {
    console.error("[menu-import-worker] queue read failed", {
      message: queueReadError.message,
      code: queueReadError.code,
    });
    return json({ ok: false, message: "Queue read failed." }, 500);
  }

  const queueRow = Array.isArray(rows) && rows[0] ? (rows[0] as QueueRow) : null;
  if (!queueRow) {
    return json({ ok: true, processed: false }, 200);
  }

  const message = queueRow.message ?? {};
  const jobId = stringFrom(message.jobId);
  const versionIdFromMessage = stringFrom(message.versionId);
  if (!jobId || !versionIdFromMessage) {
    await deleteMessage(supabase, queueRow.msg_id);
    return json({ ok: true, processed: true, status: "skipped", acked: true }, 200);
  }

  const result = await processJob(supabase, { jobId, versionId: versionIdFromMessage });
  const shouldAck =
    result.status === "ready" ||
    result.status === "ready_with_issues" ||
    result.status === "skipped" ||
    queueRow.read_ct >= MAX_QUEUE_ATTEMPTS;

  if (shouldAck) {
    await deleteMessage(supabase, queueRow.msg_id);
  }

  return json(
    {
      ok: true,
      processed: true,
      status: result.status,
      attempts: queueRow.read_ct,
      acked: shouldAck,
    },
    200
  );
});

async function processJob(
  supabase: ReturnType<typeof createClient>,
  input: { jobId: string; versionId: string }
): Promise<{ status: "ready" | "ready_with_issues" | "failed" | "skipped" }> {
  const { data: jobRow, error: jobError } = await supabase
    .from("menu_import_jobs")
    .select("id, status, menu_version_id, storage_bucket, storage_path, storage_mime, storage_pages")
    .eq("id", input.jobId)
    .maybeSingle();

  if (jobError || !jobRow) {
    console.error("[menu-import-worker] failed to load job", {
      jobId: input.jobId,
      message: jobError?.message ?? "job not found",
      code: jobError?.code,
    });
    return { status: "skipped" };
  }

  if (jobRow.status !== "processing") {
    return { status: "skipped" };
  }

  const versionId = jobRow.menu_version_id ?? input.versionId;
  if (!versionId) {
    await failJob(supabase, jobRow.id, "Job sem rascunho vinculado.");
    return { status: "failed" };
  }

  const pages = normalizeStoragePages(jobRow.storage_pages, {
    bucket: jobRow.storage_bucket,
    path: jobRow.storage_path,
    mime: jobRow.storage_mime,
  });

  if (pages.length === 0) {
    await failJob(supabase, jobRow.id, "Job sem páginas válidas para extração.");
    await updateDraftFailure(supabase, versionId, "Nenhuma página válida encontrada.");
    return { status: "failed" };
  }

  try {
    const images = [] as Array<{ mimeType: string; imageBase64: string }>;
    for (const page of pages) {
      const { data, error } = await supabase.storage.from(page.bucket).download(page.path);
      if (error || !data) {
        throw new Error(`Falha ao baixar página ${page.page}.`);
      }

      const bytes = new Uint8Array(await data.arrayBuffer());
      images.push({
        mimeType: page.mime,
        imageBase64: bytesToBase64(bytes),
      });
    }

    const extracted = await extractMenuFromImagesWithOpenAi(images);
    const extractionIssues = [...extracted.issues];
    const finalStatus: "ready" | "ready_with_issues" =
      extracted.menuItems.length > 0 ? "ready" : "ready_with_issues";

    if (extracted.menuItems.length === 0) {
      extractionIssues.push("Nenhum item válido foi identificado automaticamente.");
    }

    await supabase
      .from("menu_versions")
      .update({
        data: extracted.menuItems as unknown as Json,
        extraction_issues: extractionIssues,
        notes: null,
      })
      .eq("id", versionId)
      .eq("status", "draft");

    await supabase
      .from("menu_import_jobs")
      .update({
        status: finalStatus,
        error_message: finalStatus === "ready_with_issues" ? "Extração concluída com pendências." : null,
      })
      .eq("id", jobRow.id)
      .eq("status", "processing");

    return { status: finalStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada durante extração.";
    console.error("[menu-import-worker] extraction failed", {
      jobId: jobRow.id,
      message,
    });

    await updateDraftFailure(supabase, versionId, message);
    await failJob(supabase, jobRow.id, message);

    return { status: "failed" };
  }
}

async function extractMenuFromImagesWithOpenAi(
  images: Array<{ mimeType: string; imageBase64: string }>
): Promise<{ menuItems: MenuItem[]; issues: string[] }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("Nenhuma imagem enviada para extração.");
  }

  const model = (Deno.env.get("OPENAI_MENU_VISION_MODEL") ?? DEFAULT_MODEL).trim();
  const requestedTimeoutMs = normalizeTimeoutMs(Deno.env.get("OPENAI_MENU_VISION_TIMEOUT_MS"));
  const timeoutMs = images.length > 1 ? Math.max(requestedTimeoutMs, MULTI_IMAGE_MIN_TIMEOUT_MS) : requestedTimeoutMs;

  const content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> = [
    {
      type: "input_text",
      text:
        "Extraia o cardápio das imagens enviadas, respeitando a ordem de páginas, e devolva APENAS JSON válido com formato {\"items\": [...], \"issues\": [...]}. " +
        "Cada item em items deve conter: name (string), category (string opcional), description (string opcional), price (string ou number), extras (array opcional), removableIngredients (array opcional). " +
        "Cada extra em extras deve conter: name (string) e price (string ou number opcional). " +
        "Cada ingrediente em removableIngredients deve conter: name (string). " +
        "Se houver seção 'Adicionais' no cardápio, distribua esses adicionais nos itens aplicáveis em extras dos itens principais. " +
        "price pode vir como exemplo \"R$ 25,90\". Não invente itens. Se algo estiver incerto, inclua em issues.",
    },
  ];

  for (const image of images) {
    content.push({ type: "input_image", image_url: `data:${image.mimeType};base64,${image.imageBase64}` });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "erro desconhecido");
      throw new Error(`OpenAI retornou ${response.status}: ${message}`);
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const outputText = extractTextFromResponsesPayload(payload);
    if (!outputText) {
      throw new Error("Resposta de extração vazia.");
    }

    const extracted = parseExtractedPayload(outputText);
    const menuItems = normalizeExtractedItems(extracted);
    const issues = normalizeIssues(extracted.issues);

    return { menuItems, issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    if (message.toLowerCase().includes("aborted")) {
      throw new Error(`Timeout na extração (${timeoutMs}ms, ${images.length} imagem(ns)).`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseExtractedPayload(text: string): ExtractedMenuPayload {
  const direct = tryParseJson(text);
  if (direct) return direct;

  const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
  const fromBlock = tryParseJson(jsonBlockMatch?.[0] ?? "");
  if (fromBlock) return fromBlock;

  throw new Error("Não foi possível interpretar JSON da extração.");
}

function tryParseJson(value: string): ExtractedMenuPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ExtractedMenuPayload;
  } catch {
    return null;
  }
}

type NormalizedExtractedItem = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  priceCents?: number;
  extras?: Array<{ id: string; name: string; priceCents?: number }>;
  removableIngredients?: Array<{ id: string; name: string }>;
};

function normalizeExtractedItems(payload: ExtractedMenuPayload): MenuItem[] {
  if (!Array.isArray(payload.items)) return [];

  const normalizedItems = payload.items
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const name = stringFrom(row.name);
      if (!name) return null;

      const category = stringFrom(row.category) ?? undefined;
      const description = stringFrom(row.description) ?? undefined;
      const priceCents = parsePriceToCents(row.price);
      const extras = normalizeExtractedExtras(row.extras ?? row.adicionais, name);
      const isLanche = isLancheItem(name, category);
      const removableIngredients = isLanche
        ? normalizeRemovableIngredients(row.removableIngredients ?? row.removable_ingredients, name)
        : [];
      const inferredRemovableIngredients =
        removableIngredients.length > 0
          ? removableIngredients
          : isLanche
            ? inferRemovableIngredientsFromDescription(name, category, description)
            : [];

      return {
        id: buildStableItemId(name, index),
        name,
        ...(category ? { category } : {}),
        ...(description ? { description } : {}),
        ...(typeof priceCents === "number" ? { priceCents } : {}),
        ...(extras.length > 0 ? { extras } : {}),
        ...(inferredRemovableIngredients.length > 0 ? { removableIngredients: inferredRemovableIngredients } : {}),
      };
    })
    .filter((row): row is NormalizedExtractedItem => row !== null);

  const explicitGlobalExtras = normalizeExtractedExtras(payload.extras ?? payload.adicionais, "globais");
  const additionalRows = normalizedItems.filter((item) => isAdditionalSectionItem(item));
  const inferredGlobalExtras = collectGlobalExtrasFromAdditionalRows(additionalRows);
  const inferredFromSingleItem = inferGlobalExtrasFromItemAssignments(normalizedItems);
  const globalExtras = mergeExtras(mergeExtras(explicitGlobalExtras, inferredGlobalExtras), inferredFromSingleItem);

  return normalizedItems
    .filter((item) => !isAdditionalSectionItem(item))
    .map((item) => {
      if (globalExtras.length === 0) return item;
      if (!isLikelyCustomizableItem(item)) return item;
      const mergedItemExtras = mergeExtras(item.extras ?? [], globalExtras);
      return {
        ...item,
        ...(mergedItemExtras.length > 0 ? { extras: mergedItemExtras } : {}),
      };
    });
}

function normalizeIssues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((issue) => stringFrom(issue))
    .filter((issue): issue is string => Boolean(issue))
    .slice(0, 100);
}

function normalizeExtractedExtras(value: unknown, parentItemName: string): Array<{ id: string; name: string; priceCents?: number }> {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const name = stringFrom(row.name);
      if (!name) return null;
      const priceCents = parsePriceToCents(row.price);
      return {
        id: buildStableExtraId(parentItemName, name, index),
        name,
        ...(typeof priceCents === "number" ? { priceCents } : {}),
      };
    })
    .filter((extra): extra is { id: string; name: string; priceCents?: number } => extra !== null);

  return dedupeExtras(normalized).slice(0, 30);
}

function normalizeRemovableIngredients(value: unknown, parentItemName: string): Array<{ id: string; name: string }> {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const name = stringFrom(row.name);
      if (!name) return null;
      return { id: buildStableRemovalId(parentItemName, name, index), name };
    })
    .filter((ingredient): ingredient is { id: string; name: string } => ingredient !== null);

  return dedupeRemovableIngredients(normalized).slice(0, 40);
}

function inferRemovableIngredientsFromDescription(
  itemName: string,
  category: string | undefined,
  description: string | undefined
): Array<{ id: string; name: string }> {
  if (!description) return [];
  if (!isLancheItem(itemName, category)) return [];

  const ingredientText = extractIngredientListSegment(description);
  if (!ingredientText) return [];

  const rawTokens = ingredientText
    .split(/\s*,\s*|\s+e\s+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  if (rawTokens.length < 3) return [];

  const normalized = rawTokens
    .map(cleanIngredientToken)
    .filter((token): token is string => Boolean(token))
    .map((name, index) => ({ id: buildStableRemovalId(itemName, name, index), name }));

  return dedupeRemovableIngredients(normalized).slice(0, 40);
}

function collectGlobalExtrasFromAdditionalRows(rows: NormalizedExtractedItem[]): Array<{ id: string; name: string; priceCents?: number }> {
  const collected: Array<{ id: string; name: string; priceCents?: number }> = [];

  for (const row of rows) {
    if (Array.isArray(row.extras) && row.extras.length > 0) {
      collected.push(...row.extras);
      continue;
    }

    if (typeof row.priceCents === "number") {
      collected.push({
        id: buildStableExtraId("globais", row.name, collected.length),
        name: row.name,
        priceCents: row.priceCents,
      });
    }

    if (row.description) {
      collected.push(...parseExtrasFromDescription(row.description, collected.length));
    }
  }

  return dedupeExtras(collected);
}

function parseExtrasFromDescription(
  description: string,
  offset: number
): Array<{ id: string; name: string; priceCents?: number }> {
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const extras: Array<{ id: string; name: string; priceCents?: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(.+?)(?:\s*[—–-]\s*|\s+)(?:R\$\s*)?(\d{1,3}(?:[.,]\d{2})?)$/i);
    if (!match) continue;
    const name = match[1]?.trim();
    if (!name) continue;
    const priceCents = parsePriceToCents(match[2] ?? "");
    extras.push({
      id: buildStableExtraId("globais", name, offset + index),
      name,
      ...(typeof priceCents === "number" ? { priceCents } : {}),
    });
  }

  return extras;
}

function inferGlobalExtrasFromItemAssignments(
  items: NormalizedExtractedItem[]
): Array<{ id: string; name: string; priceCents?: number }> {
  const customizableItems = items.filter((item) => isLikelyCustomizableItem(item));
  const withExtras = customizableItems.filter((item) => Array.isArray(item.extras) && item.extras.length > 0);

  if (withExtras.length === 1 && (withExtras[0].extras?.length ?? 0) >= 4) {
    return dedupeExtras(withExtras[0].extras ?? []);
  }

  return [];
}

function mergeExtras(
  current: Array<{ id: string; name: string; priceCents?: number }>,
  incoming: Array<{ id: string; name: string; priceCents?: number }>
): Array<{ id: string; name: string; priceCents?: number }> {
  return dedupeExtras([...current, ...incoming]);
}

function dedupeExtras(
  extras: Array<{ id: string; name: string; priceCents?: number }>
): Array<{ id: string; name: string; priceCents?: number }> {
  const deduped = new Map<string, { id: string; name: string; priceCents?: number }>();
  for (const extra of extras) {
    const key = normalizeLabel(extra.name);
    if (!key) continue;
    if (!deduped.has(key)) {
      deduped.set(key, extra);
      continue;
    }
    const previous = deduped.get(key)!;
    if (typeof previous.priceCents !== "number" && typeof extra.priceCents === "number") {
      deduped.set(key, extra);
    }
  }
  return Array.from(deduped.values());
}

function dedupeRemovableIngredients(
  ingredients: Array<{ id: string; name: string }>
): Array<{ id: string; name: string }> {
  const deduped = new Map<string, { id: string; name: string }>();
  for (const ingredient of ingredients) {
    const key = normalizeLabel(ingredient.name);
    if (!key) continue;
    if (!deduped.has(key)) {
      deduped.set(key, ingredient);
    }
  }
  return Array.from(deduped.values());
}

function extractIngredientListSegment(description: string): string {
  const firstSentence = description
    .split(/[.;]/)
    .map((segment) => segment.trim())
    .find(Boolean);
  if (!firstSentence) return "";
  return firstSentence.replace(/^ingredientes?\s*:\s*/i, "").trim();
}

function cleanIngredientToken(token: string): string | null {
  const cleaned = token
    .replace(/^\s*(com|de|do|da|dos|das)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (/^(ml|g|kg|\d+)$/i.test(cleaned)) return null;
  return capitalizeWords(cleaned);
}

function capitalizeWords(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractTextFromResponsesPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return "";

  const directText = stringFrom(payload.output_text);
  if (directText) return directText;

  if (Array.isArray(payload.output_text)) {
    const joined = payload.output_text
      .map((part) => stringFrom(part))
      .filter((part): part is string => Boolean(part))
      .join("\n")
      .trim();
    if (joined) return joined;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const outputContentTexts: string[] = [];

  for (const node of output) {
    if (!node || typeof node !== "object") continue;
    const row = node as Record<string, unknown>;
    const nodeText = stringFrom(row.text) ?? stringFrom(row.output_text);
    if (nodeText) outputContentTexts.push(nodeText);

    const content = Array.isArray(row.content) ? row.content : [];
    for (const contentNode of content) {
      if (!contentNode || typeof contentNode !== "object") continue;
      const contentRow = contentNode as Record<string, unknown>;
      const contentText = stringFrom(contentRow.text) ?? stringFrom(contentRow.output_text);
      if (contentText) outputContentTexts.push(contentText);
    }
  }

  if (outputContentTexts.length > 0) {
    return outputContentTexts.join("\n").trim();
  }

  return "";
}

function isAdditionalSectionItem(item: NormalizedExtractedItem): boolean {
  const source = `${item.name} ${item.category ?? ""}`.toLowerCase();
  return /adicion|acrescimo|extra|complemento/.test(source);
}

function isLikelyCustomizableItem(item: NormalizedExtractedItem): boolean {
  const source = `${item.name} ${item.category ?? ""}`.toLowerCase();
  if (/bebida|refrigerante|suco|agua|cerveja/.test(source)) return false;
  if (/sobremesa|acai|milk[-\s]?shake/.test(source)) return false;
  return true;
}

function isLancheItem(name: string, category: string | undefined): boolean {
  const source = `${name} ${category ?? ""}`.toLowerCase();
  if (/lanche|hamburg|hamburguer|sanduich/.test(source)) return true;
  if (/^x[\s-]/.test(name.trim().toLowerCase())) return true;
  return false;
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  const bounded = Math.trunc(parsed);
  if (bounded < 3_000) return 3_000;
  if (bounded > 120_000) return 120_000;
  return bounded;
}

function stringFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parsePriceToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    if (Number.isInteger(value) && value >= 100) {
      return value;
    }
    return Math.round(value * 100);
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[R$\s]/gi, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function buildStableItemId(name: string, index: number): string {
  const base = slugify(name).slice(0, 40);
  return `${base || "item"}-${index + 1}`;
}

function buildStableExtraId(parentItemName: string, extraName: string, index: number): string {
  const parentBase = slugify(parentItemName).slice(0, 24);
  const extraBase = slugify(extraName).slice(0, 24);
  return `${parentBase || "item"}-${extraBase || "extra"}-${index + 1}`;
}

function buildStableRemovalId(parentItemName: string, ingredientName: string, index: number): string {
  const parentBase = slugify(parentItemName).slice(0, 24);
  const ingredientBase = slugify(ingredientName).slice(0, 24);
  return `${parentBase || "item"}-${ingredientBase || "removivel"}-${index + 1}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStoragePages(
  value: unknown,
  fallback: { bucket: string | null; path: string | null; mime: string | null }
): StoragePage[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback.path && fallback.bucket && fallback.mime
      ? [{ page: 1, bucket: fallback.bucket, path: fallback.path, mime: fallback.mime }]
      : [];
  }

  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const bucket = stringFrom(row.bucket) ?? fallback.bucket;
      const path = stringFrom(row.path);
      const mime = stringFrom(row.mime) ?? "image/jpeg";
      const page = numberFrom(row.page) ?? index + 1;
      if (!bucket || !path || !mime) return null;
      return { page, bucket, path, mime };
    })
    .filter((page): page is StoragePage => page !== null)
    .sort((a, b) => a.page - b.page);
}

async function failJob(supabase: ReturnType<typeof createClient>, jobId: string, message: string) {
  await supabase
    .from("menu_import_jobs")
    .update({ status: "failed", error_message: message })
    .eq("id", jobId)
    .eq("status", "processing");
}

async function updateDraftFailure(
  supabase: ReturnType<typeof createClient>,
  versionId: string,
  message: string
) {
  await supabase
    .from("menu_versions")
    .update({
      data: [] as unknown as Json,
      extraction_issues: ["Falha na extração."],
      notes: message,
    })
    .eq("id", versionId)
    .eq("status", "draft");
}

async function deleteMessage(supabase: ReturnType<typeof createClient>, messageId: number) {
  await supabase.rpc("menu_import_queue_delete", { p_msg_id: messageId });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
