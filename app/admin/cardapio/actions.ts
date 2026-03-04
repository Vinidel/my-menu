"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/supabase/database.types";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

const MENU_IMPORT_BUCKET = (process.env.MENU_IMPORT_BUCKET || "menu-imports").trim();
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES_PER_IMPORT = 5;
const MAX_TOTAL_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

const MESSAGE_PREFIX = "/admin/cardapio?message=";
const ERROR_PREFIX = "/admin/cardapio?error=";

export async function uploadMenuImageAction(formData: FormData) {
  const authClient = await createClient();
  const serviceClient = createServiceRoleClient();

  if (!authClient || !serviceClient) {
    return redirectWithError("Configuração do Supabase indisponível.");
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return redirectWithError("Acesso não autorizado.");
  }
  if (!canUseMenuImport(user.email)) {
    return redirectWithError(MENU_IMPORT_FORBIDDEN_MESSAGE);
  }

  const rawFiles = formData.getAll("menuImages");
  const files = rawFiles.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) {
    return redirectWithError("Selecione ao menos uma imagem válida para importar.");
  }
  if (files.length > MAX_IMAGES_PER_IMPORT) {
    return redirectWithError("Envie no máximo 5 imagens por importação.");
  }

  let totalSize = 0;
  const preparedFiles: Array<{
    index: number;
    file: File;
    mimeType: string;
    safeName: string;
  }> = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const mimeType = file.type.trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return redirectWithError("Formato inválido. Envie JPG, PNG ou WEBP.");
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      return redirectWithError("Imagem muito grande. Limite de 10MB por imagem.");
    }
    totalSize += file.size;
    preparedFiles.push({
      index,
      file,
      mimeType,
      safeName: sanitizeFileName(file.name || `cardapio-${index + 1}`),
    });
  }
  if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    return redirectWithError("Tamanho total excedido. Limite de 25MB por importação.");
  }

  const uploadPrefix = `${user.id}/${Date.now()}`;
  const uploadedPages: Array<{
    page: number;
    bucket: string;
    path: string;
    mime: string;
    sizeBytes: number;
  }> = [];

  for (const prepared of preparedFiles) {
    const bytes = new Uint8Array(await prepared.file.arrayBuffer());
    const storagePath = `${uploadPrefix}/${String(prepared.index + 1).padStart(2, "0")}-${prepared.safeName}`;
    const { error: storageError } = await serviceClient.storage
      .from(MENU_IMPORT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: prepared.mimeType,
        upsert: false,
      });

    if (storageError) {
      console.error("[admin/menu-import] failed to upload source image", {
        message: storageError.message,
        code: storageError.name,
        path: storagePath,
        page: prepared.index + 1,
      });
      return redirectWithError("Não foi possível enviar as imagens agora.");
    }

    uploadedPages.push({
      page: prepared.index + 1,
      bucket: MENU_IMPORT_BUCKET,
      path: storagePath,
      mime: prepared.mimeType,
      sizeBytes: prepared.file.size,
    });
  }

  const firstPage = uploadedPages[0];

  const { data: jobRow, error: jobInsertError } = await serviceClient
    .from("menu_import_jobs")
    .insert({
      created_by: user.id,
      status: "processing",
      storage_bucket: MENU_IMPORT_BUCKET,
      storage_path: firstPage.path,
      storage_mime: firstPage.mime,
      storage_size_bytes: firstPage.sizeBytes,
      storage_pages: uploadedPages.map((page) => ({
        page: page.page,
        bucket: page.bucket,
        path: page.path,
        mime: page.mime,
        sizeBytes: page.sizeBytes,
      })),
    })
    .select("id")
    .single();

  if (jobInsertError || !jobRow?.id) {
    console.error("[admin/menu-import] failed to create import job", {
      message: jobInsertError?.message ?? "missing job id",
      code: jobInsertError?.code,
    });
    return redirectWithError("Não foi possível iniciar a importação agora.");
  }

  const { data: versionRow, error: versionInsertError } = await serviceClient
    .from("menu_versions")
    .insert({
      source: "image_import",
      status: "draft",
      data: [] as Json,
      created_by: user.id,
      import_job_id: jobRow.id,
      image_bucket: MENU_IMPORT_BUCKET,
      image_path: firstPage.path,
      image_mime: firstPage.mime,
      image_size_bytes: firstPage.sizeBytes,
      image_pages: uploadedPages.map((page) => ({
        page: page.page,
        bucket: page.bucket,
        path: page.path,
        mime: page.mime,
        sizeBytes: page.sizeBytes,
      })),
      extraction_provider: "openai_vision",
      extraction_issues: [],
      notes: "Processando extração...",
    })
    .select("id")
    .single();

  if (versionInsertError || !versionRow?.id) {
    console.error("[admin/menu-import] failed to save draft version", {
      jobId: jobRow.id,
      message: versionInsertError?.message ?? "missing version id",
      code: versionInsertError?.code,
    });

    await serviceClient
      .from("menu_import_jobs")
      .update({
        status: "failed",
        error_message: "Falha ao salvar rascunho do cardápio.",
      })
      .eq("id", jobRow.id);

    return redirectWithError("Não foi possível salvar o rascunho extraído.");
  }

  await serviceClient
    .from("menu_import_jobs")
    .update({
      status: "processing",
      menu_version_id: versionRow.id,
      error_message: null,
    })
    .eq("id", jobRow.id);

  revalidatePath("/admin/cardapio");
  return redirectWithMessage("Upload concluído. Processando rascunho...");
}

export async function publishMenuVersionAction(formData: FormData) {
  const authClient = await createClient();
  const serviceClient = createServiceRoleClient();
  if (!authClient || !serviceClient) {
    return redirectWithError("Configuração do Supabase indisponível.");
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return redirectWithError("Acesso não autorizado.");
  }
  if (!canUseMenuImport(user.email)) {
    return redirectWithError(MENU_IMPORT_FORBIDDEN_MESSAGE);
  }

  const versionId = stringFromForm(formData.get("versionId"));
  if (!versionId) {
    return redirectWithError("Versão inválida para publicação.");
  }

  const { data: versionRow, error: versionError } = await serviceClient
    .from("menu_versions")
    .select("id, status, data, import_job_id")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError || !versionRow) {
    return redirectWithError("Rascunho não encontrado.");
  }
  if (versionRow.status !== "draft") {
    return redirectWithError("Somente rascunhos podem ser publicados.");
  }
  if (!Array.isArray(versionRow.data) || versionRow.data.length === 0) {
    return redirectWithError("Rascunho sem itens válidos não pode ser publicado.");
  }

  await serviceClient
    .from("menu_versions")
    .update({ status: "archived" })
    .eq("status", "active");

  const { error: activateError } = await serviceClient
    .from("menu_versions")
    .update({
      status: "active",
      published_by: user.id,
      published_at: new Date().toISOString(),
    })
    .eq("id", versionId);

  if (activateError) {
    console.error("[admin/menu-import] failed to activate version", {
      versionId,
      message: activateError.message,
      code: activateError.code,
    });
    return redirectWithError("Não foi possível publicar o cardápio agora.");
  }

  if (versionRow.import_job_id) {
    await serviceClient
      .from("menu_import_jobs")
      .update({
        status: "published",
        error_message: null,
      })
      .eq("id", versionRow.import_job_id);
  }

  revalidatePath("/");
  revalidatePath("/admin/cardapio");
  return redirectWithMessage("Cardápio publicado com sucesso.");
}

export async function discardMenuVersionAction(formData: FormData) {
  const authClient = await createClient();
  const serviceClient = createServiceRoleClient();
  if (!authClient || !serviceClient) {
    return redirectWithError("Configuração do Supabase indisponível.");
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return redirectWithError("Acesso não autorizado.");
  }
  if (!canUseMenuImport(user.email)) {
    return redirectWithError(MENU_IMPORT_FORBIDDEN_MESSAGE);
  }

  const versionId = stringFromForm(formData.get("versionId"));
  if (!versionId) {
    return redirectWithError("Versão inválida para descarte.");
  }

  const { data: versionRow, error } = await serviceClient
    .from("menu_versions")
    .select("id, status, import_job_id")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !versionRow) {
    return redirectWithError("Rascunho não encontrado.");
  }
  if (versionRow.status !== "draft") {
    return redirectWithError("Apenas rascunhos podem ser descartados.");
  }

  await serviceClient
    .from("menu_versions")
    .update({ status: "archived", notes: "Descartado manualmente no admin." })
    .eq("id", versionId);

  if (versionRow.import_job_id) {
    await serviceClient
      .from("menu_import_jobs")
      .update({ status: "discarded" })
      .eq("id", versionRow.import_job_id);
  }

  revalidatePath("/admin/cardapio");
  return redirectWithMessage("Rascunho descartado.");
}

function sanitizeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "menu-image";
}

function stringFromForm(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function redirectWithMessage(message: string) {
  return redirect(`${MESSAGE_PREFIX}${encodeURIComponent(message)}`);
}

function redirectWithError(error: string) {
  return redirect(`${ERROR_PREFIX}${encodeURIComponent(error)}`);
}
