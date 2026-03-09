export const FULFILLMENT_TYPE_LABELS = {
  retirada: "Retirada",
  entrega: "Entrega",
} as const;

const MAX_FULFILLMENT_TYPE_INPUT_LENGTH = 32;

export const FULFILLMENT_DELIVERY_FEE_CENTS = 500;
export const FULFILLMENT_TYPE_FALLBACK_LABEL = "Não informado";

export type FulfillmentType = keyof typeof FULFILLMENT_TYPE_LABELS;

export const FULFILLMENT_TYPE_VALUES = Object.keys(
  FULFILLMENT_TYPE_LABELS
) as FulfillmentType[];

export const FULFILLMENT_TYPE_OPTIONS = FULFILLMENT_TYPE_VALUES.map((value) => ({
  value,
  label: FULFILLMENT_TYPE_LABELS[value],
})) as Array<{ value: FulfillmentType; label: string }>;

export function normalizeFulfillmentType(value: unknown): FulfillmentType | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FULFILLMENT_TYPE_INPUT_LENGTH) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  return FULFILLMENT_TYPE_VALUES.includes(normalized as FulfillmentType)
    ? (normalized as FulfillmentType)
    : null;
}

export function getFulfillmentTypeLabel(value: unknown): string | null {
  const normalized = normalizeFulfillmentType(value);
  return normalized ? FULFILLMENT_TYPE_LABELS[normalized] : null;
}
