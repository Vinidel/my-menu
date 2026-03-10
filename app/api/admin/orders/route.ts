import { NextResponse } from "next/server";
import { createRequestClient } from "@/lib/request-client";
import { createAdminOrdersDataAccess } from "@/lib/admin-orders-data-access";

const SETUP_ERROR_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const AUTH_ERROR_MESSAGE = "Acesso não autorizado.";
const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar os pedidos agora. Tente novamente em instantes.";
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

export async function GET() {
  const supabase = await createRequestClient();

  if (!supabase) {
    return errorJson(503, SETUP_ERROR_MESSAGE);
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorJson(401, AUTH_ERROR_MESSAGE);
    }

    const adminOrdersDataAccess = createAdminOrdersDataAccess(supabase);
    const { data: orders, error } = await adminOrdersDataAccess.listAdminOrders();

    if (error) {
      console.error("[admin/orders/api] failed to load orders", {
        message: error.message,
        code: error.code,
      });
      return errorJson(500, LOAD_ERROR_MESSAGE);
    }

    return successJson(orders ?? []);
  } catch (error) {
    console.error("[admin/orders/api] unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return errorJson(500, LOAD_ERROR_MESSAGE);
  }
}

function successJson(orders: unknown[]) {
  return NextResponse.json(
    { ok: true, orders },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

function errorJson(status: number, message: string) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: NO_STORE_HEADERS }
  );
}
