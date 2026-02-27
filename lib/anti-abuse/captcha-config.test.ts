import { afterEach, describe, expect, it, vi } from "vitest";
import { isOrdersCaptchaRequired } from "./captcha-config";

const originalNodeEnv = process.env.NODE_ENV;
const originalCaptchaToggle = process.env.ORDERS_CAPTCHA_ENABLED;

describe("isOrdersCaptchaRequired", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ORDERS_CAPTCHA_ENABLED = originalCaptchaToggle;
    vi.restoreAllMocks();
  });

  it("always enforces CAPTCHA in production regardless of toggle", () => {
    process.env.NODE_ENV = "production";
    process.env.ORDERS_CAPTCHA_ENABLED = "false";

    expect(isOrdersCaptchaRequired()).toBe(true);
  });

  it("disables CAPTCHA in non-production when toggle is false-like", () => {
    process.env.NODE_ENV = "test";
    process.env.ORDERS_CAPTCHA_ENABLED = "off";

    expect(isOrdersCaptchaRequired()).toBe(false);
  });

  it("enables CAPTCHA in non-production when toggle is missing", () => {
    process.env.NODE_ENV = "test";
    delete process.env.ORDERS_CAPTCHA_ENABLED;

    expect(isOrdersCaptchaRequired()).toBe(true);
  });
});
