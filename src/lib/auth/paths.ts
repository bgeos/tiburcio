/** Where signed-in people land by default: `/` picks their organization (app/route.ts). */
export const DEFAULT_SIGNED_IN_PATH = "/";

export const LOGIN_PATH = "/login";

/** Pages that signed-out visitors may open. Everything else needs a session. */
export function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith("/auth/");
}

/**
 * A `next` redirect target taken from user input. Only same-site paths are
 * allowed, so a link like `/login?next=https://evil.example` can't send people
 * off-site after signing in.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next === "") return DEFAULT_SIGNED_IN_PATH;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return DEFAULT_SIGNED_IN_PATH;
  // Control characters (e.g. tab, newline) are stripped by some browsers, turning
  // "/\t/evil.example" into "//evil.example".
  for (const char of next) {
    if (char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f) return DEFAULT_SIGNED_IN_PATH;
  }
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) return DEFAULT_SIGNED_IN_PATH;
  return next;
}
