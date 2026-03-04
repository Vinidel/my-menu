const DEFAULT_ALLOWED_EMAIL = "vinidroid@gmail.com";
const MENU_IMPORT_ALLOWED_EMAILS_ENV = "MENU_IMPORT_ALLOWED_EMAILS";

export function canUseMenuImport(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return resolveAllowedEmails().has(normalizedEmail);
}

export const MENU_IMPORT_FORBIDDEN_MESSAGE =
  "Acesso não autorizado para importar cardápio.";

function resolveAllowedEmails(): Set<string> {
  const raw = process.env[MENU_IMPORT_ALLOWED_EMAILS_ENV];
  const parsed = (raw ?? DEFAULT_ALLOWED_EMAIL)
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => Boolean(entry));

  return new Set(parsed);
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}
