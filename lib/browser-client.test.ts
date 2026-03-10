import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBrowserClient } from "./browser-client";

describe("browser-client boundary", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseBrowserClient).mockReset();
  });

  it("delegates browser access to the browser client implementation", () => {
    const browserClient = { auth: { signOut: vi.fn() } };
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(browserClient as never);

    const result = createBrowserClient();

    expect(createSupabaseBrowserClient).toHaveBeenCalledTimes(1);
    expect(result).toBe(browserClient);
  });

  it("preserves null setup results from the underlying provider", () => {
    vi.mocked(createSupabaseBrowserClient).mockReturnValue(null);

    expect(createBrowserClient()).toBeNull();
  });
});
