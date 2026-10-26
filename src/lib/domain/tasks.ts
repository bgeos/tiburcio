import type { IsoDate } from "./schedule";

/** Task status (tasks.status). Cancelling is archiving, so there's no "cancelled" here. */
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskProgressState = {
  status: TaskStatus;
  /** Manual 0–100; null = not set (counts as 0). Done always counts as 100 (D-007). */
  progress: number | null;
  actualStart: IsoDate | null;
  actualEnd: IsoDate | null;
};

/**
 * Set a status and keep the rest consistent: starting work records the actual
 * start (today, if not set), finishing records the actual end and 100 %, and
 * going back to "to do" clears what had been recorded.
 */
export function withStatus(task: TaskProgressState, status: TaskStatus, today: IsoDate): TaskProgressState {
  if (status === "todo") return { status, progress: null, actualStart: null, actualEnd: null };
  const actualStart = task.actualStart ?? today;
  if (status === "done") return { status, progress: 100, actualStart, actualEnd: task.actualEnd ?? today };
  // In progress or blocked: re-opening a finished task clears its end and its 100 %.
  return {
    status,
    progress: task.status === "done" ? null : task.progress,
    actualStart,
    actualEnd: null,
  };
}

/** Set progress and let it drive the status: 100 % is done; any progress means started. */
export function withProgress(task: TaskProgressState, progress: number, today: IsoDate): TaskProgressState {
  if (progress >= 100) return withStatus(task, "done", today);
  const status: TaskStatus =
    task.status === "done" || (task.status === "todo" && progress > 0) ? "in_progress" : task.status;
  const next = status === task.status ? task : withStatus(task, status, today);
  return { ...next, progress: progress === 0 && status === "todo" ? null : progress };
}
