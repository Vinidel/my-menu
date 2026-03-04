import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { uploadMenuImageAction, publishMenuVersionAction } from "./actions";
import { MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

describe("admin menu import actions access guard", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockReset();
    vi.mocked(createClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
  });

  it("rejects upload action for non-allowlisted user (stage 2: server action guard)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const formData = new FormData();
    formData.set("menuImages", new File(["fake"], "menu.jpg", { type: "image/jpeg" }));

    await uploadMenuImageAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      `/admin/cardapio?error=${encodeURIComponent(MENU_IMPORT_FORBIDDEN_MESSAGE)}`
    );
  });

  it("rejects publish action for non-allowlisted user (stage 2: server action guard)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-2", email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const formData = new FormData();
    formData.set("versionId", "version-1");

    await publishMenuVersionAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      `/admin/cardapio?error=${encodeURIComponent(MENU_IMPORT_FORBIDDEN_MESSAGE)}`
    );
  });
});

