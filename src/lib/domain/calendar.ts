/**
 * Calendar (P4-07): which tasks and milestones fall on which days, by month or week.
 * Weeks start on Monday. Pure; the calendar page only draws what this returns.
 */
import type { Milestone } from "./milestones";
import { addDays, daysBetween, type DateRange, type IsoDate } from "./schedule";

export const CALENDAR_VIEWS = ["month", "week"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const utc = (date: IsoDate) => new Date(`${date}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && iso(utc(value)) === value;
}

/** The Monday of the week holding `date`. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, -((utc(date).getUTCDay() + 6) % 7));
}

/** The 7 days of the week holding `date`, Monday first. */
export function weekDays(date: IsoDate): IsoDate[] {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Whole weeks covering the month of `date` (days of the next/previous month fill the edges). */
export function monthWeeks(date: IsoDate): IsoDate[][] {
  const d = utc(date);
  const first = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const last = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  const weeks: IsoDate[][] = [];
  for (let monday = weekStart(first); monday <= last; monday = addDays(monday, 7)) weeks.push(weekDays(monday));
  return weeks;
}

export function sameMonth(a: IsoDate, b: IsoDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** The date one month or week before (-1) or after (+1); months keep the 1st. */
export function shiftPeriod(date: IsoDate, view: CalendarView, by: -1 | 1): IsoDate {
  if (view === "week") return addDays(weekStart(date), 7 * by);
  const d = utc(date);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1)));
}

/** "March 2031", or "3 – 9 Mar 2031" for a week. */
export function periodLabel(date: IsoDate, view: CalendarView): string {
  if (view === "month") {
    const d = utc(date);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const [monday, sunday] = [weekStart(date), addDays(weekStart(date), 6)].map(utc);
  const short = (d: Date) => MONTHS[d.getUTCMonth()].slice(0, 3);
  return monday.getUTCMonth() === sunday.getUTCMonth()
    ? `${monday.getUTCDate()} – ${sunday.getUTCDate()} ${short(sunday)} ${sunday.getUTCFullYear()}`
    : `${monday.getUTCDate()} ${short(monday)} – ${sunday.getUTCDate()} ${short(sunday)} ${sunday.getUTCFullYear()}`;
}

export type CalendarTask = { id: string; range: DateRange | null };

/** What happens on one day: tasks running that day, milestones on it. */
export function itemsOn<T extends CalendarTask>(date: IsoDate, tasks: T[], milestones: Milestone[]): { tasks: T[]; milestones: Milestone[] } {
  return {
    tasks: tasks.filter((t) => t.range && t.range.start <= date && date <= t.range.end),
    milestones: milestones.filter((m) => m.date === date),
  };
}

/** "Day 2 of 4" for a task on a given day. */
export function dayOf(range: DateRange, date: IsoDate): string {
  return `day ${daysBetween(range.start, date) + 1} of ${daysBetween(range.start, range.end) + 1}`;
}
