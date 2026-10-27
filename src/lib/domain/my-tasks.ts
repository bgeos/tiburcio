/**
 * My tasks (D-028): a person's own to-dos and reminders, private to them.
 * Separate from project tasks (the cronograma): no dates, no plan, no history.
 */

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
  createdAt: string;
};

/** Open tasks first (in progress, then to do), newest first; finished ones last. */
export function sortMyTasks(tasks: MyTask[]): MyTask[] {
  const rank: Record<MyTaskStatus, number> = { in_progress: 0, todo: 1, done: 2 };
  return [...tasks].sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt));
}
