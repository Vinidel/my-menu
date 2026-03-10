import { publishMenuVersionAction, discardMenuVersionAction } from "./actions";
import { UploadMenuForm } from "./upload-form";
import { ProcessingPoller } from "./processing-poller";
import { createRequestAndPrivilegedClients } from "@/lib/app-clients";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

export const dynamic = "force-dynamic";

const SETUP_MESSAGE =
  "Configuração indisponível. Verifique SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY.";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminMenuImportPage({ searchParams }: PageProps) {
  const params = searchParams ?? {};
  const feedbackMessage = normalizeQueryParam(params.message);
  const feedbackError = normalizeQueryParam(params.error);

  const { requestClient: authClient, privilegedClient: serviceClient } =
    await createRequestAndPrivilegedClients();
  if (!authClient) {
    return renderForbiddenView();
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user || !canUseMenuImport(user.email)) {
    return renderForbiddenView();
  }

  if (!serviceClient) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">Importar cardápio por imagem</h1>
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {SETUP_MESSAGE}
        </p>
      </div>
    );
  }

  const [{ data: activeRows }, { data: draftRows }] = await Promise.all([
    serviceClient
      .from("menu_versions")
      .select("id, created_at, published_at, extraction_issues")
      .eq("status", "active")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1),
    serviceClient
      .from("menu_versions")
      .select(
        "id, status, created_at, extraction_issues, image_mime, image_size_bytes, image_pages, import_job_id, notes, import_job:menu_import_jobs!menu_versions_import_job_id_fkey(status, error_message)"
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const hasProcessingDrafts = Array.isArray(draftRows)
    ? draftRows.some((draft) => draft.import_job?.status === "processing")
    : false;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Importar cardápio por imagem</h1>
        <p className="text-sm text-muted-foreground">
          Envie uma imagem do cardápio. O sistema gera um rascunho para revisão antes da publicação.
        </p>
      </header>

      {feedbackMessage ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {feedbackMessage}
        </p>
      ) : null}
      {feedbackError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {feedbackError}
        </p>
      ) : null}

      <section className="rounded-lg border bg-background p-5">
        <h2 className="text-lg font-medium">1. Upload da imagem</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Formatos aceitos: JPG, PNG, WEBP. Até 5 imagens por envio, 10MB por imagem.
        </p>
        <UploadMenuForm />
      </section>

      <section className="rounded-lg border bg-background p-5">
        <h2 className="text-lg font-medium">2. Cardápio ativo</h2>
        {Array.isArray(activeRows) && activeRows[0] ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Última publicação: {formatDateTimePtBr(activeRows[0].published_at ?? activeRows[0].created_at)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum cardápio ativo no banco. O app usará fallback local (`data/menu.json`).
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-background p-5">
        <h2 className="text-lg font-medium">3. Versões recentes</h2>
        {Array.isArray(draftRows) && draftRows.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {draftRows.map((draft) => {
              const issueCount = Array.isArray(draft.extraction_issues)
                ? draft.extraction_issues.length
                : 0;
              const jobStatus = draft.import_job?.status ?? null;
              const isProcessing = draft.status === "draft" && jobStatus === "processing";
              const statusLabel = labelFromImportStatus(jobStatus);
              const canAct = draft.status === "draft" && !isProcessing;
              return (
                <li key={draft.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Rascunho {draft.id.slice(0, 8)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado em {formatDateTimePtBr(draft.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: {labelFromVersionStatus(draft.status, statusLabel)}{" "}
                    {isProcessing ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        <span
                          aria-hidden
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse"
                        />
                        Processando...
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Issues: {issueCount} | Páginas:{" "}
                    {Array.isArray(draft.image_pages) && draft.image_pages.length > 0
                      ? draft.image_pages.length
                      : 1}{" "}
                    | Arquivo: {draft.image_mime ?? "n/d"}{" "}
                    {typeof draft.image_size_bytes === "number"
                      ? `(${formatBytes(draft.image_size_bytes)})`
                      : ""}
                  </p>
                  {draft.notes ? (
                    <p className="mt-2 text-xs text-amber-700">{draft.notes}</p>
                  ) : null}
                  {canAct ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={publishMenuVersionAction}>
                        <input type="hidden" name="versionId" value={draft.id} />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Publicar
                        </button>
                      </form>
                      <form action={discardMenuVersionAction}>
                        <input type="hidden" name="versionId" value={draft.id} />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent"
                        >
                          Descartar
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum rascunho disponível no momento.
          </p>
        )}
      </section>
      <ProcessingPoller hasProcessingDrafts={hasProcessingDrafts} />
    </div>
  );
}

function normalizeQueryParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.trunc(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTimePtBr(value: string | null): string {
  if (!value) return "Horário indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

const IMPORT_STATUS_LABELS: Record<string, string> = {
  processing: "Processando",
  ready: "Pronto",
  ready_with_issues: "Pronto com pendências",
  failed: "Falhou",
  published: "Publicado",
  discarded: "Descartado",
};

const VERSION_STATUS_LABELS: Record<string, string> = {
  active: "Publicado",
  archived: "Arquivado/Descartado",
};

function labelFromImportStatus(status: string | null): string {
  if (!status) return "Rascunho";
  return IMPORT_STATUS_LABELS[status] ?? status;
}

function labelFromVersionStatus(versionStatus: string, jobStatusLabel: string): string {
  return VERSION_STATUS_LABELS[versionStatus] ?? jobStatusLabel;
}

function renderForbiddenView() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Importar cardápio por imagem</h1>
      <p className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        {MENU_IMPORT_FORBIDDEN_MESSAGE}
      </p>
    </div>
  );
}
