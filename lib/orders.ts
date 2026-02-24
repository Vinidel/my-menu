import type { Database, Json } from "@/lib/supabase/database.types";

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
  extras?: Array<{
    id?: string;
    name: string;
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
};

type RowLike = Record<string, unknown>;
type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];

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

  const items = parseOrderItems(record.items as Json);

  const notes =
    stringFrom(record.notes) ??
    stringFrom(record.observacoes) ??
    null;

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
  };
}

function parseOrderItems(value: Json | unknown): AdminOrderItem[] {
  const parsed = parseUnknownItemsValue(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
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

      return {
        name,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1,
        ...(extras.length > 0 ? { extras } : {}),
      };
    })
    .filter((item): item is AdminOrderItem => item !== null);
}

function parseOrderItemExtras(
  value: unknown
): Array<{
  id?: string;
  name: string;
}> {
  const parsed = parseUnknownItemsValue(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((extra) => {
      if (!extra || typeof extra !== "object") return null;
      const row = extra as RowLike;
      const name =
        stringFrom(row.name) ??
        stringFrom(row.nome) ??
        stringFrom(row.label) ??
        stringFrom(row.title);
      if (!name) return null;

      const id = stringFrom(row.id) ?? undefined;
      return {
        ...(id ? { id } : {}),
        name,
      };
    })
    .filter((extra): extra is { id?: string; name: string } => extra !== null);
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
