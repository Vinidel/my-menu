import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createPrivilegedClient } from "./privileged-client";

describe("privileged-client boundary", () => {
  beforeEach(() => {
    vi.mocked(createServiceRoleClient).mockReset();
  });

  it("delegates privileged access to the service-role client implementation", () => {
    const privilegedClient = { from: vi.fn() };
    vi.mocked(createServiceRoleClient).mockReturnValue(privilegedClient as never);

    const result = createPrivilegedClient();

    expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(result).toBe(privilegedClient);
  });

  it("preserves null setup results from the underlying provider", () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);

    expect(createPrivilegedClient()).toBeNull();
  });
});
