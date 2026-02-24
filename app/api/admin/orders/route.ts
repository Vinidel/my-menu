import { NextResponse } from "next/server";
import { parseAdminOrders } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

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

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, reference, customer_name, customer_email, customer_phone, items, status, notes, created_at"
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[admin/orders/api] failed to load orders", {
        message: error.message,
        code: error.code,
      });
      return errorJson(500, LOAD_ERROR_MESSAGE);
    }

    const orders = parseAdminOrders(Array.isArray(data) ? data : []);

    return successJson(orders);
  } catch (error) {
    console.error("[admin/orders/api] unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return errorJson(500, LOAD_ERROR_MESSAGE);
  }
}

function successJson(orders: ReturnType<typeof parseAdminOrders>) {
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
