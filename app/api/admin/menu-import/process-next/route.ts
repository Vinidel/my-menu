import { NextResponse } from "next/server";
import { extractMenuFromImageWithOpenAi } from "@/lib/menu-import/extract-openai";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/supabase/database.types";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

type StoragePage = {
  page: number;
  bucket: string;
  path: string;
  mime: string;
  sizeBytes?: number;
};

export async function POST() {
  const authClient = await createClient();
  const serviceClient = createServiceRoleClient();

  if (!authClient || !serviceClient) {
    return NextResponse.json(
      { ok: false, message: "Configuração indisponível." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { ok: false, message: "Acesso não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
  if (!canUseMenuImport(user.email)) {
    return NextResponse.json(
      { ok: false, message: MENU_IMPORT_FORBIDDEN_MESSAGE },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const { data: jobRow, error: jobError } = await serviceClient
    .from("menu_import_jobs")
    .select(
      "id, status, menu_version_id, storage_bucket, storage_path, storage_mime, storage_pages"
    )
    .eq("status", "processing")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    console.error("[admin/menu-import/processor] failed to load pending job", {
      message: jobError.message,
      code: jobError.code,
    });
    return NextResponse.json(
      { ok: false, message: "Falha ao carregar processamento." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  if (!jobRow) {
    return NextResponse.json(
      { ok: true, processed: false },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }

  if (!jobRow.menu_version_id) {
    await failJob(serviceClient, jobRow.id, "Job sem rascunho vinculado.");
    return NextResponse.json(
      { ok: true, processed: true, status: "failed" },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }

  const pages = normalizeStoragePages(jobRow.storage_pages, {
    bucket: jobRow.storage_bucket,
    path: jobRow.storage_path,
    mime: jobRow.storage_mime,
  });

  if (pages.length === 0) {
    await failJob(serviceClient, jobRow.id, "Job sem páginas válidas para extração.");
    await updateDraftFailure(serviceClient, jobRow.menu_version_id, "Nenhuma página válida encontrada.");
    return NextResponse.json(
      { ok: true, processed: true, status: "failed" },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const imagesForExtraction = [];
    for (const page of pages) {
      const { data, error } = await serviceClient.storage.from(page.bucket).download(page.path);
      if (error || !data) {
        throw new Error(`Falha ao baixar página ${page.page}.`);
      }
      const buffer = new Uint8Array(await data.arrayBuffer());
      imagesForExtraction.push({
        mimeType: page.mime,
        imageBase64: Buffer.from(buffer).toString("base64"),
      });
    }

    const extracted = await extractMenuFromImageWithOpenAi({ images: imagesForExtraction });
    const extractionIssues = [...extracted.issues];
    const finalStatus: "ready" | "ready_with_issues" =
      extracted.menuItems.length > 0 ? "ready" : "ready_with_issues";

    if (extracted.menuItems.length === 0) {
      extractionIssues.push("Nenhum item válido foi identificado automaticamente.");
    }

    await serviceClient
      .from("menu_versions")
      .update({
        data: extracted.menuItems as unknown as Json,
        extraction_issues: extractionIssues,
        notes: null,
      })
      .eq("id", jobRow.menu_version_id);

    await serviceClient
      .from("menu_import_jobs")
      .update({
        status: finalStatus,
        error_message: finalStatus === "ready_with_issues" ? "Extração concluída com pendências." : null,
      })
      .eq("id", jobRow.id);

    return NextResponse.json(
      { ok: true, processed: true, status: finalStatus },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha inesperada durante extração.";
    console.error("[admin/menu-import/processor] extraction failed", {
      jobId: jobRow.id,
      message: errorMessage,
    });

    await updateDraftFailure(serviceClient, jobRow.menu_version_id, errorMessage);
    await failJob(serviceClient, jobRow.id, errorMessage);

    return NextResponse.json(
      { ok: true, processed: true, status: "failed" },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }
}

async function failJob(
  serviceClient: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  jobId: string,
  message: string
) {
  await serviceClient
    .from("menu_import_jobs")
    .update({
      status: "failed",
      error_message: message,
    })
    .eq("id", jobId);
}

async function updateDraftFailure(
  serviceClient: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  versionId: string,
  message: string
) {
  await serviceClient
    .from("menu_versions")
    .update({
      data: [] as Json,
      extraction_issues: ["Falha na extração."],
      notes: message,
    })
    .eq("id", versionId);
}

function normalizeStoragePages(
  value: unknown,
  fallback: { bucket: string; path: string; mime: string }
): StoragePage[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback.path
      ? [{ page: 1, bucket: fallback.bucket, path: fallback.path, mime: fallback.mime }]
      : [];
  }

  const pages = value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const bucket = stringFrom(row.bucket) ?? fallback.bucket;
      const path = stringFrom(row.path);
      const mime = stringFrom(row.mime) ?? "image/jpeg";
      const page = numberFrom(row.page) ?? index + 1;
      if (!bucket || !path || !mime) return null;
      return {
        page,
        bucket,
        path,
        mime,
      };
    })
    .filter((page): page is StoragePage => page !== null)
    .sort((a, b) => a.page - b.page);

  return pages;
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
