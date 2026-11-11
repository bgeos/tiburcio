import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client with the SECRET key: bypasses RLS. Use it only for things
 * a user can't do as themselves, and only after authorizing them in code.
 * Today that is one thing: sending invitation emails (P2-08).
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set (server only; see README).");
  const { url } = getSupabasePublicEnv();
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Public base URL of the app, for links in emails. */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL is not set (see .env.example).");
  return url.replace(/\/+$/, "");
}
