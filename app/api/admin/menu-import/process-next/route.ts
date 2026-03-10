import { NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/privileged-client";
import { createRequestClient } from "@/lib/request-client";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";
import { processMenuImportJob } from "@/lib/menu-import/processor";
import { deleteMenuImportQueueMessage, readMenuImportQueueMessages } from "@/lib/menu-import/queue";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

const MAX_QUEUE_ATTEMPTS = 5;

export async function POST(request: Request) {
  return handleProcessNext(request);
}

async function handleProcessNext(request: Request) {
  const serviceClient = createPrivilegedClient();
  if (!serviceClient) {
    return NextResponse.json(
      { ok: false, message: "Configuração indisponível." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const accessResult = await authorizeRequest(request);
  if (!accessResult.ok) {
    return NextResponse.json(
      { ok: false, message: accessResult.message },
      { status: accessResult.status, headers: NO_STORE_HEADERS }
    );
  }

  const messages = await readMenuImportQueueMessages(serviceClient, {
    visibilityTimeoutSeconds: 60,
    limit: 1,
  });
  const message = messages[0];
  if (!message) {
    return NextResponse.json(
      { ok: true, processed: false },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }

  const result = await processMenuImportJob(serviceClient, {
    jobId: message.jobId,
    versionId: message.versionId,
  });

  const shouldAck =
    result.status === "ready" ||
    result.status === "ready_with_issues" ||
    result.status === "skipped" ||
    message.readCount >= MAX_QUEUE_ATTEMPTS;

  let acked = false;
  if (shouldAck) {
    acked = await deleteMenuImportQueueMessage(serviceClient, message.msgId);
    if (!acked) {
      console.error("[admin/menu-import/worker] failed to ack queue message", {
        messageId: message.msgId,
        status: result.status,
        attempts: message.readCount,
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      processed: true,
      status: result.status,
      attempts: message.readCount,
      acked,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

async function authorizeRequest(
  request: Request
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const workerSecret = (process.env.MENU_IMPORT_WORKER_SECRET ?? "").trim();
  const bearerHeader = request.headers.get("authorization");
  const bearer = bearerFromAuthHeader(bearerHeader);
  if (workerSecret && bearerHeader) {
    if (!bearer || bearer !== workerSecret) {
      console.error("[admin/menu-import/worker] denied: invalid worker bearer token");
      return { ok: false, status: 401, message: "Acesso não autorizado." };
    }
    return { ok: true };
  }

  const authClient = await createRequestClient();
  if (!authClient) {
    return { ok: false, status: 503, message: "Configuração indisponível." };
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    console.error("[admin/menu-import/worker] denied: missing authenticated user");
    return { ok: false, status: 401, message: "Acesso não autorizado." };
  }
  if (!canUseMenuImport(user.email)) {
    console.error("[admin/menu-import/worker] denied: user outside menu-import allowlist", {
      userId: user.id,
    });
    return { ok: false, status: 403, message: MENU_IMPORT_FORBIDDEN_MESSAGE };
  }

  return { ok: true };
}

function bearerFromAuthHeader(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token || null;
}
