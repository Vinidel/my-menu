import { createServiceRoleClient as createSupabasePrivilegedClient } from "@/lib/supabase/service-role";

export type PrivilegedClient = NonNullable<ReturnType<typeof createSupabasePrivilegedClient>>;

export function createPrivilegedClient() {
  return createSupabasePrivilegedClient();
}
