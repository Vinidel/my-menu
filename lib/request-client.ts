import { createClient as createSupabaseRequestClient } from "@/lib/supabase/server";

export type RequestClient = NonNullable<Awaited<ReturnType<typeof createSupabaseRequestClient>>>;

export async function createRequestClient() {
  return createSupabaseRequestClient();
}
