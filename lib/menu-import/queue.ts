import { createServiceRoleClient } from "@/lib/supabase/service-role";

type ServiceClient = NonNullable<ReturnType<typeof createServiceRoleClient>>;

export type MenuImportQueueMessage = {
  msgId: number;
  readCount: number;
  jobId: string;
  versionId: string;
};

const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 60;
const DEFAULT_READ_LIMIT = 1;

export async function enqueueMenuImportJob(
  serviceClient: ServiceClient,
  input: { jobId: string; versionId: string }
): Promise<{ ok: true; messageId: number } | { ok: false; message: string }> {
  const { data, error } = await serviceClient.rpc("menu_import_queue_enqueue", {
    p_job_id: input.jobId,
    p_version_id: input.versionId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  const parsed = Number(data);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, message: "ID de mensagem inválido na fila." };
  }
  return { ok: true, messageId: parsed };
}

export async function readMenuImportQueueMessages(
  serviceClient: ServiceClient,
  input?: { visibilityTimeoutSeconds?: number; limit?: number }
): Promise<MenuImportQueueMessage[]> {
  const visibilityTimeoutSeconds =
    input?.visibilityTimeoutSeconds ?? DEFAULT_VISIBILITY_TIMEOUT_SECONDS;
  const limit = input?.limit ?? DEFAULT_READ_LIMIT;

  const { data, error } = await serviceClient.rpc("menu_import_queue_read", {
    p_visibility_timeout_seconds: visibilityTimeoutSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[admin/menu-import/queue] failed to read queue messages", {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((row) => parseQueueRow(row))
    .filter((row): row is MenuImportQueueMessage => row !== null);
}

export async function deleteMenuImportQueueMessage(
  serviceClient: ServiceClient,
  messageId: number
): Promise<boolean> {
  const { data, error } = await serviceClient.rpc("menu_import_queue_delete", {
    p_msg_id: messageId,
  });

  if (error) {
    console.error("[admin/menu-import/queue] failed to delete queue message", {
      message: error.message,
      code: error.code,
      messageId,
    });
    return false;
  }

  return Boolean(data);
}

function parseQueueRow(value: unknown): MenuImportQueueMessage | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  const msgId = numberFrom(row.msg_id);
  const readCount = numberFrom(row.read_ct) ?? 1;
  const message = row.message;
  if (!message || typeof message !== "object") return null;
  const messageRow = message as Record<string, unknown>;
  const jobId = stringFrom(messageRow.jobId);
  const versionId = stringFrom(messageRow.versionId);

  if (!msgId || !jobId || !versionId) return null;

  return {
    msgId,
    readCount,
    jobId,
    versionId,
  };
}

function stringFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
