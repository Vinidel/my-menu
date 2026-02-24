import { NextResponse } from "next/server";
import {
  submitCustomerOrderWithClient,
  type SubmitCustomerOrderInput,
} from "@/app/actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type ErrorBody = {
  ok: false;
  code: "setup" | "validation" | "unknown";
  message: string;
};

type SuccessBody = {
  ok: true;
  orderReference: string;
};

export async function POST(request: Request) {
  let body: SubmitCustomerOrderInput | null = null;

  try {
    body = (await request.json()) as SubmitCustomerOrderInput;
  } catch {
    return NextResponse.json<ErrorBody>(
      {
        ok: false,
        code: "validation",
        message: "Requisição inválida. Atualize a página e tente novamente.",
      },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json<ErrorBody>(
      {
        ok: false,
        code: "setup",
        message: "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.",
      },
      { status: 503 }
    );
  }

  const result = await submitCustomerOrderWithClient(body, supabase);

  if (result.ok) {
    return NextResponse.json<SuccessBody>(result, { status: 201 });
  }

  const status =
    result.code === "validation" ? 400 : result.code === "setup" ? 503 : 500;

  return NextResponse.json<ErrorBody>(result, { status });
}
