/**
 * Plan of one project: its subprojects' computed dates, overlaps between linked
 * subprojects, and the "what changes" preview shown before saving (D-019).
 * Pure functions; used by the project page (server) and by dialogs (browser).
 */
import { formatDate, formatRange, pluralDays } from "@/lib/format";
import {
  diffRanges,
  findOverlaps,
  scheduleSubproject,
  type DateRange,
  type Dependency,
  type IsoDate,
  type Overlap,
  type SubprojectSchedule,
} from "./schedule";
import { milestoneMissMessage, milestoneMisses, type MilestoneLink } from "./milestones";
import { taskOverlapMessage, taskOverlaps, taskPlace, type TaskLink } from "./task-links";

export type PlanTask = { id: string; name: string; durationDays: number; delayDays: number };
export type PlanSubproject = { id: string; name: string; startDate: IsoDate; tasks: PlanTask[] };

export function schedulesFor(subprojects: PlanSubproject[]): Record<string, SubprojectSchedule> {
  return Object.fromEntries(subprojects.map((s) => [s.id, scheduleSubproject(s.startDate, s.tasks)]));
}

/** Planned dates of every subproject (if it has tasks) and task, keyed by id. */
export function planRanges(subprojects: PlanSubproject[]): Record<string, DateRange> {
  const ranges: Record<string, DateRange> = {};
  for (const [id, schedule] of Object.entries(schedulesFor(subprojects))) {
    for (const task of schedule.tasks) ranges[task.id] = { start: task.start, end: task.end };
    if (schedule.end) ranges[id] = { start: schedule.start, end: schedule.end };
  }
  return ranges;
}

export function overlapsFor(subprojects: PlanSubproject[], dependencies: Dependency[]): Overlap[] {
  return findOverlaps(schedulesFor(subprojects), dependencies);
}

function nameOf(subprojects: PlanSubproject[], id: string): string {
  return subprojects.find((s) => s.id === id)?.name ?? "—";
}

/** "DJ Booth starts 14 Jan, but Structure finishes 14 Jan (1 day overlap)." */
export function overlapMessage(subprojects: PlanSubproject[], overlap: Overlap): string {
  const schedules = schedulesFor(subprojects);
  return `${nameOf(subprojects, overlap.successorId)} starts ${formatDate(schedules[overlap.successorId]?.start ?? null)}, but ${nameOf(
    subprojects,
    overlap.predecessorId,
  )} finishes ${formatDate(schedules[overlap.predecessorId]?.end ?? null)} (${pluralDays(overlap.days)} overlap).`;
}

/** The days a subproject overlaps its linked subprojects, clipped to its own bar (drawn red). */
export function overlapWindows(
  subprojects: PlanSubproject[],
  overlaps: Overlap[],
  subprojectId: string,
): DateRange[] {
  const schedules = schedulesFor(subprojects);
  const own = schedules[subprojectId];
  if (!own?.end) return [];
  return overlaps
    .filter((o) => o.predecessorId === subprojectId || o.successorId === subprojectId)
    .map((o) => {
      const start = schedules[o.successorId].start;
      const end = schedules[o.predecessorId].end ?? start;
      return { start: start > own.start ? start : own.start, end: end < own.end! ? end : own.end! };
    });
}

export type PlanChange = {
  /** e.g. "Assemble poles: 7 Jan – 10 Jan → 8 Jan – 11 Jan". */
  lines: string[];
  /** Overlaps that are new or bigger after the change. */
  newOverlaps: string[];
  resolvedOverlaps: string[];
};

/**
 * What replacing the plan `before` with `after` changes. Nothing else ever moves.
 * `taskLinks` touching this project are checked too; tasks of other projects keep their dates.
 * `milestoneLinks` of this project's tasks report tasks that run into their milestone (D-030).
 */
export function describePlanChange(
  before: PlanSubproject[],
  after: PlanSubproject[],
  dependencies: Dependency[],
  taskLinks: TaskLink[] = [],
  projectId?: string,
  milestoneLinks: MilestoneLink[] = [],
): PlanChange {
  const names = new Map<string, string>();
  for (const s of [...before, ...after]) {
    names.set(s.id, s.name);
    for (const t of s.tasks) names.set(t.id, t.name);
  }
  const rangesBefore = planRanges(before);
  const rangesAfter = planRanges(after);
  const lines = diffRanges(rangesBefore, rangesAfter).map(
    (c) => `${names.get(c.id)}: ${formatRange(c.before)} → ${formatRange(c.after)}`,
  );
  for (const id of Object.keys(rangesAfter)) {
    if (!rangesBefore[id]) lines.push(`${names.get(id)}: new, ${formatRange(rangesAfter[id])}`);
  }
  for (const id of Object.keys(rangesBefore)) {
    if (!rangesAfter[id]) lines.push(`${names.get(id)}: removed`);
  }

  const key = (o: Overlap) => `${o.predecessorId}>${o.successorId}`;
  const old = new Map(overlapsFor(before, dependencies).map((o) => [key(o), o]));
  const now = new Map(overlapsFor(after, dependencies).map((o) => [key(o), o]));

  // Task links: this project's tasks take their (new) planned dates; a task removed
  // from this project's plan takes its links with it.
  const inPlan = (ranges: Record<string, DateRange>) => (link: TaskLink) =>
    [link.predecessor, link.successor].every((t) => t.projectId !== projectId || t.id in ranges);
  const taskOverlapsIn = (ranges: Record<string, DateRange>) =>
    new Map(taskOverlaps(taskLinks.filter(inPlan(ranges)), ranges).map((o) => [o.link.id, o]));
  const oldTask = taskOverlapsIn(rangesBefore);
  const nowTask = taskOverlapsIn(rangesAfter);
  const missesIn = (ranges: Record<string, DateRange>) =>
    new Map(milestoneMisses(milestoneLinks.filter((l) => l.task.id in ranges), ranges).map((m) => [m.link.id, m]));
  const oldMiss = missesIn(rangesBefore);
  const nowMiss = missesIn(rangesAfter);

  return {
    lines,
    newOverlaps: [
      ...[...now.entries()].filter(([k, o]) => old.get(k)?.days !== o.days).map(([, o]) => overlapMessage(after, o)),
      ...[...nowTask.entries()]
        .filter(([k, o]) => oldTask.get(k)?.days !== o.days)
        .map(([, o]) => taskOverlapMessage(o, projectId, rangesAfter)),
      ...[...nowMiss.entries()]
        .filter(([k, m]) => oldMiss.get(k)?.days !== m.days)
        .map(([, m]) => milestoneMissMessage(m, projectId, rangesAfter)),
    ],
    resolvedOverlaps: [
      ...[...old.entries()]
        .filter(([k]) => !now.has(k))
        .map(([, o]) => `${nameOf(after, o.successorId)} no longer overlaps ${nameOf(after, o.predecessorId)}.`),
      ...[...oldTask.entries()]
        .filter(([k]) => !nowTask.has(k))
        .map(([, o]) => `${taskPlace(o.link.successor, projectId)} no longer overlaps ${taskPlace(o.link.predecessor, projectId)}.`),
      ...[...oldMiss.entries()]
        .filter(([k]) => !nowMiss.has(k))
        .map(([, m]) => `${taskPlace(m.link.task, projectId)} is done before ${m.link.milestone.name} again.`),
    ],
  };
}
