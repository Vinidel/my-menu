import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/request-client", () => ({
  createRequestClient: vi.fn(),
}));

vi.mock("@/lib/menu-runtime", () => ({
  getRuntimeMenuItemMap: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createRequestClient } from "@/lib/request-client";
import { progressOrderStatus, updateOrder } from "./actions";
import { getRuntimeMenuItemMap } from "@/lib/menu-runtime";

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
  data: Record<string, unknown> | null;
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

describe("updateOrder (admin edit flow)", () => {
  beforeEach(() => {
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(revalidatePath).mockReset();
    vi.mocked(getRuntimeMenuItemMap as never).mockReset();
  });

  const menuMap = new Map([
    [
      "x-burger",
      {
        id: "x-burger",
        name: "X-Burger",
        priceCents: 2890,
        extras: [],
        removableIngredients: [],
      },
    ],
  ]);

  it("updates order when payload is valid (brief: admin corrects items/contact/payment/fulfillment)", async () => {
    vi.mocked(getRuntimeMenuItemMap as never).mockResolvedValue(menuMap as never);

    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "aguardando_confirmacao", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: {
        data: { id: "order-1" },
        error: null,
      },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrder({
      orderId: "order-1",
      orderPayload: {
        customerName: "João",
        customerEmail: "",
        customerPhone: "11987654321",
        paymentMethod: "dinheiro",
        fulfillmentType: "retirada",
        notes: "sem cebola",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
          },
        ],
      },
    });

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(supabase.state.updateCalls).toHaveLength(1);

    const updatePayload = supabase.state.updateCalls[0];
    expect(updatePayload).toMatchObject({
      customer_name: "João",
      customer_phone: expect.any(String),
      payment_method: "dinheiro",
      fulfillment_type: "retirada",
      items: expect.any(Array),
    });

    expect((updatePayload.items as any[])[0]).toMatchObject({
      menuItemId: "x-burger",
      quantity: 1,
      unitPriceCents: 2890,
      lineTotalCents: 2890,
    });
  });

  it("rejects invalid phone (brief: invalid phone in edit)", async () => {
    vi.mocked(getRuntimeMenuItemMap as never).mockResolvedValue(menuMap as never);

    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "aguardando_confirmacao", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: { data: { id: "unused" }, error: null },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrder({
      orderId: "order-1",
      orderPayload: {
        customerName: "João",
        customerEmail: "",
        customerPhone: "123",
        paymentMethod: "dinheiro",
        fulfillmentType: "retirada",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.message).toMatch(/Telefone inválido/i);
    }
    expect(supabase.state.updateCalls).toEqual([]);
  });

  it("rejects empty items (brief: remove all items)", async () => {
    vi.mocked(getRuntimeMenuItemMap as never).mockResolvedValue(menuMap as never);

    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "aguardando_confirmacao", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: { data: { id: "unused" }, error: null },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrder({
      orderId: "order-1",
      orderPayload: {
        customerName: "João",
        customerEmail: "",
        customerPhone: "11987654321",
        paymentMethod: "dinheiro",
        fulfillmentType: "retirada",
        items: [],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.message).toMatch(/Selecione itens válidos/i);
    }
    expect(supabase.state.updateCalls).toEqual([]);
  });

  it("rejects fulfillment-type conflicts with status (brief: fulfillment vs status constraint)", async () => {
    vi.mocked(getRuntimeMenuItemMap as never).mockResolvedValue(menuMap as never);

    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "saiu_para_entrega", fulfillment_type: "entrega" },
          error: null,
        },
      ],
      updateResult: { data: { id: "unused" }, error: null },
    });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrder({
      orderId: "order-1",
      orderPayload: {
        customerName: "João",
        customerEmail: "",
        customerPhone: "11987654321",
        paymentMethod: "dinheiro",
        fulfillmentType: "retirada",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation");
      expect(result.message).toMatch(/tipo de entrega/i);
    }
    expect(supabase.state.updateCalls).toEqual([]);
  });

  it("rejects unauthenticated sessions (brief: unauthenticated request)", async () => {
    vi.mocked(getRuntimeMenuItemMap as never).mockResolvedValue(menuMap as never);

    const supabase = makeSupabase({
      lookupResults: [
        {
          data: { status: "aguardando_confirmacao", fulfillment_type: "retirada" },
          error: null,
        },
      ],
      updateResult: { data: { id: "unused" }, error: null },
    });
    // Force unauthenticated
    supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createRequestClient).mockResolvedValue(supabase as never);

    const result = await updateOrder({
      orderId: "order-1",
      orderPayload: {
        customerName: "João",
        customerEmail: "",
        customerPhone: "11987654321",
        paymentMethod: "dinheiro",
        fulfillmentType: "retirada",
        items: [
          {
            menuItemId: "x-burger",
            quantity: 1,
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("auth");
      expect(result.message).toMatch(/Sessão inválida/i);
    }
    expect(supabase.state.updateCalls).toEqual([]);
  });
});

function makeSupabase(input: {
  lookupResults: LookupResult[];
  updateResult: UpdateResult;
}) {
  const state = {
    lookupResults: [...input.lookupResults],
    updateCalls: [] as Array<Record<string, unknown>>,
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
        state.updateCalls.push(values as never);
        const builder: any = {
          eq: vi.fn().mockImplementation((_column: string, _value: string | boolean) => builder),
          select: vi.fn().mockImplementation((_columns: string) => ({
            maybeSingle: vi.fn().mockResolvedValue(input.updateResult),
          })),
        };
        return builder;
      }),
    })),
    state,
  };
}
