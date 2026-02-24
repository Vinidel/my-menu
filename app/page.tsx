import { CustomerOrderPage } from "@/components/customer-order-page";
import { getMenuItems } from "@/lib/menu";

export default function HomePage() {
  const menuItems = getMenuItems();
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  return (
    <CustomerOrderPage
      menuItems={menuItems}
      isSupabaseConfigured={isSupabaseConfigured}
    />
  );
}
