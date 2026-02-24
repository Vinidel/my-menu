import { NextResponse } from "next/server";
import {
  submitCustomerOrderWithClient,
  type SubmitCustomerOrderInput,
} from "@/app/actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_REQUEST_BODY_BYTES = 32 * 1024;

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
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(
      {
        ok: false,
        code: "validation",
        message: "Formato de requisição inválido. Envie os dados em JSON.",
      },
      415
    );
  }

  let body: SubmitCustomerOrderInput | null = null;

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BODY_BYTES) {
      return jsonError(
        {
          ok: false,
          code: "validation",
          message: "Requisição muito grande. Reduza os dados e tente novamente.",
        },
        413
      );
    }

    body = JSON.parse(rawBody) as SubmitCustomerOrderInput;
  } catch {
    return jsonError(
      {
        ok: false,
        code: "validation",
        message: "Requisição inválida. Atualize a página e tente novamente.",
      },
      400
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return jsonError(
      {
        ok: false,
        code: "setup",
        message: "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.",
      },
      503
    );
  }

  const result = await submitCustomerOrderWithClient(body, supabase);

  if (result.ok) {
    return NextResponse.json<SuccessBody>(result, {
      status: 201,
      headers: noStoreHeaders(),
    });
  }

  const status =
    result.code === "validation" ? 400 : result.code === "setup" ? 503 : 500;

  return jsonError(result, status);
}

function jsonError(body: ErrorBody, status: number) {
  return NextResponse.json<ErrorBody>(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}
