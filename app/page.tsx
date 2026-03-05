import { CustomerOrderPage } from "@/components/customer-order-page";
import { isOrdersCaptchaRequired } from "@/lib/anti-abuse/captcha-config";
import { getRuntimeMenuItems } from "@/lib/menu-runtime";
import { resolveStorePhoneContact } from "@/lib/phone";

export default async function HomePage() {
  const menuItems = await getRuntimeMenuItems();
  const isCaptchaRequired = isOrdersCaptchaRequired();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
  const storePhoneContact = resolveStorePhoneContact(process.env.NEXT_PUBLIC_STORE_PHONE);
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
      storePhoneDisplay={storePhoneContact?.display ?? null}
      storePhoneHref={storePhoneContact?.href ?? null}
    />
  );
}
