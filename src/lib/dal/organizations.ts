import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgRole } from "@/lib/domain/roles";
import { DEFAULT_SECTION, isSection, orgHref } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";

export type Membership = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  /** IANA timezone, e.g. "America/Sao_Paulo": what "today" means for this organization. */
  timezone: string;
};

type MembershipRow = {
  role: OrgRole;
  organizations: { id: string; name: string; slug: string; timezone: string } | null;
};

/**
 * Organizations the signed-in person belongs to, sorted by name. Read as the
 * user, so RLS decides what comes back. Empty when signed out.
 */
export const getMyMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  return membershipsOf(await createClient(), user.id);
});

/**
 * Memberships of `userId`, read with an already signed-in client (RLS applies).
 * Used directly by the sign-in action, whose new session isn't in the request cookies yet.
 */
export async function membershipsOf(supabase: SupabaseClient, userId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug, timezone)")
    .eq("user_id", userId)
    .returns<MembershipRow[]>();
  if (error) throw new Error(`Could not load organizations: ${error.message}`);

  return data
    .flatMap((row) => (row.organizations ? [{ ...row.organizations, role: row.role }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Where someone lands: their first organization (by name), or the "ask for an invitation" page. */
export function homePath(memberships: Membership[], section?: unknown): string {
  if (memberships.length === 0) return "/no-organization";
  return orgHref(memberships[0].slug, isSection(section) ? section : DEFAULT_SECTION);
}

/** The organization at `/<slug>` if the person is a member of it, else null. */
export async function getMembership(slug: string): Promise<Membership | null> {
  const memberships = await getMyMemberships();
  return memberships.find((m) => m.slug === slug) ?? null;
}

/**
 * The organization at `/<slug>`, or the 404 page. Non-members get "not found",
 * not "forbidden", so the page doesn't confirm that an organization exists.
 */
export async function requireMembership(slug: string): Promise<Membership> {
  const membership = await getMembership(slug);
  if (!membership) notFound();
  return membership;
}
