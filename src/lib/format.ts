import type { DateRange, IsoDate } from "@/lib/domain/schedule";

// Calendar dates are shown as "4 Jan" (English, D-019), computed in UTC so server
// and browser always agree. Missing data is "—", never a fake value.
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function formatDate(date: IsoDate | null): string {
  return date ? dayMonth.format(new Date(`${date}T00:00:00Z`)) : "—";
}

export function formatRange(range: DateRange | null): string {
  if (!range) return "—";
  return range.start === range.end ? formatDate(range.start) : `${formatDate(range.start)} – ${formatDate(range.end)}`;
}

export function pluralDays(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
}
