import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/privileged-client", () => ({
  createPrivilegedClient: vi.fn(),
}));

vi.mock("@/lib/request-client", () => ({
  createRequestClient: vi.fn(),
}));

vi.mock("@/lib/request-and-privileged-clients", () => ({
  createRequestAndPrivilegedClients: vi.fn(),
}));

import { redirect } from "next/navigation";
import { createPrivilegedClient } from "@/lib/privileged-client";
import { createRequestClient } from "@/lib/request-client";
import { createRequestAndPrivilegedClients } from "@/lib/request-and-privileged-clients";
import { uploadMenuImageAction, publishMenuVersionAction } from "./actions";
import { MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

describe("admin menu import actions access guard", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockReset();
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(createPrivilegedClient).mockReset();
    vi.mocked(createRequestAndPrivilegedClients).mockReset();
    vi.mocked(createPrivilegedClient).mockReturnValue({} as never);
  });

  it("rejects upload action for non-allowlisted user (stage 2: server action guard)", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createRequestClient>>;
    const privilegedClient = {} as never;
    vi.mocked(createRequestClient).mockResolvedValue(authClient);
    vi.mocked(createPrivilegedClient).mockReturnValue(privilegedClient);
    vi.mocked(createRequestAndPrivilegedClients).mockResolvedValue({
      requestClient: authClient,
      privilegedClient,
    } as never);

    const formData = new FormData();
    formData.set("menuImages", new File(["fake"], "menu.jpg", { type: "image/jpeg" }));

    await uploadMenuImageAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      `/admin/cardapio?error=${encodeURIComponent(MENU_IMPORT_FORBIDDEN_MESSAGE)}`
    );
  });

  it("rejects publish action for non-allowlisted user (stage 2: server action guard)", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-2", email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createRequestClient>>;
    const privilegedClient = {} as never;
    vi.mocked(createRequestClient).mockResolvedValue(authClient);
    vi.mocked(createPrivilegedClient).mockReturnValue(privilegedClient);
    vi.mocked(createRequestAndPrivilegedClients).mockResolvedValue({
      requestClient: authClient,
      privilegedClient,
    } as never);

    const formData = new FormData();
    formData.set("versionId", "version-1");

    await publishMenuVersionAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      `/admin/cardapio?error=${encodeURIComponent(MENU_IMPORT_FORBIDDEN_MESSAGE)}`
    );
  });
});
