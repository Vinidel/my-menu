import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/menu", () => ({
  getMenuItemMap: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { getMenuItemMap } from "@/lib/menu";
import { submitCustomerOrderWithClient } from "./actions";

type FakeError = { message: string; code?: string | null } | null;

describe("submitCustomerOrderWithClient (extras customization)", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockReset();
    vi.mocked(getMenuItemMap).mockReset();
  });

  it("rejects invalid extra ids for a menu item (brief: tampered extras payload)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            extras: [{ id: "queijo-extra", name: "Queijo extra" }],
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            extraIds: ["bacon-extra"],
          },
        ],
      },
      makeFakeSupabase()
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Selecione itens válidos do cardápio para enviar o pedido.",
    });
  });

  it("persists normalized extras snapshots and merges lines with same extras set (brief: extras merge + snapshot source)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            extras: [
              { id: "bacon-extra", name: "Bacon extra" },
              { id: "queijo-extra", name: "Queijo extra" },
            ],
          },
        ],
      ])
    );

    const supabase = makeFakeSupabase();

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "(11) 99999-9999",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            extraIds: ["queijo-extra", "bacon-extra", "queijo-extra"],
          },
          {
            menuItemId: "x-burger",
            quantity: 2,
            extraIds: ["bacon-extra", "queijo-extra"],
          },
        ],
      },
      supabase
    );

    expect(result).toEqual({ ok: true, orderReference: "PED-TESTE123" });
    expect(supabase.state.orderInsertPayload).toMatchObject({
      customer_name: "Ana",
      customer_email: "ana@example.com",
      customer_phone: "(11) 99999-9999",
      status: "aguardando_confirmacao",
    });

    expect(supabase.state.orderInsertPayload?.items).toEqual([
      {
        menuItemId: "x-burger",
        name: "X-Burger",
        quantity: 3,
        extras: [
          { id: "bacon-extra", name: "Bacon extra" },
          { id: "queijo-extra", name: "Queijo extra" },
        ],
      },
    ]);

    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });
});

function makeFakeSupabase() {
  const state: {
    orderInsertPayload: Record<string, unknown> | null;
  } = {
    orderInsertPayload: null,
  };

  const customersTable = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () =>
            ({
              data: null,
              error: null as FakeError,
            }) satisfies { data: { id: string } | null; error: FakeError },
        }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: async () =>
          ({
            data: { id: "customer-1" },
            error: null as FakeError,
          }) satisfies { data: { id: string } | null; error: FakeError },
      }),
    }),
  };

  const ordersTable = {
    insert: (values: Record<string, unknown>) => {
      state.orderInsertPayload = values;
      return {
        select: () => ({
          single: async () =>
            ({
              data: { reference: "PED-TESTE123" },
              error: null as FakeError,
            }) satisfies { data: { reference: string } | null; error: FakeError },
        }),
      };
    },
  };

  return {
    state,
    from: (table: "customers" | "orders") => {
      if (table === "customers") return customersTable;
      return ordersTable;
    },
  };
}
