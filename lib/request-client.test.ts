import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient as createSupabaseRequestClient } from "@/lib/supabase/server";
import { createRequestClient } from "./request-client";

describe("request-client boundary", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseRequestClient).mockReset();
  });

  it("delegates request-scoped access to the server client implementation", async () => {
    const requestClient = { auth: { getUser: vi.fn() } };
    vi.mocked(createSupabaseRequestClient).mockResolvedValue(requestClient as never);

    const result = await createRequestClient();

    expect(createSupabaseRequestClient).toHaveBeenCalledTimes(1);
    expect(result).toBe(requestClient);
  });

  it("preserves null setup results from the underlying provider", async () => {
    vi.mocked(createSupabaseRequestClient).mockResolvedValue(null);

    await expect(createRequestClient()).resolves.toBeNull();
  });
});
