/**
 * Cronograma rules (docs/DECISIONS.md D-019).
 *
 * - A subproject has a start date. Its tasks run one after another from it.
 * - A task has a duration in calendar days; the start day counts as day 1,
 *   so a 3-day task starting on 1 March ends on 3 March.
 * - A task can wait `delayDays` before it starts (e.g. a late delivery).
 * - Subprojects never move each other. When a predecessor now ends on or
 *   after its successor's start, we report an overlap instead.
 *
 * Dates are ISO calendar dates (`YYYY-MM-DD`), computed in UTC.
 */

export type IsoDate = string;

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export type DateRange = { start: IsoDate; end: IsoDate };

export type SchedulableTask = { id: string; durationDays: number; delayDays: number };

export type ScheduledTask = DateRange & { id: string };

export type SubprojectSchedule = {
  /** The subproject's own start date. */
  start: IsoDate;
  /** Last day of its last task, or null when it has no tasks yet. */
  end: IsoDate | null;
  tasks: ScheduledTask[];
};

export function scheduleSubproject(
  start: IsoDate,
  tasks: SchedulableTask[],
): SubprojectSchedule {
  let nextStart = start;
  const scheduled = tasks.map((task) => {
    const taskStart = addDays(nextStart, Math.max(0, task.delayDays));
    const taskEnd = addDays(taskStart, Math.max(1, task.durationDays) - 1);
    nextStart = addDays(taskEnd, 1);
    return { id: task.id, start: taskStart, end: taskEnd };
  });
  return { start, end: scheduled.at(-1)?.end ?? null, tasks: scheduled };
}

export type Dependency = { predecessorId: string; successorId: string };

export type Overlap = Dependency & {
  /** Days the successor starts before the predecessor has finished (≥ 1). */
  days: number;
};

/** Successors that start on or before the last day of their predecessor. */
export function findOverlaps(
  schedules: Record<string, SubprojectSchedule>,
  dependencies: Dependency[],
): Overlap[] {
  return dependencies.flatMap((dep) => {
    const before = schedules[dep.predecessorId];
    const after = schedules[dep.successorId];
    if (!before?.end || !after) return [];
    const days = daysBetween(after.start, before.end) + 1;
    return days > 0 ? [{ ...dep, days }] : [];
  });
}

export type RangeChange = { id: string; before: DateRange; after: DateRange };

/** Items whose dates differ between two schedules (for previews and history). */
export function diffRanges(
  before: Record<string, DateRange>,
  after: Record<string, DateRange>,
): RangeChange[] {
  return Object.entries(after).flatMap(([id, next]) => {
    const prev = before[id];
    if (!prev || (prev.start === next.start && prev.end === next.end)) return [];
    return [{ id, before: prev, after: next }];
  });
}

/** Days `actual` is later than `planned` (negative = earlier, null = unknown). */
export function slipDays(planned: IsoDate | null, actual: IsoDate | null): number | null {
  if (!planned || !actual) return null;
  return daysBetween(planned, actual);
}
