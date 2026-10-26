/**
 * Overview figures (D-026). Pure: computed from the organization's current projects,
 * meaning not archived and in planning or active (finished projects are left out).
 * Missing data stays null ("—"), never a fake 0.
 */
import type { MaterialStatus } from "./materials";
import { overlapsFor, schedulesFor, type PlanSubproject } from "./project-plan";
import { rollupProgress } from "./progress";
import type { ProjectStatus } from "./projects";
import type { Dependency, IsoDate } from "./schedule";
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
};

export type DashboardSummary = {
  activeProjects: number;
  planningProjects: number;
  /** Null when there are no tasks at all. */
  openTasks: number | null;
  overdueTasks: number | null;
  tasksByStatus: Record<TaskStatus, number>;
  /** Not on site yet; null when no materials are listed. */
  materialsNotOnSite: number | null;
  materialsToRequest: number;
  projects: ProjectHealth[];
};

/** A task is overdue when it isn't done and its planned last day is before today. */
export function summarizeDashboard(projects: DashboardProject[], today: IsoDate): DashboardSummary {
  const current = projects.filter((p) => p.status !== "finished");
  const tasksByStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  let taskCount = 0;
  let overdueTasks = 0;
  const materials = current.flatMap((p) => p.materialStatuses);

  const health = current.map((project) => {
    const schedules = schedulesFor(project.subprojects);
    const tasks = project.subprojects.flatMap((s) => s.tasks);
    let overdueCount = 0;
    for (const sub of project.subprojects) {
      const ends = new Map(schedules[sub.id].tasks.map((t) => [t.id, t.end]));
      for (const task of sub.tasks) {
        tasksByStatus[task.status] += 1;
        if (task.status !== "done" && (ends.get(task.id) ?? today) < today) overdueCount += 1;
      }
    }
    taskCount += tasks.length;
    overdueTasks += overdueCount;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      progress: rollupProgress(tasks),
      taskCount: tasks.length,
      overlapCount: overlapsFor(project.subprojects, project.dependencies).length,
      overdueCount,
    };
  });

  return {
    activeProjects: current.filter((p) => p.status === "active").length,
    planningProjects: current.filter((p) => p.status === "planning").length,
    openTasks: taskCount ? taskCount - tasksByStatus.done : null,
    overdueTasks: taskCount ? overdueTasks : null,
    tasksByStatus,
    materialsNotOnSite: materials.length ? materials.filter((m) => m !== "on_site").length : null,
    materialsToRequest: materials.filter((m) => m === "to_request").length,
    projects: health,
  };
}
