"use server";

import { revalidatePath } from "next/cache";
import {
  isBasicEmail,
  normalizeOptionalEmail,
  sanitizeOptionalText,
  sanitizeText,
} from "@/lib/customer-contact";
import { normalizeBrazilPhone } from "@/lib/phone";
import { createRequestClient } from "@/lib/request-client";
import {
  createAdminOrdersDataAccess,
  type AdminOrdersDataAccess,
} from "@/lib/admin-orders-data-access";
import {
  getStatusLabelFromUnknown,
  getNextOrderStatus,
  getOrderStatusLabel,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/orders";
import { normalizeFulfillmentType } from "@/lib/fulfillment-types";
import { normalizePaymentMethod } from "@/lib/payment-methods";
import { getMenuItemMap, type MenuItem } from "@/lib/menu";

const UPDATE_STATUS_ERROR_MESSAGE = "Não foi possível atualizar o status do pedido.";
const UPDATE_ORDER_DETAILS_ERROR_MESSAGE = "Não foi possível atualizar os dados do pedido.";
const INVALID_ORDER_MESSAGE = "Pedido inválido para atualização.";
const INVALID_ORDER_DETAILS_MESSAGE = "Pedido inválido para edição.";
const INVALID_PROGRESS_MESSAGE = "Este pedido não pode avançar de status.";
const INVALID_ORDER_EDIT_CONFLICT_MESSAGE =
  "Este pedido foi atualizado por outra pessoa. Recarregamos os dados atuais.";
const SETUP_ERROR_MESSAGE =
  "Configure as variáveis do Supabase para atualizar o status dos pedidos.";
const EDIT_SETUP_ERROR_MESSAGE =
  "Configure as variáveis do Supabase para editar os pedidos.";
const AUTH_INVALID_SESSION_MESSAGE = "Sessão inválida. Faça login novamente.";
const AUTH_VALIDATION_ERROR_MESSAGE =
  "Não foi possível validar sua sessão. Faça login novamente.";
const STALE_STATUS_MESSAGE =
  "Este pedido foi atualizado por outra pessoa. Recarregamos o status atual.";
const VALIDATION_REQUIRED_MESSAGE = "Preencha nome e telefone para salvar as alterações.";
const VALIDATION_EMAIL_MESSAGE = "Informe um e-mail válido.";
const VALIDATION_PHONE_MESSAGE = "Telefone inválido. Use um número brasileiro válido.";
const VALIDATION_PAYMENT_METHOD_MESSAGE = "Selecione uma forma de pagamento válida.";
const VALIDATION_TOO_LARGE_MESSAGE =
  "Alguns dados do pedido são muito longos. Revise e tente novamente.";
const MAX_CUSTOMER_NAME_LENGTH = 120;
const MAX_CUSTOMER_EMAIL_LENGTH = 254;
const MAX_CUSTOMER_PHONE_LENGTH = 32;
const MAX_NOTES_LENGTH = 1000;
const MAX_ORDER_LINE_ITEMS = 50;
const MAX_EXTRAS_PER_ITEM = 20;
const MAX_REMOVED_INGREDIENTS_PER_ITEM = 20;
const MAX_CUSTOMIZATION_ID_LENGTH = 80;
const VALIDATION_ITEMS_MESSAGE = "Selecione itens válidos para salvar o pedido.";

type ProgressOrderInput = {
  orderId: string;
  currentStatus: OrderStatus;
};

type UpdateOrderDetailsInput = {
  orderId: string;
  expectedUpdatedAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  notes: string | null;
  paymentMethod: string | null;
  items: Array<{
    menuItemId: string;
    quantity: number;
    extraIds?: string[];
    removedIngredientIds?: string[];
  }>;
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

export type UpdateOrderDetailsResult =
  | {
      ok: true;
      order: AdminOrder;
    }
  | {
      ok: false;
      code: "setup" | "auth" | "validation" | "unknown";
      message: string;
    }
  | {
      ok: false;
      code: "stale";
      message: string;
      currentOrder: AdminOrder | null;
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

export async function updateOrderDetails(
  input: UpdateOrderDetailsInput
): Promise<UpdateOrderDetailsResult> {
  const orderId = sanitizeText(input.orderId);
  const expectedUpdatedAt = sanitizeText(input.expectedUpdatedAt);
  const customerName = sanitizeText(input.customerName);
  const customerEmail = normalizeOptionalEmail(sanitizeOptionalText(input.customerEmail));
  const customerPhoneRaw = sanitizeText(input.customerPhone);
  const notes = sanitizeOptionalText(input.notes);
  const paymentMethodInput = sanitizeOptionalText(input.paymentMethod);
  const paymentMethod = paymentMethodInput
    ? normalizePaymentMethod(paymentMethodInput)
    : null;
  const menuMap = getMenuItemMap();
  const normalizedItems = normalizeSelectedItemsForAdmin(input.items, menuMap);

  if (!orderId || !expectedUpdatedAt) {
    return updateOrderErrorResult("validation", INVALID_ORDER_DETAILS_MESSAGE);
  }

  if (
    customerName.length > MAX_CUSTOMER_NAME_LENGTH ||
    (customerEmail?.length ?? 0) > MAX_CUSTOMER_EMAIL_LENGTH ||
    customerPhoneRaw.length > MAX_CUSTOMER_PHONE_LENGTH ||
    (notes?.length ?? 0) > MAX_NOTES_LENGTH
  ) {
    return updateOrderErrorResult("validation", VALIDATION_TOO_LARGE_MESSAGE);
  }

  if (!customerName || !customerPhoneRaw) {
    return updateOrderErrorResult("validation", VALIDATION_REQUIRED_MESSAGE);
  }

  if (!normalizedItems) {
    return updateOrderErrorResult("validation", VALIDATION_ITEMS_MESSAGE);
  }

  if (customerEmail && !isBasicEmail(customerEmail)) {
    return updateOrderErrorResult("validation", VALIDATION_EMAIL_MESSAGE);
  }

  const customerPhone = normalizeBrazilPhone(customerPhoneRaw);
  if (!customerPhone) {
    return updateOrderErrorResult("validation", VALIDATION_PHONE_MESSAGE);
  }

  if (paymentMethodInput && !paymentMethod) {
    return updateOrderErrorResult("validation", VALIDATION_PAYMENT_METHOD_MESSAGE);
  }

  const supabase = await createRequestClient();
  if (!supabase) {
    return updateOrderErrorResult("setup", EDIT_SETUP_ERROR_MESSAGE);
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return updateOrderErrorResult("auth", AUTH_INVALID_SESSION_MESSAGE);
    }
  } catch {
    console.error("[admin/orders] failed to validate session during order edit");
    return updateOrderErrorResult("auth", AUTH_VALIDATION_ERROR_MESSAGE);
  }

  const adminOrdersDataAccess = createAdminOrdersDataAccess(supabase);
  const { data: editSnapshot, error: editSnapshotError } = await loadOrderEditSnapshot(
    adminOrdersDataAccess,
    orderId
  );

  if (editSnapshotError) {
    console.error("[admin/orders] failed to load order edit snapshot", {
      orderId,
      message: editSnapshotError.message,
      code: editSnapshotError.code,
    });
    return updateOrderErrorResult("unknown", UPDATE_ORDER_DETAILS_ERROR_MESSAGE);
  }

  if (!editSnapshot) {
    console.warn("[admin/orders] attempted to edit missing or non-operational order", {
      orderId,
    });
    return updateOrderErrorResult("validation", INVALID_ORDER_DETAILS_MESSAGE);
  }

  if (editSnapshot.updatedAt !== expectedUpdatedAt) {
    return staleOrderEditResult(adminOrdersDataAccess, orderId);
  }

  const { data: updatedOrder, error: updateError } =
    await adminOrdersDataAccess.updateAdminOrderDetailsConditionally({
      orderId,
      expectedUpdatedAt,
      customerName,
      customerEmail,
      customerPhone,
      notes,
      paymentMethod,
      items: normalizedItems,
    });

  if (updateError) {
    console.error("[admin/orders] failed to update order details", {
      orderId,
      message: updateError.message,
      code: updateError.code,
    });
    return updateOrderErrorResult("unknown", UPDATE_ORDER_DETAILS_ERROR_MESSAGE);
  }

  if (!updatedOrder) {
    return staleOrderEditResult(adminOrdersDataAccess, orderId);
  }

  revalidatePath("/admin");

  return {
    ok: true,
    order: updatedOrder,
  };
}

function errorResult(
  code: "setup" | "auth" | "validation" | "unknown",
  message: string
): Extract<ProgressOrderResult, { ok: false; code: "setup" | "auth" | "validation" | "unknown" }> {
  return { ok: false, code, message };
}

function updateOrderErrorResult(
  code: "setup" | "auth" | "validation" | "unknown",
  message: string
): Extract<UpdateOrderDetailsResult, { ok: false; code: "setup" | "auth" | "validation" | "unknown" }> {
  return { ok: false, code, message };
}

async function loadOrderStatusSnapshot(
  adminOrdersDataAccess: AdminOrdersDataAccess,
  orderId: string
) {
  return adminOrdersDataAccess.getAdminOrderStatusSnapshot(orderId);
}

async function loadOrderEditSnapshot(
  adminOrdersDataAccess: AdminOrdersDataAccess,
  orderId: string
) {
  return adminOrdersDataAccess.getAdminOrderEditSnapshot(orderId);
}

async function staleOrderEditResult(
  adminOrdersDataAccess: AdminOrdersDataAccess,
  orderId: string
): Promise<Extract<UpdateOrderDetailsResult, { ok: false; code: "stale" }>> {
  const { data: currentOrder, error } = await adminOrdersDataAccess.getAdminOrderById(orderId);
  if (error) {
    console.error("[admin/orders] failed to reload order after stale edit conflict", {
      orderId,
      message: error.message,
      code: error.code,
    });
  }

  return {
    ok: false,
    code: "stale",
    message: INVALID_ORDER_EDIT_CONFLICT_MESSAGE,
    currentOrder: currentOrder ?? null,
  };
}

type AdminEditedItemSnapshot = {
  name: string;
  quantity: number;
  menuItemId: string;
  unitPriceCents: number;
  lineTotalCents: number;
  extras?: Array<{ id: string; name: string; priceCents: number }>;
  removedIngredients?: Array<{ id: string; name: string }>;
};

function normalizeSelectedItemsForAdmin(
  items: UpdateOrderDetailsInput["items"],
  menuMap: Map<string, MenuItem>
): AdminEditedItemSnapshot[] | null {
  if (!Array.isArray(items)) return null;
  if (items.length === 0 || items.length > MAX_ORDER_LINE_ITEMS) return null;

  const aggregated = new Map<
    string,
    {
      menuItemId: string;
      quantity: number;
      unitPriceCents: number;
      extras: Array<{ id: string; name: string; priceCents: number }>;
      removedIngredients: Array<{ id: string; name: string }>;
    }
  >();

  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const menuItemId = sanitizeText(item.menuItemId);
    const quantity = toPositiveInt(item.quantity);
    if (!menuItemId || !quantity) return null;

    const menuItem = menuMap.get(menuItemId);
    if (!menuItem) return null;
    if (typeof menuItem.priceCents !== "number" || menuItem.priceCents < 0) return null;

    const normalizedExtraIds = normalizeIdList(item.extraIds);
    const normalizedRemovedIngredientIds = normalizeIdList(item.removedIngredientIds);
    if (!normalizedExtraIds || !normalizedRemovedIngredientIds) return null;
    if (normalizedExtraIds.length > MAX_EXTRAS_PER_ITEM) return null;
    if (normalizedRemovedIngredientIds.length > MAX_REMOVED_INGREDIENTS_PER_ITEM) return null;

    const extrasById = new Map((menuItem.extras ?? []).map((extra) => [extra.id, extra]));
    const extras = normalizedExtraIds.map((extraId) => {
      const extra = extrasById.get(extraId);
      if (!extra || typeof extra.priceCents !== "number" || extra.priceCents < 0) return null;
      return { id: extra.id, name: extra.name, priceCents: extra.priceCents };
    });
    if (extras.some((extra) => extra === null)) return null;

    const removableIngredientsById = new Map(
      (menuItem.removableIngredients ?? []).map((ingredient) => [ingredient.id, ingredient])
    );
    const removedIngredients = normalizedRemovedIngredientIds.map((ingredientId) => {
      const ingredient = removableIngredientsById.get(ingredientId);
      if (!ingredient) return null;
      return { id: ingredient.id, name: ingredient.name };
    });
    if (removedIngredients.some((ingredient) => ingredient === null)) return null;

    const key = JSON.stringify([menuItemId, normalizedExtraIds, normalizedRemovedIngredientIds]);
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += quantity;
      continue;
    }

    aggregated.set(key, {
      menuItemId,
      quantity,
      unitPriceCents: menuItem.priceCents,
      extras: extras as Array<{ id: string; name: string; priceCents: number }>,
      removedIngredients: removedIngredients as Array<{ id: string; name: string }>,
    });
  }

  return Array.from(aggregated.values()).map((entry) => {
    const menuItem = menuMap.get(entry.menuItemId);
    const extrasTotalCents = entry.extras.reduce((sum, extra) => sum + extra.priceCents, 0);
    const lineTotalCents = (entry.unitPriceCents + extrasTotalCents) * entry.quantity;

    return {
      name: menuItem?.name ?? "Item",
      quantity: entry.quantity,
      menuItemId: entry.menuItemId,
      unitPriceCents: entry.unitPriceCents,
      lineTotalCents,
      ...(entry.extras.length > 0 ? { extras: entry.extras } : {}),
      ...(entry.removedIngredients.length > 0
        ? { removedIngredients: entry.removedIngredients }
        : {}),
    };
  });
}

function normalizeIdList(value: unknown): string[] | null {
  if (typeof value === "undefined") return [];
  if (!Array.isArray(value)) return null;
  const unique = new Set<string>();
  for (const raw of value) {
    const id = sanitizeText(raw);
    if (!id || id.length > MAX_CUSTOMIZATION_ID_LENGTH) return null;
    unique.add(id);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
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
