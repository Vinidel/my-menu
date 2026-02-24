import { NextResponse } from "next/server";
import { parseAdminOrders } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

const SETUP_ERROR_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";
const AUTH_ERROR_MESSAGE = "Acesso não autorizado.";
const LOAD_ERROR_MESSAGE =
  "Não foi possível carregar os pedidos agora. Tente novamente em instantes.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: SETUP_ERROR_MESSAGE },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, message: AUTH_ERROR_MESSAGE },
        { status: 401, headers: NO_STORE_HEADERS }
      );
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
      return NextResponse.json(
        { ok: false, message: LOAD_ERROR_MESSAGE },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const orders = parseAdminOrders(Array.isArray(data) ? data : []);

    return NextResponse.json(
      { ok: true, orders },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[admin/orders/api] unexpected error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, message: LOAD_ERROR_MESSAGE },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
