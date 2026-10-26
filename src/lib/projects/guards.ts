import "server-only";
import { requireUser } from "@/lib/dal/auth";
import { getMembership, type Membership } from "@/lib/dal/organizations";
import { canEditProjects } from "@/lib/domain/projects";
import type { createClient } from "@/lib/supabase/server";

// Shared by the project Server Actions. Deliberately NOT in a "use server" file:
// every export of such a file becomes a publicly callable endpoint.

export const NOT_ALLOWED = "Only admins and production managers can change projects.";

/** The organization, if the signed-in person may edit its projects. Called by every action. */
export async function editableOrganization(orgSlug: string): Promise<Membership | null> {
  await requireUser();
  const membership = await getMembership(orgSlug);
  return membership && canEditProjects(membership.role) ? membership : null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Append a history entry. A failed log doesn't undo the change it describes. */
export async function logActivity(
  supabase: Supabase,
  org: Membership,
  entry: { projectId: string; subprojectId?: string | null; summary: string; details?: string[]; reason?: string | null },
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    organization_id: org.id,
    project_id: entry.projectId,
    subproject_id: entry.subprojectId ?? null,
    summary: entry.summary.slice(0, 500),
    details: entry.details ?? [],
    reason: entry.reason?.trim() ? entry.reason.trim().slice(0, 1000) : null,
  });
  if (error) console.error(`activity_log insert failed for project ${entry.projectId}: ${error.message}`);
}
