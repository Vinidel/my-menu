import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-clients", () => ({
  createRequestClient: vi.fn(),
  createPrivilegedClient: vi.fn(),
}));

vi.mock("@/lib/menu-import/queue", () => ({
  readMenuImportQueueMessages: vi.fn(),
  deleteMenuImportQueueMessage: vi.fn(),
}));

vi.mock("@/lib/menu-import/processor", () => ({
  processMenuImportJob: vi.fn(),
}));

import { createPrivilegedClient, createRequestClient } from "@/lib/app-clients";
import { readMenuImportQueueMessages, deleteMenuImportQueueMessage } from "@/lib/menu-import/queue";
import { processMenuImportJob } from "@/lib/menu-import/processor";
import { POST } from "./route";
import { MENU_IMPORT_FORBIDDEN_MESSAGE } from "@/lib/menu-import/access";

describe("POST /api/admin/menu-import/process-next", () => {
  beforeEach(() => {
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(createPrivilegedClient).mockReset();
    vi.mocked(readMenuImportQueueMessages).mockReset();
    vi.mocked(deleteMenuImportQueueMessage).mockReset();
    vi.mocked(processMenuImportJob).mockReset();

    vi.mocked(createPrivilegedClient).mockReturnValue({} as never);
    vi.mocked(readMenuImportQueueMessages).mockResolvedValue([]);
    vi.mocked(deleteMenuImportQueueMessage).mockResolvedValue(true);
    vi.mocked(processMenuImportJob).mockResolvedValue({ status: "ready" });
    delete process.env.MENU_IMPORT_WORKER_SECRET;
  });

  it("returns 403 for non-allowlisted user when worker secret auth is not used", async () => {
    vi.mocked(createRequestClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createRequestClient>>);

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: MENU_IMPORT_FORBIDDEN_MESSAGE,
    });
  });

  it("accepts worker-secret auth and returns processed=false when queue is empty", async () => {
    process.env.MENU_IMPORT_WORKER_SECRET = "secret-123";

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret-123",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      processed: false,
    });
    expect(createRequestClient).not.toHaveBeenCalled();
  });

  it("denies when Authorization header is present but worker token is invalid", async () => {
    process.env.MENU_IMPORT_WORKER_SECRET = "secret-123";

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-token",
        },
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: "Acesso não autorizado.",
    });
    expect(createRequestClient).not.toHaveBeenCalled();
  });

  it("acks queue message when processor returns ready", async () => {
    process.env.MENU_IMPORT_WORKER_SECRET = "secret-123";
    vi.mocked(readMenuImportQueueMessages).mockResolvedValue([
      {
        msgId: 10,
        readCount: 1,
        jobId: "job-1",
        versionId: "ver-1",
      },
    ]);
    vi.mocked(processMenuImportJob).mockResolvedValue({ status: "ready" });

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
        headers: { Authorization: "Bearer secret-123" },
      })
    );

    expect(response.status).toBe(200);
    expect(processMenuImportJob).toHaveBeenCalledWith({}, { jobId: "job-1", versionId: "ver-1" });
    expect(deleteMenuImportQueueMessage).toHaveBeenCalledWith({}, 10);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      processed: true,
      status: "ready",
      acked: true,
    });
  });

  it("returns acked=false when queue delete fails even if message should be acked", async () => {
    process.env.MENU_IMPORT_WORKER_SECRET = "secret-123";
    vi.mocked(readMenuImportQueueMessages).mockResolvedValue([
      {
        msgId: 13,
        readCount: 1,
        jobId: "job-4",
        versionId: "ver-4",
      },
    ]);
    vi.mocked(processMenuImportJob).mockResolvedValue({ status: "ready" });
    vi.mocked(deleteMenuImportQueueMessage).mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
        headers: { Authorization: "Bearer secret-123" },
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      processed: true,
      status: "ready",
      acked: false,
    });
  });

  it("does not ack failed message before max attempts", async () => {
    process.env.MENU_IMPORT_WORKER_SECRET = "secret-123";
    vi.mocked(readMenuImportQueueMessages).mockResolvedValue([
      {
        msgId: 11,
        readCount: 2,
        jobId: "job-2",
        versionId: "ver-2",
      },
    ]);
    vi.mocked(processMenuImportJob).mockResolvedValue({ status: "failed" });

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
        headers: { Authorization: "Bearer secret-123" },
      })
    );

    expect(deleteMenuImportQueueMessage).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      processed: true,
      status: "failed",
      acked: false,
    });
  });

  it("acks failed message when read count reaches max attempts", async () => {
    process.env.MENU_IMPORT_WORKER_SECRET = "secret-123";
    vi.mocked(readMenuImportQueueMessages).mockResolvedValue([
      {
        msgId: 12,
        readCount: 5,
        jobId: "job-3",
        versionId: "ver-3",
      },
    ]);
    vi.mocked(processMenuImportJob).mockResolvedValue({ status: "failed" });

    const response = await POST(
      new Request("http://localhost/api/admin/menu-import/process-next", {
        method: "POST",
        headers: { Authorization: "Bearer secret-123" },
      })
    );

    expect(deleteMenuImportQueueMessage).toHaveBeenCalledWith({}, 12);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      processed: true,
      status: "failed",
      acked: true,
    });
  });
});
