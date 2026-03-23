/**
 * Shared validation and snapshot building for order submission and admin edit.
 * Used by both customer submit (app/actions) and admin order edit (app/admin/actions).
 */

import {
  getDeliveryFeeCentsForFulfillmentType,
  normalizeFulfillmentType,
  type FulfillmentType,
} from "@/lib/fulfillment-types";
import type { MenuItem } from "@/lib/menu";
import { normalizeBrazilPhone } from "@/lib/phone";
import {
  normalizePaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods";

const VALIDATION_REQUIRED_MESSAGE =
  "Preencha nome, telefone, forma de pagamento e selecione pelo menos um item.";
const VALIDATION_EMAIL_MESSAGE = "Informe um e-mail válido.";
const VALIDATION_PHONE_MESSAGE = "Telefone inválido. Use um número brasileiro válido.";
const VALIDATION_PAYMENT_METHOD_MESSAGE = "Selecione uma forma de pagamento válida.";
const VALIDATION_FULFILLMENT_TYPE_MESSAGE = "Selecione um tipo de entrega válido.";
const VALIDATION_ITEMS_MESSAGE = "Selecione itens válidos do cardápio para enviar o pedido.";
const VALIDATION_PRICING_MESSAGE =
  "Alguns itens selecionados estão sem preço configurado. Revise o cardápio e tente novamente.";
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

export type OrderSubmitInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  fulfillmentType: FulfillmentType;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    extraIds?: string[];
    removedIngredientIds?: string[];
  }>;
};

export type OrderEditPayload = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  payment_method: string;
  fulfillment_type: string;
  delivery_fee_cents: number;
  notes: string | null;
  items: OrderItemSnapshot[];
};

export type OrderItemSnapshot = {
  name: string;
  quantity: number;
  menuItemId: string;
  unitPriceCents: number;
  lineTotalCents: number;
  extras?: OrderItemExtraSnapshot[];
  removedIngredients?: OrderItemRemovedIngredientSnapshot[];
};

type OrderItemExtraSnapshot = { id: string; name: string; priceCents: number };
type OrderItemRemovedIngredientSnapshot = { id: string; name: string };

export type ValidateOrderResult =
  | { ok: true; payload: OrderEditPayload }
  | { ok: false; message: string };

export function validateAndBuildOrderPayload(
  input: OrderSubmitInput,
  menuMap: Map<string, MenuItem>
): ValidateOrderResult {
  const rawCustomerEmail = input.customerEmail as unknown;
  if (typeof rawCustomerEmail !== "string" && typeof rawCustomerEmail !== "undefined") {
    return { ok: false, message: VALIDATION_EMAIL_MESSAGE };
  }

  const customerName = sanitizeText(input.customerName);
  const customerEmail = sanitizeOptionalText(
    typeof rawCustomerEmail === "string" ? rawCustomerEmail : undefined
  );
  const customerPhone = sanitizeText(input.customerPhone);
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  const fulfillmentType = normalizeFulfillmentType(input.fulfillmentType);
  const notes = sanitizeOptionalText(input.notes);

  if (
    customerName.length > MAX_CUSTOMER_NAME_LENGTH ||
    (customerEmail?.length ?? 0) > MAX_CUSTOMER_EMAIL_LENGTH ||
    customerPhone.length > MAX_CUSTOMER_PHONE_LENGTH ||
    (notes?.length ?? 0) > MAX_NOTES_LENGTH
  ) {
    return { ok: false, message: VALIDATION_TOO_LARGE_MESSAGE };
  }

  if (!customerName || !customerPhone) {
    return { ok: false, message: VALIDATION_REQUIRED_MESSAGE };
  }

  if (customerEmail && !isBasicEmail(customerEmail)) {
    return { ok: false, message: VALIDATION_EMAIL_MESSAGE };
  }

  const normalizedPhone = normalizeBrazilPhone(customerPhone);

  if (!normalizedPhone) {
    return { ok: false, message: VALIDATION_PHONE_MESSAGE };
  }

  if (!paymentMethod) {
    return { ok: false, message: VALIDATION_PAYMENT_METHOD_MESSAGE };
  }
  if (!fulfillmentType) {
    return { ok: false, message: VALIDATION_FULFILLMENT_TYPE_MESSAGE };
  }

  let orderItems: OrderItemSnapshot[];
  try {
    const parsed = normalizeSelectedItems(input.items, menuMap);
    if (!parsed || parsed.length === 0) {
      return { ok: false, message: VALIDATION_ITEMS_MESSAGE };
    }
    orderItems = parsed;
  } catch (error) {
    if (error instanceof MissingPriceSnapshotError) {
      return { ok: false, message: VALIDATION_PRICING_MESSAGE };
    }
    throw error;
  }

  const deliveryFeeCents = getDeliveryFeeCentsForFulfillmentType(fulfillmentType);

  return {
    ok: true,
    payload: {
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: normalizedPhone,
      payment_method: paymentMethod,
      fulfillment_type: fulfillmentType,
      delivery_fee_cents: deliveryFeeCents,
      notes,
      items: orderItems,
    },
  };
}

function normalizeSelectedItems(
  items: OrderSubmitInput["items"],
  menuMap: Map<string, MenuItem>
): OrderItemSnapshot[] | null {
  if (!Array.isArray(items)) return null;
  if (items.length === 0 || items.length > MAX_ORDER_LINE_ITEMS) return null;

  const aggregated = new Map<
    string,
    {
      menuItemId: string;
      quantity: number;
      unitPriceCents: number;
      extras: OrderItemExtraSnapshot[];
      removedIngredients: OrderItemRemovedIngredientSnapshot[];
    }
  >();

  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const menuItemId = sanitizeText(item.menuItemId);
    const quantity = toPositiveInt(item.quantity);

    if (!menuItemId || !quantity) return null;
    const menuItem = menuMap.get(menuItemId);
    if (!menuItem) return null;
    assertValidPriceCents(menuItem.priceCents, "base item missing priceCents");

    const normalizedExtraIds = normalizeExtraIds(item.extraIds);
    if (!normalizedExtraIds) return null;
    if (normalizedExtraIds.length > MAX_EXTRAS_PER_ITEM) return null;
    const normalizedRemovedIngredientIds = normalizeRemovedIngredientIds(item.removedIngredientIds);
    if (!normalizedRemovedIngredientIds) return null;
    if (normalizedRemovedIngredientIds.length > MAX_REMOVED_INGREDIENTS_PER_ITEM) return null;

    const extrasById = new Map((menuItem.extras ?? []).map((extra) => [extra.id, extra]));
    const extras = normalizedExtraIds.map((extraId) => {
      const extra = extrasById.get(extraId);
      if (!extra) return null;
      assertValidPriceCents(extra.priceCents, "extra missing priceCents");
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

    const comparisonKey = buildOrderItemAggregationKey(
      menuItemId,
      normalizedExtraIds,
      normalizedRemovedIngredientIds
    );
    const existing = aggregated.get(comparisonKey);

    if (existing) {
      existing.quantity += quantity;
      continue;
    }

    aggregated.set(comparisonKey, {
      menuItemId,
      quantity,
      unitPriceCents: menuItem.priceCents!,
      extras: extras as OrderItemExtraSnapshot[],
      removedIngredients: removedIngredients as OrderItemRemovedIngredientSnapshot[],
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

function normalizeExtraIds(value: unknown): string[] | null {
  return normalizeStringIdList(value);
}

function normalizeRemovedIngredientIds(value: unknown): string[] | null {
  return normalizeStringIdList(value);
}

function normalizeStringIdList(value: unknown): string[] | null {
  if (typeof value === "undefined") return [];
  if (!Array.isArray(value)) return null;

  const unique = new Set<string>();
  for (const raw of value) {
    const id = sanitizeText(typeof raw === "string" ? raw : "");
    if (!id) return null;
    if (id.length > MAX_CUSTOMIZATION_ID_LENGTH) return null;
    unique.add(id);
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function buildOrderItemAggregationKey(
  menuItemId: string,
  extraIds: string[],
  removedIngredientIds: string[]
) {
  return JSON.stringify([menuItemId, extraIds, removedIngredientIds]);
}

class MissingPriceSnapshotError extends Error {}

function assertValidPriceCents(
  value: unknown,
  message: string
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new MissingPriceSnapshotError(message);
  }
}

function sanitizeText(value: string): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeOptionalText(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isBasicEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}
