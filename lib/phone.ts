const BRAZIL_COUNTRY_CODE = "55";

export function stripNonDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

export function normalizeBrazilPhone(value: string): string | null {
  const stripped = stripNonDigits(value);
  if (!stripped) return null;

  let digits = stripped;
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }

  return null;
}

export function formatBrazilPhoneMask(value: string): string {
  const digits = normalizeBrazilPhoneDigitsForMask(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const area = digits.slice(0, 2);
  const local = digits.slice(2);

  if (digits.length <= 6) {
    return `(${area}) ${local}`;
  }

  if (digits.length <= 10) {
    const prefix = local.slice(0, 4);
    const suffix = local.slice(4, 8);
    return suffix ? `(${area}) ${prefix}-${suffix}` : `(${area}) ${prefix}`;
  }

  const prefix = local.slice(0, 5);
  const suffix = local.slice(5, 9);
  return suffix ? `(${area}) ${prefix}-${suffix}` : `(${area}) ${prefix}`;
}

export function formatBrazilPhoneDisplay(value: string): string | null {
  const normalized = normalizeBrazilPhone(value);
  if (!normalized) return null;

  const area = normalized.slice(0, 2);
  const local = normalized.slice(2);
  if (normalized.length === 10) {
    return `(${area}) ${local.slice(0, 4)}-${local.slice(4)}`;
  }

  return `(${area}) ${local.slice(0, 5)}-${local.slice(5)}`;
}

export function toBrazilPhoneTelHref(value: string): string | null {
  const normalized = normalizeBrazilPhone(value);
  if (!normalized) return null;
  return `tel:+55${normalized}`;
}

function normalizeBrazilPhoneDigitsForMask(value: string): string {
  const stripped = stripNonDigits(value);
  if (!stripped) return "";

  let digits = stripped;
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length > 11) {
    return digits.slice(0, 11);
  }

  return digits;
}
