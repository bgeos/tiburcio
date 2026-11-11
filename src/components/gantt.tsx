import Link from "next/link";
import { Flag } from "lucide-react";
import { arrowPath, ganttMonths, ganttScale, ganttTicks, ROW_HEIGHT, type GanttZoom } from "@/lib/domain/gantt";
import type { Milestone } from "@/lib/domain/milestones";
import type { DateRange, IsoDate } from "@/lib/domain/schedule";
import type { SubprojectColor } from "@/lib/domain/subproject-colors";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SUBPROJECT_BG, SubprojectDot } from "./subproject-color";

export type GanttRow = {
  id: string;
  /** Subprojects are summary rows; their tasks follow them. */
  kind: "subproject" | "task";
  label: string;
  href?: string;
  range: DateRange | null;
  /** Original (locked) plan, drawn as a dashed line under the bar. */
  baseline?: DateRange | null;
  color: SubprojectColor;
  done?: boolean;
  /** Days drawn red: overlaps and days late for a milestone. */
  red?: DateRange[];
  /** The row in words, for screen readers: dates, links, warnings. */
  description: string;
};

/** "`to` starts after `from` finishes": drawn as an arrow, red when `to` starts too early. */
export type GanttLink = { from: string; to: string };

// The name column: narrower on phones. Bars and arrows are placed after it (--gantt-label).
const LABEL_COLUMN = "[--gantt-label:9rem] sm:[--gantt-label:14rem]";

/**
 * Read-only Gantt chart (P4-06, D-031): bars, finish-to-start arrows, today, milestones, the
 * original plan and red days. Scrolls sideways; every row also states its dates in words.
 */
export function Gantt({
  rows,
  links,
  milestones,
  today,
  zoom,
  label,
}: {
  rows: GanttRow[];
  links: GanttLink[];
  milestones: Milestone[];
  today: IsoDate;
  zoom: GanttZoom;
  label: string;
}) {
  const dates: IsoDate[] = milestones.map((m) => m.date);
  for (const row of rows) for (const r of [row.range, row.baseline]) if (r) dates.push(r.start, r.end);
  const scale = ganttScale(dates, today, zoom);
  const ticks = ganttTicks(scale, zoom);
  const months = ganttMonths(scale);
  const height = rows.length * ROW_HEIGHT;
  const todayInside = today >= scale.first && today <= scale.last;

  const index = new Map(rows.map((r, i) => [r.id, i]));
  const arrows = links.flatMap((link) => {
    const from = index.get(link.from);
    const to = index.get(link.to);
    const a = from === undefined ? null : rows[from].range;
    const b = to === undefined ? null : rows[to].range;
    if (from === undefined || to === undefined || !a || !b) return [];
    return [{ ...link, ...arrowPath({ x: scale.x(a.start), w: scale.w(a), row: from }, { x: scale.x(b.start), row: to }) }];
  });

  return (
    <div
      className="overflow-x-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-ring"
      tabIndex={0}
      role="region"
      aria-label={`${label} (scrolls sideways)`}
    >
      <div className={cn("relative", LABEL_COLUMN)} style={{ width: `calc(var(--gantt-label) + ${scale.width}px)` }}>
        {/* Header: months, day numbers, milestones. */}
        <div className="flex border-b text-xs text-muted-foreground" aria-hidden="true">
          <div className="sticky left-0 z-20 flex w-(--gantt-label) shrink-0 items-end border-r bg-card px-3 pb-1 font-medium">
            Subproject / task
          </div>
          <div className="relative shrink-0 py-1" style={{ width: scale.width }}>
            <div className="relative h-4 font-medium text-foreground">
              {months.map((m) => (
                <span key={m.date} className="absolute top-0 whitespace-nowrap pl-1" style={{ left: m.x }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="relative h-4">
              {ticks.map((t) => (
                <span key={t.date} className="absolute top-0 whitespace-nowrap pl-1 tabular-nums" style={{ left: t.x }}>
                  {t.label}
                </span>
              ))}
            </div>
            {milestones.length ? (
              <div className="relative h-4 font-medium text-foreground">
                {milestones.map((m) => (
                  <span
                    key={m.id}
                    className="absolute top-0 inline-flex items-center gap-0.5 whitespace-nowrap"
                    style={{ left: scale.x(m.date) }}
                    title={`${m.name} · ${formatDate(m.date)}`}
                  >
                    <Flag className="size-3" />
                    <span className="max-w-32 truncate">{m.name}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative">
          {/* Behind the bars: day or week lines, today, milestones. */}
          <svg
            className="pointer-events-none absolute top-0 left-(--gantt-label)"
            width={scale.width}
            height={height}
            aria-hidden="true"
          >
            {ticks.map((t) => (
              <line key={t.date} x1={t.x} x2={t.x} y1={0} y2={height} className="text-border" stroke="currentColor" />
            ))}
            {todayInside ? (
              <line
                x1={scale.x(today) + scale.dayWidth / 2}
                x2={scale.x(today) + scale.dayWidth / 2}
                y1={0}
                y2={height}
                className="text-destructive/60"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            ) : null}
            {milestones.map((m) => (
              <line
                key={m.id}
                x1={scale.x(m.date)}
                x2={scale.x(m.date)}
                y1={0}
                y2={height}
                className="text-foreground/60"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="2 3"
              />
            ))}
          </svg>

          <ul aria-label={label}>
            {rows.map((row) => (
              <li key={row.id} className="flex border-b last:border-b-0" style={{ height: ROW_HEIGHT }}>
                <div
                  className={cn(
                    "sticky left-0 z-20 flex w-(--gantt-label) shrink-0 items-center gap-1.5 border-r bg-card px-3 text-sm",
                    row.kind === "task" && "pl-5 sm:pl-7",
                  )}
                >
                  {row.kind === "subproject" ? <SubprojectDot color={row.color} /> : null}
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="truncate font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {row.label}
                    </Link>
                  ) : (
                    <span className={cn("truncate", row.kind === "subproject" && "font-semibold")}>{row.label}</span>
                  )}
                  <span className="sr-only">{row.description}</span>
                </div>
                <div className="relative shrink-0" style={{ width: scale.width }} aria-hidden="true">
                  {row.range ? (
                    <div
                      className={cn(
                        "absolute rounded-sm",
                        SUBPROJECT_BG[row.color],
                        row.kind === "subproject" ? "top-3.5 h-2" : "top-2.5 h-4",
                        row.done && "opacity-45",
                      )}
                      style={{ left: scale.x(row.range.start), width: scale.w(row.range) }}
                    />
                  ) : null}
                  {row.red?.map((r, i) => (
                    <div
                      key={`${r.start}-${i}`}
                      className="absolute top-2 h-5 rounded-sm bg-destructive"
                      style={{ left: scale.x(r.start), width: scale.w(r) }}
                    />
                  ))}
                  {row.baseline ? (
                    <div
                      className="absolute bottom-1 h-1.5 rounded-sm border border-dashed border-muted-foreground"
                      style={{ left: scale.x(row.baseline.start), width: scale.w(row.baseline) }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {/* In front of the bars: finish-to-start arrows. */}
          <svg
            className="pointer-events-none absolute top-0 left-(--gantt-label) z-10"
            width={scale.width}
            height={height}
            aria-hidden="true"
          >
            <defs>
              <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" className="text-muted-foreground" fill="currentColor" />
              </marker>
              <marker id="gantt-arrow-late" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" className="text-destructive" fill="currentColor" />
              </marker>
            </defs>
            {arrows.map((a) => (
              <path
                key={`${a.from}-${a.to}`}
                d={a.path}
                fill="none"
                className={a.late ? "text-destructive" : "text-muted-foreground"}
                stroke="currentColor"
                strokeWidth={1.5}
                markerEnd={a.late ? "url(#gantt-arrow-late)" : "url(#gantt-arrow)"}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
