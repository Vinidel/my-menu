"use server";

import { revalidatePath } from "next/cache";
import { createRequestClient } from "@/lib/request-client";
import {
  createAdminOrdersDataAccess,
  type AdminOrdersDataAccess,
} from "@/lib/admin-orders-data-access";
import {
  getStatusLabelFromUnknown,
  getNextOrderStatus,
  getOrderStatusLabel,
  type OrderStatus,
} from "@/lib/orders";
import { normalizeFulfillmentType } from "@/lib/fulfillment-types";
import { getRuntimeMenuItemMap } from "@/lib/menu-runtime";
import {
  validateAndBuildOrderPayload,
  type OrderSubmitInput,
} from "@/lib/order-submit-validation";

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
const FULFILLMENT_CONFLICT_MESSAGE =
  "Não é possível alterar o tipo de entrega enquanto o status do pedido exigir o tipo atual. Avance ou altere o status antes de mudar o tipo de entrega.";
const UPDATE_ORDER_ERROR_MESSAGE = "Não foi possível atualizar o pedido.";

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
    return errorResult("validation", INVALID_ORDER_MESSAGE);
  }

  const supabase = await createRequestClient();
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

  const adminOrdersDataAccess = createAdminOrdersDataAccess(supabase);
  const { data: persistedOrder, error: lookupError } = await loadOrderStatusSnapshot(
    adminOrdersDataAccess,
    orderId
  );

  if (lookupError) {
    console.error("[admin/orders] failed to load order before status update", {
      orderId,
      message: lookupError.message,
      code: lookupError.code,
    });
    return errorResult("unknown", UPDATE_STATUS_ERROR_MESSAGE);
  }

  if (!persistedOrder) {
    console.warn("[admin/orders] attempted to progress missing or non-operational order", {
      orderId,
      currentStatus,
    });
    return errorResult("validation", INVALID_ORDER_MESSAGE);
  }

  const persisted = getStatusLabelFromUnknown(persistedOrder?.status);
  if (persisted.status !== currentStatus) {
    return staleResult(orderId, currentStatus, persisted);
  }

  const nextStatus = getNextOrderStatus(
    persisted.status,
    normalizeFulfillmentType(persistedOrder?.fulfillmentType)
  );
  if (!nextStatus) {
    return errorResult("validation", INVALID_PROGRESS_MESSAGE);
  }

  const { data, error } = await adminOrdersDataAccess.progressAdminOrderStatusConditionally({
    orderId,
    currentStatus,
    nextStatus,
  });

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
    const { data: currentOrder, error: staleLookupError } = await loadOrderStatusSnapshot(
      adminOrdersDataAccess,
      orderId
    );

    if (staleLookupError) {
      console.error("[admin/orders] failed to load current status after stale update miss", {
        orderId,
        expectedStatus: currentStatus,
        message: staleLookupError.message,
        code: staleLookupError.code,
      });
    } else if (!currentOrder) {
      console.warn("[admin/orders] stale update miss followed by missing order lookup result", {
        orderId,
        expectedStatus: currentStatus,
      });
      return errorResult("validation", INVALID_ORDER_MESSAGE);
    }

    const current = getStatusLabelFromUnknown(currentOrder?.status);
    return staleResult(orderId, currentStatus, current);
  }

  if (data.id !== orderId || data.status !== nextStatus) {
    console.error("[admin/orders] conditional status update returned unexpected persisted result", {
      orderId,
      currentStatus,
      nextStatus,
      returnedId: data.id,
      returnedStatus: data.status,
    });
    return errorResult("unknown", UPDATE_STATUS_ERROR_MESSAGE);
  }

  revalidatePath("/admin");

  return {
    ok: true,
    nextStatus,
    nextStatusLabel: getOrderStatusLabel(nextStatus),
  };
}

export type UpdateOrderInput = {
  orderId: string;
  orderPayload: OrderSubmitInput;
};

export type UpdateOrderResult =
  | { ok: true }
  | {
      ok: false;
      code: "setup" | "auth" | "validation" | "unknown";
      message: string;
    };

export async function updateOrder(
  input: UpdateOrderInput
): Promise<UpdateOrderResult> {
  const orderId = input.orderId?.trim();
  if (!orderId) {
    return errorResult("validation", INVALID_ORDER_MESSAGE);
  }

  const supabase = await createRequestClient();
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
    console.error("[admin/orders] failed to validate session during order update");
    return errorResult("auth", AUTH_VALIDATION_ERROR_MESSAGE);
  }

  const adminOrdersDataAccess = createAdminOrdersDataAccess(supabase);
  const { data: statusSnapshot, error: lookupError } = await loadOrderStatusSnapshot(
    adminOrdersDataAccess,
    orderId
  );

  if (lookupError) {
    console.error("[admin/orders] failed to load order before update", {
      orderId,
      message: lookupError.message,
      code: lookupError.code,
    });
    return errorResult("unknown", UPDATE_ORDER_ERROR_MESSAGE);
  }

  if (!statusSnapshot) {
    console.warn("[admin/orders] attempted to update missing or non-operational order", {
      orderId,
    });
    return errorResult("validation", INVALID_ORDER_MESSAGE);
  }

  const menuMap = await getRuntimeMenuItemMap();
  const validation = validateAndBuildOrderPayload(input.orderPayload, menuMap);

  if (!validation.ok) {
    return errorResult("validation", validation.message);
  }

  const { payload } = validation;
  const currentStatus = getStatusLabelFromUnknown(statusSnapshot.status).status;
  const currentFulfillment = normalizeFulfillmentType(statusSnapshot.fulfillmentType);
  const newFulfillment = normalizeFulfillmentType(payload.fulfillment_type);

  if (
    currentFulfillment &&
    newFulfillment &&
    currentFulfillment !== newFulfillment
  ) {
    if (
      currentStatus === "saiu_para_entrega" &&
      newFulfillment === "retirada"
    ) {
      return errorResult("validation", FULFILLMENT_CONFLICT_MESSAGE);
    }
    if (
      currentStatus === "pronto_para_retirada" &&
      newFulfillment === "entrega"
    ) {
      return errorResult("validation", FULFILLMENT_CONFLICT_MESSAGE);
    }
  }

  const { data, error } = await adminOrdersDataAccess.updateAdminOrder({
    orderId,
    payload: {
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      payment_method: payload.payment_method,
      fulfillment_type: payload.fulfillment_type,
      delivery_fee_cents: payload.delivery_fee_cents,
      notes: payload.notes,
      items: payload.items,
    },
  });

  if (error) {
    console.error("[admin/orders] failed to update order", {
      orderId,
      message: error.message,
      code: error.code,
    });
    return errorResult("unknown", UPDATE_ORDER_ERROR_MESSAGE);
  }

  if (!data) {
    return errorResult("validation", INVALID_ORDER_MESSAGE);
  }

  revalidatePath("/admin");

  return { ok: true };
}

function errorResult(
  code: "setup" | "auth" | "validation" | "unknown",
  message: string
): Extract<ProgressOrderResult, { ok: false; code: "setup" | "auth" | "validation" | "unknown" }> {
  return { ok: false, code, message };
}

async function loadOrderStatusSnapshot(
  adminOrdersDataAccess: AdminOrdersDataAccess,
  orderId: string
) {
  return adminOrdersDataAccess.getAdminOrderStatusSnapshot(orderId);
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
