import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

import {
  createBrowserClient,
  createPrivilegedClient,
  createRequestClient,
  createRequestAndPrivilegedClients,
} from "./app-clients";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient as createSupabaseRequestClient } from "@/lib/supabase/server";

describe("app-clients boundary", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseRequestClient).mockReset();
    vi.mocked(createSupabaseBrowserClient).mockReset();
    vi.mocked(createServiceRoleClient).mockReset();
  });

  it("delegates request-scoped access to the server client implementation", async () => {
    const requestClient = { auth: { getUser: vi.fn() } };
    vi.mocked(createSupabaseRequestClient).mockResolvedValue(requestClient as never);

    const result = await createRequestClient();

    expect(createSupabaseRequestClient).toHaveBeenCalledTimes(1);
    expect(result).toBe(requestClient);
  });

  it("delegates browser access to the browser client implementation", () => {
    const browserClient = { auth: { signOut: vi.fn() } };
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(browserClient as never);

    const result = createBrowserClient();

    expect(createSupabaseBrowserClient).toHaveBeenCalledTimes(1);
    expect(result).toBe(browserClient);
  });

  it("delegates privileged access to the service-role client implementation", () => {
    const privilegedClient = { from: vi.fn() };
    vi.mocked(createServiceRoleClient).mockReturnValue(privilegedClient as never);

    const result = createPrivilegedClient();

    expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(result).toBe(privilegedClient);
  });

  it("preserves null setup results from the underlying providers", async () => {
    vi.mocked(createSupabaseRequestClient).mockResolvedValue(null);
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(null);
    vi.mocked(createServiceRoleClient).mockReturnValue(null);

    await expect(createRequestClient()).resolves.toBeNull();
    expect(createBrowserClient()).toBeNull();
    expect(createPrivilegedClient()).toBeNull();
  });

  it("can load request and privileged clients through the shared paired helper", async () => {
    const requestClient = { auth: { getUser: vi.fn() } };
    const privilegedClient = { from: vi.fn() };
    vi.mocked(createSupabaseRequestClient).mockResolvedValue(requestClient as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(privilegedClient as never);

    const result = await createRequestAndPrivilegedClients();

    expect(result).toEqual({
      requestClient,
      privilegedClient,
    });
  });
});
