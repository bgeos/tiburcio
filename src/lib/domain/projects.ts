import type { OrgRole } from "./roles";
import type { StatusCategory } from "./status";
import type { TaskStatus } from "./tasks";

/** Project lifecycle (projects.status, D-025). */
export const PROJECT_STATUSES = ["planning", "active", "finished"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  finished: "Finished",
};

/** Drives the badge icon and colour (the label stays the project status). */
export const PROJECT_STATUS_CATEGORY: Record<ProjectStatus, StatusCategory> = {
  planning: "todo",
  active: "in_progress",
  finished: "done",
};

/** Same rule as the database (private.can_edit_projects): admins and production managers. */
export function canEditProjects(role: OrgRole): boolean {
  return role === "admin" || role === "production_manager";
}

/** Same rule as the database (private.can_view_projects): everyone except external collaborators (D-025). */
export function canViewProjects(role: OrgRole): boolean {
  return role !== "external";
}

/** What external collaborators see instead of projects and materials. */
export const EXTERNAL_NO_PROJECTS =
  "External collaborators don't see projects or materials yet. Ask an admin or production manager if you need something from a project.";

/**
 * The status that follows the work (D-029), from the statuses of the project's current tasks:
 * every task done → Finished; work started (or a finished project's task reopened) → Active.
 * Never goes back to Planning, and leaves a project without tasks as it is. People can still
 * set any status by hand; this runs only when tasks change.
 */
export function statusFromTasks(current: ProjectStatus, taskStatuses: readonly TaskStatus[]): ProjectStatus {
  if (taskStatuses.length === 0) return current;
  if (taskStatuses.every((s) => s === "done")) return "finished";
  if (current === "finished") return "active";
  if (current === "planning" && taskStatuses.some((s) => s !== "todo")) return "active";
  return current;
}

/** Why the status changed by itself, for the history. */
export function statusChangeReason(next: ProjectStatus): string {
  return next === "finished" ? "Every task is done." : "Work has started on a task.";
}
