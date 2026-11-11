import "server-only";
import { cache } from "react";
import { unauthorized } from "next/navigation";
import { connection } from "next/server";
import { DEFAULT_ACCENT, THEME_MODES, isAccentColor, type AccentColor, type ThemeMode } from "@/lib/domain/appearance";
import { createClient } from "@/lib/supabase/server";

/** The narrow view of the signed-in person that pages and components may use. */
export type CurrentUser = {
  id: string;
  email: string;
  /** Empty until the person sets it. */
  fullName: string;
  accentColor: AccentColor;
  themeMode: ThemeMode;
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
    .select("full_name, accent_color, theme_mode")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? "",
    accentColor: isAccentColor(profile?.accent_color) ? profile.accent_color : DEFAULT_ACCENT,
    themeMode: (THEME_MODES as readonly string[]).includes(profile?.theme_mode) ? (profile?.theme_mode as ThemeMode) : "system",
  };
});

/** The signed-in person, or the 401 "Sign in to continue" page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  return user;
}
