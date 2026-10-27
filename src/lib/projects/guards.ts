import "server-only";
import { requireUser } from "@/lib/dal/auth";
import { getMembership, type Membership } from "@/lib/dal/organizations";
import { PROJECT_STATUS_LABELS, canEditProjects, statusChangeReason, statusFromTasks, type ProjectStatus } from "@/lib/domain/projects";
import type { TaskStatus } from "@/lib/domain/tasks";
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

/**
 * After tasks change, let the project's status follow the work (D-029): Planning → Active when
 * a task starts, → Finished when every task is done, Finished → Active when one re-opens.
 * Logged in the history. A failure leaves the status as it was; the task change still stands.
 */
export async function followTaskStatuses(supabase: Supabase, org: Membership, projectId: string): Promise<void> {
  const [project, tasks] = await Promise.all([
    supabase
      .from("projects")
      .select("status, archived_at")
      .eq("id", projectId)
      .eq("organization_id", org.id)
      .maybeSingle<{ status: ProjectStatus; archived_at: string | null }>(),
    // Current tasks of current subprojects only.
    supabase
      .from("tasks")
      .select("status, subprojects!inner(project_id, archived_at)")
      .eq("organization_id", org.id)
      .eq("subprojects.project_id", projectId)
      .is("subprojects.archived_at", null)
      .is("archived_at", null)
      .returns<{ status: TaskStatus }[]>(),
  ]);
  if (project.error || tasks.error || !project.data || project.data.archived_at) return;

  const current = project.data.status;
  const next = statusFromTasks(current, tasks.data.map((t) => t.status));
  if (next === current) return;

  const { error } = await supabase.from("projects").update({ status: next }).eq("id", projectId).eq("organization_id", org.id);
  if (error) {
    console.error(`project status update failed for project ${projectId}: ${error.message}`);
    return;
  }
  await logActivity(supabase, org, {
    projectId,
    summary: `Project status: ${PROJECT_STATUS_LABELS[current]} → ${PROJECT_STATUS_LABELS[next]}`,
    details: [`Changed automatically. ${statusChangeReason(next)}`],
  });
}
