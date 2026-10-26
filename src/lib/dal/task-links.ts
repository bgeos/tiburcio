import "server-only";
import { scheduleSubproject } from "@/lib/domain/schedule";
import { isSubprojectColor } from "@/lib/domain/subproject-colors";
import type { LinkedTask, TaskLink } from "@/lib/domain/task-links";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

type Client = Awaited<ReturnType<typeof createClient>>;

type SubprojectRow = {
  id: string;
  name: string;
  color: string;
  start_date: string;
  archived_at: string | null;
  projects: { id: string; name: string; archived_at: string | null } | null;
};

const SUBPROJECT_COLUMNS =
  // Name the foreign key: subprojects also relate to projects through the dependency links.
  "id, name, color, start_date, archived_at, projects!subprojects_organization_id_project_id_fkey(id, name, archived_at)";

/** Every current task of these subprojects with its planned dates (archived ones left out). */
async function tasksOf(supabase: Client, subprojects: SubprojectRow[]): Promise<LinkedTask[]> {
  const current = subprojects.filter((s) => !s.archived_at && s.projects && !s.projects.archived_at);
  if (current.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("id, subproject_id, name, duration_days, delay_days")
    .in("subproject_id", current.map((s) => s.id))
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`Could not load linked tasks: ${error.message}`);

  return current.flatMap((sub) => {
    const tasks = data.filter((t) => t.subproject_id === sub.id);
    const schedule = scheduleSubproject(
      sub.start_date,
      tasks.map((t) => ({ id: t.id, durationDays: t.duration_days, delayDays: t.delay_days })),
    );
    return tasks.map((t, i) => ({
      id: t.id,
      name: t.name,
      subprojectId: sub.id,
      subprojectName: sub.name,
      projectId: sub.projects!.id,
      projectName: sub.projects!.name,
      color: isSubprojectColor(sub.color) ? sub.color : "blue",
      range: schedule.tasks[i] ? { start: schedule.tasks[i].start, end: schedule.tasks[i].end } : null,
    }));
  });
}

/** Tasks by id, wherever they are in the organization (read as the user: RLS applies). */
async function describeTasks(supabase: Client, orgId: string, ids: string[]): Promise<Map<string, LinkedTask>> {
  if (ids.length === 0) return new Map();
  const { data: rows, error } = await supabase.from("tasks").select("subproject_id").in("id", ids).eq("organization_id", orgId);
  if (error) throw new Error(`Could not load linked tasks: ${error.message}`);
  const { data: subs, error: subError } = await supabase
    .from("subprojects")
    .select(SUBPROJECT_COLUMNS)
    .in("id", [...new Set(rows.map((r) => r.subproject_id))])
    .returns<SubprojectRow[]>();
  if (subError) throw new Error(`Could not load linked tasks: ${subError.message}`);
  const wanted = new Set(ids);
  return new Map((await tasksOf(supabase, subs)).filter((t) => wanted.has(t.id)).map((t) => [t.id, t]));
}

/**
 * Links that touch `own` tasks (one project's), with the other end described wherever it is.
 * Links to archived tasks, subprojects or projects are kept in the database but left out.
 */
export async function loadTaskLinks(supabase: Client, orgId: string, own: Map<string, LinkedTask>): Promise<TaskLink[]> {
  const ownIds = [...own.keys()];
  if (ownIds.length === 0) return [];
  const columns = "id, predecessor_task_id, successor_task_id";
  const [asSuccessor, asPredecessor] = await Promise.all([
    supabase.from("task_dependencies").select(columns).in("successor_task_id", ownIds),
    supabase.from("task_dependencies").select(columns).in("predecessor_task_id", ownIds),
  ]);
  for (const result of [asSuccessor, asPredecessor]) {
    if (result.error) throw new Error(`Could not load task links: ${result.error.message}`);
  }
  const rows = new Map([...(asSuccessor.data ?? []), ...(asPredecessor.data ?? [])].map((r) => [r.id, r]));
  const others = [...rows.values()]
    .flatMap((r) => [r.predecessor_task_id, r.successor_task_id])
    .filter((id) => !own.has(id));
  const tasks = new Map([...own, ...(await describeTasks(supabase, orgId, [...new Set(others)]))]);

  return [...rows.values()].flatMap((r) => {
    const predecessor = tasks.get(r.predecessor_task_id);
    const successor = tasks.get(r.successor_task_id);
    return predecessor && successor ? [{ id: r.id, predecessor, successor }] : [];
  });
}

/** Every current task in the organization, read as the user: the choices for "waits for…". */
export async function listLinkableTasks(org: Membership): Promise<LinkedTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subprojects")
    .select(SUBPROJECT_COLUMNS)
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at")
    .returns<SubprojectRow[]>();
  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return tasksOf(supabase, data);
}
