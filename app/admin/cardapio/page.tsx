import { publishMenuVersionAction, uploadMenuImageAction, discardMenuVersionAction } from "./actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const SETUP_MESSAGE =
  "Configuração indisponível. Verifique SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY.";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminMenuImportPage({ searchParams }: PageProps) {
  const params = searchParams ?? {};
  const feedbackMessage = normalizeQueryParam(params.message);
  const feedbackError = normalizeQueryParam(params.error);

  const serviceClient = createServiceRoleClient();
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
        "id, status, created_at, extraction_issues, image_mime, image_size_bytes, image_pages, import_job_id, notes"
      )
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

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
        <form action={uploadMenuImageAction} className="mt-4 flex flex-col gap-3">
          <input
            type="file"
            name="menuImages"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
            className="block w-full text-sm"
          />
          <button
            type="submit"
            className="inline-flex h-10 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Gerar rascunho
          </button>
        </form>
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
        <h2 className="text-lg font-medium">3. Rascunhos recentes</h2>
        {Array.isArray(draftRows) && draftRows.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {draftRows.map((draft) => {
              const issueCount = Array.isArray(draft.extraction_issues)
                ? draft.extraction_issues.length
                : 0;
              return (
                <li key={draft.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Rascunho {draft.id.slice(0, 8)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado em {formatDateTimePtBr(draft.created_at)}
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
