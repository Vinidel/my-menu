"use server";

import { revalidatePath } from "next/cache";
import { getMenuItemMap, type MenuItem } from "@/lib/menu";
import {
  normalizePaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const SETUP_ERROR_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const VALIDATION_REQUIRED_MESSAGE =
  "Preencha nome, telefone, forma de pagamento e selecione pelo menos um item.";
const VALIDATION_EMAIL_MESSAGE = "Informe um e-mail válido.";
const VALIDATION_PHONE_MESSAGE = "Informe um telefone válido.";
const VALIDATION_PAYMENT_METHOD_MESSAGE = "Selecione uma forma de pagamento válida.";
const VALIDATION_ITEMS_MESSAGE = "Selecione itens válidos do cardápio para enviar o pedido.";
const VALIDATION_PRICING_MESSAGE =
  "Alguns itens selecionados estão sem preço configurado. Revise o cardápio e tente novamente.";
const SUBMIT_ERROR_MESSAGE =
  "Não foi possível enviar seu pedido agora. Tente novamente em instantes.";
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

export type SubmitCustomerOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    extraIds?: string[];
    removedIngredientIds?: string[];
  }>;
};

export type SubmitCustomerOrderResult =
  | { ok: true; orderReference: string }
  | {
      ok: false;
      code: "setup" | "validation" | "unknown";
      message: string;
    };

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];
type CustomerIdRow = Pick<CustomerRow, "id">;
type SupabaseTableError = { message: string; code?: string | null } | null;
type CustomerMaybeSingleResult = Promise<{
  data: CustomerIdRow | null;
  error: SupabaseTableError;
}>;
type OrdersTablesClient = {
  from: (table: "customers" | "orders") => unknown;
};
type OrderItemExtraSnapshot = { id: string; name: string; priceCents: number };
type OrderItemRemovedIngredientSnapshot = { id: string; name: string };
type OrderItemSnapshot = {
  name: string;
  quantity: number;
  menuItemId: string;
  unitPriceCents: number;
  lineTotalCents: number;
  extras?: OrderItemExtraSnapshot[];
  removedIngredients?: OrderItemRemovedIngredientSnapshot[];
};

export async function submitCustomerOrder(
  input: SubmitCustomerOrderInput
): Promise<SubmitCustomerOrderResult> {
  const supabase = await createClient();
  if (!supabase) {
    return submitErrorResult("setup", SETUP_ERROR_MESSAGE);
  }

  return submitCustomerOrderWithClient(input, supabase);
}

export async function submitCustomerOrderWithClient(
  input: SubmitCustomerOrderInput,
  supabase: OrdersTablesClient,
  menuMapOverride?: Map<string, MenuItem>
): Promise<SubmitCustomerOrderResult> {
  const rawCustomerEmail = input.customerEmail as unknown;
  if (typeof rawCustomerEmail !== "string" && typeof rawCustomerEmail !== "undefined") {
    return submitErrorResult("validation", VALIDATION_EMAIL_MESSAGE);
  }

  const customerName = sanitizeText(input.customerName);
  const customerEmail = sanitizeOptionalText(
    typeof rawCustomerEmail === "string" ? rawCustomerEmail : undefined
  );
  const customerPhone = sanitizeText(input.customerPhone);
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  const notes = sanitizeOptionalText(input.notes);

  if (
    customerName.length > MAX_CUSTOMER_NAME_LENGTH ||
    (customerEmail?.length ?? 0) > MAX_CUSTOMER_EMAIL_LENGTH ||
    customerPhone.length > MAX_CUSTOMER_PHONE_LENGTH ||
    (notes?.length ?? 0) > MAX_NOTES_LENGTH
  ) {
    return submitErrorResult("validation", VALIDATION_TOO_LARGE_MESSAGE);
  }

  if (!customerName || !customerPhone) {
    return submitErrorResult("validation", VALIDATION_REQUIRED_MESSAGE);
  }

  if (customerEmail && !isBasicEmail(customerEmail)) {
    return submitErrorResult("validation", VALIDATION_EMAIL_MESSAGE);
  }

  const normalizedEmail = normalizeOptionalEmail(customerEmail);
  const normalizedPhone = normalizePhone(customerPhone);

  if (!normalizedPhone) {
    return submitErrorResult("validation", VALIDATION_PHONE_MESSAGE);
  }

  if (!paymentMethod) {
    return submitErrorResult("validation", VALIDATION_PAYMENT_METHOD_MESSAGE);
  }

  const menuMap = menuMapOverride ?? getMenuItemMap();
  let orderItems: ReturnType<typeof normalizeSelectedItems>;
  try {
    orderItems = normalizeSelectedItems(input.items, menuMap);
  } catch (error) {
    if (error instanceof MissingPriceSnapshotError) {
      return submitErrorResult("validation", VALIDATION_PRICING_MESSAGE);
    }

    throw error;
  }
  if (!orderItems || orderItems.length === 0) {
    return submitErrorResult("validation", VALIDATION_ITEMS_MESSAGE);
  }

  try {
    const customerId = await findOrCreateCustomer(supabase, {
      name: customerName,
      email: normalizedEmail,
      phone: normalizedPhone,
      email_normalized: normalizedEmail,
      phone_normalized: normalizedPhone,
    });

    if (!customerId) {
      console.error("[customer/orders] failed to resolve customer id");
      return submitUnknownError();
    }

    const orderPayload: OrderInsert = {
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      payment_method: paymentMethod,
      notes,
      items: orderItems,
      status: "aguardando_confirmacao" satisfies OrderStatus,
    };

    const orderInsert = asOrdersInsertChain(supabase.from("orders"));
    const { data: orderRow, error: orderError } = await orderInsert
      .insert(orderPayload)
      .select("reference")
      .single();

    if (orderError || !orderRow?.reference) {
      console.error("[customer/orders] failed to create order", {
        message: orderError?.message ?? "missing order reference",
        code: orderError?.code,
      });
      return submitUnknownError();
    }

    revalidatePath("/admin");

    return { ok: true, orderReference: orderRow.reference };
  } catch (error) {
    console.error("[customer/orders] unexpected error during order submission", {
      message: error instanceof Error ? error.message : String(error),
    });
    return submitUnknownError();
  }
}

type FindOrCreateCustomerInput = CustomerInsert;

type CustomersSelectChain = {
  select: (columns: "id") => {
    eq: (column: "email_normalized" | "phone_normalized" | "id", value: string) => {
      eq: (column: "phone_normalized" | "id", value: string) => {
        is: (
          column: "email_normalized",
          value: null
        ) => {
          maybeSingle: () => CustomerMaybeSingleResult;
        };
        maybeSingle: () => CustomerMaybeSingleResult;
      };
      is: (
        column: "email_normalized",
        value: null
      ) => {
        maybeSingle: () => CustomerMaybeSingleResult;
      };
    };
    is: (
      column: "email_normalized",
      value: null
    ) => {
      maybeSingle: () => CustomerMaybeSingleResult;
    };
  };
};

type CustomersInsertChain = {
  insert: (values: CustomerInsert) => {
    select: (columns: "id") => {
      single: () => Promise<{
        data: CustomerIdRow | null;
        error: SupabaseTableError;
      }>;
    };
  };
};

type CustomersUpdateChain = {
  update: (values: Database["public"]["Tables"]["customers"]["Update"]) => {
    eq: (column: "id", value: string) => {
      is: (
        column: "email_normalized",
        value: null
      ) => {
        select: (columns: "id") => {
          maybeSingle: () => CustomerMaybeSingleResult;
        };
      };
    };
  };
};

type OrdersInsertChain = {
  insert: (values: OrderInsert) => {
    select: (columns: "reference") => {
      single: () => Promise<{
        data: { reference: string } | null;
        error: SupabaseTableError;
      }>;
    };
  };
};

async function findOrCreateCustomer(
  supabase: OrdersTablesClient,
  input: FindOrCreateCustomerInput
): Promise<string | null> {
  const hasEmail = Boolean(input.email_normalized);

  if (hasEmail && input.email_normalized) {
    const { data: customerByEmailAndPhone, error: byEmailError } =
      await findCustomerByNormalizedContact(
        supabase,
        input.email_normalized,
        input.phone_normalized
      );
    if (byEmailError) {
      console.error("[customer/orders] failed to query customers by email+phone", {
        message: byEmailError.message,
        code: byEmailError.code,
      });
      return null;
    }
    if (customerByEmailAndPhone?.id) {
      return customerByEmailAndPhone.id;
    }

    const { data: phoneOnlyCustomer, error: phoneOnlyError } =
      await findCustomerByPhoneWithoutEmail(supabase, input.phone_normalized);
    if (phoneOnlyError) {
      console.error("[customer/orders] failed to query phone-only customer for upgrade", {
        message: phoneOnlyError.message,
        code: phoneOnlyError.code,
      });
      return null;
    }

    if (phoneOnlyCustomer?.id && input.email && input.email_normalized) {
      const upgradedCustomer = await upgradePhoneOnlyCustomerWithEmail(
        supabase,
        phoneOnlyCustomer.id,
        input.email,
        input.email_normalized
      );
      if (upgradedCustomer?.id) {
        return upgradedCustomer.id;
      }

      const { data: retriedByEmail, error: retriedByEmailError } =
        await findCustomerByNormalizedContact(
          supabase,
          input.email_normalized,
          input.phone_normalized
        );
      if (retriedByEmailError) {
        console.error("[customer/orders] failed to retry customer query after upgrade", {
          message: retriedByEmailError.message,
          code: retriedByEmailError.code,
        });
        return null;
      }
      if (retriedByEmail?.id) {
        return retriedByEmail.id;
      }
    }
  } else {
    const { data: phoneOnlyCustomer, error: phoneOnlyError } =
      await findCustomerByPhoneWithoutEmail(supabase, input.phone_normalized);
    if (phoneOnlyError) {
      console.error("[customer/orders] failed to query phone-only customer", {
        message: phoneOnlyError.message,
        code: phoneOnlyError.code,
      });
      return null;
    }

    if (phoneOnlyCustomer?.id) {
      return phoneOnlyCustomer.id;
    }
  }

  const customersInsert = asCustomersInsertChain(supabase.from("customers"));
  const { data: insertedCustomer, error: insertError } = await customersInsert
    .insert(input)
    .select("id")
    .single();

  if (!insertError && insertedCustomer?.id) {
    return insertedCustomer.id;
  }

  if (insertError?.code === "23505") {
    // Another request inserted/updated the same customer between select and insert.
    if (hasEmail && input.email_normalized) {
      const { data: retriedByEmailAndPhone, error: retryByEmailError } =
        await findCustomerByNormalizedContact(
          supabase,
          input.email_normalized,
          input.phone_normalized
        );

      if (!retryByEmailError && retriedByEmailAndPhone?.id) {
        return retriedByEmailAndPhone.id;
      }

      console.error("[customer/orders] duplicate customer insert retry failed", {
        insertCode: insertError.code,
        retryCode: retryByEmailError?.code,
        retryMessage: retryByEmailError?.message,
      });
      return null;
    }

    const { data: retriedByPhoneOnly, error: retryByPhoneError } =
      await findCustomerByPhoneWithoutEmail(supabase, input.phone_normalized);

    if (!retryByPhoneError && retriedByPhoneOnly?.id) {
      return retriedByPhoneOnly.id;
    }

    console.error("[customer/orders] duplicate customer insert retry failed", {
      insertCode: insertError.code,
      retryCode: retryByPhoneError?.code,
      retryMessage: retryByPhoneError?.message,
    });
    return null;
  }

  console.error("[customer/orders] failed to insert customer", {
    message: insertError?.message ?? "unknown",
    code: insertError?.code,
  });
  return null;
}

function findCustomerByNormalizedContact(
  supabase: OrdersTablesClient,
  emailNormalized: string,
  phoneNormalized: string
) {
  const customersSelect = asCustomersSelectChain(supabase.from("customers"));

  return customersSelect
    .select("id")
    .eq("email_normalized", emailNormalized)
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();
}

function findCustomerByPhoneWithoutEmail(
  supabase: OrdersTablesClient,
  phoneNormalized: string
) {
  const customersSelect = asCustomersSelectChain(supabase.from("customers"));

  return customersSelect
    .select("id")
    .eq("phone_normalized", phoneNormalized)
    .is("email_normalized", null)
    .maybeSingle();
}

async function upgradePhoneOnlyCustomerWithEmail(
  supabase: OrdersTablesClient,
  customerId: string,
  email: string,
  emailNormalized: string
) {
  const customersUpdate = asCustomersUpdateChain(supabase.from("customers"));
  const { data: upgradedCustomer, error: upgradeError } = await customersUpdate
    .update({
      email,
      email_normalized: emailNormalized,
    })
    .eq("id", customerId)
    .is("email_normalized", null)
    .select("id")
    .maybeSingle();

  if (upgradeError) {
    if (upgradeError.code === "23505") {
      return null;
    }
    console.error("[customer/orders] failed to upgrade phone-only customer with email", {
      message: upgradeError.message,
      code: upgradeError.code,
    });
    return null;
  }

  return upgradedCustomer;
}

function normalizeSelectedItems(
  items: SubmitCustomerOrderInput["items"],
  menuMap: ReturnType<typeof getMenuItemMap>
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
      unitPriceCents: menuItem.priceCents,
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

function normalizeOptionalEmail(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.trim().replace(/\D+/g, "");
}

function isBasicEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function asCustomersSelectChain(value: unknown): CustomersSelectChain {
  return value as CustomersSelectChain;
}

function asCustomersInsertChain(value: unknown): CustomersInsertChain {
  return value as CustomersInsertChain;
}

function asCustomersUpdateChain(value: unknown): CustomersUpdateChain {
  return value as CustomersUpdateChain;
}

function asOrdersInsertChain(value: unknown): OrdersInsertChain {
  return value as OrdersInsertChain;
}

function submitUnknownError(): Extract<
  SubmitCustomerOrderResult,
  { ok: false }
> {
  return submitErrorResult("unknown", SUBMIT_ERROR_MESSAGE);
}

function submitErrorResult(
  code: "setup" | "validation" | "unknown",
  message: string
): Extract<
  SubmitCustomerOrderResult,
  { ok: false }
> {
  return { ok: false, code, message };
}
