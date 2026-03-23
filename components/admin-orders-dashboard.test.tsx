import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdminOrdersDashboard } from "./admin-orders-dashboard";
import type { AdminOrder } from "@/lib/orders";

vi.mock("@/app/admin/actions", () => ({
  progressOrderStatus: vi.fn(),
  updateOrderDetails: vi.fn(),
}));

import { progressOrderStatus, updateOrderDetails } from "@/app/admin/actions";

function makeOrder(overrides: Partial<AdminOrder>): AdminOrder {
  return {
    id: "1",
    reference: "PED-0001",
    createdAtIso: "2026-02-23T10:00:00.000Z",
    updatedAtIso: "2026-02-23T10:00:00.000Z",
    createdAtLabel: "23/02/2026, 07:00",
    customerName: "Cliente Teste",
    customerEmail: "cliente@example.com",
    customerPhone: "+55 11 99999-9999",
    items: [{ menuItemId: "x-burger", name: "X-Burger", quantity: 1 }],
    status: "aguardando_confirmacao",
    statusLabel: "Esperando confirmação",
    rawStatus: "aguardando_confirmacao",
    notes: null,
    paymentMethod: null,
    paymentMethodLabel: "Não informado",
    fulfillmentType: null,
    fulfillmentTypeLabel: "Não informado",
    deliveryFeeCents: null,
    ...overrides,
  };
}

describe("AdminOrdersDashboard (Employee Orders Dashboard)", () => {
  beforeEach(() => {
    vi.mocked(progressOrderStatus).mockReset();
    vi.mocked(updateOrderDetails).mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows summary counts including pronto para retirada and renders orders in status-first order (brief: dashboard summary/list)", () => {
    const orders = [
      makeOrder({
        id: "1",
        reference: "PED-0001",
        customerName: "Ana",
        status: "aguardando_confirmacao",
        statusLabel: "Esperando confirmação",
      }),
      makeOrder({
        id: "2",
        reference: "PED-0002",
        customerName: "Bruno",
        status: "em_preparo",
        statusLabel: "Em preparo",
        createdAtIso: "2026-02-23T10:10:00.000Z",
        createdAtLabel: "23/02/2026, 07:10",
      }),
      makeOrder({
        id: "3",
        reference: "PED-0003",
        customerName: "Carla",
        status: "pronto_para_retirada",
        statusLabel: "Pronto para retirada",
        createdAtIso: "2026-02-23T10:12:00.000Z",
        createdAtLabel: "23/02/2026, 07:12",
      }),
      makeOrder({
        id: "4",
        reference: "PED-0004",
        customerName: "Dora",
        fulfillmentType: "entrega",
        fulfillmentTypeLabel: "Entrega",
        status: "saiu_para_entrega",
        statusLabel: "Saiu para entrega",
        createdAtIso: "2026-02-23T10:15:00.000Z",
        createdAtLabel: "23/02/2026, 07:15",
      }),
      makeOrder({
        id: "5",
        reference: "PED-0005",
        customerName: "Davi",
        status: "entregue",
        statusLabel: "Entregue",
        createdAtIso: "2026-02-23T10:20:00.000Z",
        createdAtLabel: "23/02/2026, 07:20",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);

    const summary = screen.getByRole("region", {
      name: "Resumo de pedidos por status",
    });
    expect(within(summary).getByText("Esperando confirmação")).toBeInTheDocument();
    expect(within(summary).getByText("Em preparo")).toBeInTheDocument();
    expect(within(summary).getByText("Pronto para retirada")).toBeInTheDocument();
    expect(within(summary).getByText("Saiu para entrega")).toBeInTheDocument();
    expect(within(summary).getByText("Entregue")).toBeInTheDocument();

    const oneCounts = screen.getAllByText("1");
    expect(oneCounts.length).toBeGreaterThanOrEqual(5);

    const listButtons = screen
      .getAllByRole("button")
      .filter((button) =>
      button.textContent?.includes("PED-000")
      )
      .slice(0, orders.length);
    expect(listButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("PED-0001"),
      expect.stringContaining("PED-0002"),
      expect.stringContaining("PED-0003"),
      expect.stringContaining("PED-0004"),
      expect.stringContaining("PED-0005"),
    ]);
  });

  it("uses status-matching colors in summary cards (brief: status color alignment)", () => {
    const orders = [
      makeOrder({
        id: "1",
        status: "aguardando_confirmacao",
        statusLabel: "Esperando confirmação",
      }),
      makeOrder({
        id: "2",
        status: "em_preparo",
        statusLabel: "Em preparo",
        createdAtIso: "2026-02-23T10:10:00.000Z",
      }),
      makeOrder({
        id: "3",
        status: "pronto_para_retirada",
        statusLabel: "Pronto para retirada",
        createdAtIso: "2026-02-23T10:12:00.000Z",
      }),
      makeOrder({
        id: "4",
        fulfillmentType: "entrega",
        fulfillmentTypeLabel: "Entrega",
        status: "saiu_para_entrega",
        statusLabel: "Saiu para entrega",
        createdAtIso: "2026-02-23T10:15:00.000Z",
      }),
      makeOrder({
        id: "5",
        status: "entregue",
        statusLabel: "Entregue",
        createdAtIso: "2026-02-23T10:20:00.000Z",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);

    const summary = screen.getByRole("region", {
      name: "Resumo de pedidos por status",
    });
    const aguardandoCard = within(summary).getByText("Esperando confirmação").closest("div");
    const preparoCard = within(summary).getByText("Em preparo").closest("div");
    const pickupReadyCard = within(summary).getByText("Pronto para retirada").closest("div");
    const saiuEntregaCard = within(summary).getByText("Saiu para entrega").closest("div");
    const entregueCard = within(summary).getByText("Entregue").closest("div");

    expect(aguardandoCard?.className).toContain("border-amber-300");
    expect(aguardandoCard?.className).toContain("bg-amber-50/80");
    expect(preparoCard?.className).toContain("border-blue-300");
    expect(preparoCard?.className).toContain("bg-blue-50/80");
    expect(pickupReadyCard?.className).toContain("border-cyan-300");
    expect(pickupReadyCard?.className).toContain("bg-cyan-50/80");
    expect(saiuEntregaCard?.className).toContain("border-orange-300");
    expect(saiuEntregaCard?.className).toContain("bg-orange-50/80");
    expect(entregueCard?.className).toContain("border-green-300");
    expect(entregueCard?.className).toContain("bg-green-50/80");
  });

  it("renders orders by status priority first and oldest first within each status, including pronto_para_retirada and saiu_para_entrega (brief: status-first sorting)", () => {
    const orders = [
      makeOrder({
        id: "delivered-old",
        reference: "PED-0005",
        status: "entregue",
        statusLabel: "Entregue",
        createdAtIso: "2026-02-23T10:00:00.000Z",
        createdAtLabel: "23/02/2026, 07:00",
      }),
      makeOrder({
        id: "prep-newer",
        reference: "PED-0002",
        status: "em_preparo",
        statusLabel: "Em preparo",
        createdAtIso: "2026-02-23T10:15:00.000Z",
        createdAtLabel: "23/02/2026, 07:15",
      }),
      makeOrder({
        id: "pickup-ready",
        reference: "PED-0003",
        status: "pronto_para_retirada",
        statusLabel: "Pronto para retirada",
        createdAtIso: "2026-02-23T10:18:00.000Z",
        createdAtLabel: "23/02/2026, 07:18",
      }),
      makeOrder({
        id: "delivery-en-route",
        reference: "PED-0004",
        fulfillmentType: "entrega",
        fulfillmentTypeLabel: "Entrega",
        status: "saiu_para_entrega",
        statusLabel: "Saiu para entrega",
        createdAtIso: "2026-02-23T10:19:00.000Z",
        createdAtLabel: "23/02/2026, 07:19",
      }),
      makeOrder({
        id: "waiting-newer",
        reference: "PED-0006",
        status: "aguardando_confirmacao",
        statusLabel: "Esperando confirmação",
        createdAtIso: "2026-02-23T10:20:00.000Z",
        createdAtLabel: "23/02/2026, 07:20",
      }),
      makeOrder({
        id: "waiting-older",
        reference: "PED-0001",
        status: "aguardando_confirmacao",
        statusLabel: "Esperando confirmação",
        createdAtIso: "2026-02-23T09:50:00.000Z",
        createdAtLabel: "23/02/2026, 06:50",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);

    const ordersSection = screen.getByRole("heading", { level: 1, name: "Pedidos" }).closest("section");
    expect(ordersSection).toBeTruthy();
    const listButtons = Array.from(
      ordersSection!.querySelectorAll<HTMLButtonElement>("ul > li > button")
    ).slice(0, orders.length);

    expect(listButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("PED-0001"),
      expect.stringContaining("PED-0006"),
      expect.stringContaining("PED-0002"),
      expect.stringContaining("PED-0003"),
      expect.stringContaining("PED-0004"),
      expect.stringContaining("PED-0005"),
    ]);
  });

  it("shows the new pickup status label in list and details for pickup-ready orders (brief: status labels)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "pickup-row",
            reference: "PED-RETIRA",
            fulfillmentType: "retirada",
            fulfillmentTypeLabel: "Retirada",
            status: "pronto_para_retirada",
            statusLabel: "Pronto para retirada",
          }),
        ]}
      />
    );

    expect(screen.getAllByText("Pronto para retirada").length).toBeGreaterThan(1);
    expect(screen.getByText("Próximo status: Entregue")).toBeInTheDocument();
  });

  it("places unknown statuses after known statuses with oldest-first fallback ordering (brief: unknown fallback ordering)", () => {
    const orders = [
      makeOrder({
        id: "unknown-newer",
        reference: "PED-9992",
        status: null,
        statusLabel: "cancelado_legacy",
        rawStatus: "cancelado_legacy",
        createdAtIso: "2026-02-23T10:20:00.000Z",
        createdAtLabel: "23/02/2026, 07:20",
      }),
      makeOrder({
        id: "known",
        reference: "PED-0001",
        status: "entregue",
        statusLabel: "Entregue",
        createdAtIso: "2026-02-23T09:50:00.000Z",
        createdAtLabel: "23/02/2026, 06:50",
      }),
      makeOrder({
        id: "unknown-older",
        reference: "PED-9991",
        status: null,
        statusLabel: "arquivado",
        rawStatus: "arquivado",
        createdAtIso: "2026-02-23T10:10:00.000Z",
        createdAtLabel: "23/02/2026, 07:10",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);

    const listButtons = screen.getAllByRole("button").filter((button) =>
      button.textContent?.includes("PED-")
    );

    expect(listButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("PED-0001"),
      expect.stringContaining("PED-9991"),
      expect.stringContaining("PED-9992"),
    ]);
  });

  it("shows details for clicked order (brief: open order and see details)", () => {
    const orders = [
      makeOrder({
        id: "1",
        reference: "PED-0001",
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "1111",
        items: [{ name: "X-Burger", quantity: 2 }],
      }),
      makeOrder({
        id: "2",
        reference: "PED-0002",
        customerName: "Bruno",
        customerEmail: "bruno@example.com",
        customerPhone: "2222",
        items: [{ name: "Batata frita", quantity: 1 }],
        createdAtIso: "2026-02-23T10:10:00.000Z",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);
    const orderButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.includes("PED-0002"));
    fireEvent.click(orderButtons[0]);

    const detailHeading = screen.getByRole("heading", { level: 2, name: "PED-0002" });
    expect(detailHeading).toBeInTheDocument();
    const detailsPanel = detailHeading.closest("section");
    expect(detailsPanel).toBeTruthy();
    const details = within(detailsPanel!);
    expect(details.getByText("Bruno")).toBeInTheDocument();
    expect(details.getByText("2222")).toBeInTheDocument();
    expect(details.getByText("bruno@example.com")).toBeInTheDocument();
    expect(details.getByText("Batata frita")).toBeInTheDocument();
    expect(details.getByText("1x")).toBeInTheDocument();
  });

  it("renders extras in order details when present (brief: admin extras display)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            items: [
              {
                name: "X-Burger",
                quantity: 1,
                extras: [
                  { id: "bacon-extra", name: "Bacon extra" },
                  { id: "queijo-extra", name: "Queijo extra" },
                ],
              },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("X-Burger")).toBeInTheDocument();
    expect(screen.getByText(/Extras:/)).toBeInTheDocument();
    expect(screen.getByText(/Bacon extra, Queijo extra/)).toBeInTheDocument();
  });

  it("renders removed ingredients in order details when present (brief: admin removals display)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            items: [
              {
                name: "X-Burger",
                quantity: 1,
                removedIngredients: [
                  { id: "alface", name: "Alface" },
                  { id: "tomate", name: "Tomate" },
                ],
              },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("X-Burger")).toBeInTheDocument();
    expect(screen.getByText(/Sem:/)).toBeInTheDocument();
    expect(screen.getByText(/Alface, Tomate/)).toBeInTheDocument();
  });

  it("renders payment method label in admin order details for new orders (brief: payment method display)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            paymentMethod: "pix",
            paymentMethodLabel: "Pix",
          }),
        ]}
      />
    );

    expect(screen.getByText("Forma de pagamento")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
  });

  it("renders fulfillment type label in admin order details for new delivery orders (brief: fulfillment display)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            fulfillmentType: "entrega",
            fulfillmentTypeLabel: "Entrega",
            deliveryFeeCents: 500,
          }),
        ]}
      />
    );

    expect(screen.getByText("Tipo de entrega")).toBeInTheDocument();
    expect(screen.getByText("Entrega")).toBeInTheDocument();
  });

  it("renders fulfillment fallback in admin order details for legacy orders (brief: legacy fulfillment fallback)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            fulfillmentType: null,
            fulfillmentTypeLabel: "Não informado",
            deliveryFeeCents: null,
          }),
        ]}
      />
    );

    expect(screen.getByText("Tipo de entrega")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThanOrEqual(1);
  });

  it("renders payment method fallback in admin order details for legacy/unknown values (brief: payment method fallback)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            paymentMethod: null,
            paymentMethodLabel: "Não informado",
          }),
        ]}
      />
    );

    expect(screen.getByText("Forma de pagamento")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThanOrEqual(1);
  });

  it("renders payment method fallback for unknown stored DB values in admin details (brief: unknown DB value fallback)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            rawStatus: "aguardando_confirmacao",
            paymentMethod: null,
            paymentMethodLabel: "Não informado",
          }),
        ]}
      />
    );

    expect(screen.getByText("Forma de pagamento")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Total do pedido' in admin order details when pricing snapshots are available (brief: total display)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
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
            totalAmountCents: 6500,
            totalAmountLabel: "R$ 65,00",
          }),
        ]}
      />
    );

    expect(screen.getByText("Total do pedido")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*65,00/)).toBeInTheDocument();
  });

  it("renders 'Indisponível' total fallback in admin order details for legacy pricing data (brief: total fallback)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            items: [{ name: "X-Burger", quantity: 1 }],
            totalAmountCents: null,
            totalAmountLabel: "Indisponível",
          }),
        ]}
      />
    );

    expect(screen.getByText("Total do pedido")).toBeInTheDocument();
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
  });

  it("uses single-expand accordion behavior on mobile viewport (brief: mobile accordion)", async () => {
    const restore = mockMobileViewport(true);
    try {
      const orders = [
        makeOrder({ id: "1", reference: "PED-0001", customerName: "Ana" }),
        makeOrder({
          id: "2",
          reference: "PED-0002",
          customerName: "Bruno",
          createdAtIso: "2026-02-23T10:10:00.000Z",
          createdAtLabel: "23/02/2026, 07:10",
        }),
      ];

      render(<AdminOrdersDashboard initialOrders={orders} />);

      const firstTrigger = screen.getByRole("button", { name: /PED-0001/i });
      const secondTrigger = screen.getByRole("button", { name: /PED-0002/i });

      expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(firstTrigger);
      expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
      expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
      expect(firstTrigger).toHaveAttribute(
        "aria-controls",
        expect.stringContaining("admin-order-mobile-panel-")
      );
      const firstPanelId = firstTrigger.getAttribute("aria-controls");
      expect(firstPanelId).toBeTruthy();
      const firstPanel = document.getElementById(firstPanelId!);
      expect(firstPanel).toHaveAttribute("role", "region");
      expect(firstPanel).toHaveAttribute("aria-labelledby", firstTrigger.id);
      expect(screen.getAllByText("Próximo status: Em preparo").length).toBeGreaterThan(0);

      fireEvent.click(secondTrigger);
      expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    } finally {
      restore();
    }
  });

  it("shows minimum order details content inside expanded mobile accordion (brief: mobile details content)", () => {
    const restore = mockMobileViewport(true);
    try {
      render(
        <AdminOrdersDashboard
          initialOrders={[
            makeOrder({
              id: "1",
              reference: "PED-0001",
              customerName: "Ana",
              customerPhone: "1111",
              customerEmail: "ana@example.com",
              paymentMethod: "pix",
              paymentMethodLabel: "Pix",
              items: [{ name: "X-Burger", quantity: 2 }],
              status: "aguardando_confirmacao",
              statusLabel: "Esperando confirmação",
            }),
          ]}
        />
      );

      const trigger = screen.getByRole("button", { name: /PED-0001/i });
      fireEvent.click(trigger);

      const expandedRow = trigger.closest("li");
      expect(expandedRow).toBeTruthy();
      const row = within(expandedRow!);

      expect(row.getByText("Cliente")).toBeInTheDocument();
      expect(row.getByText("Nome")).toBeInTheDocument();
      expect(row.getByText("1111")).toBeInTheDocument();
      expect(row.getByText("Telefone")).toBeInTheDocument();
      expect(row.getByText("E-mail")).toBeInTheDocument();
      expect(row.getByText("ana@example.com")).toBeInTheDocument();
      expect(row.getByText("Forma de pagamento")).toBeInTheDocument();
      expect(row.getByText("Pix")).toBeInTheDocument();
      expect(row.getByText("Itens do pedido")).toBeInTheDocument();
      expect(row.getByText("X-Burger")).toBeInTheDocument();
      expect(row.getByText("2x")).toBeInTheDocument();
      expect(row.getByText("Próximo status: Em preparo")).toBeInTheDocument();
      expect(row.getByRole("button", { name: "Avançar status" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("progresses from the mobile accordion and reorders the list by status priority (brief: mobile progress + reorder)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "em_preparo",
      nextStatusLabel: "Em preparo",
    });

    const restore = mockMobileViewport(true);
    try {
      const orders = [
        makeOrder({
          id: "waiting-older",
          reference: "PED-0001",
          status: "aguardando_confirmacao",
          statusLabel: "Esperando confirmação",
          createdAtIso: "2026-02-23T09:50:00.000Z",
          createdAtLabel: "23/02/2026, 06:50",
        }),
        makeOrder({
          id: "prep",
          reference: "PED-0002",
          status: "em_preparo",
          statusLabel: "Em preparo",
          createdAtIso: "2026-02-23T10:10:00.000Z",
          createdAtLabel: "23/02/2026, 07:10",
        }),
        makeOrder({
          id: "waiting-newer",
          reference: "PED-0003",
          status: "aguardando_confirmacao",
          statusLabel: "Esperando confirmação",
          createdAtIso: "2026-02-23T10:20:00.000Z",
          createdAtLabel: "23/02/2026, 07:20",
        }),
      ];

      render(<AdminOrdersDashboard initialOrders={orders} />);

      fireEvent.click(screen.getByRole("button", { name: /PED-0001/i }));
      const expandedOrderRow = screen.getByRole("button", { name: /PED-0001/i }).closest("li");
      expect(expandedOrderRow).toBeTruthy();
      fireEvent.click(within(expandedOrderRow!).getByRole("button", { name: "Avançar status" }));

      await waitFor(() => {
        expect(progressOrderStatus).toHaveBeenCalledWith({
          orderId: "waiting-older",
          currentStatus: "aguardando_confirmacao",
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Pedido atualizado para Em preparo.")).toBeInTheDocument();
      });

      const listButtons = screen.getAllByRole("button").filter((button) =>
        button.textContent?.includes("PED-000")
      );
      expect(listButtons.map((button) => button.textContent)).toEqual([
        expect.stringContaining("PED-0003"),
        expect.stringContaining("PED-0001"),
        expect.stringContaining("PED-0002"),
      ]);
    } finally {
      restore();
    }
  });

  it("progresses status and updates summary counts (brief: progress waiting->preparing)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "em_preparo",
      nextStatusLabel: "Em preparo",
    });

    const orders = [
      makeOrder({
        id: "1",
        reference: "PED-0001",
        status: "aguardando_confirmacao",
        statusLabel: "Esperando confirmação",
      }),
      makeOrder({
        id: "2",
        reference: "PED-0002",
        status: "em_preparo",
        statusLabel: "Em preparo",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

    await waitFor(() => {
      expect(progressOrderStatus).toHaveBeenCalledWith({
        orderId: "1",
        currentStatus: "aguardando_confirmacao",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Pedido atualizado para Em preparo.")).toBeInTheDocument();
    });

    const summary = screen.getByRole("region", {
      name: "Resumo de pedidos por status",
    });
    expect(within(summary).getAllByText("0").length).toBeGreaterThanOrEqual(2);
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Próximo status: Pronto para retirada")).toBeInTheDocument();
  });

  it("progresses pickup status from preparing to pronto para retirada and updates summary counts (brief: progress preparing->pickup ready)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "pronto_para_retirada",
      nextStatusLabel: "Pronto para retirada",
    });

    const orders = [
      makeOrder({
        id: "1",
        reference: "PED-0001",
        status: "em_preparo",
        statusLabel: "Em preparo",
      }),
      makeOrder({
        id: "2",
        reference: "PED-0002",
        status: "pronto_para_retirada",
        statusLabel: "Pronto para retirada",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

    await waitFor(() => {
      expect(progressOrderStatus).toHaveBeenCalledWith({
        orderId: "1",
        currentStatus: "em_preparo",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Pedido atualizado para Pronto para retirada.")).toBeInTheDocument();
    });

    const summary = screen.getByRole("region", {
      name: "Resumo de pedidos por status",
    });
    const pickupSummaryCard = within(summary)
      .getByText("Pronto para retirada")
      .closest("div");
    expect(pickupSummaryCard).toHaveTextContent("2");
    expect(screen.getByText("Próximo status: Entregue")).toBeInTheDocument();
  });

  it("progresses pickup status from pronto para retirada to entregue and disables further progression (brief: pickup completion)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "entregue",
      nextStatusLabel: "Entregue",
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "pickup-final",
            reference: "PED-0001",
            fulfillmentType: "retirada",
            fulfillmentTypeLabel: "Retirada",
            status: "pronto_para_retirada",
            statusLabel: "Pronto para retirada",
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Avançar status" }));

    await waitFor(() => {
      expect(progressOrderStatus).toHaveBeenCalledWith({
        orderId: "pickup-final",
        currentStatus: "pronto_para_retirada",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Pedido atualizado para Entregue.")).toBeInTheDocument();
    });

    expect(screen.getByText("Este pedido não pode avançar mais.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sem próxima etapa" })).toBeDisabled();
  });

  it("progresses delivery status from preparing to saiu para entrega and updates summary counts (brief: delivery out-for-delivery step)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "saiu_para_entrega",
      nextStatusLabel: "Saiu para entrega",
    });

    const orders = [
      makeOrder({
        id: "delivery-1",
        reference: "PED-0001",
        fulfillmentType: "entrega",
        fulfillmentTypeLabel: "Entrega",
        status: "em_preparo",
        statusLabel: "Em preparo",
      }),
      makeOrder({
        id: "delivery-2",
        reference: "PED-0002",
        fulfillmentType: "entrega",
        fulfillmentTypeLabel: "Entrega",
        status: "saiu_para_entrega",
        statusLabel: "Saiu para entrega",
      }),
    ];

    render(<AdminOrdersDashboard initialOrders={orders} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

    await waitFor(() => {
      expect(progressOrderStatus).toHaveBeenCalledWith({
        orderId: "delivery-1",
        currentStatus: "em_preparo",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Pedido atualizado para Saiu para entrega.")).toBeInTheDocument();
    });

    const summary = screen.getByRole("region", {
      name: "Resumo de pedidos por status",
    });
    const deliverySummaryCard = within(summary)
      .getByText("Saiu para entrega")
      .closest("div");
    expect(deliverySummaryCard).toHaveTextContent("2");
    expect(screen.getByText("Próximo status: Entregue")).toBeInTheDocument();
  });

  it("progresses delivery status from saiu para entrega to entregue and disables further progression (brief: delivery completion)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "entregue",
      nextStatusLabel: "Entregue",
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "delivery-final",
            reference: "PED-0001",
            fulfillmentType: "entrega",
            fulfillmentTypeLabel: "Entrega",
            status: "saiu_para_entrega",
            statusLabel: "Saiu para entrega",
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Avançar status" }));

    await waitFor(() => {
      expect(progressOrderStatus).toHaveBeenCalledWith({
        orderId: "delivery-final",
        currentStatus: "saiu_para_entrega",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Pedido atualizado para Entregue.")).toBeInTheDocument();
    });

    expect(screen.getByText("Este pedido não pode avançar mais.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sem próxima etapa" })).toBeDisabled();
  });

  it("shows error and preserves status on update failure (brief: status update fails)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: false,
      code: "unknown",
      message: "Não foi possível atualizar o status do pedido.",
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            status: "em_preparo",
            statusLabel: "Em preparo",
          }),
        ]}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível atualizar o status do pedido.")
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Em preparo").length).toBeGreaterThan(0);
    expect(screen.getByText("Próximo status: Pronto para retirada")).toBeInTheDocument();
  });

  it("preserves the delivery-only next step when a delivery update fails (brief: delivery status update fails)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: false,
      code: "unknown",
      message: "Não foi possível atualizar o status do pedido.",
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "delivery-fail",
            fulfillmentType: "entrega",
            fulfillmentTypeLabel: "Entrega",
            status: "em_preparo",
            statusLabel: "Em preparo",
          }),
        ]}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível atualizar o status do pedido.")
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Em preparo").length).toBeGreaterThan(0);
    expect(screen.getByText("Próximo status: Saiu para entrega")).toBeInTheDocument();
  });

  it("shows stale update message and refreshes selected order status label (brief: concurrent update rejection)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: false,
      code: "stale",
      message:
        "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual.",
      currentStatus: "entregue",
      currentStatusLabel: "Entregue",
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            reference: "PED-0001",
            status: "em_preparo",
            statusLabel: "Em preparo",
          }),
        ]}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual."
        )
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Entregue").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sem próxima etapa" })).toBeDisabled();
  });

  it("disables progression for delivered orders (brief: disallowed progression)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "3",
            status: "entregue",
            statusLabel: "Entregue",
          }),
        ]}
      />
    );

    const button = screen.getByRole("button", { name: "Sem próxima etapa" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Este pedido não pode avançar mais.")).toBeInTheDocument();
  });

  it("prevents progression for unknown/unsupported status shape (brief: legacy/unknown status)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "legacy-1",
            reference: "PED-LEGADO",
            status: null,
            statusLabel: "cancelado_legacy",
            rawStatus: "cancelado_legacy",
          }),
        ]}
      />
    );

    const button = screen.getByRole("button", { name: "Sem próxima etapa" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Este pedido não pode avançar mais.")).toBeInTheDocument();
    expect(screen.getAllByText("cancelado_legacy").length).toBeGreaterThan(0);
  });

  it("shows empty state in Portuguese (brief: no orders yet)", () => {
    render(<AdminOrdersDashboard initialOrders={[]} />);

    expect(screen.getByText("Nenhum pedido no momento")).toBeInTheDocument();
    expect(
      screen.getByText(/Quando novos pedidos chegarem, eles aparecerão aqui/)
    ).toBeInTheDocument();
  });

  it("shows load error state in Portuguese (brief: orders load fails)", () => {
    render(
      <AdminOrdersDashboard
        initialOrders={[]}
        initialLoadError="Não foi possível carregar os pedidos agora. Tente novamente em instantes."
      />
    );

    expect(screen.getByText("Falha ao carregar pedidos")).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar os pedidos agora. Tente novamente em instantes.")
    ).toBeInTheDocument();
  });

  it("pauses polling while hidden and triggers one immediate refetch on visibility restore (brief: hidden-tab behavior)", async () => {
    vi.useFakeTimers();
    const restoreVisibility = mockDocumentVisibility("visible");
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeJsonResponse({ ok: true, orders: [makeOrder({ id: "1" })] }));
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(
        <AdminOrdersDashboard
          initialOrders={[makeOrder({ id: "1" })]}
          enablePolling
        />
      );

      await flushAsyncWork();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushAsyncWork();
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      setDocumentVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      await flushAsyncWork();
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      setDocumentVisibility("visible");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await flushAsyncWork();
      expect(fetchSpy).toHaveBeenCalledTimes(3);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushAsyncWork();
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    } finally {
      restoreVisibility();
      vi.useRealTimers();
    }
  });

  it("keeps last successful data visible after a background polling failure (brief: background polling failure)", async () => {
    vi.useFakeTimers();
    const restoreVisibility = mockDocumentVisibility("visible");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          orders: [makeOrder({ id: "1", reference: "PED-0001", customerName: "Ana" })],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse(
          { ok: false, message: "falha" },
          { status: 500 }
        )
      );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(
        <AdminOrdersDashboard
          initialOrders={[makeOrder({ id: "1", reference: "PED-0001", customerName: "Ana" })]}
          enablePolling
        />
      );

      await flushAsyncWork();
      expect(screen.getAllByText("PED-0001").length).toBeGreaterThan(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushAsyncWork();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText(
          "Não foi possível atualizar os pedidos automaticamente. Exibindo os últimos dados carregados."
        )
      ).toBeInTheDocument();
      expect(screen.getAllByText("PED-0001").length).toBeGreaterThan(0);
    } finally {
      restoreVisibility();
      vi.useRealTimers();
    }
  });

  it("keeps mobile accordion usable while polling is enabled (brief: mobile polling usability)", async () => {
    vi.useFakeTimers();
    const restoreViewport = mockMobileViewport(true);
    const restoreVisibility = mockDocumentVisibility("visible");
    const fetchSpy = vi.fn().mockResolvedValue(
      makeJsonResponse({
        ok: true,
        orders: [
          makeOrder({ id: "1", reference: "PED-0001", customerName: "Ana" }),
          makeOrder({ id: "2", reference: "PED-0002", customerName: "Bruno" }),
        ],
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(
        <AdminOrdersDashboard
          initialOrders={[
            makeOrder({ id: "1", reference: "PED-0001", customerName: "Ana" }),
            makeOrder({ id: "2", reference: "PED-0002", customerName: "Bruno" }),
          ]}
          enablePolling
        />
      );

      await flushAsyncWork();

      const firstTrigger = screen.getByRole("button", { name: /PED-0001/i });
      const secondTrigger = screen.getByRole("button", { name: /PED-0002/i });

      fireEvent.click(firstTrigger);
      expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
      expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushAsyncWork();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getAllByText("Próximo status: Em preparo").length).toBeGreaterThan(0);
    } finally {
      restoreViewport();
      restoreVisibility();
      vi.useRealTimers();
    }
  });

  it("does not let polling overwrite the local pending state of the order being updated (brief: polling vs mutation conflict)", async () => {
    vi.useFakeTimers();
    const restoreVisibility = mockDocumentVisibility("visible");
    let resolveProgress:
      | ((value: Awaited<ReturnType<typeof progressOrderStatus>>) => void)
      | null = null;

    vi.mocked(progressOrderStatus).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProgress = resolve as typeof resolveProgress;
        })
    );

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          orders: [
            makeOrder({
              id: "1",
              reference: "PED-0001",
              status: "aguardando_confirmacao",
              statusLabel: "Esperando confirmação",
            }),
            makeOrder({
              id: "2",
              reference: "PED-0002",
              status: "aguardando_confirmacao",
              statusLabel: "Esperando confirmação",
            }),
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          orders: [
            makeOrder({
              id: "1",
              reference: "PED-0001",
              status: "aguardando_confirmacao",
              statusLabel: "Esperando confirmação",
            }),
            makeOrder({
              id: "2",
              reference: "PED-0002",
              status: "em_preparo",
              statusLabel: "Em preparo",
            }),
          ],
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(
        <AdminOrdersDashboard
          initialOrders={[
            makeOrder({
              id: "1",
              reference: "PED-0001",
              status: "aguardando_confirmacao",
              statusLabel: "Esperando confirmação",
            }),
            makeOrder({
              id: "2",
              reference: "PED-0002",
              status: "aguardando_confirmacao",
              statusLabel: "Esperando confirmação",
            }),
          ]}
          enablePolling
        />
      );

      await flushAsyncWork();
      fireEvent.click(screen.getAllByRole("button", { name: "Avançar status" }).at(-1)!);

      await flushAsyncWork();
      expect(progressOrderStatus).toHaveBeenCalledWith({
        orderId: "1",
        currentStatus: "aguardando_confirmacao",
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushAsyncWork();
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      expect(screen.getAllByText("Esperando confirmação").length).toBeGreaterThan(1);
      expect(screen.getAllByText("Em preparo").length).toBeGreaterThan(0);

      await act(async () => {
        resolveProgress?.({
          ok: true,
          nextStatus: "em_preparo",
          nextStatusLabel: "Em preparo",
        });
      });
      await flushAsyncWork();

      expect(screen.getAllByText("Em preparo").length).toBeGreaterThan(0);
    } finally {
      restoreVisibility();
      vi.useRealTimers();
    }
  });

  it("saves edited order details and updates the rendered customer/payment fields", async () => {
    vi.mocked(updateOrderDetails).mockResolvedValue({
      ok: true,
      order: makeOrder({
        id: "1",
        customerName: "Ana Editada",
        customerPhone: "11977776666",
        customerEmail: "ana@editada.com",
        paymentMethod: "pix",
        paymentMethodLabel: "Pix",
        notes: "Sem maionese",
        updatedAtIso: "2026-02-23T10:05:00.000Z",
      }),
    });

    render(<AdminOrdersDashboard initialOrders={[makeOrder({ id: "1" })]} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar pedido" }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Editada" },
    });
    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "(11) 97777-6666" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@editada.com" },
    });
    fireEvent.change(screen.getByLabelText("Forma de pagamento"), {
      target: { value: "pix" },
    });
    fireEvent.change(screen.getByLabelText("Observações"), {
      target: { value: "Sem maionese" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateOrderDetails).toHaveBeenCalledWith({
        orderId: "1",
        expectedUpdatedAt: "2026-02-23T10:00:00.000Z",
        customerName: "Ana Editada",
        customerPhone: "(11) 97777-6666",
        customerEmail: "ana@editada.com",
        notes: "Sem maionese",
        paymentMethod: "pix",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      });
    });

    expect(screen.getByText("Dados do pedido atualizados com sucesso.")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Editada").length).toBeGreaterThan(0);
    expect(screen.getByText("Pix")).toBeInTheDocument();
  });

  it("allows removing an item line during edit mode and saves remaining items", async () => {
    vi.mocked(updateOrderDetails).mockResolvedValue({
      ok: true,
      order: makeOrder({
        id: "1",
        items: [{ name: "X-Salada", quantity: 1 }],
        updatedAtIso: "2026-02-23T10:05:00.000Z",
      }),
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            items: [
              { menuItemId: "x-burger", name: "X-Burger", quantity: 1 },
              { menuItemId: "x-salada", name: "X-Salada", quantity: 1 },
            ],
          }),
        ]}
        menuItems={[
          { id: "x-burger", name: "X-Burger", priceCents: 2000 },
          { id: "x-salada", name: "X-Salada", priceCents: 2200 },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar pedido" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateOrderDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "1",
          items: [{ menuItemId: "x-salada", quantity: 1 }],
        })
      );
    });
  });

  it("allows toggling extras and removable ingredients like customer customization", async () => {
    vi.mocked(updateOrderDetails).mockResolvedValue({
      ok: true,
      order: makeOrder({
        id: "1",
        items: [
          {
            menuItemId: "x-burger",
            name: "X-Burger",
            quantity: 1,
            extras: [{ id: "extra-bacon", name: "Bacon", priceCents: 300 }],
            removedIngredients: [{ id: "ingred-cheese", name: "Queijo" }],
          },
        ],
        updatedAtIso: "2026-02-23T10:05:00.000Z",
      }),
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            items: [{ menuItemId: "x-burger", name: "X-Burger", quantity: 1 }],
          }),
        ]}
        menuItems={[
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2000,
            extras: [{ id: "extra-bacon", name: "Bacon", priceCents: 300 }],
            removableIngredients: [{ id: "ingred-cheese", name: "Queijo" }],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar pedido" }));
    fireEvent.click(screen.getByLabelText(/Bacon/));
    fireEvent.click(screen.getByLabelText(/Sem Queijo/));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateOrderDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              menuItemId: "x-burger",
              quantity: 1,
              extraIds: ["extra-bacon"],
              removedIngredientIds: ["ingred-cheese"],
            },
          ],
        })
      );
    });
  });

  it("resolves missing menuItemId by item name so customization stays available", async () => {
    vi.mocked(updateOrderDetails).mockResolvedValue({
      ok: true,
      order: makeOrder({
        id: "1",
        notes: "Atualizado",
        updatedAtIso: "2026-02-23T10:05:00.000Z",
      }),
    });

    render(
      <AdminOrdersDashboard
        initialOrders={[
          makeOrder({
            id: "1",
            items: [{ name: "X-Burger", quantity: 1 }],
          }),
        ]}
        menuItems={[{ id: "x-burger", name: "X-Burger", priceCents: 2000 }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar pedido" }));
    expect(
      screen.queryByText("Personalização indisponível para este item.")
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Observações"), {
      target: { value: "Atualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateOrderDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ menuItemId: "x-burger", quantity: 1 }],
        })
      );
    });
  });

  it("keeps local draft values while editing even when polling receives newer server data", async () => {
    vi.useFakeTimers();
    const restoreVisibility = mockDocumentVisibility("visible");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          orders: [
            makeOrder({
              id: "1",
              customerName: "Nome Servidor",
              customerPhone: "11999999999",
            }),
          ],
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(
        <AdminOrdersDashboard
          initialOrders={[
            makeOrder({
              id: "1",
              customerName: "Nome Inicial",
              customerPhone: "11999999999",
            }),
          ]}
          enablePolling
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Editar pedido" }));
      fireEvent.change(screen.getByLabelText("Nome"), {
        target: { value: "Nome Local Rascunho" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushAsyncWork();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText("Nome")).toHaveValue("Nome Local Rascunho");
    } finally {
      restoreVisibility();
      vi.useRealTimers();
    }
  });
});

function mockMobileViewport(matches: boolean) {
  const original = window.matchMedia;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void
      ) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    })),
  });

  return () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: original,
    });
  };
}

let documentVisibilityState: "visible" | "hidden" = "visible";

function mockDocumentVisibility(initial: "visible" | "hidden") {
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  documentVisibilityState = initial;

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get() {
      return documentVisibilityState;
    },
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(document, "visibilityState", originalDescriptor);
    }
  };
}

function setDocumentVisibility(next: "visible" | "hidden") {
  documentVisibilityState = next;
}

function makeJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}
