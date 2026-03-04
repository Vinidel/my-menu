import { describe, expect, it } from "vitest";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "./access";

describe("menu import access guard", () => {
  it("allows only the configured owner email (brief: strict allowlist)", () => {
    expect(canUseMenuImport("vinidroid@gmail.com")).toBe(true);
    expect(canUseMenuImport("VINIDROID@GMAIL.COM")).toBe(true);
    expect(canUseMenuImport("other@example.com")).toBe(false);
    expect(canUseMenuImport(null)).toBe(false);
    expect(canUseMenuImport(undefined)).toBe(false);
  });

  it("exposes a stable forbidden message for UI/api responses", () => {
    expect(MENU_IMPORT_FORBIDDEN_MESSAGE).toBe("Acesso não autorizado para importar cardápio.");
  });
});

