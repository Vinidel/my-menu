import Link from "next/link";
import { createRequestClient } from "@/lib/request-client";
import { AdminOrdersDashboard } from "@/components/admin-orders-dashboard";
import { createAdminOrdersDataAccess } from "@/lib/admin-orders-data-access";
import { getMenuItems } from "@/lib/menu";

const SETUP_MESSAGE =
  "Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para visualizar os pedidos.";

const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar os pedidos agora. Tente novamente em instantes.";

export default async function AdminPage() {
  const menuItems = getMenuItems();
  const supabase = await createRequestClient();

  if (!supabase) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">Área do funcionário</h1>
        <p className="max-w-lg text-center text-muted-foreground">{SETUP_MESSAGE}</p>
        <Link
          href="/"
          className="text-primary underline underline-offset-4 hover:no-underline"
        >
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  const adminOrdersDataAccess = createAdminOrdersDataAccess(supabase);
  const { data: orders, error } = await adminOrdersDataAccess.listAdminOrders();

  if (error) {
    console.error("[admin/orders] failed to load orders", {
      message: error.message,
      code: error.code,
    });
    return (
      <AdminOrdersDashboard initialOrders={[]} initialLoadError={LOAD_ERROR_MESSAGE} />
    );
  }

  return <AdminOrdersDashboard initialOrders={orders ?? []} menuItems={menuItems} enablePolling />;
}
