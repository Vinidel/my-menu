import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/menu-import/extract-openai", () => ({
  extractMenuFromImageWithOpenAi: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { POST } from "./route";
import { MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

describe("POST /api/admin/menu-import/process-next", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
  });

  it("returns 403 for non-allowlisted user (stage 2: processor guard)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: MENU_IMPORT_FORBIDDEN_MESSAGE,
    });
  });
});
