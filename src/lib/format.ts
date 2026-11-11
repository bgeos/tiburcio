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

/** A moment (e.g. a history entry) in the organization's timezone: "26 Oct, 14:05". */
export function formatDateTime(iso: string, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(iso));
  }
}
