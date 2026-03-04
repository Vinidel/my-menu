import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AdminLayout from "./layout";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/admin-logout-button", () => ({
  AdminLogoutButton: () => <button type="button">Sair</button>,
}));

import { createClient } from "@/lib/supabase/server";

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Importar cardápio link only for allowlisted user email (brief: owner-only menu import)", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "vinidroid@gmail.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    render(await AdminLayout({ children: <div>content</div> }));

    expect(screen.getByRole("link", { name: "Importar cardápio" })).toBeInTheDocument();
  });

  it("hides Importar cardápio link for non-allowlisted users", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "employee@example.com" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    render(await AdminLayout({ children: <div>content</div> }));

    expect(screen.queryByRole("link", { name: "Importar cardápio" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cardápio" })).toBeInTheDocument();
  });
});
