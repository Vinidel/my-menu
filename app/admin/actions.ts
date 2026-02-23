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

const UPDATE_STATUS_ERROR_MESSAGE = "Não foi possível atualizar o status do pedido.";
const INVALID_ORDER_MESSAGE = "Pedido inválido para atualização.";
const INVALID_PROGRESS_MESSAGE = "Este pedido não pode avançar de status.";
const SETUP_ERROR_MESSAGE =
  "Configure as variáveis do Supabase para atualizar o status dos pedidos.";
const AUTH_INVALID_SESSION_MESSAGE = "Sessão inválida. Faça login novamente.";
const AUTH_VALIDATION_ERROR_MESSAGE =
  "Não foi possível validar sua sessão. Faça login novamente.";
const STALE_STATUS_MESSAGE =
  "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual.";

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

type OrdersStatusUpdateChain = {
  update: (values: Database["public"]["Tables"]["orders"]["Update"]) => {
    eq: (column: "id", value: string) => {
      eq: (column: "status", value: OrderStatus) => {
        select: (columns: "id, status") => { maybeSingle: () => Promise<any> };
      };
    };
  };
};

type OrdersStatusLookupChain = {
  select: (columns: "status") => {
    eq: (column: "id", value: string) => {
      maybeSingle: () => Promise<{ data: { status: string | null } | null }>;
    };
  };
};

export async function progressOrderStatus(
  input: ProgressOrderInput
): Promise<ProgressOrderResult> {
  const orderId = input.orderId?.trim();
  const currentStatus = input.currentStatus;

  if (!orderId) {
    return errorResult("validation", INVALID_ORDER_MESSAGE);
  }

  const nextStatus = getNextOrderStatus(currentStatus);
  if (!nextStatus) {
    return errorResult("validation", INVALID_PROGRESS_MESSAGE);
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResult("setup", SETUP_ERROR_MESSAGE);
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResult("auth", AUTH_INVALID_SESSION_MESSAGE);
    }
  } catch {
    console.error("[admin/orders] failed to validate session during status update");
    return errorResult("auth", AUTH_VALIDATION_ERROR_MESSAGE);
  }

  const ordersTable = asOrdersStatusUpdateChain(supabase.from("orders"));

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
    return errorResult("unknown", UPDATE_STATUS_ERROR_MESSAGE);
  }

  if (!data) {
    const staleCheckTable = asOrdersStatusLookupChain(supabase.from("orders"));

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
      message: STALE_STATUS_MESSAGE,
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

function errorResult(
  code: "setup" | "auth" | "validation" | "unknown",
  message: string
): Extract<ProgressOrderResult, { ok: false; code: "setup" | "auth" | "validation" | "unknown" }> {
  return { ok: false, code, message };
}

function asOrdersStatusUpdateChain(value: unknown): OrdersStatusUpdateChain {
  return value as OrdersStatusUpdateChain;
}

function asOrdersStatusLookupChain(value: unknown): OrdersStatusLookupChain {
  return value as OrdersStatusLookupChain;
}
