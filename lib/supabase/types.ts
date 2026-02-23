/**
 * Shape used by @supabase/ssr cookie adapters (setAll callback).
 * Shared by server client and middleware to avoid duplication.
 */
export type CookieToSet = {
  name: string;
  value: string;
  options?: object;
};
