import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AdminPage from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/orders", () => ({
  parseAdminOrders: vi.fn((rows: unknown[]) => rows),
}));

vi.mock("@/components/admin-orders-dashboard", () => ({
  AdminOrdersDashboard: ({
    initialOrders,
    initialLoadError,
  }: {
    initialOrders: unknown[];
    initialLoadError?: string | null;
  }) => (
    <div>
      <div data-testid="orders-count">{initialOrders.length}</div>
      <div data-testid="load-error">{initialLoadError ?? ""}</div>
    </div>
  ),
}));

import { createClient } from "@/lib/supabase/server";
import { parseAdminOrders } from "@/lib/orders";

describe("AdminPage (Employee Orders Dashboard)", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(parseAdminOrders).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows setup message when Supabase is not configured (brief: env/setup resilience)", async () => {
    vi.mocked(createClient).mockResolvedValue(null);

    render(await AdminPage());

    expect(
      screen.getByText(/Configure as variáveis NEXT_PUBLIC_SUPABASE_URL/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao cardápio" })).toBeInTheDocument();
  });

  it("loads orders with explicit columns and oldest->newest ordering (brief: oldest to newest)", async () => {
    const orderSpy = vi.fn().mockResolvedValue({
      data: [{ id: "1" }, { id: "2" }],
      error: null,
    });
    const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
    const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

    vi.mocked(createClient).mockResolvedValue({
      from: fromSpy,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    render(await AdminPage());

    expect(fromSpy).toHaveBeenCalledWith("orders");
    expect(selectSpy).toHaveBeenCalledWith(
      "id, reference, customer_name, customer_email, customer_phone, items, status, notes, created_at"
    );
    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(parseAdminOrders).toHaveBeenCalledWith([{ id: "1" }, { id: "2" }]);
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
  });

  it("passes Portuguese load error state to dashboard when orders query fails (brief: orders load fails)", async () => {
    const orderSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom", code: "500" },
    });
    const selectSpy = vi.fn().mockReturnValue({ order: orderSpy });
    const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

    vi.mocked(createClient).mockResolvedValue({
      from: fromSpy,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    render(await AdminPage());

    expect(screen.getAllByTestId("orders-count").at(-1)).toHaveTextContent("0");
    expect(screen.getAllByTestId("load-error").at(-1)).toHaveTextContent(
      "Não foi possível carregar os pedidos agora. Tente novamente em instantes."
    );
  });
});
