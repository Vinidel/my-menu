import { describe, expect, it } from "vitest";
import { getPaymentMethodLabel, normalizePaymentMethod } from "./payment-methods";

describe("payment methods hardening", () => {
  it("normalizes valid canonical payment methods with trim/case folding", () => {
    expect(normalizePaymentMethod("  PIX  ")).toBe("pix");
    expect(normalizePaymentMethod("Cartao")).toBe("cartao");
    expect(getPaymentMethodLabel("  dinheiro ")).toBe("Dinheiro");
  });

  it("rejects oversized payment method strings safely", () => {
    const oversized = ` ${"p".repeat(2000)} `;

    expect(normalizePaymentMethod(oversized)).toBeNull();
    expect(getPaymentMethodLabel(oversized)).toBeNull();
  });
});
