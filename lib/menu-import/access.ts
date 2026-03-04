const MENU_IMPORT_ALLOWED_EMAIL = "vinidroid@gmail.com";

export function canUseMenuImport(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === MENU_IMPORT_ALLOWED_EMAIL;
}

export const MENU_IMPORT_FORBIDDEN_MESSAGE =
  "Acesso não autorizado para importar cardápio.";

