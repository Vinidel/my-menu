import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-orders-data-access", () => ({
  createSupabaseAdminOrdersDataAccess: vi.fn(),
}));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminOrdersDataAccess } from "@/lib/supabase/admin-orders-data-access";

describe("GET /api/admin/orders", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(createSupabaseAdminOrdersDataAccess).mockReset();
  });

  it("returns 503 when Supabase is not configured (brief: setup resilience)", async () => {
    vi.mocked(createClient).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.",
    });
  });

  it("returns 401 when no authenticated user is available (brief: auth protection)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Acesso não autorizado.",
    });
  });

  it("returns 200 with orders loaded through the admin/orders data-access boundary (brief: first slice migrated)", async () => {
    const listAdminOrders = vi.fn().mockResolvedValue({
      data: [{ id: "parsed-1", reference: "PED-1" }],
      error: null,
    });
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };

    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createSupabaseAdminOrdersDataAccess).mockReturnValue({
      listAdminOrders,
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(createSupabaseAdminOrdersDataAccess).toHaveBeenCalledWith(supabase);
    expect(listAdminOrders).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      orders: [{ id: "parsed-1", reference: "PED-1" }],
    });
  });

  it("returns 500 when the data-access lookup fails (brief: polling request fails)", async () => {
    const listAdminOrders = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom", code: "500" },
    });

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };

    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createSupabaseAdminOrdersDataAccess).mockReturnValue({
      listAdminOrders,
    } as never);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(createSupabaseAdminOrdersDataAccess).toHaveBeenCalledWith(supabase);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Não foi possível carregar os pedidos agora. Tente novamente em instantes.",
    });
  });
});
