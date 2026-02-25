import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminLoginPage from "./page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";

describe("Admin Login Page (Employee Auth)", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(),
      },
    } as unknown as ReturnType<typeof createClient>);
    mockPush.mockClear();
    mockReplace.mockClear();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("when Supabase env vars are missing (brief: env vars missing)", () => {
    it("shows setup message in Portuguese and does not crash", () => {
      vi.mocked(createClient).mockReturnValue(null);
      render(<AdminLoginPage />);
      expect(
        screen.getByText(/Configure as variáveis NEXT_PUBLIC_SUPABASE_URL/)
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Voltar ao cardápio/ })).toBeInTheDocument();
    });
  });

  describe("login form (brief: Portuguese UI, validation)", () => {
    it("shows E-mail and Senha labels and Entrar button in Portuguese", () => {
      render(<AdminLoginPage />);
      expect(screen.getByLabelText(/E-mail/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Senha/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Entrar/ })).toBeInTheDocument();
    });

    it("shows validation message when email is empty (brief: empty fields)", async () => {
      const { container } = render(<AdminLoginPage />);
      const form = container.querySelector("form");
      expect(form).toBeTruthy();
      fireEvent.submit(form!);
      await waitFor(() => {
        expect(screen.getByText("Informe o e-mail.")).toBeInTheDocument();
      });
    });

    it("validates password required and does not call Supabase when empty (brief: empty fields)", async () => {
      const signInWithPassword = vi.fn();
      vi.mocked(createClient).mockReturnValue({
        auth: { signInWithPassword },
      } as unknown as ReturnType<typeof createClient>);
      const { container } = render(<AdminLoginPage />);
      fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "a@b.com" } });
      const form = container.querySelector("form");
      expect(form).toBeTruthy();
      fireEvent.submit(form!);
      await waitFor(() => {
        expect(signInWithPassword).not.toHaveBeenCalled();
      });
    });

    it("shows Portuguese error when credentials are invalid (brief: invalid credentials)", async () => {
      const signInWithPassword = vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login" },
      });
      vi.mocked(createClient).mockReturnValue({
        auth: { signInWithPassword },
      } as unknown as ReturnType<typeof createClient>);
      render(<AdminLoginPage />);
      const emailInputs = screen.getAllByPlaceholderText("seu@email.com");
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");
      const emailInput = emailInputs[emailInputs.length - 1];
      const passwordInput = passwordInputs[passwordInputs.length - 1];
      fireEvent.change(emailInput, { target: { value: "wrong@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      const form = emailInput.closest("form")!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(signInWithPassword).toHaveBeenCalledWith({
          email: "wrong@example.com",
          password: "wrong",
        });
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    });

    it("keeps submit disabled while login request is pending (bugfix UX: prevent double submit)", async () => {
      let resolveSignIn:
        | ((value: { data: { user: {} | null; session: {} | null }; error: null }) => void)
        | null = null;
      const signInWithPassword = vi.fn(
        () =>
          new Promise<{ data: { user: {} | null; session: {} | null }; error: null }>((resolve) => {
            resolveSignIn = resolve;
          })
      );

      vi.mocked(createClient).mockReturnValue({
        auth: { signInWithPassword },
      } as unknown as ReturnType<typeof createClient>);

      render(<AdminLoginPage />);

      const emailInput = screen.getAllByPlaceholderText("seu@email.com").at(-1)!;
      const passwordInput = screen.getAllByPlaceholderText("••••••••").at(-1)!;
      fireEvent.change(emailInput, { target: { value: "emp@burger.com" } });
      fireEvent.change(passwordInput, { target: { value: "validpassword" } });

      fireEvent.submit(emailInput.closest("form")!);

      await waitFor(() => {
        expect(signInWithPassword).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Redirecionando..." })).toBeDisabled();
      });

      resolveSignIn?.({ data: { user: {}, session: {} }, error: null });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/admin");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("redirects to /admin after successful login (brief: happy path)", async () => {
      const signInWithPassword = vi.fn().mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });
      vi.mocked(createClient).mockReturnValue({
        auth: { signInWithPassword },
      } as unknown as ReturnType<typeof createClient>);
      render(<AdminLoginPage />);
      const emailInputs = screen.getAllByPlaceholderText("seu@email.com");
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");
      const emailInput = emailInputs[emailInputs.length - 1];
      const passwordInput = passwordInputs[passwordInputs.length - 1];
      fireEvent.change(emailInput, { target: { value: "emp@burger.com" } });
      fireEvent.change(passwordInput, { target: { value: "validpassword" } });
      const form = emailInput.closest("form")!;
      fireEvent.submit(form);
      await waitFor(
        () => {
          expect(signInWithPassword).toHaveBeenCalledWith({
            email: "emp@burger.com",
            password: "validpassword",
          });
          expect(mockReplace).toHaveBeenCalledWith("/admin");
          expect(mockRefresh).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
      expect(screen.getByRole("button", { name: "Redirecionando..." })).toBeDisabled();
    });

    it("navigates before refresh on successful login (bugfix: fresh-session redirect race)", async () => {
      const signInWithPassword = vi.fn().mockResolvedValue({
        data: { user: {}, session: {} },
        error: null,
      });
      vi.mocked(createClient).mockReturnValue({
        auth: { signInWithPassword },
      } as unknown as ReturnType<typeof createClient>);
      render(<AdminLoginPage />);
      const emailInputs = screen.getAllByPlaceholderText("seu@email.com");
      const passwordInputs = screen.getAllByPlaceholderText("••••••••");
      const emailInput = emailInputs[emailInputs.length - 1];
      const passwordInput = passwordInputs[passwordInputs.length - 1];
      fireEvent.change(emailInput, { target: { value: "emp@burger.com" } });
      fireEvent.change(passwordInput, { target: { value: "validpassword" } });

      fireEvent.submit(emailInput.closest("form")!);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/admin");
        expect(mockRefresh).toHaveBeenCalled();
      });

      expect(mockReplace.mock.invocationCallOrder[0]).toBeLessThan(
        mockRefresh.mock.invocationCallOrder[0]
      );
    });
  });
});
