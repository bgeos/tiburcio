import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SIGNED_IN_PATH, LOGIN_PATH, isPublicPath } from "@/lib/auth/paths";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/**
 * Next 16 Proxy (formerly middleware). Two jobs only:
 * 1. Refresh the Supabase session cookie on every request.
 * 2. Optimistic redirects: signed-out visitors go to /login, signed-in people
 *    skip /login. This is NOT authorization; that is RLS + the DAL + every
 *    Server Action re-checking the session (docs/ARCHITECTURE.md).
 */
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache headers that stop a CDN from caching a response with someone's session.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Verifies the JWT (and refreshes it when needed). Must run before any return.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(loginUrl, response);
  }
  if (signedIn && pathname === LOGIN_PATH) {
    return redirectKeepingCookies(new URL(DEFAULT_SIGNED_IN_PATH, request.url), response);
  }
  return response;
}

/** A redirect that still carries any refreshed session cookies. */
function redirectKeepingCookies(target: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
