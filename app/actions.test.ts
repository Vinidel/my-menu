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

describe("submitCustomerOrderWithClient (item customization)", () => {
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
            priceCents: 2500,
            extras: [{ id: "queijo-extra", name: "Queijo extra", priceCents: 300 }],
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "pix",
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

  it("rejects invalid removed ingredient ids for a menu item (brief: tampered removals payload)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
            removableIngredients: [{ id: "cebola", name: "Cebola" }],
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "pix",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            removedIngredientIds: ["tomate"],
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
            priceCents: 2500,
            extras: [
              { id: "bacon-extra", name: "Bacon extra", priceCents: 400 },
              { id: "queijo-extra", name: "Queijo extra", priceCents: 300 },
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
        paymentMethod: "dinheiro",
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
      payment_method: "dinheiro",
      status: "aguardando_confirmacao",
    });

    expect(supabase.state.orderInsertPayload?.items).toEqual([
      {
        menuItemId: "x-burger",
        name: "X-Burger",
        quantity: 3,
        unitPriceCents: 2500,
        lineTotalCents: 9600,
        extras: [
          { id: "bacon-extra", name: "Bacon extra", priceCents: 400 },
          { id: "queijo-extra", name: "Queijo extra", priceCents: 300 },
        ],
      },
    ]);

    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("persists normalized removed ingredients snapshots and keeps lines separate when removals differ (brief: removals merge key + snapshot source)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
            removableIngredients: [
              { id: "cebola", name: "Cebola" },
              { id: "tomate", name: "Tomate" },
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
        paymentMethod: "pix",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            removedIngredientIds: ["tomate", "cebola", "tomate"],
          },
          {
            menuItemId: "x-burger",
            quantity: 2,
            removedIngredientIds: ["cebola", "tomate"],
          },
          {
            menuItemId: "x-burger",
            quantity: 1,
            removedIngredientIds: ["cebola"],
          },
        ],
      },
      supabase
    );

    expect(result).toEqual({ ok: true, orderReference: "PED-TESTE123" });
    expect(supabase.state.orderInsertPayload?.items).toEqual([
      {
        menuItemId: "x-burger",
        name: "X-Burger",
        quantity: 3,
        unitPriceCents: 2500,
        lineTotalCents: 7500,
        removedIngredients: [
          { id: "cebola", name: "Cebola" },
          { id: "tomate", name: "Tomate" },
        ],
      },
      {
        menuItemId: "x-burger",
        name: "X-Burger",
        quantity: 1,
        unitPriceCents: 2500,
        lineTotalCents: 2500,
        removedIngredients: [{ id: "cebola", name: "Cebola" }],
      },
    ]);
  });

  it("rejects item when removed ingredients exceed max allowed count (brief: max removals per item)", async () => {
    const removableIngredients = Array.from({ length: 21 }, (_, index) => ({
      id: `ing-${index + 1}`,
      name: `Ingrediente ${index + 1}`,
    }));

    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
            removableIngredients,
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "pix",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            removedIngredientIds: removableIngredients.map((ingredient) => ingredient.id),
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

  it("rejects item when customization id exceeds max supported length (hardening: id length bounds)", async () => {
    const longId = "a".repeat(81);
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
            removableIngredients: [{ id: longId, name: "Ingrediente longo" }],
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "pix",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            removedIngredientIds: [longId],
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

  it("rejects order when base item is missing priceCents (brief: fail closed pricing snapshots)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "cartao",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      makeFakeSupabase()
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message:
        "Alguns itens selecionados estão sem preço configurado. Revise o cardápio e tente novamente.",
    });
  });

  it("rejects order when selected extra is missing priceCents (brief: fail closed pricing snapshots)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
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
        paymentMethod: "pix",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
            extraIds: ["queijo-extra"],
          },
        ],
      },
      makeFakeSupabase()
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message:
        "Alguns itens selecionados estão sem preço configurado. Revise o cardápio e tente novamente.",
    });
  });

  it("rejects tampered payment method values (brief: payment method server validation)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "credito" as never,
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      makeFakeSupabase()
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Selecione uma forma de pagamento válida.",
    });
  });

  it("accepts empty e-mail and persists null customer_email (brief: optional e-mail)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
          },
        ],
      ])
    );

    const supabase = makeFakeSupabase();
    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "   ",
        customerPhone: "(11) 99999-9999",
        paymentMethod: "pix",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      supabase
    );

    expect(result).toEqual({ ok: true, orderReference: "PED-TESTE123" });
    expect(supabase.state.orderInsertPayload?.customer_email).toBeNull();
  });

  it("rejects tampered non-string customerEmail payload (brief: tampered e-mail type/value)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
          },
        ],
      ])
    );

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: { value: "ana@example.com" } as never,
        customerPhone: "11999999999",
        paymentMethod: "pix",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      makeFakeSupabase()
    );

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Informe um e-mail válido.",
    });
  });

  it("reuses existing phone-only customer when e-mail is empty (brief: phone dedupe fallback)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
          },
        ],
      ])
    );

    const supabase = makeFakeSupabase({
      customers: [
        {
          id: "customer-existing",
          name: "Ana",
          email: null,
          phone: "11999999999",
          email_normalized: null,
          phone_normalized: "11999999999",
        },
      ],
    });

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "",
        customerPhone: "11999999999",
        paymentMethod: "dinheiro",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      supabase
    );

    expect(result).toEqual({ ok: true, orderReference: "PED-TESTE123" });
    expect(supabase.state.orderInsertPayload?.customer_id).toBe("customer-existing");
    expect(supabase.state.customers).toHaveLength(1);
  });

  it("upgrades phone-only customer with e-mail on later submit (brief: deterministic upgrade path)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
          },
        ],
      ])
    );

    const supabase = makeFakeSupabase({
      customers: [
        {
          id: "customer-existing",
          name: "Ana",
          email: null,
          phone: "11999999999",
          email_normalized: null,
          phone_normalized: "11999999999",
        },
      ],
    });

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "ANA@example.com",
        customerPhone: "11999999999",
        paymentMethod: "cartao",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      supabase
    );

    expect(result).toEqual({ ok: true, orderReference: "PED-TESTE123" });
    expect(supabase.state.orderInsertPayload?.customer_id).toBe("customer-existing");
    expect(supabase.state.customers).toHaveLength(1);
    expect(supabase.state.customers[0]).toMatchObject({
      email: "ana@example.com",
      email_normalized: "ana@example.com",
    });
  });

  it("recovers from concurrent phone-only insert conflict via 23505 retry (brief: concurrent phone-only submits)", async () => {
    vi.mocked(getMenuItemMap).mockReturnValue(
      new Map([
        [
          "x-burger",
          {
            id: "x-burger",
            name: "X-Burger",
            priceCents: 2500,
          },
        ],
      ])
    );

    const supabase = makeFakeSupabase({
      onPhoneOnlyInsertConflictOnce: true,
      conflictCustomer: {
        id: "customer-race",
        name: "Ana",
        email: null,
        phone: "11999999999",
        email_normalized: null,
        phone_normalized: "11999999999",
      },
    });

    const result = await submitCustomerOrderWithClient(
      {
        customerName: "Ana",
        customerEmail: "   ",
        customerPhone: "11999999999",
        paymentMethod: "pix",
        items: [{ menuItemId: "x-burger", quantity: 1 }],
      },
      supabase
    );

    expect(result).toEqual({ ok: true, orderReference: "PED-TESTE123" });
    expect(supabase.state.orderInsertPayload?.customer_id).toBe("customer-race");
  });
});

function makeFakeSupabase(input?: {
  customers?: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string;
    email_normalized: string | null;
    phone_normalized: string;
  }>;
  onPhoneOnlyInsertConflictOnce?: boolean;
  conflictCustomer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    email_normalized: string | null;
    phone_normalized: string;
  };
}) {
  type FakeCustomer = {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    email_normalized: string | null;
    phone_normalized: string;
  };
  const state: {
    orderInsertPayload: Record<string, unknown> | null;
    customers: FakeCustomer[];
    nextCustomerId: number;
    phoneOnlyConflictPending: boolean;
    conflictCustomer: FakeCustomer | null;
  } = {
    orderInsertPayload: null,
    customers: [...(input?.customers ?? [])],
    nextCustomerId: 1,
    phoneOnlyConflictPending: Boolean(input?.onPhoneOnlyInsertConflictOnce),
    conflictCustomer: input?.conflictCustomer ?? null,
  };

  function findCustomer(filters: {
    id?: string;
    email_normalized?: string | null;
    phone_normalized?: string;
  }) {
    return (
      state.customers.find((customer) => {
        if (typeof filters.id !== "undefined" && customer.id !== filters.id) return false;
        if (
          typeof filters.email_normalized !== "undefined" &&
          customer.email_normalized !== filters.email_normalized
        ) {
          return false;
        }
        if (
          typeof filters.phone_normalized !== "undefined" &&
          customer.phone_normalized !== filters.phone_normalized
        ) {
          return false;
        }
        return true;
      }) ?? null
    );
  }

  const customersTable = {
    select: () => {
      const filters: { id?: string; email_normalized?: string | null; phone_normalized?: string } = {};
      const chain = {
        eq: (column: "id" | "email_normalized" | "phone_normalized", value: string) => {
          filters[column] = value;
          return chain;
        },
        is: (column: "email_normalized", value: null) => {
          filters[column] = value;
          return chain;
        },
        maybeSingle: async () =>
          ({
            data: (() => {
              const customer = findCustomer(filters);
              return customer ? { id: customer.id } : null;
            })(),
            error: null as FakeError,
          }) satisfies { data: { id: string } | null; error: FakeError },
      };
      return chain;
    },
    insert: (values: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          const emailNormalized =
            typeof values.email_normalized === "string"
              ? values.email_normalized
              : values.email_normalized === null
                ? null
                : null;
          const phoneNormalized =
            typeof values.phone_normalized === "string" ? values.phone_normalized : "";

          const duplicate = state.customers.find((customer) =>
            emailNormalized === null
              ? customer.email_normalized === null && customer.phone_normalized === phoneNormalized
              : customer.email_normalized === emailNormalized &&
                  customer.phone_normalized === phoneNormalized
          );

          if (emailNormalized === null && state.phoneOnlyConflictPending) {
            state.phoneOnlyConflictPending = false;
            if (
              state.conflictCustomer &&
              !state.customers.some((customer) => customer.id === state.conflictCustomer?.id)
            ) {
              state.customers.push(state.conflictCustomer);
            }
            return {
              data: null,
              error: { message: "duplicate key", code: "23505" } as FakeError,
            } satisfies { data: { id: string } | null; error: FakeError };
          }

          if (duplicate) {
            return {
              data: null,
              error: { message: "duplicate key", code: "23505" } as FakeError,
            } satisfies { data: { id: string } | null; error: FakeError };
          }

          const id = `customer-${state.nextCustomerId++}`;
          state.customers.push({
            id,
            name: String(values.name ?? ""),
            email: (values.email as string | null | undefined) ?? null,
            phone: String(values.phone ?? ""),
            email_normalized: emailNormalized,
            phone_normalized: phoneNormalized,
          });

          return {
            data: { id },
            error: null as FakeError,
          } satisfies { data: { id: string } | null; error: FakeError };
        },
      }),
    }),
    update: (values: Record<string, unknown>) => {
      const filters: { id?: string; email_normalized?: null } = {};
      return {
        eq: (column: "id", value: string) => {
          filters[column] = value;
          return {
            is: (_column: "email_normalized", valueForIs: null) => {
              filters.email_normalized = valueForIs;
              return {
                select: () => ({
                  maybeSingle: async () => {
                    const target = state.customers.find(
                      (customer) =>
                        customer.id === filters.id &&
                        customer.email_normalized === filters.email_normalized
                    );
                    if (!target) {
                      return {
                        data: null,
                        error: null as FakeError,
                      } satisfies { data: { id: string } | null; error: FakeError };
                    }

                    const nextEmailNormalized =
                      typeof values.email_normalized === "string"
                        ? values.email_normalized
                        : null;
                    if (!nextEmailNormalized) {
                      return {
                        data: null,
                        error: null as FakeError,
                      } satisfies { data: { id: string } | null; error: FakeError };
                    }

                    const conflicting = state.customers.find(
                      (customer) =>
                        customer.id !== target.id &&
                        customer.email_normalized === nextEmailNormalized &&
                        customer.phone_normalized === target.phone_normalized
                    );
                    if (conflicting) {
                      return {
                        data: null,
                        error: { message: "duplicate key", code: "23505" } as FakeError,
                      } satisfies { data: { id: string } | null; error: FakeError };
                    }

                    target.email = (values.email as string | null | undefined) ?? null;
                    target.email_normalized = nextEmailNormalized;

                    return {
                      data: { id: target.id },
                      error: null as FakeError,
                    } satisfies { data: { id: string } | null; error: FakeError };
                  },
                }),
              };
            },
          };
        },
      };
    },
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
