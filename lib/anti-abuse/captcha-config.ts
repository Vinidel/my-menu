const DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

export function isOrdersCaptchaRequired(): boolean {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const rawToggle = process.env.ORDERS_CAPTCHA_ENABLED;
  const normalizedToggle = rawToggle?.trim().toLowerCase();
  if (normalizedToggle && DISABLED_VALUES.has(normalizedToggle)) {
    return false;
  }

  return true;
}
