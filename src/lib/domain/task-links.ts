/**
 * Task links (P4-01, D-027): "this task starts after that task finishes", between any two
 * tasks of the organization. Nothing moves automatically: overlaps are reported in red.
 * Pure functions; used by pages (server), dialogs (browser) and the history.
 */
import { formatDate, pluralDays } from "@/lib/format";
import { daysBetween, type DateRange } from "./schedule";
import type { SubprojectColor } from "./subproject-colors";
import type { TaskStatus } from "./tasks";

/** One end of a link: where the task is and its planned dates (null when unknown). */
export type LinkedTask = {
  id: string;
  name: string;
  subprojectId: string;
  subprojectName: string;
  projectId: string;
  projectName: string;
  color: SubprojectColor;
  status: TaskStatus;
  range: DateRange | null;
};

export type TaskLink = { id: string; predecessor: LinkedTask; successor: LinkedTask };

export type TaskOverlap = { link: TaskLink; days: number };

/** Planned dates to use instead of the stored ones (e.g. a previewed change), by task id. */
export type RangeOverrides = Record<string, DateRange | undefined>;

const rangeOf = (task: LinkedTask, ranges?: RangeOverrides) => ranges?.[task.id] ?? task.range;

/** "Set up structure (Structure)", or with the project when it's another one. */
export function taskPlace(task: LinkedTask, fromProjectId?: string): string {
  return task.projectId === fromProjectId || !fromProjectId
    ? `${task.name} (${task.subprojectName})`
    : `${task.name} (${task.projectName} › ${task.subprojectName})`;
}

/** Links whose successor starts on or before the predecessor's last day. */
export function taskOverlaps(links: TaskLink[], ranges?: RangeOverrides): TaskOverlap[] {
  return links.flatMap((link) => {
    const before = rangeOf(link.predecessor, ranges);
    const after = rangeOf(link.successor, ranges);
    if (!before || !after) return [];
    const days = daysBetween(after.start, before.end) + 1;
    return days > 0 ? [{ link, days }] : [];
  });
}

/** "Rig sail (Shade Sail) starts 14 Jan, but Set up structure (Structure) finishes 14 Jan (1 day overlap)." */
export function taskOverlapMessage(overlap: TaskOverlap, fromProjectId?: string, ranges?: RangeOverrides): string {
  const { predecessor, successor } = overlap.link;
  return `${taskPlace(successor, fromProjectId)} starts ${formatDate(rangeOf(successor, ranges)?.start ?? null)}, but ${taskPlace(
    predecessor,
    fromProjectId,
  )} finishes ${formatDate(rangeOf(predecessor, ranges)?.end ?? null)} (${pluralDays(overlap.days)} overlap).`;
}

/** The overlapping days of a link, clipped to one task's own bar (drawn red on it). */
export function taskOverlapWindows(overlaps: TaskOverlap[], taskId: string, ranges?: RangeOverrides): DateRange[] {
  return overlaps.flatMap(({ link }) => {
    if (link.predecessor.id !== taskId && link.successor.id !== taskId) return [];
    const own = rangeOf(link.predecessor.id === taskId ? link.predecessor : link.successor, ranges);
    const start = rangeOf(link.successor, ranges)?.start;
    const end = rangeOf(link.predecessor, ranges)?.end;
    if (!own || !start || !end) return [];
    return [{ start: start > own.start ? start : own.start, end: end < own.end ? end : own.end }];
  });
}

/** Links that touch any of these tasks. */
export function linksTouching(links: TaskLink[], taskIds: Iterable<string>): TaskLink[] {
  const ids = new Set(taskIds);
  return links.filter((l) => ids.has(l.predecessor.id) || ids.has(l.successor.id));
}
