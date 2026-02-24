export const PAYMENT_METHOD_LABELS = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
} as const;

const MAX_PAYMENT_METHOD_INPUT_LENGTH = 32;

export type PaymentMethod = keyof typeof PAYMENT_METHOD_LABELS;

export const PAYMENT_METHOD_VALUES = Object.keys(
  PAYMENT_METHOD_LABELS
) as PaymentMethod[];

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_VALUES.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
})) as Array<{ value: PaymentMethod; label: string }>;

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PAYMENT_METHOD_INPUT_LENGTH) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  return PAYMENT_METHOD_VALUES.includes(normalized as PaymentMethod)
    ? (normalized as PaymentMethod)
    : null;
}

export function getPaymentMethodLabel(value: unknown): string | null {
  const normalized = normalizePaymentMethod(value);
  return normalized ? PAYMENT_METHOD_LABELS[normalized] : null;
}
