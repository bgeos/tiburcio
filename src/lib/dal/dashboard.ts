import "server-only";
import type { DashboardProject, Deadline } from "@/lib/domain/dashboard";
import type { MaterialStatus } from "@/lib/domain/materials";
import type { ProjectStatus } from "@/lib/domain/projects";
import type { Dependency } from "@/lib/domain/schedule";
import type { TaskStatus } from "@/lib/domain/tasks";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

/** Every task link of the organization, by task id (the Overview counts their overlaps). */
export async function getTaskLinkIds(org: Membership): Promise<Dependency[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("predecessor_task_id, successor_task_id")
    .eq("organization_id", org.id);
  if (error) throw new Error(`Could not load the overview: ${error.message}`);
  return data.map((d) => ({ predecessorId: d.predecessor_task_id, successorId: d.successor_task_id }));
}

/** Every task's "must be done before" milestone date (the Overview counts late tasks). */
export async function getDeadlines(org: Membership): Promise<Deadline[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_milestones")
    .select("task_id, milestones(date)")
    .eq("organization_id", org.id)
    .returns<{ task_id: string; milestones: { date: string } | null }[]>();
  if (error) throw new Error(`Could not load the overview: ${error.message}`);
  return data.flatMap((d) => (d.milestones ? [{ taskId: d.task_id, date: d.milestones.date }] : []));
}

/** Current projects (not archived, planning or active) with what the Overview counts, read as the user (RLS). */
export async function getDashboardProjects(org: Membership): Promise<DashboardProject[]> {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .in("status", ["planning", "active"])
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Could not load the overview: ${error.message}`);
  if (projects.length === 0) return [];

  const { data: subprojects, error: subError } = await supabase
    .from("subprojects")
    .select("id, project_id, name, start_date")
    .in("project_id", projects.map((p) => p.id))
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (subError) throw new Error(`Could not load the overview: ${subError.message}`);
  const ids = subprojects.map((s) => s.id);

  const [tasks, materials, dependencies] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, subproject_id, name, duration_days, delay_days, status, progress")
      .in("subproject_id", ids)
      .is("archived_at", null)
      .order("sort_order")
      .order("created_at"),
    supabase.from("subproject_materials").select("subproject_id, status").in("subproject_id", ids).is("archived_at", null),
    supabase
      .from("subproject_dependencies")
      .select("project_id, predecessor_id, successor_id")
      .in("project_id", projects.map((p) => p.id)),
  ]);
  for (const result of [tasks, materials, dependencies]) {
    if (result.error) throw new Error(`Could not load the overview: ${result.error.message}`);
  }
  const active = new Set(ids);

  return projects.map((project) => {
    const subs = subprojects.filter((s) => s.project_id === project.id);
    const subIds = new Set(subs.map((s) => s.id));
    return {
      id: project.id,
      name: project.name,
      status: project.status as ProjectStatus,
      subprojects: subs.map((s) => ({
        id: s.id,
        name: s.name,
        startDate: s.start_date,
        tasks: (tasks.data ?? [])
          .filter((t) => t.subproject_id === s.id)
          .map((t) => ({
            id: t.id,
            name: t.name,
            durationDays: t.duration_days,
            delayDays: t.delay_days,
            status: t.status as TaskStatus,
            progress: t.progress === null ? null : Number(t.progress),
          })),
      })),
      // Links to archived subprojects are kept in the database but not counted.
      dependencies: (dependencies.data ?? [])
        .filter((d) => d.project_id === project.id && active.has(d.predecessor_id) && active.has(d.successor_id))
        .map((d) => ({ predecessorId: d.predecessor_id, successorId: d.successor_id })),
      materialStatuses: (materials.data ?? [])
        .filter((m) => subIds.has(m.subproject_id))
        .map((m) => m.status as MaterialStatus),
    };
  });
}
