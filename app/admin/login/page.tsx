"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const AUTH_ERROR_MESSAGE = "E-mail ou senha incorretos.";
const EMPTY_EMAIL_MESSAGE = "Informe o e-mail.";
const EMPTY_PASSWORD_MESSAGE = "Informe a senha.";
const SETUP_MESSAGE =
  "Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local para usar o login.";
const LOGIN_SUBMIT_LABEL = "Entrar";
const LOGIN_REDIRECTING_LABEL = "Redirecionando...";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  function navigateToAdminAfterLogin() {
    // Navigate first, then refresh to re-run middleware once the new auth cookie/session
    // has propagated (fresh-session first login path can race otherwise).
    router.replace("/admin");
    router.refresh();
  }

  if (!supabase) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-foreground">Área do funcionário</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {SETUP_MESSAGE}
        </p>
        <Link href="/" className="text-primary underline underline-offset-4">
          Voltar ao cardápio
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const client = createClient();
    if (!client) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(EMPTY_EMAIL_MESSAGE);
      return;
    }
    if (!password) {
      setError(EMPTY_PASSWORD_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setIsSubmitting(false);
        setError(AUTH_ERROR_MESSAGE);
        return;
      }

      navigateToAdminAfterLogin();
    } catch {
      setIsSubmitting(false);
      setError(AUTH_ERROR_MESSAGE);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-foreground">Entrar</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Área restrita a funcionários. Use seu e-mail e senha.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Senha
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={isSubmitting}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? LOGIN_REDIRECTING_LABEL : LOGIN_SUBMIT_LABEL}
        </Button>
      </form>

      <Link
        href="/"
        className="text-primary text-sm underline underline-offset-4 hover:no-underline"
      >
        Voltar ao cardápio
      </Link>
    </main>
  );
}
