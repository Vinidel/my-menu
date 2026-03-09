import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { progressOrderStatus } from "./actions";

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
    vi.mocked(createClient).mockReset();
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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
    vi.mocked(createClient).mockResolvedValue(supabase as never);

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
        eq: vi.fn().mockImplementation((_column: string, _value: string) => ({
          maybeSingle: vi.fn().mockResolvedValue(
            state.lookupResults.shift() ?? { data: null, error: null }
          ),
        })),
      })),
      update: vi.fn().mockImplementation((values: { status?: string }) => {
        state.updateCalls.push(values);
        return {
          eq: vi.fn().mockImplementation((_column: string, _value: string) => ({
            eq: vi.fn().mockImplementation((_column2: string, _value2: string) => ({
              select: vi.fn().mockImplementation((_columns: string) => ({
                maybeSingle: vi.fn().mockResolvedValue(input.updateResult),
              })),
            })),
          })),
        };
      }),
    })),
    state,
  };
}
