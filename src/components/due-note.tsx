import { CalendarClock, CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { IsoDate } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";

/**
 * "Due 5 Mar" / "Needed by 5 Mar", in words with an icon; amber with "late" when the day has
 * passed and the item isn't finished (D-034). Nothing when there's no date.
 */
export function DueNote({ date, late, label = "Due", className }: { date: IsoDate | null; late: boolean; label?: string; className?: string }) {
  if (!date) return null;
  const Icon = late ? CalendarClock : CalendarDays;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", late ? "font-medium text-warning" : "text-muted-foreground", className)}>
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      {label ? `${label} ` : ""}
      {formatDate(date)}
      {late ? " · late" : ""}
    </span>
  );
}
