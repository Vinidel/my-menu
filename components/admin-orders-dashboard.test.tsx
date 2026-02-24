import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    ...overrides,
  };
}

describe("AdminOrdersDashboard (Employee Orders Dashboard)", () => {
  beforeEach(() => {
    vi.mocked(progressOrderStatus).mockReset();
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
