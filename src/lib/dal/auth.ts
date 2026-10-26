import "server-only";
import { cache } from "react";
import { unauthorized } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** The narrow view of the signed-in person that pages and components may use. */
export type CurrentUser = {
  id: string;
  email: string;
  /** Empty until the person sets it. */
  fullName: string;
};

/**
 * Who is signed in, or null. Verifies the session JWT (getClaims), never trusts
 * an unverified cookie. Deduplicated per request with React `cache`.
 * Reads cookies, so callers must render behind <Suspense> (Cache Components).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session checks compare token expiry with the clock (Date.now()), which Cache
  // Components only allows at request time, never while prerendering.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? "",
  };
});

/** The signed-in person, or the 401 "Sign in to continue" page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  return user;
}
