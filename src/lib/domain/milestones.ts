/**
 * Milestones (P4-05, D-030): key dates of the organization, shown in every project. A task linked
 * to a milestone must be done before that day; if its planned end reaches the day, the days
 * from the milestone to the task's end are "late" and shown in red. Nothing moves by itself.
 */
import { formatDate, pluralDays } from "@/lib/format";
import { daysBetween, type DateRange, type IsoDate } from "./schedule";
import { taskPlace, type LinkedTask, type RangeOverrides } from "./task-links";

export type Milestone = { id: string; name: string; date: IsoDate };

export type MilestoneLink = { id: string; milestone: Milestone; task: LinkedTask };

export type MilestoneMiss = { link: MilestoneLink; days: number };

const rangeOf = (task: LinkedTask, ranges?: RangeOverrides) => ranges?.[task.id] ?? task.range;

/** Links whose task finishes on or after the milestone's day. */
export function milestoneMisses(links: MilestoneLink[], ranges?: RangeOverrides): MilestoneMiss[] {
  return links.flatMap((link) => {
    const end = rangeOf(link.task, ranges)?.end;
    if (!end) return [];
    const days = daysBetween(link.milestone.date, end) + 1;
    return days > 0 ? [{ link, days }] : [];
  });
}

/** "Rig sail (Shade Sail) finishes 21 Jan, but must be done before Festival opens (20 Jan): 2 days late." */
export function milestoneMissMessage(miss: MilestoneMiss, fromProjectId?: string, ranges?: RangeOverrides): string {
  const { task, milestone } = miss.link;
  return `${taskPlace(task, fromProjectId)} finishes ${formatDate(rangeOf(task, ranges)?.end ?? null)}, but must be done before ${
    milestone.name
  } (${formatDate(milestone.date)}): ${pluralDays(miss.days)} late.`;
}

/** The late days on one task's bar (from the milestone's day to the task's end). */
export function milestoneMissWindows(misses: MilestoneMiss[], taskId: string, ranges?: RangeOverrides): DateRange[] {
  return misses.flatMap(({ link }) => {
    if (link.task.id !== taskId) return [];
    const own = rangeOf(link.task, ranges);
    if (!own) return [];
    return [{ start: link.milestone.date > own.start ? link.milestone.date : own.start, end: own.end }];
  });
}

/** Milestones in date order, then by name. */
export function sortMilestones(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Milestones from today on, soonest first, with the days left (0 = today). */
export function upcomingMilestones(milestones: Milestone[], today: IsoDate, limit = 5): (Milestone & { daysLeft: number })[] {
  return sortMilestones(milestones)
    .filter((m) => m.date >= today)
    .slice(0, limit)
    .map((m) => ({ ...m, daysLeft: daysBetween(today, m.date) }));
}

/** Milestones to draw on a timeline: inside its dates, or linked to one of its tasks. */
export function milestonesOnTimeline(milestones: Milestone[], range: DateRange | null, links: MilestoneLink[]): Milestone[] {
  const linked = new Set(links.map((l) => l.milestone.id));
  return milestones.filter((m) => linked.has(m.id) || (range !== null && m.date >= range.start && m.date <= range.end));
}
