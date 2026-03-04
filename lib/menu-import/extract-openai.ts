import "server-only";

import type { MenuItem } from "@/lib/menu";
import { parseMenuItemsFromUnknown } from "@/lib/menu";

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 90_000;
const MULTI_IMAGE_MIN_TIMEOUT_MS = 120_000;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type ExtractedMenuPayload = {
  items?: unknown;
  issues?: unknown;
  extras?: unknown;
  adicionais?: unknown;
};

export async function extractMenuFromImageWithOpenAi(input: {
  images: Array<{
    mimeType: string;
    imageBase64: string;
  }>;
}): Promise<{ menuItems: MenuItem[]; issues: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  if (!Array.isArray(input.images) || input.images.length === 0) {
    throw new Error("Nenhuma imagem enviada para extração.");
  }

  const model = (process.env.OPENAI_MENU_VISION_MODEL || DEFAULT_MODEL).trim();
  const requestedTimeoutMs = normalizeTimeoutMs(process.env.OPENAI_MENU_VISION_TIMEOUT_MS);
  const timeoutMs =
    input.images.length > 1
      ? Math.max(requestedTimeoutMs, MULTI_IMAGE_MIN_TIMEOUT_MS)
      : requestedTimeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> =
      [
        {
          type: "input_text",
          text:
            "Extraia o cardápio das imagens enviadas, respeitando a ordem de páginas, e devolva APENAS JSON válido com formato {\"items\": [...], \"issues\": [...]}. " +
            "Cada item em items deve conter: name (string), category (string opcional), description (string opcional), price (string ou number), extras (array opcional). " +
            "Cada extra em extras deve conter: name (string) e price (string ou number opcional). " +
            "Se houver seção 'Adicionais' no cardápio, distribua esses adicionais nos itens aplicáveis em `extras` dos itens principais, em vez de criar itens soltos da categoria 'Adicionais'. " +
            "price pode vir como exemplo \"R$ 25,90\". Não invente itens. Se algo estiver incerto, inclua em issues.",
        },
      ];
    for (const image of input.images) {
      content.push({
        type: "input_image",
        image_url: `data:${image.mimeType};base64,${image.imageBase64}`,
      });
    }

    let response: Response;
    try {
      response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content,
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      if (message.toLowerCase().includes("aborted")) {
        throw new Error(
          `Timeout na extração (${timeoutMs}ms, ${input.images.length} imagem(ns)). Tente imagens menores ou aumente OPENAI_MENU_VISION_TIMEOUT_MS.`
        );
      }
      throw new Error(`Falha de rede na extração: ${message}`);
    }

    if (!response.ok) {
      const message = await response.text().catch(() => "erro desconhecido");
      throw new Error(`OpenAI retornou ${response.status}: ${message}`);
    }

    const payload = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const outputText = extractTextFromResponsesPayload(payload);
    if (!outputText) {
      throw new Error("Resposta de extração vazia.");
    }

    const extracted = parseExtractedPayload(outputText);
    const menuItems = normalizeExtractedItems(extracted);
    const issues = normalizeIssues(extracted.issues);

    return { menuItems, issues };
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as ExtractedMenuPayload;
}

type NormalizedExtractedItem = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  priceCents?: number;
  extras?: Array<{ id: string; name: string; priceCents?: number }>;
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

      return {
        id: buildStableItemId(name, index),
        name,
        ...(category ? { category } : {}),
        ...(description ? { description } : {}),
        ...(typeof priceCents === "number" ? { priceCents } : {}),
        ...(extras.length > 0 ? { extras } : {}),
      };
    })
    .filter((row): row is NormalizedExtractedItem => row !== null);

  const explicitGlobalExtras = normalizeExtractedExtras(
    payload.extras ?? payload.adicionais,
    "globais"
  );
  const additionalRows = normalizedItems.filter((item) => isAdditionalSectionItem(item));
  const inferredGlobalExtras = collectGlobalExtrasFromAdditionalRows(additionalRows);
  const inferredFromSingleItem = inferGlobalExtrasFromItemAssignments(normalizedItems);
  const globalExtras = mergeExtras(
    mergeExtras(explicitGlobalExtras, inferredGlobalExtras),
    inferredFromSingleItem
  );

  const finalizedItems = normalizedItems
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

  return parseMenuItemsFromUnknown(finalizedItems);
}

function normalizeIssues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((issue) => stringFrom(issue))
    .filter((issue): issue is string => Boolean(issue))
    .slice(0, 100);
}

function normalizeExtractedExtras(value: unknown, parentItemName: string): Array<{
  id: string;
  name: string;
  priceCents?: number;
}> {
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

function collectGlobalExtrasFromAdditionalRows(
  rows: NormalizedExtractedItem[]
): Array<{ id: string; name: string; priceCents?: number }> {
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
    const match = line.match(
      /^(.+?)(?:\s*[—–-]\s*|\s+)(?:R\$\s*)?(\d{1,3}(?:[.,]\d{2})?)$/i
    );
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

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferGlobalExtrasFromItemAssignments(
  items: NormalizedExtractedItem[]
): Array<{ id: string; name: string; priceCents?: number }> {
  const customizableItems = items.filter((item) => isLikelyCustomizableItem(item));
  const withExtras = customizableItems.filter(
    (item) => Array.isArray(item.extras) && item.extras.length > 0
  );

  // Common extraction failure mode: model attaches "Adicionais" only to one lanche.
  // If exactly one customizable item has a sizable extras list, treat it as global.
  if (withExtras.length === 1 && (withExtras[0].extras?.length ?? 0) >= 4) {
    return dedupeExtras(withExtras[0].extras ?? []);
  }

  return [];
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

  const choiceText = extractTextFromChoices(payload.choices);
  if (choiceText) return choiceText;

  return "";
}

function extractTextFromChoices(value: unknown): string {
  if (!Array.isArray(value)) return "";

  const texts: string[] = [];
  for (const choice of value) {
    if (!choice || typeof choice !== "object") continue;
    const row = choice as Record<string, unknown>;
    const message = row.message;
    if (!message || typeof message !== "object") continue;
    const messageRow = message as Record<string, unknown>;

    const direct = stringFrom(messageRow.content);
    if (direct) {
      texts.push(direct);
      continue;
    }

    if (Array.isArray(messageRow.content)) {
      for (const part of messageRow.content) {
        if (!part || typeof part !== "object") continue;
        const partRow = part as Record<string, unknown>;
        const text = stringFrom(partRow.text);
        if (text) texts.push(text);
      }
    }
  }

  return texts.join("\n").trim();
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

function parsePriceToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    if (Number.isInteger(value) && value >= 100) {
      return value;
    }
    return Math.round(value * 100);
  }

  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/[R$\s]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function buildStableItemId(name: string, index: number) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "item"}-${index + 1}`;
}

function buildStableExtraId(parentItemName: string, extraName: string, index: number) {
  const parentBase = slugify(parentItemName).slice(0, 24);
  const extraBase = slugify(extraName).slice(0, 24);
  return `${parentBase || "item"}-${extraBase || "extra"}-${index + 1}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
