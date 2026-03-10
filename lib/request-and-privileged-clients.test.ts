import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/request-client", () => ({
  createRequestClient: vi.fn(),
}));

vi.mock("@/lib/privileged-client", () => ({
  createPrivilegedClient: vi.fn(),
}));

import { createPrivilegedClient } from "@/lib/privileged-client";
import { createRequestClient } from "@/lib/request-client";
import { createRequestAndPrivilegedClients } from "./request-and-privileged-clients";

describe("request-and-privileged-clients boundary", () => {
  beforeEach(() => {
    vi.mocked(createRequestClient).mockReset();
    vi.mocked(createPrivilegedClient).mockReset();
  });

  it("loads request and privileged clients through the paired helper", async () => {
    const requestClient = { auth: { getUser: vi.fn() } };
    const privilegedClient = { from: vi.fn() };
    vi.mocked(createRequestClient).mockResolvedValue(requestClient as never);
    vi.mocked(createPrivilegedClient).mockReturnValue(privilegedClient as never);

    const result = await createRequestAndPrivilegedClients();

    expect(result).toEqual({
      requestClient,
      privilegedClient,
    });
  });

  it("preserves null setup results from the underlying providers", async () => {
    vi.mocked(createRequestClient).mockResolvedValue(null);
    vi.mocked(createPrivilegedClient).mockReturnValue(null);

    await expect(createRequestAndPrivilegedClients()).resolves.toEqual({
      requestClient: null,
      privilegedClient: null,
    });
  });
});
