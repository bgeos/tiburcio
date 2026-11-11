/**
 * Fixed status categories. Organizations will rename/recolour their own
 * statuses (Phase 7), but every status maps to exactly one of these
 * categories, and calculations (progress, overdue, Kanban) use the category.
 * See docs/DATA_MODEL.md § status_definitions and docs/DECISIONS.md D-011.
 */
export const STATUS_CATEGORIES = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Sort rank: higher number = more important. */
export const PRIORITY_RANK: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};
