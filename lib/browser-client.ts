import "client-only";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

export type BrowserClient = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;

export function createBrowserClient() {
  return createSupabaseBrowserClient();
}
