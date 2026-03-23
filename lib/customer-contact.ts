const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeOptionalEmail(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

export function isBasicEmail(value: string): boolean {
  return BASIC_EMAIL_REGEX.test(value.trim());
}
