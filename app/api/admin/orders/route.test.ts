import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/orders", () => ({
  parseAdminOrders: vi.fn((rows: unknown[]) => rows),
}));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";
import { parseAdminOrders } from "@/lib/orders";

describe("GET /api/admin/orders", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(parseAdminOrders).mockClear();
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

  it("returns 200 with parsed orders for authenticated users (brief: Option A route shape)", async () => {
    const orderSpy = vi.fn().mockResolvedValue({
      data: [{ id: "1", reference: "PED-1" }],
      error: null,
    });
    const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
    const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

    vi.mocked(parseAdminOrders).mockReturnValue([
      { id: "parsed-1", reference: "PED-1" },
    ] as never);

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: fromSpy,
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(fromSpy).toHaveBeenCalledWith("orders");
    expect(selectSpy).toHaveBeenCalledWith(
      "id, reference, customer_name, customer_email, customer_phone, items, status, notes, created_at"
    );
    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(parseAdminOrders).toHaveBeenCalledWith([{ id: "1", reference: "PED-1" }]);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      orders: [{ id: "parsed-1", reference: "PED-1" }],
    });
  });

  it("returns 500 when the orders query fails (brief: polling request fails)", async () => {
    const orderSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom", code: "500" },
    });
    const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
    const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: fromSpy,
    } as never);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Não foi possível carregar os pedidos agora. Tente novamente em instantes.",
    });
  });
});
