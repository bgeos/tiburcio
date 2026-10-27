/**
 * Gantt layout (P4-06, D-031): where bars, arrows and markers go, in pixels. Pure; the Gantt
 * component only draws what this returns. Read-only: nothing is dragged, dates come from the plan.
 */
import { addDays, daysBetween, type DateRange, type IsoDate } from "./schedule";

export const GANTT_ZOOMS = ["day", "week"] as const;
export type GanttZoom = (typeof GANTT_ZOOMS)[number];

/** Pixels per calendar day. */
export const DAY_WIDTH: Record<GanttZoom, number> = { day: 36, week: 12 };
export const ROW_HEIGHT = 36;

export type GanttScale = {
  first: IsoDate;
  last: IsoDate;
  days: number;
  dayWidth: number;
  width: number;
  x: (date: IsoDate) => number;
  /** Bar width of a range, inclusive of both days. */
  w: (range: DateRange) => number;
};

/** The days to draw: every date given, with some room (just today when there are none). */
export function ganttScale(dates: IsoDate[], today: IsoDate, zoom: GanttZoom): GanttScale {
  const sorted = [...dates].sort();
  // A day of room on each side at day zoom; whole weeks already leave room at week zoom.
  const pad = zoom === "day" ? 1 : 0;
  let first = addDays(sorted[0] ?? today, -pad);
  let last = addDays(sorted[sorted.length - 1] ?? today, pad);
  if (zoom === "week") {
    // Whole weeks, starting on Monday, so week labels line up.
    const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
    first = addDays(first, -weekday);
    last = addDays(last, 6 - ((new Date(`${last}T00:00:00Z`).getUTCDay() + 6) % 7));
  }
  const days = daysBetween(first, last) + 1;
  const dayWidth = DAY_WIDTH[zoom];
  return {
    first,
    last,
    days,
    dayWidth,
    width: days * dayWidth,
    x: (date) => daysBetween(first, date) * dayWidth,
    w: (range) => (daysBetween(range.start, range.end) + 1) * dayWidth,
  };
}

export type GanttTick = { date: IsoDate; x: number; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day numbers: every day at day zoom, every Monday at week zoom. */
export function ganttTicks(scale: GanttScale, zoom: GanttZoom): GanttTick[] {
  const ticks: GanttTick[] = [];
  for (let i = 0; i < scale.days; i++) {
    const date = addDays(scale.first, i);
    const d = new Date(`${date}T00:00:00Z`);
    if (zoom === "day" || d.getUTCDay() === 1) ticks.push({ date, x: scale.x(date), label: String(d.getUTCDate()) });
  }
  return ticks;
}

/** Month names above the day numbers: at the start of the chart and on each 1st. */
export function ganttMonths(scale: GanttScale): GanttTick[] {
  const months: GanttTick[] = [];
  for (let i = 0; i < scale.days; i++) {
    const date = addDays(scale.first, i);
    const d = new Date(`${date}T00:00:00Z`);
    if (i === 0 || d.getUTCDate() === 1) {
      months.push({ date, x: scale.x(date), label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
    }
  }
  // A month starting a few days in would overlap the first label: keep the later one.
  return months.filter((m, i) => i + 1 >= months.length || months[i + 1].x - m.x >= 72);
}

export type GanttArrow = { from: string; to: string; path: string; late: boolean };

/**
 * An arrow from the end of one bar to the start of another (finish-to-start). When the successor
 * starts too early it loops back around, and is drawn as late (red).
 */
export function arrowPath(
  from: { x: number; w: number; row: number },
  to: { x: number; row: number },
  rowHeight = ROW_HEIGHT,
): { path: string; late: boolean } {
  const x1 = from.x + from.w;
  const y1 = from.row * rowHeight + rowHeight / 2;
  const x2 = to.x;
  const y2 = to.row * rowHeight + rowHeight / 2;
  const late = x2 < x1;
  const gap = 6;
  if (x2 - x1 >= 2 * gap) {
    return { path: `M ${x1} ${y1} H ${x1 + gap} V ${y2} H ${x2}`, late };
  }
  // Too close or overlapping: out to the right, down between the rows, back left to the start.
  const between = y2 > y1 ? to.row * rowHeight : (to.row + 1) * rowHeight;
  return { path: `M ${x1} ${y1} H ${x1 + gap} V ${between} H ${x2 - gap} V ${y2} H ${x2}`, late };
}
