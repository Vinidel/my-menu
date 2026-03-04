import type { Json } from "@/lib/supabase/database.types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { extractMenuFromImageWithOpenAi } from "@/lib/menu-import/extract-openai";

type ServiceClient = NonNullable<ReturnType<typeof createServiceRoleClient>>;

type StoragePage = {
  page: number;
  bucket: string;
  path: string;
  mime: string;
};

export async function processMenuImportJob(
  serviceClient: ServiceClient,
  input: { jobId: string; versionId: string }
): Promise<{ ok: true; status: "ready" | "ready_with_issues" | "failed" | "skipped" }> {
  const { data: jobRow, error: jobError } = await serviceClient
    .from("menu_import_jobs")
    .select(
      "id, status, menu_version_id, storage_bucket, storage_path, storage_mime, storage_pages"
    )
    .eq("id", input.jobId)
    .maybeSingle();

  if (jobError || !jobRow) {
    console.error("[admin/menu-import/processor] failed to load queued job", {
      jobId: input.jobId,
      message: jobError?.message ?? "job not found",
      code: jobError?.code,
    });
    return { ok: true, status: "skipped" };
  }

  if (jobRow.status !== "processing") {
    return { ok: true, status: "skipped" };
  }

  const versionId = jobRow.menu_version_id ?? input.versionId;
  if (!versionId) {
    await failJob(serviceClient, jobRow.id, "Job sem rascunho vinculado.");
    return { ok: true, status: "failed" };
  }

  const pages = normalizeStoragePages(jobRow.storage_pages, {
    bucket: jobRow.storage_bucket,
    path: jobRow.storage_path,
    mime: jobRow.storage_mime,
  });
  if (pages.length === 0) {
    await failJob(serviceClient, jobRow.id, "Job sem páginas válidas para extração.");
    await updateDraftFailure(serviceClient, versionId, "Nenhuma página válida encontrada.");
    return { ok: true, status: "failed" };
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

    const { error: versionUpdateError } = await serviceClient
      .from("menu_versions")
      .update({
        data: extracted.menuItems as unknown as Json,
        extraction_issues: extractionIssues,
        notes: null,
      })
      .eq("id", versionId)
      .eq("status", "draft");

    if (versionUpdateError) {
      await failJob(serviceClient, jobRow.id, "Falha ao salvar extração no rascunho.");
      return { ok: true, status: "failed" };
    }

    await serviceClient
      .from("menu_import_jobs")
      .update({
        status: finalStatus,
        error_message: finalStatus === "ready_with_issues" ? "Extração concluída com pendências." : null,
      })
      .eq("id", jobRow.id)
      .eq("status", "processing");

    return { ok: true, status: finalStatus };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha inesperada durante extração.";
    console.error("[admin/menu-import/processor] extraction failed", {
      jobId: jobRow.id,
      message: errorMessage,
    });

    await updateDraftFailure(serviceClient, versionId, errorMessage);
    await failJob(serviceClient, jobRow.id, errorMessage);

    return { ok: true, status: "failed" };
  }
}

async function failJob(serviceClient: ServiceClient, jobId: string, message: string) {
  await serviceClient
    .from("menu_import_jobs")
    .update({
      status: "failed",
      error_message: message,
    })
    .eq("id", jobId)
    .eq("status", "processing");
}

async function updateDraftFailure(serviceClient: ServiceClient, versionId: string, message: string) {
  await serviceClient
    .from("menu_versions")
    .update({
      data: [] as Json,
      extraction_issues: ["Falha na extração."],
      notes: message,
    })
    .eq("id", versionId)
    .eq("status", "draft");
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
