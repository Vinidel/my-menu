import type { Database, Json } from "@/lib/supabase/database.types";
import {
  getPaymentMethodLabel,
  normalizePaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods";

export const ORDER_STATUS_LABELS = {
  aguardando_confirmacao: "Esperando confirmação",
  em_preparo: "Em preparo",
  entregue: "Entregue",
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;

export const ORDER_STATUS_SEQUENCE: readonly OrderStatus[] = [
  "aguardando_confirmacao",
  "em_preparo",
  "entregue",
] as const;

export type AdminOrderItem = {
  name: string;
  quantity: number;
  unitPriceCents?: number;
  lineTotalCents?: number;
  extras?: Array<{
    id?: string;
    name: string;
    priceCents?: number;
  }>;
};

export type AdminOrder = {
  id: string;
  reference: string;
  createdAtIso: string | null;
  createdAtLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: AdminOrderItem[];
  status: OrderStatus | null;
  statusLabel: string;
  rawStatus: string | null;
  notes: string | null;
  paymentMethod: PaymentMethod | null;
  paymentMethodLabel: string;
  totalAmountCents?: number | null;
  totalAmountLabel?: string;
};

type RowLike = Record<string, unknown>;
type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];
type ParsedOrderItemExtra = { id?: string; name: string; priceCents?: number };
const MAX_PARSED_ITEM_EXTRAS = 20;
const MAX_PARSED_EXTRA_NAME_LENGTH = 120;
const MAX_PARSED_EXTRA_ID_LENGTH = 80;
const MAX_PARSED_UNIT_PRICE_CENTS = 1_000_000; // R$ 10.000,00 por unidade
const MAX_PARSED_EXTRA_PRICE_CENTS = 200_000; // R$ 2.000,00 por extra
const MAX_PARSED_LINE_TOTAL_CENTS = 5_000_000; // R$ 50.000,00 por linha
const MAX_PARSED_ORDER_TOTAL_CENTS = 20_000_000; // R$ 200.000,00 por pedido
const ORDER_TOTAL_UNAVAILABLE_LABEL = "Indisponível";
const ORDER_PAYMENT_METHOD_FALLBACK_LABEL = "Não informado";

export function getOrderStatusLabel(status: OrderStatus) {
  return ORDER_STATUS_LABELS[status];
}

export function getNextOrderStatus(status: OrderStatus | null): OrderStatus | null {
  if (!status) return null;
  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(status);
  if (currentIndex < 0) return null;
  return ORDER_STATUS_SEQUENCE[currentIndex + 1] ?? null;
}

export function getStatusLabelFromUnknown(value: unknown): {
  status: OrderStatus | null;
  label: string;
  raw: string | null;
} {
  const raw = typeof value === "string" ? value : null;
  const normalized = normalizeStatus(value);

  if (normalized) {
    return {
      status: normalized,
      label: getOrderStatusLabel(normalized),
      raw,
    };
  }

  if (raw && raw.trim()) {
    return { status: null, label: raw, raw };
  }

  return { status: null, label: "Status desconhecido", raw: null };
}

export function countOrdersByStatus(orders: AdminOrder[]) {
  return orders.reduce<Record<OrderStatus, number>>(
    (acc, order) => {
      if (order.status) acc[order.status] += 1;
      return acc;
    },
    {
      aguardando_confirmacao: 0,
      em_preparo: 0,
      entregue: 0,
    }
  );
}

export function parseAdminOrders(rows: OrdersRow[]): AdminOrder[] {
  return rows
    .map((row, index) => parseAdminOrder(row, index))
    .filter((row): row is AdminOrder => row !== null);
}

export function parseAdminOrder(
  row: OrdersRow | (RowLike & { id?: unknown }),
  fallbackIndex = 0
): AdminOrder | null {
  if (!row || typeof row !== "object") return null;

  const record = row as RowLike;
  const idValue = stringFrom(record.id) ?? stringFrom(record.reference);

  if (!idValue) {
    return null;
  }

  const createdAtRaw = stringFrom(record.created_at) ?? stringFrom(record.createdAt);

  const { status, label: statusLabel, raw: rawStatus } = getStatusLabelFromUnknown(
    record.status
  );

  const customerName =
    stringFrom(record.customer_name) ??
    stringFrom(record.customerName) ??
    "Cliente não informado";

  const customerEmail =
    stringFrom(record.customer_email) ??
    stringFrom(record.customerEmail) ??
    "Não informado";

  const customerPhone =
    stringFrom(record.customer_phone) ??
    stringFrom(record.customerPhone) ??
    "Não informado";

  const { items, totalAmountCents } = parseOrderItemsWithTotal(record.items as Json);

  const notes =
    stringFrom(record.notes) ??
    stringFrom(record.observacoes) ??
    null;
  const { paymentMethod, paymentMethodLabel } = getPaymentMethodLabelFromUnknown(
    record.payment_method ?? record.paymentMethod
  );

  return {
    id: idValue,
    reference:
      stringFrom(record.reference) ??
      `Pedido #${fallbackIndex + 1}`,
    createdAtIso: toIsoString(createdAtRaw),
    createdAtLabel: formatDateTimePtBr(createdAtRaw),
    customerName,
    customerEmail,
    customerPhone,
    items,
    status,
    statusLabel,
    rawStatus,
    notes,
    paymentMethod,
    paymentMethodLabel,
    totalAmountCents,
    totalAmountLabel: formatOrderTotalLabel(totalAmountCents),
  };
}

function getPaymentMethodLabelFromUnknown(value: unknown): {
  paymentMethod: PaymentMethod | null;
  paymentMethodLabel: string;
} {
  const paymentMethod = normalizePaymentMethod(value);
  if (!paymentMethod) {
    return { paymentMethod: null, paymentMethodLabel: ORDER_PAYMENT_METHOD_FALLBACK_LABEL };
  }
  return {
    paymentMethod,
    paymentMethodLabel: getPaymentMethodLabel(paymentMethod) ?? ORDER_PAYMENT_METHOD_FALLBACK_LABEL,
  };
}

function parseOrderItemsWithTotal(
  value: Json | unknown
): { items: AdminOrderItem[]; totalAmountCents: number | null } {
  const parsed = parseUnknownItemsValue(value);
  if (!Array.isArray(parsed)) return { items: [], totalAmountCents: null };

  let canComputeTotal = true;
  let orderTotalCents = 0;

  const items = parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as RowLike;
      const name =
        stringFrom(row.name) ??
        stringFrom(row.item_name) ??
        stringFrom(row.nome) ??
        stringFrom(row.title);
      if (!name) return null;

      const quantity = numberFrom(row.quantity) ?? numberFrom(row.qty) ?? numberFrom(row.qtd) ?? 1;
      const extras = parseOrderItemExtras(row.extras);
      const normalizedQuantity =
        Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
      const unitPriceCents = parseNonNegativeCents(
        row.unitPriceCents ?? row.unit_price_cents,
        MAX_PARSED_UNIT_PRICE_CENTS
      );
      const lineTotalCents = parseNonNegativeCents(
        row.lineTotalCents ?? row.line_total_cents,
        MAX_PARSED_LINE_TOTAL_CENTS
      );
      const parsedUnitPriceCents = toTruncatedInt(unitPriceCents);
      const parsedLineTotalCents = toTruncatedInt(lineTotalCents);
      const itemPricing = computeItemTotalCents({
        quantity: normalizedQuantity,
        unitPriceCents,
        lineTotalCents,
        extras,
      });

      if (itemPricing === null) {
        canComputeTotal = false;
      } else if (canComputeTotal) {
        orderTotalCents += itemPricing;
        if (orderTotalCents > MAX_PARSED_ORDER_TOTAL_CENTS) {
          canComputeTotal = false;
        }
      }

      return {
        name,
        quantity: normalizedQuantity,
        ...(parsedUnitPriceCents !== null ? { unitPriceCents: parsedUnitPriceCents } : {}),
        ...(parsedLineTotalCents !== null ? { lineTotalCents: parsedLineTotalCents } : {}),
        ...(extras.length > 0 ? { extras } : {}),
      };
    })
    .filter((item): item is AdminOrderItem => item !== null);

  return {
    items,
    totalAmountCents: canComputeTotal && items.length > 0 ? orderTotalCents : null,
  };
}

function parseOrderItemExtras(
  value: unknown
): ParsedOrderItemExtra[] {
  const parsed = parseUnknownItemsValue(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, MAX_PARSED_ITEM_EXTRAS)
    .map((extra) => {
      if (!extra || typeof extra !== "object") return null;
      const row = extra as RowLike;
      const name =
        stringFromMax(row.name, MAX_PARSED_EXTRA_NAME_LENGTH) ??
        stringFromMax(row.nome, MAX_PARSED_EXTRA_NAME_LENGTH) ??
        stringFromMax(row.label, MAX_PARSED_EXTRA_NAME_LENGTH) ??
        stringFromMax(row.title, MAX_PARSED_EXTRA_NAME_LENGTH);
      if (!name) return null;

      const id = stringFromMax(row.id, MAX_PARSED_EXTRA_ID_LENGTH) ?? undefined;
      const priceCents = parseNonNegativeCents(
        row.priceCents ?? row.price_cents,
        MAX_PARSED_EXTRA_PRICE_CENTS
      );
      return {
        ...(id ? { id } : {}),
        name,
        ...(priceCents !== null ? { priceCents } : {}),
      };
    })
    .filter((extra): extra is ParsedOrderItemExtra => extra !== null);
}

function computeItemTotalCents(input: {
  quantity: number;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
  extras: Array<{ priceCents?: number }>;
}): number | null {
  if (typeof input.lineTotalCents === "number" && Number.isFinite(input.lineTotalCents)) {
    const parsedLineTotal = toTruncatedInt(input.lineTotalCents);
    if (parsedLineTotal === null || parsedLineTotal < 0 || parsedLineTotal > MAX_PARSED_LINE_TOTAL_CENTS) {
      return null;
    }
    return parsedLineTotal;
  }

  const parsedUnitPrice = toTruncatedInt(input.unitPriceCents);
  if (parsedUnitPrice === null || parsedUnitPrice < 0 || parsedUnitPrice > MAX_PARSED_UNIT_PRICE_CENTS) {
    return null;
  }

  let extrasSum = 0;
  for (const extra of input.extras) {
    const parsedExtraPrice = toTruncatedInt(extra.priceCents ?? null);
    if (
      parsedExtraPrice === null ||
      parsedExtraPrice < 0 ||
      parsedExtraPrice > MAX_PARSED_EXTRA_PRICE_CENTS
    ) {
      return null;
    }
    extrasSum += parsedExtraPrice;
  }

  const computedTotal = (parsedUnitPrice + extrasSum) * input.quantity;
  if (computedTotal < 0 || computedTotal > MAX_PARSED_LINE_TOTAL_CENTS) {
    return null;
  }

  return computedTotal;
}

function formatOrderTotalLabel(totalAmountCents: number | null) {
  if (typeof totalAmountCents !== "number" || !Number.isFinite(totalAmountCents)) {
    return ORDER_TOTAL_UNAVAILABLE_LABEL;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(totalAmountCents / 100);
}

function toTruncatedInt(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function parseNonNegativeCents(value: unknown, max: number): number | null {
  const parsed = toTruncatedInt(numberFrom(value));
  if (parsed === null) return null;
  if (parsed < 0 || parsed > max) return null;
  return parsed;
}

function parseUnknownItemsValue(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeStatus(value: unknown): OrderStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

  if (
    normalized === "aguardando_confirmacao" ||
    normalized === "em_preparo" ||
    normalized === "entregue"
  ) {
    return normalized;
  }

  if (normalized === "esperando_confirmacao") return "aguardando_confirmacao";

  return null;
}

function stringFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stringFromMax(value: unknown, maxLength: number): string | null {
  const parsed = stringFrom(value);
  if (!parsed) return null;
  return parsed.length > maxLength ? parsed.slice(0, maxLength) : parsed;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIsoString(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateTimePtBr(value: string | null): string {
  if (!value) return "Data não informada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
