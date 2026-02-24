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

describe("parseAdminOrder total amount display", () => {
  it("computes total from persisted item/extras pricing snapshots and formats pt-BR currency", () => {
    const order = parseAdminOrder({
      id: "3",
      reference: "PED-0003",
      customer_name: "Carlos",
      customer_email: "carlos@example.com",
      customer_phone: "11777777777",
      status: "aguardando_confirmacao",
      items: [
        {
          name: "X-Burger",
          quantity: 2,
          unitPriceCents: 2500,
          extras: [{ id: "bacon", name: "Bacon", priceCents: 400 }],
        },
        {
          name: "Refrigerante",
          quantity: 1,
          unitPriceCents: 700,
          lineTotalCents: 700,
        },
      ],
    });

    expect(order).not.toBeNull();
    expect(order?.totalAmountCents).toBe(6500);
    expect(order?.totalAmountLabel).toBe("R$ 65,00");
  });

  it("returns total indisponível for legacy items without pricing snapshots", () => {
    const order = parseAdminOrder({
      id: "4",
      reference: "PED-0004",
      customer_name: "Dani",
      customer_email: "dani@example.com",
      customer_phone: "11666666666",
      status: "em_preparo",
      items: [{ name: "X-Salada", quantity: 1 }],
    });

    expect(order).not.toBeNull();
    expect(order?.totalAmountCents).toBeNull();
    expect(order?.totalAmountLabel).toBe("Indisponível");
  });

  it("returns total indisponível when any selected extra lacks price snapshot", () => {
    const order = parseAdminOrder({
      id: "5",
      reference: "PED-0005",
      customer_name: "Eva",
      customer_email: "eva@example.com",
      customer_phone: "11555555555",
      status: "entregue",
      items: [
        {
          name: "X-Tudo",
          quantity: 1,
          unitPriceCents: 3200,
          extras: [{ id: "queijo", name: "Queijo extra" }],
        },
      ],
    });

    expect(order).not.toBeNull();
    expect(order?.totalAmountCents).toBeNull();
    expect(order?.totalAmountLabel).toBe("Indisponível");
  });

  it("returns total indisponível for malformed negative pricing snapshots", () => {
    const order = parseAdminOrder({
      id: "6",
      reference: "PED-0006",
      customer_name: "Fabi",
      customer_email: "fabi@example.com",
      customer_phone: "11444444444",
      status: "aguardando_confirmacao",
      items: [
        {
          name: "X-Burger",
          quantity: 1,
          unitPriceCents: -100,
        },
      ],
    });

    expect(order).not.toBeNull();
    expect(order?.totalAmountCents).toBeNull();
    expect(order?.totalAmountLabel).toBe("Indisponível");
  });

  it("returns total indisponível for implausibly large pricing snapshots", () => {
    const order = parseAdminOrder({
      id: "7",
      reference: "PED-0007",
      customer_name: "Gabi",
      customer_email: "gabi@example.com",
      customer_phone: "11333333333",
      status: "aguardando_confirmacao",
      items: [
        {
          name: "X-Tudo",
          quantity: 1,
          lineTotalCents: 99_999_999,
        },
      ],
    });

    expect(order).not.toBeNull();
    expect(order?.totalAmountCents).toBeNull();
    expect(order?.totalAmountLabel).toBe("Indisponível");
  });
});
