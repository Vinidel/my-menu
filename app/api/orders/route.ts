import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  submitCustomerOrderWithClient,
  type SubmitCustomerOrderInput,
} from "@/app/actions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  consumeFixedWindowRateLimit,
  type FixedWindowRateLimitResult,
} from "@/lib/anti-abuse/rate-limit";

const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const ORDER_SUBMIT_RATE_LIMIT_MAX_REQUESTS = 5;
const ORDER_SUBMIT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const ORDER_SUBMIT_RATE_LIMIT_KEY_PREFIX = "api_orders:";
const SOURCE_TOKEN_MAX_LENGTH = 256;
const UNKNOWN_SOURCE_KEY = "unknown";
const UNKNOWN_SOURCE_LOG_KEY = "unknown";
const RATE_LIMIT_MESSAGE =
  "Muitas tentativas de envio em pouco tempo. Aguarde um instante e tente novamente.";
const INVALID_CONTENT_TYPE_MESSAGE =
  "Formato de requisição inválido. Envie os dados em JSON.";
const REQUEST_TOO_LARGE_MESSAGE =
  "Requisição muito grande. Reduza os dados e tente novamente.";
const INVALID_JSON_MESSAGE = "Requisição inválida. Atualize a página e tente novamente.";
const SETUP_UNAVAILABLE_MESSAGE =
  "Pedidos indisponíveis no momento. Verifique a configuração do Supabase.";

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
  const source = getRequestSource(request);
  const rateLimit = enforceOrderSubmitRateLimit(source.bucketKey);
  if (!rateLimit.ok) {
    console.warn("[customer/orders] rate limit exceeded", {
      route: "/api/orders",
      source: source.logKey,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });

    return jsonError(
      {
        ok: false,
        code: "validation",
        message: RATE_LIMIT_MESSAGE,
      },
      429,
      {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return validationError(INVALID_CONTENT_TYPE_MESSAGE, 415);
  }

  let body: SubmitCustomerOrderInput | null = null;

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BODY_BYTES) {
      return validationError(REQUEST_TOO_LARGE_MESSAGE, 413);
    }

    body = JSON.parse(rawBody) as SubmitCustomerOrderInput;
  } catch {
    return validationError(INVALID_JSON_MESSAGE, 400);
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return setupError(SETUP_UNAVAILABLE_MESSAGE, 503);
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

function jsonError(
  body: ErrorBody,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json<ErrorBody>(body, {
    status,
    headers: {
      ...noStoreHeaders(),
      ...extraHeaders,
    },
  });
}

function validationError(message: string, status: number, extraHeaders?: Record<string, string>) {
  return jsonError({ ok: false, code: "validation", message }, status, extraHeaders);
}

function setupError(message: string, status: number) {
  return jsonError({ ok: false, code: "setup", message }, status);
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

function enforceOrderSubmitRateLimit(bucketKey: string): FixedWindowRateLimitResult {
  try {
    return consumeFixedWindowRateLimit({
      key: `${ORDER_SUBMIT_RATE_LIMIT_KEY_PREFIX}${bucketKey}`,
      maxRequests: ORDER_SUBMIT_RATE_LIMIT_MAX_REQUESTS,
      windowMs: ORDER_SUBMIT_RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    console.error("[customer/orders] rate limiter unavailable; degrading open", {
      route: "/api/orders",
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      ok: true as const,
      remaining: ORDER_SUBMIT_RATE_LIMIT_MAX_REQUESTS,
      resetAtMs: Date.now(),
    };
  }
}

function getRequestSource(request: Request): { bucketKey: string; logKey: string } {
  const ip =
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    singleHeaderValue(request.headers.get("x-real-ip")) ??
    singleHeaderValue(request.headers.get("cf-connecting-ip")) ??
    forwardedForToken(request.headers.get("forwarded"));

  if (!ip) {
    return unknownSource();
  }

  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp) {
    return unknownSource();
  }

  return {
    bucketKey: `ip_hash:${hashForRateLimit(normalizedIp)}`,
    logKey: `ip_hash:${hashForLogs(normalizedIp)}`,
  };
}

function unknownSource() {
  return { bucketKey: UNKNOWN_SOURCE_KEY, logKey: UNKNOWN_SOURCE_LOG_KEY };
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const [first] = value.split(",");
  return singleHeaderValue(first);
}

function singleHeaderValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function forwardedForToken(value: string | null): string | null {
  if (!value) return null;

  const match = value.match(/for=(?:"?\[?)([^;\]",]+)(?:\]?"?)/i);
  return singleHeaderValue(match?.[1] ?? null);
}

function normalizeIp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > SOURCE_TOKEN_MAX_LENGTH) return null;

  if (trimmed.startsWith("[")) {
    const closingIndex = trimmed.indexOf("]");
    if (closingIndex > 1) {
      return trimmed.slice(1, closingIndex);
    }
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount === 1 && trimmed.includes(".")) {
    // IPv4 with port (e.g. 1.2.3.4:1234)
    return trimmed.split(":")[0] ?? null;
  }

  return trimmed;
}

function hashForRateLimit(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashForLogs(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
