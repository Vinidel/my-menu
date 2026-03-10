import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createServiceRoleClient as createSupabasePrivilegedClient } from "@/lib/supabase/service-role";
import { createClient as createSupabaseRequestClient } from "@/lib/supabase/server";

export async function createRequestClient() {
  return createSupabaseRequestClient();
}

export function createBrowserClient() {
  return createSupabaseBrowserClient();
}

export function createPrivilegedClient() {
  return createSupabasePrivilegedClient();
}
