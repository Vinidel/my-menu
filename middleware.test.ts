/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe("middleware (Employee Auth — protected routes)", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    mockGetUser.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("redirects unauthenticated user from /admin to /admin/login (brief: unprotected access)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { middleware } = await import("./middleware");
    const request = new NextRequest(new URL("https://example.com/admin"), {
      headers: new Headers(),
    });
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/admin/login");
  });

  it("redirects unauthenticated user from /admin/anything to /admin/login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { middleware } = await import("./middleware");
    const request = new NextRequest(new URL("https://example.com/admin/orders"), {
      headers: new Headers(),
    });
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/admin/login");
  });

  it("does not redirect from /admin/login when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { middleware } = await import("./middleware");
    const request = new NextRequest(new URL("https://example.com/admin/login"), {
      headers: new Headers(),
    });
    const response = await middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects authenticated user from /admin/login to /admin (brief: already logged in)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "1", email: "e@x.com" } },
      error: null,
    });
    const { middleware } = await import("./middleware");
    const request = new NextRequest(new URL("https://example.com/admin/login"), {
      headers: new Headers(),
    });
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/admin");
  });

  it("allows authenticated user to access /admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "1", email: "e@x.com" } },
      error: null,
    });
    const { middleware } = await import("./middleware");
    const request = new NextRequest(new URL("https://example.com/admin"), {
      headers: new Headers(),
    });
    const response = await middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
