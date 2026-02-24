import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/actions", () => ({
  submitCustomerOrderWithClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { POST } from "./route";
import { submitCustomerOrderWithClient } from "@/app/actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

describe("POST /api/orders", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        __my_menu_rate_limit_store__?: Map<string, unknown>;
      }
    ).__my_menu_rate_limit_store__ = new Map();
    vi.mocked(submitCustomerOrderWithClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReset();
  });

  it("returns 400 for invalid JSON body (brief: validation/unhappy path)", async () => {
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: "{invalid json",
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "validation",
    });
  });

  it("returns 415 for non-JSON content type (hardening: request format validation)", async () => {
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: "customerName=Ana",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "validation",
    });
  });

  it("returns 503 when service-role client is unavailable (brief: setup resilience)", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "setup",
    });
  });

  it("returns 201 and order reference on success (brief: proper HTTP status codes)", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(submitCustomerOrderWithClient).mockResolvedValue({
      ok: true,
      orderReference: "PED-1234ABCD",
    });

    const body = {
      customerName: "Ana",
      customerEmail: "ana@example.com",
      customerPhone: "11999999999",
      items: [{ menuItemId: "x-burger", quantity: 1 }],
    };

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(submitCustomerOrderWithClient).toHaveBeenCalledWith(body, {});
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      orderReference: "PED-1234ABCD",
    });
  });

  it("maps validation errors to 400 and unexpected errors to 500 (brief: status mapping)", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);

    vi.mocked(submitCustomerOrderWithClient).mockResolvedValueOnce({
      ok: false,
      code: "validation",
      message: "Selecione itens válidos do cardápio para enviar o pedido.",
    });

    let response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({ customerName: "Ana", items: [] }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(response.status).toBe(400);

    vi.mocked(submitCustomerOrderWithClient).mockResolvedValueOnce({
      ok: false,
      code: "unknown",
      message: "Não foi possível enviar seu pedido agora. Tente novamente em instantes.",
    });

    response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({ customerName: "Ana", items: [] }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(response.status).toBe(500);
  });
});
