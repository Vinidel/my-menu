import Link from "next/link";
import { AdminOrdersDashboard } from "@/components/admin-orders-dashboard";
import { parseAdminOrders } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

const SETUP_MESSAGE =
  "Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para visualizar os pedidos.";

const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar os pedidos agora. Tente novamente em instantes.";

export default async function AdminPage() {
  const supabase = await createClient();

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

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, reference, customer_name, customer_email, customer_phone, items, status, notes, created_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin/orders] failed to load orders", {
      message: error.message,
      code: error.code,
    });
    return (
      <AdminOrdersDashboard initialOrders={[]} initialLoadError={LOAD_ERROR_MESSAGE} />
    );
  }

  const orders = parseAdminOrders(Array.isArray(data) ? data : []);

  return <AdminOrdersDashboard initialOrders={orders} />;
}
