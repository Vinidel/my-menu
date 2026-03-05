import { describe, expect, it } from "vitest";
import {
  formatBrazilPhoneDisplay,
  formatBrazilPhoneMask,
  normalizeBrazilPhone,
  resolveStorePhoneContact,
  toBrazilPhoneTelHref,
} from "./phone";

describe("phone helpers", () => {
  it("normalizes BR phones with and without +55 prefix", () => {
    expect(normalizeBrazilPhone("(11) 98765-4321")).toBe("11987654321");
    expect(normalizeBrazilPhone("+55 (11) 98765-4321")).toBe("11987654321");
    expect(normalizeBrazilPhone("1134567890")).toBe("1134567890");
  });

  it("rejects invalid BR phone sizes", () => {
    expect(normalizeBrazilPhone("11999")).toBeNull();
    expect(normalizeBrazilPhone("5511999")).toBeNull();
    expect(normalizeBrazilPhone("")).toBeNull();
  });

  it("formats masked typing output for 10 and 11 digits", () => {
    expect(formatBrazilPhoneMask("1134567890")).toBe("(11) 3456-7890");
    expect(formatBrazilPhoneMask("11987654321")).toBe("(11) 98765-4321");
    expect(formatBrazilPhoneMask("+55 (11) 98765-4321")).toBe("(11) 98765-4321");
  });

  it("formats display label and tel href from normalized value", () => {
    expect(formatBrazilPhoneDisplay("11987654321")).toBe("(11) 98765-4321");
    expect(toBrazilPhoneTelHref("11987654321")).toBe("tel:+5511987654321");
  });

  it("resolves store phone contact only for valid BR values", () => {
    expect(resolveStorePhoneContact("+55 (48) 99958-5067")).toEqual({
      display: "(48) 99958-5067",
      href: "tel:+5548999585067",
    });
    expect(resolveStorePhoneContact("123")).toBeNull();
    expect(resolveStorePhoneContact(undefined)).toBeNull();
  });
});
