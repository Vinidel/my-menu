"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  getStatusLabelFromUnknown,
  getNextOrderStatus,
  getOrderStatusLabel,
  type OrderStatus,
} from "@/lib/orders";

type ProgressOrderInput = {
  orderId: string;
  currentStatus: OrderStatus;
};

export type ProgressOrderResult =
  | { ok: true; nextStatus: OrderStatus; nextStatusLabel: string }
  | {
      ok: false;
      code: "setup" | "auth" | "validation" | "unknown";
      message: string;
    }
  | {
      ok: false;
      code: "stale";
      message: string;
      currentStatus: OrderStatus | null;
      currentStatusLabel: string;
    };

export async function progressOrderStatus(
  input: ProgressOrderInput
): Promise<ProgressOrderResult> {
  const orderId = input.orderId?.trim();
  const currentStatus = input.currentStatus;

  if (!orderId) {
    return {
      ok: false,
      code: "validation",
      message: "Pedido inválido para atualização.",
    };
  }

  const nextStatus = getNextOrderStatus(currentStatus);
  if (!nextStatus) {
    return {
      ok: false,
      code: "validation",
      message: "Este pedido não pode avançar de status.",
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return {
      ok: false,
      code: "setup",
      message:
        "Configure as variáveis do Supabase para atualizar o status dos pedidos.",
    };
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        code: "auth",
        message: "Sessão inválida. Faça login novamente.",
      };
    }
  } catch {
    console.error("[admin/orders] failed to validate session during status update");
    return {
      ok: false,
      code: "auth",
      message: "Não foi possível validar sua sessão. Faça login novamente.",
    };
  }

  const ordersTable = supabase.from("orders") as unknown as {
    update: (values: Database["public"]["Tables"]["orders"]["Update"]) => {
      eq: (column: "id", value: string) => {
        eq: (column: "status", value: OrderStatus) => {
          select: (columns: "id, status") => { maybeSingle: () => Promise<any> };
        };
      };
    };
  };

  const { data, error } = await ordersTable
    .update({ status: nextStatus })
    .eq("id", orderId)
    .eq("status", currentStatus)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("[admin/orders] failed to progress order status", {
      orderId,
      currentStatus,
      nextStatus,
      message: error.message,
      code: error.code,
    });
    return {
      ok: false,
      code: "unknown",
      message: "Não foi possível atualizar o status do pedido.",
    };
  }

  if (!data) {
    const staleCheckTable = supabase.from("orders") as unknown as {
      select: (columns: "status") => {
        eq: (column: "id", value: string) => {
          maybeSingle: () => Promise<{ data: { status: string | null } | null }>;
        };
      };
    };

    const { data: currentOrder } = await staleCheckTable
      .select("status")
      .eq("id", orderId)
      .maybeSingle();

    const current = getStatusLabelFromUnknown(currentOrder?.status);

    console.warn("[admin/orders] stale status progression rejected", {
      orderId,
      expectedStatus: currentStatus,
      currentStatus: current.status ?? current.raw ?? null,
    });

    return {
      ok: false,
      code: "stale",
      message:
        "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual.",
      currentStatus: current.status,
      currentStatusLabel: current.label,
    };
  }

  revalidatePath("/admin");

  return {
    ok: true,
    nextStatus,
    nextStatusLabel: getOrderStatusLabel(nextStatus),
  };
}
