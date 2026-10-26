import type { IsoDate } from "@/lib/domain/schedule";

/**
 * Today's calendar date in a timezone (e.g. the organization's "America/Sao_Paulo"),
 * as YYYY-MM-DD. Late in the evening in Brazil it is already tomorrow in UTC.
 */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  try {
    // en-CA formats dates as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10); // unknown timezone: fall back to UTC
  }
}
