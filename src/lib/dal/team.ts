import "server-only";
import type { OrgRole } from "@/lib/domain/roles";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

export type TeamMember = { userId: string; fullName: string; email: string; role: OrgRole; joinedAt: string };

export type OpenInvitation = { id: string; email: string; role: OrgRole; expiresAt: string; createdAt: string };

type MemberRow = {
  user_id: string;
  role: OrgRole;
  joined_at: string;
  profiles: { full_name: string; email: string | null } | null;
};

/** Members of the organization, as RLS lets the viewer see them (externals see only themselves). */
export async function listMembers(org: Membership): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, joined_at, profiles!organization_members_user_id_fkey(full_name, email)")
    .eq("organization_id", org.id)
    .returns<MemberRow[]>();
  if (error) throw new Error(`Could not load members: ${error.message}`);
  return data
    .map((row) => ({
      userId: row.user_id,
      fullName: row.profiles?.full_name ?? "",
      email: row.profiles?.email ?? "",
      role: row.role,
      joinedAt: row.joined_at,
    }))
    .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
}

/** Invitations not yet accepted, revoked or expired. Only admins and PMs get rows (RLS). */
export async function listOpenInvitations(org: Membership): Promise<OpenInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("organization_id", org.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load invitations: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as OrgRole,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}
