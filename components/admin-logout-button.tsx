"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AdminLogoutButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const client = createClient();
    if (!client) {
      setUser(null);
      return;
    }
    client.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined || !user) return null;

  async function handleLogout() {
    const client = createClient();
    if (client) await client.auth.signOut();
    router.refresh();
    router.push("/admin/login");
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Sair
    </Button>
  );
}
