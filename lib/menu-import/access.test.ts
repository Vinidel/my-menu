import { afterEach, describe, expect, it } from "vitest";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "./access";

describe("menu import access guard", () => {
  const originalAllowedEmails = process.env.MENU_IMPORT_ALLOWED_EMAILS;

  afterEach(() => {
    process.env.MENU_IMPORT_ALLOWED_EMAILS = originalAllowedEmails;
  });

  it("allows only the configured owner email (brief: strict allowlist)", () => {
    delete process.env.MENU_IMPORT_ALLOWED_EMAILS;
    expect(canUseMenuImport("vinidroid@gmail.com")).toBe(true);
    expect(canUseMenuImport("VINIDROID@GMAIL.COM")).toBe(true);
    expect(canUseMenuImport("other@example.com")).toBe(false);
    expect(canUseMenuImport(null)).toBe(false);
    expect(canUseMenuImport(undefined)).toBe(false);
  });

  it("supports env allowlist with comma-separated emails and ignores blanks (hardening: robust env parsing)", () => {
    process.env.MENU_IMPORT_ALLOWED_EMAILS = "owner@example.com, ,  vinidroid@gmail.com  ";

    expect(canUseMenuImport("owner@example.com")).toBe(true);
    expect(canUseMenuImport("VINIDROID@GMAIL.COM")).toBe(true);
    expect(canUseMenuImport("other@example.com")).toBe(false);
  });

  it("exposes a stable forbidden message for UI/api responses", () => {
    expect(MENU_IMPORT_FORBIDDEN_MESSAGE).toBe("Acesso não autorizado para importar cardápio.");
  });
});
