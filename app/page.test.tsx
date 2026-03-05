import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import HomePage from "./page";

vi.mock("@/lib/menu-runtime", () => ({
  getRuntimeMenuItems: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/anti-abuse/captcha-config", () => ({
  isOrdersCaptchaRequired: vi.fn().mockReturnValue(false),
}));

vi.mock("@/components/customer-order-page", () => ({
  CustomerOrderPage: ({
    isSupabaseConfigured,
    isCaptchaRequired,
    turnstileSiteKey,
    storePhoneDisplay,
    storePhoneHref,
  }: {
    isSupabaseConfigured: boolean;
    isCaptchaRequired?: boolean;
    turnstileSiteKey?: string | null;
    storePhoneDisplay?: string | null;
    storePhoneHref?: string | null;
  }) => (
    <div>
      <div data-testid="supabase-config">{String(isSupabaseConfigured)}</div>
      <div data-testid="captcha-required">{String(Boolean(isCaptchaRequired))}</div>
      <div data-testid="turnstile-site-key">{turnstileSiteKey ?? ""}</div>
      <div data-testid="store-phone-display">{storePhoneDisplay ?? ""}</div>
      <div data-testid="store-phone-href">{storePhoneHref ?? ""}</div>
    </div>
  ),
}));

describe("HomePage", () => {
  const originalEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_STORE_PHONE: process.env.NEXT_PUBLIC_STORE_PHONE,
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_STORE_PHONE = originalEnv.NEXT_PUBLIC_STORE_PHONE;
    cleanup();
  });

  it("passes formatted store phone display and tel href when env phone is valid (brief: menu phone display source of truth)", async () => {
    process.env.NEXT_PUBLIC_STORE_PHONE = "+55 (48) 99958-5067";

    render(await HomePage());

    expect(screen.getByTestId("supabase-config")).toHaveTextContent("true");
    expect(screen.getByTestId("store-phone-display")).toHaveTextContent("(48) 99958-5067");
    expect(screen.getByTestId("store-phone-href")).toHaveTextContent("tel:+5548999585067");
  });

  it("passes empty store phone props when env phone is missing/invalid (brief: hide store phone fallback)", async () => {
    process.env.NEXT_PUBLIC_STORE_PHONE = "123";

    render(await HomePage());

    expect(screen.getByTestId("store-phone-display")).toHaveTextContent("");
    expect(screen.getByTestId("store-phone-href")).toHaveTextContent("");
  });
});
