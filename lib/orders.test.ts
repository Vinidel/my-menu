import { describe, expect, it } from "vitest";
import { parseAdminOrder } from "./orders";

describe("parseAdminOrder extras hardening", () => {
  it("limits parsed extras per item and preserves valid names", () => {
    const extras = Array.from({ length: 25 }, (_, index) => ({
      id: `extra-${index + 1}`,
      name: `Extra ${index + 1}`,
    }));

    const order = parseAdminOrder({
      id: "1",
      reference: "PED-0001",
      customer_name: "Ana",
      customer_email: "ana@example.com",
      customer_phone: "11999999999",
      status: "aguardando_confirmacao",
      items: [{ name: "X-Burger", quantity: 1, extras }],
    });

    expect(order).not.toBeNull();
    expect(order?.items[0]?.extras).toHaveLength(20);
    expect(order?.items[0]?.extras?.[0]?.name).toBe("Extra 1");
    expect(order?.items[0]?.extras?.[19]?.name).toBe("Extra 20");
  });

  it("truncates oversized extras name/id values for safe admin rendering", () => {
    const longName = `  ${"B".repeat(160)}  `;
    const longId = `  ${"x".repeat(100)}  `;

    const order = parseAdminOrder({
      id: "2",
      reference: "PED-0002",
      customer_name: "Bruno",
      customer_email: "bruno@example.com",
      customer_phone: "11888888888",
      status: "em_preparo",
      items: [
        {
          name: "X-Salada",
          quantity: 1,
          extras: [{ id: longId, name: longName }],
        },
      ],
    });

    const parsedExtra = order?.items[0]?.extras?.[0];
    expect(parsedExtra).toBeTruthy();
    expect(parsedExtra?.name).toHaveLength(120);
    expect(parsedExtra?.id).toHaveLength(80);
    expect(parsedExtra?.name).toBe("B".repeat(120));
    expect(parsedExtra?.id).toBe("x".repeat(80));
  });
});
