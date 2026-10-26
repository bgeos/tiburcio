import { addDays, daysBetween, type DateRange, type IsoDate } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDate, formatRange } from "@/lib/format";

export type TimelineRow = {
  id: string;
  label: string;
  sublabel?: string;
  range: DateRange | null;
  /** Original (locked) plan, drawn as a dashed line under the bar. */
  baseline?: DateRange | null;
  /** Overlap text for screen readers; `overlaps` are the days drawn in red. */
  warning?: string | null;
  overlaps?: DateRange[];
  done?: boolean;
  /** Link the row label (server or client callers)… */
  href?: string;
  /** …or make it a button (client callers only). */
  onSelect?: () => void;
};

/**
 * The days to draw: the plan's own dates. Today stretches the scale only when it falls
 * inside the plan; a plan months away would otherwise be squeezed against one edge.
 */
function span(rows: TimelineRow[], today: IsoDate) {
  const dates: IsoDate[] = [];
  for (const row of rows) {
    for (const r of [row.range, row.baseline]) if (r) dates.push(r.start, r.end);
  }
  dates.sort();
  const first = dates[0] ?? today;
  const last = dates[dates.length - 1] ?? today;
  const todayInside = today >= first && today <= last;
  return { first, last, todayInside, todayBefore: today < first };
}

/**
 * Simple Gantt-style timeline (calendar days). Bars are decorative; each row
 * also states its dates and warnings as text for screen readers.
 */
export function Timeline({
  rows,
  today,
  label,
  showOverlapKey = false,
}: {
  rows: TimelineRow[];
  today: IsoDate;
  label: string;
  /** Show the red "Overlap" legend entry (only where overlaps can occur). */
  showOverlapKey?: boolean;
}) {
  const { first, last, todayInside, todayBefore } = span(rows, today);
  const total = daysBetween(first, last) + 1;
  const pos = (date: IsoDate) => (daysBetween(first, date) / total) * 100;
  const width = (r: DateRange) => ((daysBetween(r.start, r.end) + 1) / total) * 100;
  const step = Math.max(1, Math.ceil(total / 8));
  const ticks = Array.from({ length: Math.ceil(total / step) }, (_, i) => addDays(first, i * step));

  return (
    <div className="space-y-3">
      {/* Scrolls sideways on narrow screens: focusable so keyboard users can scroll it too. */}
      <div
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={0}
        role="region"
        aria-label={`${label} (scrolls sideways on small screens)`}
      >
        <div className="min-w-[560px]">
          <div className="flex text-xs text-muted-foreground" aria-hidden="true">
            <div className="w-40 shrink-0" />
            <div className="relative h-5 flex-1">
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 whitespace-nowrap" style={{ left: `${pos(t)}%` }}>
                  {formatDate(t)}
                </span>
              ))}
            </div>
          </div>
          <ul aria-label={label} className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center py-2">
                <div className="w-40 shrink-0 pr-3">
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {row.label}
                    </Link>
                  ) : row.onSelect ? (
                    <button
                      type="button"
                      onClick={row.onSelect}
                      className="text-left text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {row.label}
                    </button>
                  ) : (
                    <p className="text-sm font-medium">{row.label}</p>
                  )}
                  {row.sublabel ? <p className="text-xs text-muted-foreground">{row.sublabel}</p> : null}
                  <span className="sr-only">
                    {`Planned ${formatRange(row.range)}.`}
                    {row.baseline ? ` Original plan ${formatRange(row.baseline)}.` : ""}
                    {row.warning ? ` Warning: ${row.warning}` : ""}
                  </span>
                </div>
                <div className="relative h-8 flex-1" aria-hidden="true">
                  {todayInside ? (
                    <div
                      className="absolute inset-y-0 w-px bg-destructive/60"
                      style={{ left: `${pos(today)}%` }}
                    />
                  ) : null}
                  {row.range ? (
                    <div
                      className={cn(
                        "absolute top-1 flex h-4 items-center rounded-sm",
                        row.done ? "bg-status-done" : "bg-primary",
                      )}
                      style={{ left: `${pos(row.range.start)}%`, width: `${width(row.range)}%` }}
                    />
                  ) : null}
                  {row.overlaps?.map((o) => (
                    <div
                      key={o.start}
                      className="absolute top-0.5 h-5 rounded-sm bg-destructive"
                      style={{ left: `${pos(o.start)}%`, width: `${width(o)}%` }}
                    />
                  ))}
                  {row.baseline ? (
                    <div
                      className="absolute bottom-1 h-1.5 rounded-sm border border-dashed border-muted-foreground"
                      style={{ left: `${pos(row.baseline.start)}%`, width: `${width(row.baseline)}%` }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-primary" /> Current plan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-sm border border-dashed border-muted-foreground" /> Original plan
        </span>
        {showOverlapKey ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-destructive" /> Overlapping days
          </span>
        ) : null}
        {todayInside ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-destructive/60" /> Today ({formatDate(today)})
          </span>
        ) : (
          <span>
            Today: {formatDate(today)}, {todayBefore ? "before" : "after"} this plan
          </span>
        )}
      </div>
    </div>
  );
}
