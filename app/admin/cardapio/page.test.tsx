import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import AdminMenuImportPage from "./page";

vi.mock("@/lib/app-clients", () => ({
  createRequestClient: vi.fn(),
  createPrivilegedClient: vi.fn(),
  createRequestAndPrivilegedClients: vi.fn(),
}));

vi.mock("./upload-form", () => ({
  UploadMenuForm: () => <div data-testid="upload-menu-form" />,
}));

vi.mock("./processing-poller", () => ({
  ProcessingPoller: ({ hasProcessingDrafts }: { hasProcessingDrafts: boolean }) => (
    <div data-testid="processing-poller">{hasProcessingDrafts ? "on" : "off"}</div>
  ),
}));

import {
  createPrivilegedClient,
  createRequestAndPrivilegedClients,
  createRequestClient,
} from "@/lib/app-clients";

describe("AdminMenuImportPage", () => {
  beforeEach(() => {
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(createPrivilegedClient).mockReset();
    vi.mocked(createRequestAndPrivilegedClients).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("uses explicit FK relationship for import_job select (stage 2: join regression guard)", async () => {
    const selectCalls: string[] = [];
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "vinidroid@gmail.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createRequestClient>>;
    vi.mocked(createRequestClient).mockResolvedValue(authClient);

    const privilegedClient = {
      from: vi.fn().mockImplementation(() => {
        const builder = {
          select: vi.fn((query: string) => {
            selectCalls.push(query);
            return builder;
          }),
          eq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return builder;
      }),
    } as never;
    vi.mocked(createPrivilegedClient).mockReturnValue(privilegedClient);
    vi.mocked(createRequestAndPrivilegedClients).mockResolvedValue({
      requestClient: authClient,
      privilegedClient,
    } as never);

    await AdminMenuImportPage({ searchParams: {} });

    expect(
      selectCalls.some((query) =>
        query.includes("import_job:menu_import_jobs!menu_versions_import_job_id_fkey(status, error_message)")
      )
    ).toBe(true);
  });

  it("hides actions for processing draft and shows actions for ready draft (stage 2: processing UX)", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "vinidroid@gmail.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createRequestClient>>;
    vi.mocked(createRequestClient).mockResolvedValue(authClient);

    const activeRows = [];
    const draftRows = [
      {
        id: "processing-row-12345678",
        status: "draft",
        created_at: new Date().toISOString(),
        extraction_issues: [],
        image_mime: "image/jpeg",
        image_size_bytes: 1234,
        image_pages: [{ page: 1 }],
        import_job_id: "job-1",
        notes: "Processando extração...",
        import_job: { status: "processing", error_message: null },
      },
      {
        id: "ready-row-87654321",
        status: "draft",
        created_at: new Date().toISOString(),
        extraction_issues: [],
        image_mime: "image/jpeg",
        image_size_bytes: 1234,
        image_pages: [{ page: 1 }],
        import_job_id: "job-2",
        notes: null,
        import_job: { status: "ready", error_message: null },
      },
    ];

    const privilegedClient = {
      from: vi.fn().mockImplementation(() => {
        const builder = {
          select: vi.fn((query: string) => {
            if (query.includes("published_at")) {
              builder.limit = vi.fn().mockResolvedValue({ data: activeRows, error: null });
            } else {
              builder.limit = vi.fn().mockResolvedValue({ data: draftRows, error: null });
            }
            return builder;
          }),
          eq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return builder;
      }),
    } as never;
    vi.mocked(createPrivilegedClient).mockReturnValue(privilegedClient);
    vi.mocked(createRequestAndPrivilegedClients).mockResolvedValue({
      requestClient: authClient,
      privilegedClient,
    } as never);

    render(await AdminMenuImportPage({ searchParams: {} }));

    const processingLabel = screen.getByText(/Rascunho processi/i);
    const processingCard = processingLabel.closest("li");
    expect(processingCard).not.toBeNull();
    if (processingCard) {
      expect(within(processingCard).queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument();
      expect(within(processingCard).queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
      expect(within(processingCard).getByText("Processando...")).toBeInTheDocument();
    }

    const readyLabel = screen.getByText(/Rascunho ready-ro/i);
    const readyCard = readyLabel.closest("li");
    expect(readyCard).not.toBeNull();
    if (readyCard) {
      expect(within(readyCard).getByRole("button", { name: "Publicar" })).toBeInTheDocument();
      expect(within(readyCard).getByRole("button", { name: "Descartar" })).toBeInTheDocument();
    }
  });
});
