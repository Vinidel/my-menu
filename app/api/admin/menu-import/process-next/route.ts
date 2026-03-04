import { NextResponse } from "next/server";
import { canUseMenuImport, MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";
import { processMenuImportJob } from "@/lib/menu-import/processor";
import { deleteMenuImportQueueMessage, readMenuImportQueueMessages } from "@/lib/menu-import/queue";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const;

const MAX_QUEUE_ATTEMPTS = 5;

export async function POST(request: Request) {
  return handleProcessNext(request);
}

async function handleProcessNext(request: Request) {
  const serviceClient = createServiceRoleClient();
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

  if (shouldAck) {
    await deleteMenuImportQueueMessage(serviceClient, message.msgId);
  }

  return NextResponse.json(
    {
      ok: true,
      processed: true,
      status: result.status,
      attempts: message.readCount,
      acked: shouldAck,
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

async function authorizeRequest(
  request: Request
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const workerSecret = (process.env.MENU_IMPORT_WORKER_SECRET ?? "").trim();
  const bearer = bearerFromAuthHeader(request.headers.get("authorization"));
  if (workerSecret && bearer && bearer === workerSecret) {
    return { ok: true };
  }

  const authClient = await createClient();
  if (!authClient) {
    return { ok: false, status: 503, message: "Configuração indisponível." };
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, message: "Acesso não autorizado." };
  }
  if (!canUseMenuImport(user.email)) {
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

