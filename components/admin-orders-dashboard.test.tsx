import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdminOrdersDashboard } from "./admin-orders-dashboard";
import type { AdminOrder } from "@/lib/orders";

vi.mock("@/app/admin/actions", () => ({
  progressOrderStatus: vi.fn(),
}));

import { progressOrderStatus } from "@/app/admin/actions";

function makeOrder(overrides: Partial<AdminOrder>): AdminOrder {
  return {
    id: "1",
    reference: "PED-0001",
    createdAtIso: "2026-02-23T10:00:00.000Z",
    createdAtLabel: "23/02/2026, 07:00",
    customerName: "Cliente Teste",
    customerEmail: "cliente@example.com",
    customerPhone: "+55 11 99999-9999",
    items: [{ name: "X-Burger", quantity: 1 }],
    status: "aguardando_confirmacao",
    statusLabel: "Esperando confirmação",
    rawStatus: "aguardando_confirmacao",
    notes: null,
    paymentMethod: null,
    paymentMethodLabel: "Não informado",
    ...overrides,
  };
}

describe("AdminOrdersDashboard (Employee Orders Dashboard)", () => {
  beforeEach(() => {
    vi.mocked(progressOrderStatus).mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows summary counts and renders orders in provided oldest->newest order (brief: dashboard summary/list)", () => {
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
    expect(within(summary).getByText("Entregue")).toBeInTheDocument();

    const oneCounts = screen.getAllByText("1");
    expect(oneCounts.length).toBeGreaterThanOrEqual(3);

    const listButtons = screen.getAllByRole("button").filter((button) =>
      button.textContent?.includes("PED-000")
    );
    expect(listButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("PED-0001"),
      expect.stringContaining("PED-0002"),
      expect.stringContaining("PED-0003"),
    ]);
  });

  it("renders orders by status priority first and oldest first within each status (brief: status-first sorting)", () => {
    const orders = [
      makeOrder({
        id: "delivered-old",
        reference: "PED-0003",
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
        id: "waiting-newer",
        reference: "PED-0004",
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

    const listButtons = screen.getAllByRole("button").filter((button) =>
      button.textContent?.includes("PED-000")
    );

    expect(listButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("PED-0001"),
      expect.stringContaining("PED-0004"),
      expect.stringContaining("PED-0002"),
      expect.stringContaining("PED-0003"),
    ]);
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
    expect(screen.getByText("Não informado")).toBeInTheDocument();
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
    expect(screen.getByText("Não informado")).toBeInTheDocument();
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
    expect(screen.getByText("Próximo status: Entregue")).toBeInTheDocument();
  });

  it("progresses status from preparing to delivered and updates summary counts (brief: progress preparing->delivered)", async () => {
    vi.mocked(progressOrderStatus).mockResolvedValue({
      ok: true,
      nextStatus: "entregue",
      nextStatusLabel: "Entregue",
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
        status: "entregue",
        statusLabel: "Entregue",
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
      expect(screen.getByText("Pedido atualizado para Entregue.")).toBeInTheDocument();
    });

    expect(screen.getByText("Este pedido não pode avançar mais.")).toBeInTheDocument();

    const summary = screen.getByRole("region", {
      name: "Resumo de pedidos por status",
    });
    const cards = within(summary).getAllByText(/^(0|2)$/).map((el) => el.textContent);
    expect(cards).toContain("0");
    expect(cards).toContain("2");
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
    expect(screen.getByText("Próximo status: Entregue")).toBeInTheDocument();
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
