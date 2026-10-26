import type { OrgRole } from "./roles";
import type { StatusCategory } from "./status";

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
