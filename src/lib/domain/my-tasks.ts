/**
 * My tasks (D-028): a person's own to-dos and reminders, private to them.
 * Separate from project tasks (the cronograma): no plan, no history; an optional due date
 * puts them on the calendar (D-034).
 */
import type { IsoDate } from "./schedule";

export const MY_TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type MyTaskStatus = (typeof MY_TASK_STATUSES)[number];

export const MY_TASK_TAGS = ["todo", "reminder"] as const;
export type MyTaskTag = (typeof MY_TASK_TAGS)[number];

export const MY_TASK_TAG_LABELS: Record<MyTaskTag, string> = {
  todo: "To do",
  reminder: "Reminder",
};

export type MyTask = {
  id: string;
  name: string;
  description: string;
  status: MyTaskStatus;
  tag: MyTaskTag;
  dueDate: IsoDate | null;
  createdAt: string;
};

/** Overdue: its due day has passed and it isn't done. */
export function isMyTaskOverdue(task: Pick<MyTask, "status" | "dueDate">, today: IsoDate): boolean {
  return task.dueDate !== null && task.dueDate < today && task.status !== "done";
}

/** Open tasks first (in progress, then to do), soonest due date first, then newest; finished ones last. */
export function sortMyTasks(tasks: MyTask[]): MyTask[] {
  const rank: Record<MyTaskStatus, number> = { in_progress: 0, todo: 1, done: 2 };
  const due = (t: MyTask) => t.dueDate ?? "9999-12-31";
  return [...tasks].sort(
    (a, b) => rank[a.status] - rank[b.status] || due(a).localeCompare(due(b)) || b.createdAt.localeCompare(a.createdAt),
  );
}
