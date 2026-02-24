"use server";

import { revalidatePath } from "next/cache";
import { getMenuItemMap } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const SETUP_ERROR_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const VALIDATION_REQUIRED_MESSAGE =
  "Preencha nome, e-mail, telefone e selecione pelo menos um item.";
const VALIDATION_EMAIL_MESSAGE = "Informe um e-mail válido.";
const VALIDATION_PHONE_MESSAGE = "Informe um telefone válido.";
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

export type SubmitCustomerOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    extraIds?: string[];
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
type OrdersTablesClient = {
  from: (table: "customers" | "orders") => unknown;
};
type OrderItemExtraSnapshot = { id: string; name: string; priceCents: number };
type OrderItemSnapshot = {
  name: string;
  quantity: number;
  menuItemId: string;
  unitPriceCents: number;
  lineTotalCents: number;
  extras?: OrderItemExtraSnapshot[];
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
  supabase: OrdersTablesClient
): Promise<SubmitCustomerOrderResult> {
  const customerName = sanitizeText(input.customerName);
  const customerEmail = sanitizeText(input.customerEmail);
  const customerPhone = sanitizeText(input.customerPhone);
  const notes = sanitizeOptionalText(input.notes);

  if (
    customerName.length > MAX_CUSTOMER_NAME_LENGTH ||
    customerEmail.length > MAX_CUSTOMER_EMAIL_LENGTH ||
    customerPhone.length > MAX_CUSTOMER_PHONE_LENGTH ||
    (notes?.length ?? 0) > MAX_NOTES_LENGTH
  ) {
    return submitErrorResult("validation", VALIDATION_TOO_LARGE_MESSAGE);
  }

  if (!customerName || !customerEmail || !customerPhone) {
    return submitErrorResult("validation", VALIDATION_REQUIRED_MESSAGE);
  }

  if (!isBasicEmail(customerEmail)) {
    return submitErrorResult("validation", VALIDATION_EMAIL_MESSAGE);
  }

  const normalizedEmail = normalizeEmail(customerEmail);
  const normalizedPhone = normalizePhone(customerPhone);

  if (!normalizedPhone) {
    return submitErrorResult("validation", VALIDATION_PHONE_MESSAGE);
  }

  const menuMap = getMenuItemMap();
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
    eq: (column: "email_normalized", value: string) => {
      eq: (column: "phone_normalized", value: string) => {
        maybeSingle: () => Promise<{
          data: Pick<CustomerRow, "id"> | null;
          error: { message: string; code?: string | null } | null;
        }>;
      };
    };
  };
};

type CustomersInsertChain = {
  insert: (values: CustomerInsert) => {
    select: (columns: "id") => {
      single: () => Promise<{
        data: Pick<CustomerRow, "id"> | null;
        error: { message: string; code?: string | null } | null;
      }>;
    };
  };
};

type OrdersInsertChain = {
  insert: (values: OrderInsert) => {
    select: (columns: "reference") => {
      single: () => Promise<{
        data: { reference: string } | null;
        error: { message: string; code?: string | null } | null;
      }>;
    };
  };
};

async function findOrCreateCustomer(
  supabase: OrdersTablesClient,
  input: FindOrCreateCustomerInput
): Promise<string | null> {
  const { data: existingCustomer, error: selectError } = await findCustomerByNormalizedContact(
    supabase,
    input.email_normalized,
    input.phone_normalized
  );

  if (selectError) {
    console.error("[customer/orders] failed to query customers for dedupe", {
      message: selectError.message,
      code: selectError.code,
    });
    return null;
  }

  if (existingCustomer?.id) {
    return existingCustomer.id;
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
    // Another request inserted the same normalized customer between select and insert.
    const { data: retriedCustomer, error: retryError } = await findCustomerByNormalizedContact(
      supabase,
      input.email_normalized,
      input.phone_normalized
    );

    if (!retryError && retriedCustomer?.id) {
      return retriedCustomer.id;
    }

    console.error("[customer/orders] duplicate customer insert retry failed", {
      insertCode: insertError.code,
      retryCode: retryError?.code,
      retryMessage: retryError?.message,
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

    const extrasById = new Map((menuItem.extras ?? []).map((extra) => [extra.id, extra]));
    const extras = normalizedExtraIds.map((extraId) => {
      const extra = extrasById.get(extraId);
      if (!extra) return null;
      assertValidPriceCents(extra.priceCents, "extra missing priceCents");
      return { id: extra.id, name: extra.name, priceCents: extra.priceCents };
    });
    if (extras.some((extra) => extra === null)) return null;

    const comparisonKey = buildOrderItemAggregationKey(menuItemId, normalizedExtraIds);
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
    };
  });
}

function normalizeExtraIds(value: unknown): string[] | null {
  if (typeof value === "undefined") return [];
  if (!Array.isArray(value)) return null;

  const unique = new Set<string>();
  for (const raw of value) {
    const extraId = sanitizeText(typeof raw === "string" ? raw : "");
    if (!extraId) return null;
    unique.add(extraId);
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function buildOrderItemAggregationKey(menuItemId: string, extraIds: string[]) {
  return `${menuItemId}::${extraIds.join("|")}`;
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

function normalizeEmail(value: string): string {
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
