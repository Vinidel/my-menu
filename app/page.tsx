import { CustomerOrderPage } from "@/components/customer-order-page";
import { isOrdersCaptchaRequired } from "@/lib/anti-abuse/captcha-config";
import { getMenuItems } from "@/lib/menu";

export default function HomePage() {
  const menuItems = getMenuItems();
  const isCaptchaRequired = isOrdersCaptchaRequired();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return (
    <CustomerOrderPage
      menuItems={menuItems}
      isSupabaseConfigured={isSupabaseConfigured}
      isCaptchaRequired={isCaptchaRequired}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}
