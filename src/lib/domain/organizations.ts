/**
 * Organization addresses: the first part of every URL, /<slug>/<section> (D-016).
 * Same rules as the organizations table (format, length, reserved words).
 */
export const ORG_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Words that are app pages or sections, never an organization address (migration 20261026161550). */
export const RESERVED_ORG_SLUGS: readonly string[] = [
  "api", "auth", "login", "logout", "signup", "sign-up", "invite", "invitations",
  "accept-invite", "no-organization", "onboarding", "welcome", "account", "profile",
  "design", "admin", "static", "public", "assets", "new", "help", "about",
  "settings", "dashboard", "projects", "tasks", "materials", "reports", "team",
];

/** "Jupi Produções 2027" → "jupi-producoes-2027": a suggested address for a name. */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}
