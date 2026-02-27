import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/app/actions", () => ({
  submitCustomerOrderWithClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/anti-abuse/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/anti-abuse/rate-limit")>(
    "@/lib/anti-abuse/rate-limit"
  );
  return {
    ...actual,
    consumeFixedWindowRateLimit: vi.fn(actual.consumeFixedWindowRateLimit),
  };
});

import { POST } from "./route";
import { submitCustomerOrderWithClient } from "@/app/actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { consumeFixedWindowRateLimit } from "@/lib/anti-abuse/rate-limit";

describe("POST /api/orders", () => {
  const originalCaptchaToggle = process.env.ORDERS_CAPTCHA_ENABLED;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const originalTurnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        __my_menu_rate_limit_store__?: Map<string, unknown>;
      }
    ).__my_menu_rate_limit_store__ = new Map();
    process.env.ORDERS_CAPTCHA_ENABLED = "false";
    vi.mocked(submitCustomerOrderWithClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReset();
    vi.mocked(consumeFixedWindowRateLimit).mockClear();
  });

  afterEach(() => {
    process.env.ORDERS_CAPTCHA_ENABLED = originalCaptchaToggle;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecretKey;
    vi.restoreAllMocks();
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

  it("returns 429 with Retry-After and does not call order creation when rate limit is exceeded (brief: anti-abuse throttle)", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(submitCustomerOrderWithClient).mockResolvedValue({
      ok: true,
      orderReference: "PED-SHOULD-NOT-HAPPEN",
    });

    const makeRequest = () =>
      POST(
        new Request("http://localhost/api/orders", {
          method: "POST",
          body: JSON.stringify({
            customerName: "Ana",
            customerEmail: "ana@example.com",
            customerPhone: "11999999999",
            items: [{ menuItemId: "x-burger", quantity: 1 }],
          }),
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "203.0.113.10",
          },
        })
      );

    for (let i = 0; i < 5; i += 1) {
      const response = await makeRequest();
      expect(response.status).not.toBe(429);
    }

    const throttled = await makeRequest();
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("Retry-After")).toBeTruthy();
    await expect(throttled.json()).resolves.toMatchObject({
      ok: false,
      code: "validation",
      message: "Muitas tentativas de envio em pouco tempo. Aguarde um instante e tente novamente.",
    });

    expect(submitCustomerOrderWithClient).toHaveBeenCalledTimes(5);
  });

  it("uses the fallback 'unknown' bucket when source IP is missing (brief: missing source IP)", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(submitCustomerOrderWithClient).mockResolvedValue({
      ok: true,
      orderReference: "PED-1234ABCD",
    });

    const request = () =>
      POST(
        new Request("http://localhost/api/orders", {
          method: "POST",
          body: JSON.stringify({
            customerName: "Ana",
            customerEmail: "ana@example.com",
            customerPhone: "11999999999",
            items: [{ menuItemId: "x-burger", quantity: 1 }],
          }),
          headers: { "Content-Type": "application/json" },
        })
      );

    for (let i = 0; i < 5; i += 1) {
      const response = await request();
      expect(response.status).toBe(201);
    }

    const throttled = await request();
    expect(throttled.status).toBe(429);
  });

  it("falls back to the 'unknown' bucket for oversized source header values (hardening: source parsing bounds)", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(submitCustomerOrderWithClient).mockResolvedValue({
      ok: true,
      orderReference: "PED-1234ABCD",
    });

    await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "1".repeat(300),
        },
      })
    );

    expect(consumeFixedWindowRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining("api_orders:unknown"),
      })
    );
  });

  it("degrades open when limiter throws and continues processing the request (brief: limiter unavailable)", async () => {
    vi.mocked(consumeFixedWindowRateLimit).mockImplementationOnce(() => {
      throw new Error("limiter down");
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(submitCustomerOrderWithClient).mockResolvedValue({
      ok: true,
      orderReference: "PED-DEGRADEOPEN",
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(201);
    expect(submitCustomerOrderWithClient).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[customer/orders] rate limiter unavailable; degrading open",
      expect.objectContaining({ route: "/api/orders" })
    );
  });

  it("returns 503 when CAPTCHA is required but Turnstile keys are missing (brief: deterministic setup failure)", async () => {
    process.env.ORDERS_CAPTCHA_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          paymentMethod: "pix",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "setup",
    });
    expect(submitCustomerOrderWithClient).not.toHaveBeenCalled();
  });

  it("returns 400 when CAPTCHA is required and token is missing (brief: token required)", async () => {
    process.env.ORDERS_CAPTCHA_ENABLED = "true";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          paymentMethod: "pix",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(submitCustomerOrderWithClient).not.toHaveBeenCalled();
  });

  it("verifies Turnstile token before submit when CAPTCHA is required (brief: server-side verify gate)", async () => {
    process.env.ORDERS_CAPTCHA_ENABLED = "true";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(submitCustomerOrderWithClient).mockResolvedValue({
      ok: true,
      orderReference: "PED-CAPTCHA1",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = {
      customerName: "Ana",
      customerEmail: "ana@example.com",
      customerPhone: "11999999999",
      paymentMethod: "pix",
      turnstileToken: "token-123",
      items: [{ menuItemId: "x-burger", quantity: 1 }],
    };

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(fetchSpy).toHaveBeenCalled();
    expect(submitCustomerOrderWithClient).toHaveBeenCalledWith(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "pix",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      {}
    );
    expect(response.status).toBe(201);
    fetchSpy.mockRestore();
  });

  it("enforces CAPTCHA in production even when toggle is false (brief: production override)", async () => {
    process.env.NODE_ENV = "production";
    process.env.ORDERS_CAPTCHA_ENABLED = "false";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          paymentMethod: "pix",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(submitCustomerOrderWithClient).not.toHaveBeenCalled();
  });

  it("returns 503 when Turnstile verify service fails (brief: fail closed on upstream errors)", async () => {
    process.env.ORDERS_CAPTCHA_ENABLED = "true";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream unavailable", { status: 503 })
    );

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          paymentMethod: "pix",
          turnstileToken: "token-123",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "setup",
    });
    expect(submitCustomerOrderWithClient).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns 400 when Turnstile verification rejects token (brief: invalid token path)", async () => {
    process.env.ORDERS_CAPTCHA_ENABLED = "true";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ana",
          customerEmail: "ana@example.com",
          customerPhone: "11999999999",
          paymentMethod: "pix",
          turnstileToken: "token-123",
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(submitCustomerOrderWithClient).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
