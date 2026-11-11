import "server-only";
import type { MaterialStatus } from "@/lib/domain/materials";
import type { ProjectStatus } from "@/lib/domain/projects";
import { scheduleSubproject, type DateRange, type IsoDate } from "@/lib/domain/schedule";
import { isSubprojectColor, type SubprojectColor } from "@/lib/domain/subproject-colors";
import type { TaskStatus } from "@/lib/domain/tasks";
import type { MilestoneLink } from "@/lib/domain/milestones";
import type { LinkedTask, TaskLink } from "@/lib/domain/task-links";
import { createClient } from "@/lib/supabase/server";
import { loadMilestoneLinks } from "./milestones";
import { loadTaskLinks } from "./task-links";
import type { Membership } from "./organizations";

export type { TaskStatus };

export type TaskView = {
  id: string;
  name: string;
  durationDays: number;
  delayDays: number;
  status: TaskStatus;
  progress: number | null;
  actualStart: IsoDate | null;
  actualEnd: IsoDate | null;
};

export type SubprojectView = {
  id: string;
  name: string;
  startDate: IsoDate;
  color: SubprojectColor;
  ownerCrewId: string | null;
  ownerName: string | null;
  /** Not archived, in cronograma order. */
  tasks: TaskView[];
  /** Not archived, in list order. */
  materials: MaterialView[];
  /** Not archived, in list order. */
  crew: CrewView[];
};

export type CrewView = { id: string; name: string; role: string };

export type MaterialView = { id: string; description: string; status: MaterialStatus; neededBy: IsoDate | null };

export type ProjectDetail = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  archivedAt: string | null;
  /** Not archived, in display order. */
  subprojects: SubprojectView[];
  dependencies: { id: string; predecessorId: string; successorId: string }[];
  /** Task links touching this project's tasks; the other end may be in another project. */
  taskLinks: TaskLink[];
  /** "Must be done before" links of this project's tasks (D-030). */
  milestoneLinks: MilestoneLink[];
  baseline: { lockedAt: string; ranges: Record<string, DateRange> } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Everything the project page needs, read as the user (RLS). Null when the id is
 * malformed, the project doesn't exist, or it belongs to another organization.
 */
export async function getProjectDetail(org: Membership, projectId: string): Promise<ProjectDetail | null> {
  if (!UUID.test(projectId)) return null;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, description, status, archived_at")
    .eq("id", projectId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the project: ${error.message}`);
  if (!project) return null;

  const { data: subprojects, error: subError } = await supabase
    .from("subprojects")
    .select("id, name, start_date, color, owner_crew_id")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (subError) throw new Error(`Could not load subprojects: ${subError.message}`);
  const ids = subprojects.map((s) => s.id);

  const [tasks, materials, crew, dependencies, baseline] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, subproject_id, name, duration_days, delay_days, status, progress, actual_start, actual_end")
      .in("subproject_id", ids)
      .is("archived_at", null)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("subproject_materials")
      .select("id, subproject_id, description, status, needed_by")
      .in("subproject_id", ids)
      .is("archived_at", null)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("crew_members")
      .select("id, subproject_id, name, role, archived_at")
      .in("subproject_id", ids)
      .order("sort_order")
      .order("created_at"),
    supabase.from("subproject_dependencies").select("id, predecessor_id, successor_id").eq("project_id", projectId),
    supabase.from("plan_baselines").select("locked_at, snapshot").eq("project_id", projectId).maybeSingle(),
  ]);
  for (const result of [tasks, materials, crew, dependencies, baseline]) {
    if (result.error) throw new Error(`Could not load the project: ${result.error.message}`);
  }

  const crewNames = new Map((crew.data ?? []).map((c) => [c.id, c.name as string]));
  const active = new Set(ids);

  const views: SubprojectView[] = subprojects.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.start_date,
    color: isSubprojectColor(s.color) ? s.color : "blue",
    ownerCrewId: s.owner_crew_id,
    ownerName: s.owner_crew_id ? (crewNames.get(s.owner_crew_id) ?? null) : null,
    tasks: (tasks.data ?? [])
      .filter((t) => t.subproject_id === s.id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        durationDays: t.duration_days,
        delayDays: t.delay_days,
        status: t.status as TaskStatus,
        progress: t.progress === null ? null : Number(t.progress),
        actualStart: t.actual_start,
        actualEnd: t.actual_end,
      })),
    materials: (materials.data ?? [])
      .filter((m) => m.subproject_id === s.id)
      .map((m) => ({ id: m.id, description: m.description, status: m.status as MaterialStatus, neededBy: m.needed_by as IsoDate | null })),
    crew: (crew.data ?? [])
      .filter((c) => c.subproject_id === s.id && !c.archived_at)
      .map((c) => ({ id: c.id, name: c.name, role: c.role })),
  }));

  // This project's tasks as link ends, with their planned dates.
  const own = new Map<string, LinkedTask>();
  for (const sub of views) {
    const schedule = scheduleSubproject(sub.startDate, sub.tasks);
    sub.tasks.forEach((t, i) =>
      own.set(t.id, {
        id: t.id,
        name: t.name,
        subprojectId: sub.id,
        subprojectName: sub.name,
        projectId: project.id,
        projectName: project.name,
        color: sub.color,
        status: t.status,
        range: { start: schedule.tasks[i].start, end: schedule.tasks[i].end },
      }),
    );
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status as ProjectStatus,
    archivedAt: project.archived_at,
    subprojects: views,
    // Links to archived subprojects are kept in the database but not shown.
    dependencies: (dependencies.data ?? [])
      .filter((d) => active.has(d.predecessor_id) && active.has(d.successor_id))
      .map((d) => ({ id: d.id, predecessorId: d.predecessor_id, successorId: d.successor_id })),
    taskLinks: await loadTaskLinks(supabase, org.id, own),
    milestoneLinks: await loadMilestoneLinks(supabase, own),
    baseline: baseline.data
      ? { lockedAt: baseline.data.locked_at, ranges: baseline.data.snapshot as Record<string, DateRange> }
      : null,
  };
}
