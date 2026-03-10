import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AdminPage from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/admin-orders-data-access", () => ({
  createAdminOrdersDataAccess: vi.fn(),
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
import { createAdminOrdersDataAccess } from "@/lib/admin-orders-data-access";

describe("AdminPage (Employee Orders Dashboard)", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(createAdminOrdersDataAccess).mockReset();
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

  it("loads orders through the admin/orders data-access boundary (brief: first slice migrated)", async () => {
    const listAdminOrders = vi.fn().mockResolvedValue({
      data: [{ id: "1" }, { id: "2" }],
      error: null,
    });
    const supabase = { from: vi.fn() };

    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createAdminOrdersDataAccess).mockReturnValue({
      listAdminOrders,
    } as never);

    render(await AdminPage());

    expect(createAdminOrdersDataAccess).toHaveBeenCalledWith(supabase);
    expect(listAdminOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("orders-count")).toHaveTextContent("2");
  });

  it("passes Portuguese load error state to dashboard when the data-access lookup fails (brief: orders load fails)", async () => {
    const listAdminOrders = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom", code: "500" },
    });
    const supabase = { from: vi.fn() };

    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createAdminOrdersDataAccess).mockReturnValue({
      listAdminOrders,
    } as never);

    render(await AdminPage());

    expect(createAdminOrdersDataAccess).toHaveBeenCalledWith(supabase);
    expect(screen.getAllByTestId("orders-count").at(-1)).toHaveTextContent("0");
    expect(screen.getAllByTestId("load-error").at(-1)).toHaveTextContent(
      "Não foi possível carregar os pedidos agora. Tente novamente em instantes."
    );
  });
});
