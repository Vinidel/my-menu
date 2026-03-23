import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/request-client", () => ({
  createRequestClient: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createRequestClient } from "@/lib/request-client";
import { progressOrderStatus, updateOrderDetails } from "./actions";

type LookupResult = {
  data:
    | {
        status: string | null;
        fulfillment_type?: string | null;
      }
    | null;
  error?: { message?: string; code?: string } | null;
};

type UpdateResult = {
  data: { id: string; status: string } | null;
  error: { message?: string; code?: string } | null;
};

describe("progressOrderStatus", () => {
  beforeEach(() => {
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(revalidatePath).mockReset();
  });

  it("progresses delivery orders from em preparo to saiu_para_entrega (brief: delivery out-for-delivery step)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "em_preparo", fulfillment_type: "entrega" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-1", status: "saiu_para_entrega" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-1",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "saiu_para_entrega",
      nextStatusLabel: "Saiu para entrega",
    });
    expect(supabase.state.updateCalls).toEqual([{ status: "saiu_para_entrega" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("progresses pickup orders from em preparo to pronto_para_retirada (brief: pickup ready-for-pickup step)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "em_preparo", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-2", status: "pronto_para_retirada" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-2",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "pronto_para_retirada",
      nextStatusLabel: "Pronto para retirada",
    });
    expect(supabase.state.updateCalls).toEqual([{ status: "pronto_para_retirada" }]);
  });

  it("treats unknown fulfillment rows as pickup flow instead of delivery flow (brief: unknown fulfillment fallback)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "em_preparo", fulfillment_type: "motoboy_externo" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-legacy", status: "pronto_para_retirada" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-legacy",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "pronto_para_retirada",
      nextStatusLabel: "Pronto para retirada",
    });
    expect(supabase.state.updateCalls).toEqual([{ status: "pronto_para_retirada" }]);
  });

  it("progresses pickup orders from pronto_para_retirada to entregue (brief: pickup completion)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "pronto_para_retirada", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-pickup-done", status: "entregue" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-pickup-done",
      currentStatus: "pronto_para_retirada",
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "entregue",
      nextStatusLabel: "Entregue",
    });
    expect(supabase.state.updateCalls).toEqual([{ status: "entregue" }]);
  });

  it("rejects pickup orders that are manually targeted at the delivery-only status (brief: pickup order attempts delivery-only step)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "saiu_para_entrega", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-invalid", status: "entregue" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-invalid",
      currentStatus: "saiu_para_entrega",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Este pedido não pode avançar de status.",
    });
    expect(supabase.state.updateCalls).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a stale result when another employee already changed the persisted status before lookup (brief: concurrent employee update)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "saiu_para_entrega", fulfillment_type: "entrega" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-stale", status: "entregue" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-stale",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: false,
      code: "stale",
      message: "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual.",
      currentStatus: "saiu_para_entrega",
      currentStatusLabel: "Saiu para entrega",
    });
    expect(supabase.state.updateCalls).toEqual([]);
  });

  it("returns a stale result with the current persisted status after a conditional update miss (brief: concurrent employee update)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "saiu_para_entrega", fulfillment_type: "entrega" },
          error: null,
        },
        {
          data: { status: "entregue" },
          error: null,
        },
      ],
      updateResult: {
        data: null,
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-race",
      currentStatus: "saiu_para_entrega",
    });

    expect(result).toEqual({
      ok: false,
      code: "stale",
      message: "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual.",
      currentStatus: "entregue",
      currentStatusLabel: "Entregue",
    });
  });

  it("rejects soft-deleted or otherwise non-operational rows before attempting status progression (brief: stale admin tab or direct request)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: null,
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-hidden", status: "saiu_para_entrega" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-hidden",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Pedido inválido para atualização.",
    });
    expect(supabase.state.updateCalls).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the status update write fails (brief: status update fails)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "em_preparo", fulfillment_type: "entrega" },
          error: null,
        },
      ],
      updateResult: {
        data: null,
        error: { message: "db down", code: "500" },
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-fail",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: false,
      code: "unknown",
      message: "Não foi possível atualizar o status do pedido.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the conditional update returns an unexpected persisted record (hardening: unexpected update result)", async () => {
    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "em_preparo", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "other-order", status: "entregue" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await progressOrderStatus({
      orderId: "order-hardening",
      currentStatus: "em_preparo",
    });

    expect(result).toEqual({
      ok: false,
      code: "unknown",
      message: "Não foi possível atualizar o status do pedido.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateOrderDetails", () => {
  beforeEach(() => {
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(revalidatePath).mockReset();
  });

  it("updates allowed order metadata using stale guard and active-row filter", async () => {
    const supabase = makeSupabaseForOrderEdit({
      lookupResults: [
        { data: { updated_at: "2026-03-23T10:00:00.000Z" }, error: null },
      ],
      updateResult: {
        data: {
          id: "order-1",
          reference: "PED-1",
          customer_name: "Ana Silva",
          customer_email: "ana@example.com",
          customer_phone: "11999999999",
          payment_method: "pix",
          fulfillment_type: "retirada",
          delivery_fee_cents: 0,
          items: [],
          status: "aguardando_confirmacao",
          notes: "Sem cebola",
          created_at: "2026-03-23T09:00:00.000Z",
          updated_at: "2026-03-23T10:01:00.000Z",
        },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrderDetails({
      orderId: "order-1",
      expectedUpdatedAt: "2026-03-23T10:00:00.000Z",
      customerName: " Ana Silva ",
      customerEmail: " ANA@EXAMPLE.COM ",
      customerPhone: "(11) 99999-9999",
      notes: " Sem cebola ",
      paymentMethod: "pix",
      items: [{ menuItemId: "x-burger", quantity: 2 }],
    });

    expect(result).toMatchObject({
      ok: true,
      order: {
        id: "order-1",
        customerName: "Ana Silva",
        customerEmail: "ana@example.com",
        customerPhone: "11999999999",
        paymentMethod: "pix",
      },
    });
    expect(supabase.state.updateCalls).toEqual([
      {
        customer_name: "Ana Silva",
        customer_email: "ana@example.com",
        customer_phone: "11999999999",
        notes: "Sem cebola",
        payment_method: "pix",
        items: [{ name: "X-Burger", quantity: 2, menuItemId: "x-burger", unitPriceCents: 2890, lineTotalCents: 5780 }],
      },
    ]);
    expect(supabase.state.updateEqCalls).toEqual([
      ["id", "order-1"],
      ["updated_at", "2026-03-23T10:00:00.000Z"],
      ["is_deleted", false],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("rejects invalid BR phone in admin edit flow", async () => {
    const result = await updateOrderDetails({
      orderId: "order-1",
      expectedUpdatedAt: "2026-03-23T10:00:00.000Z",
      customerName: "Ana",
      customerEmail: "ana@example.com",
      customerPhone: "123",
      notes: null,
      paymentMethod: "pix",
      items: [{ menuItemId: "x-burger", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Telefone inválido. Use um número brasileiro válido.",
    });
    expect(createRequestClient).not.toHaveBeenCalled();
  });

  it("returns stale result and reloads current order when updated_at snapshot changed", async () => {
    const supabase = makeSupabaseForOrderEdit({
      lookupResults: [
        { data: { updated_at: "2026-03-23T10:01:00.000Z" }, error: null },
        {
          data: {
            id: "order-1",
            reference: "PED-1",
            customer_name: "Outro Nome",
            customer_email: null,
            customer_phone: "11988887777",
            payment_method: null,
            fulfillment_type: "retirada",
            delivery_fee_cents: 0,
            items: [],
            status: "aguardando_confirmacao",
            notes: null,
            created_at: "2026-03-23T09:00:00.000Z",
            updated_at: "2026-03-23T10:01:00.000Z",
          },
          error: null,
        },
      ],
      updateResult: { data: null, error: null },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrderDetails({
      orderId: "order-1",
      expectedUpdatedAt: "2026-03-23T10:00:00.000Z",
      customerName: "Ana",
      customerEmail: "ana@example.com",
      customerPhone: "11999999999",
      notes: null,
      paymentMethod: "pix",
      items: [{ menuItemId: "x-burger", quantity: 1 }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "stale",
      message: "Este pedido foi atualizado por outra pessoa. Recarregamos os dados atuais.",
      currentOrder: {
        id: "order-1",
        customerName: "Outro Nome",
      },
    });
    expect(supabase.state.updateCalls).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects edits for non-operational rows", async () => {
    const supabase = makeSupabaseForOrderEdit({
      lookupResults: [{ data: null, error: null }],
      updateResult: { data: null, error: null },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrderDetails({
      orderId: "order-1",
      expectedUpdatedAt: "2026-03-23T10:00:00.000Z",
      customerName: "Ana",
      customerEmail: null,
      customerPhone: "11999999999",
      notes: null,
      paymentMethod: null,
      items: [{ menuItemId: "x-burger", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Pedido inválido para edição.",
    });
    expect(supabase.state.updateCalls).toEqual([]);
  });

  it("rejects edits when all items are removed", async () => {
    const result = await updateOrderDetails({
      orderId: "order-1",
      expectedUpdatedAt: "2026-03-23T10:00:00.000Z",
      customerName: "Ana",
      customerEmail: null,
      customerPhone: "11999999999",
      notes: null,
      paymentMethod: null,
      items: [],
    });

    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "Selecione itens válidos para salvar o pedido.",
    });
    expect(createRequestClient).not.toHaveBeenCalled();
  });
});

function makeSupabase(input: {
  lookupResults: LookupResult[];
  updateResult: UpdateResult;
}) {
  const state = {
    lookupResults: [...input.lookupResults],
    updateCalls: [] as Array<{ status?: string }>,
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockImplementation((_columns: string) => ({
        eq: vi.fn().mockImplementation((_column: string, _value: string | boolean) => ({
          eq: vi.fn().mockImplementation((_column2: string, _value2: string | boolean) => ({
            maybeSingle: vi.fn().mockResolvedValue(
              state.lookupResults.shift() ?? { data: null, error: null }
            ),
          })),
        })),
      })),
      update: vi.fn().mockImplementation((values: { status?: string }) => {
        state.updateCalls.push(values);
        return {
          eq: vi.fn().mockImplementation((_column: string, _value: string) => ({
            eq: vi.fn().mockImplementation((_column2: string, _value2: string | boolean) => ({
              eq: vi.fn().mockImplementation((_column3: string, _value3: string | boolean) => ({
                select: vi.fn().mockImplementation((_columns: string) => ({
                  maybeSingle: vi.fn().mockResolvedValue(input.updateResult),
                })),
              })),
            })),
          })),
        };
      }),
    })),
    state,
  };
}

function makeSupabaseForOrderEdit(input: {
  lookupResults: Array<{
    data: Record<string, unknown> | null;
    error?: { message?: string; code?: string } | null;
  }>;
  updateResult: {
    data: Record<string, unknown> | null;
    error: { message?: string; code?: string } | null;
  };
}) {
  const state = {
    lookupResults: [...input.lookupResults],
    updateCalls: [] as Array<Record<string, unknown>>,
    updateEqCalls: [] as Array<[string, string | boolean]>,
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockImplementation((_columns: string) => ({
        eq: vi.fn().mockImplementation((_column: string, _value: string | boolean) => ({
          eq: vi.fn().mockImplementation((_column2: string, _value2: string | boolean) => ({
            maybeSingle: vi.fn().mockResolvedValue(
              state.lookupResults.shift() ?? { data: null, error: null }
            ),
          })),
        })),
      })),
      update: vi.fn().mockImplementation((values: Record<string, unknown>) => {
        state.updateCalls.push(values);
        return {
          eq: vi.fn().mockImplementation((column1: string, value1: string | boolean) => {
            state.updateEqCalls.push([column1, value1]);
            return {
              eq: vi.fn().mockImplementation((column2: string, value2: string | boolean) => {
                state.updateEqCalls.push([column2, value2]);
                return {
                  eq: vi.fn().mockImplementation((column3: string, value3: string | boolean) => {
                    state.updateEqCalls.push([column3, value3]);
                    return {
                      select: vi.fn().mockImplementation((_columns: string) => ({
                        maybeSingle: vi.fn().mockResolvedValue(input.updateResult),
                      })),
                    };
                  }),
                };
              }),
            };
          }),
        };
      }),
    })),
    state,
  };
}
