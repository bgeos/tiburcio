/**
 * Overdue and blocked work (P4-04). Pure; used by the cronograma, the project page and the Overview.
 * - Overdue: not done, and the planned last day is before today.
 * - Blocked: marked Blocked, or due to start (planned start today or earlier) while a task it
 *   waits for (task link) isn't done. Waiting for a later start isn't blocked: that's the plan.
 */
import { daysBetween, type DateRange, type IsoDate } from "./schedule";
import type { LinkedTask, TaskLink } from "./task-links";
import type { TaskStatus } from "./tasks";

export type FlaggableTask = { id: string; status: TaskStatus; range: DateRange | null };

export type TaskFlags = {
  /** Days past the planned last day; null when not overdue. */
  overdueDays: number | null;
  /** The task's status is Blocked. */
  markedBlocked: boolean;
  /** Linked tasks it waits for that aren't done, while it's due to start. */
  waitingFor: LinkedTask[];
};

export function overdueDays(status: TaskStatus, end: IsoDate | null | undefined, today: IsoDate): number | null {
  if (status === "done" || !end || end >= today) return null;
  return daysBetween(end, today);
}

/** Due to start (or started) and still waiting for an unfinished predecessor. */
export function isWaiting(status: TaskStatus, start: IsoDate | null | undefined, today: IsoDate, predecessors: { status: TaskStatus }[]): boolean {
  return status !== "done" && Boolean(start) && start! <= today && predecessors.some((p) => p.status !== "done");
}

export function flagTask(task: FlaggableTask, links: TaskLink[], today: IsoDate): TaskFlags {
  const predecessors = links.filter((l) => l.successor.id === task.id).map((l) => l.predecessor);
  const waiting = isWaiting(task.status, task.range?.start, today, predecessors);
  return {
    overdueDays: overdueDays(task.status, task.range?.end, today),
    markedBlocked: task.status === "blocked",
    waitingFor: waiting ? predecessors.filter((p) => p.status !== "done") : [],
  };
}

export const isBlocked = (flags: TaskFlags) => flags.markedBlocked || flags.waitingFor.length > 0;

/** How many tasks are overdue and how many are blocked. */
export function countFlags(tasks: FlaggableTask[], links: TaskLink[], today: IsoDate): { overdue: number; blocked: number } {
  const flags = tasks.map((t) => flagTask(t, links, today));
  return { overdue: flags.filter((f) => f.overdueDays !== null).length, blocked: flags.filter(isBlocked).length };
}
