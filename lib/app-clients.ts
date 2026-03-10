import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createServiceRoleClient as createSupabasePrivilegedClient } from "@/lib/supabase/service-role";
import { createClient as createSupabaseRequestClient } from "@/lib/supabase/server";

export type RequestClient = NonNullable<Awaited<ReturnType<typeof createSupabaseRequestClient>>>;
export type BrowserClient = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
export type PrivilegedClient = NonNullable<ReturnType<typeof createSupabasePrivilegedClient>>;

export async function createRequestClient() {
  return createSupabaseRequestClient();
}

export function createBrowserClient() {
  return createSupabaseBrowserClient();
}

export function createPrivilegedClient() {
  return createSupabasePrivilegedClient();
}

export async function createRequestAndPrivilegedClients() {
  const requestClient = await createRequestClient();
  const privilegedClient = createPrivilegedClient();

  return { requestClient, privilegedClient };
}
