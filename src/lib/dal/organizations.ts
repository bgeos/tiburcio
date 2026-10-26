import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { OrgRole } from "@/lib/domain/roles";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";

export type Membership = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
};

type MembershipRow = {
  role: OrgRole;
  organizations: { id: string; name: string; slug: string } | null;
};

/**
 * Organizations the signed-in person belongs to, sorted by name. Read as the
 * user, so RLS decides what comes back. Empty when signed out.
 */
export const getMyMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .returns<MembershipRow[]>();
  if (error) throw new Error(`Could not load organizations: ${error.message}`);

  return data
    .flatMap((row) => (row.organizations ? [{ ...row.organizations, role: row.role }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
});

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
