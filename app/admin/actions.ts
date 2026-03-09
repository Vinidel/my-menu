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
import { normalizeFulfillmentType } from "@/lib/fulfillment-types";

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
const ORDER_STATUS_LOOKUP_COLUMNS = "status, fulfillment_type";
const ORDER_STATUS_STALE_CHECK_COLUMNS = "status";

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
  select: (columns: "status, fulfillment_type" | "status") => {
    eq: (column: "id", value: string) => {
      maybeSingle: () => Promise<{
        data:
          | {
              status: string | null;
              fulfillment_type?: string | null;
            }
          | null;
        error?: {
          message?: string;
          code?: string;
        } | null;
      }>;
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

  const ordersLookupTable = asOrdersStatusLookupChain(supabase.from("orders"));
  const { data: persistedOrder, error: lookupError } = await ordersLookupTable
    .select(ORDER_STATUS_LOOKUP_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("[admin/orders] failed to load order before status update", {
      orderId,
      message: lookupError.message,
      code: lookupError.code,
    });
    return errorResult("unknown", UPDATE_STATUS_ERROR_MESSAGE);
  }

  const persisted = getStatusLabelFromUnknown(persistedOrder?.status);
  if (persisted.status !== currentStatus) {
    return staleResult(orderId, currentStatus, persisted);
  }

  const nextStatus = getNextOrderStatus(
    persisted.status,
    normalizeFulfillmentType(persistedOrder?.fulfillment_type)
  );
  if (!nextStatus) {
    return errorResult("validation", INVALID_PROGRESS_MESSAGE);
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

    const { data: currentOrder, error: staleLookupError } = await staleCheckTable
      .select(ORDER_STATUS_STALE_CHECK_COLUMNS)
      .eq("id", orderId)
      .maybeSingle();

    if (staleLookupError) {
      console.error("[admin/orders] failed to load current status after stale update miss", {
        orderId,
        expectedStatus: currentStatus,
        message: staleLookupError.message,
        code: staleLookupError.code,
      });
    }

    const current = getStatusLabelFromUnknown(currentOrder?.status);
    return staleResult(orderId, currentStatus, current);
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

function staleResult(
  orderId: string,
  expectedStatus: OrderStatus,
  current: ReturnType<typeof getStatusLabelFromUnknown>
): Extract<ProgressOrderResult, { ok: false; code: "stale" }> {
  console.warn("[admin/orders] stale status progression rejected", {
    orderId,
    expectedStatus,
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
