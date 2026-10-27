/**
 * Overview figures (D-026). Pure: computed from the organization's current projects,
 * meaning not archived and in planning or active (finished projects are left out).
 * Missing data stays null ("—"), never a fake 0.
 */
import type { MaterialStatus } from "./materials";
import { overlapsFor, schedulesFor, type PlanSubproject } from "./project-plan";
import { rollupProgress } from "./progress";
import type { ProjectStatus } from "./projects";
import { daysBetween, type DateRange, type Dependency, type IsoDate } from "./schedule";
import { isWaiting, overdueDays } from "./task-flags";
import { TASK_STATUSES, type TaskStatus } from "./tasks";

export type DashboardTask = PlanSubproject["tasks"][number] & { status: TaskStatus; progress: number | null };

export type DashboardProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  subprojects: (PlanSubproject & { tasks: DashboardTask[] })[];
  dependencies: Dependency[];
  materialStatuses: MaterialStatus[];
};

export type ProjectHealth = {
  id: string;
  name: string;
  status: ProjectStatus;
  /** 0–100, or null when the project has no tasks yet. */
  progress: number | null;
  taskCount: number;
  overlapCount: number;
  overdueCount: number;
  /** Marked Blocked, or due to start while a task it waits for isn't done (P4-04). */
  blockedCount: number;
  /** Tasks whose planned end reaches a milestone they must be done before (D-030). */
  lateCount: number;
};

/** "Task must be done before this day" (a task's link to a milestone). */
export type Deadline = { taskId: string; date: IsoDate };

export type DashboardSummary = {
  activeProjects: number;
  planningProjects: number;
  /** Null when there are no tasks at all. */
  openTasks: number | null;
  overdueTasks: number | null;
  blockedTasks: number | null;
  tasksByStatus: Record<TaskStatus, number>;
  /** Not on site yet; null when no materials are listed. */
  materialsNotOnSite: number | null;
  materialsToRequest: number;
  projects: ProjectHealth[];
};

/**
 * A task is overdue when it isn't done and its planned last day is before today.
 * `taskLinks` (by task id) add their overlaps to every project that holds one end.
 */
export function summarizeDashboard(
  projects: DashboardProject[],
  today: IsoDate,
  taskLinks: Dependency[] = [],
  deadlines: Deadline[] = [],
): DashboardSummary {
  const current = projects.filter((p) => p.status !== "finished");
  const tasksByStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  let taskCount = 0;
  let overdueTasks = 0;
  let blockedTasks = 0;
  const materials = current.flatMap((p) => p.materialStatuses);

  // Planned dates and project of every task in a current project, for task-link overlaps.
  const taskRange = new Map<string, DateRange>();
  const taskProject = new Map<string, string>();
  const taskStatus = new Map<string, TaskStatus>();
  for (const project of current) {
    const schedules = schedulesFor(project.subprojects);
    for (const sub of project.subprojects) {
      for (const t of schedules[sub.id].tasks) {
        taskRange.set(t.id, t);
        taskProject.set(t.id, project.id);
      }
      for (const t of sub.tasks) taskStatus.set(t.id, t.status);
    }
  }
  // What each task waits for, with known statuses (links to finished projects don't block).
  const waitsFor = (taskId: string) =>
    taskLinks.flatMap((l) => (l.successorId === taskId && taskStatus.has(l.predecessorId) ? [{ status: taskStatus.get(l.predecessorId)! }] : []));
  const overlappingLinks = taskLinks.filter((l) => {
    const before = taskRange.get(l.predecessorId);
    const after = taskRange.get(l.successorId);
    return before && after && daysBetween(after.start, before.end) >= 0;
  });

  const health = current.map((project) => {
    const schedules = schedulesFor(project.subprojects);
    const tasks = project.subprojects.flatMap((s) => s.tasks);
    let overdueCount = 0;
    let blockedCount = 0;
    let lateCount = 0;
    for (const sub of project.subprojects) {
      const ranges = new Map(schedules[sub.id].tasks.map((t) => [t.id, t]));
      for (const task of sub.tasks) {
        tasksByStatus[task.status] += 1;
        const range = ranges.get(task.id);
        if (overdueDays(task.status, range?.end, today) !== null) overdueCount += 1;
        if (task.status === "blocked" || isWaiting(task.status, range?.start, today, waitsFor(task.id))) blockedCount += 1;
        if (range && deadlines.some((d) => d.taskId === task.id && range.end >= d.date)) lateCount += 1;
      }
    }
    taskCount += tasks.length;
    overdueTasks += overdueCount;
    blockedTasks += blockedCount;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      progress: rollupProgress(tasks),
      taskCount: tasks.length,
      overlapCount:
        overlapsFor(project.subprojects, project.dependencies).length +
        overlappingLinks.filter(
          (l) => taskProject.get(l.predecessorId) === project.id || taskProject.get(l.successorId) === project.id,
        ).length,
      overdueCount,
      blockedCount,
      lateCount,
    };
  });

  return {
    activeProjects: current.filter((p) => p.status === "active").length,
    planningProjects: current.filter((p) => p.status === "planning").length,
    openTasks: taskCount ? taskCount - tasksByStatus.done : null,
    overdueTasks: taskCount ? overdueTasks : null,
    blockedTasks: taskCount ? blockedTasks : null,
    tasksByStatus,
    materialsNotOnSite: materials.length ? materials.filter((m) => m !== "on_site").length : null,
    materialsToRequest: materials.filter((m) => m === "to_request").length,
    projects: health,
  };
}
