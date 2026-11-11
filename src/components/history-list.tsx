import type { ActivityEntry } from "@/lib/dal/activity";
import { formatDateTime } from "@/lib/format";

/** "What changed, and why": newest first, with who did it and when (organization's timezone). */
export function HistoryList({
  entries,
  timeZone,
  label,
  subprojectName,
  emptyText = "No changes yet.",
}: {
  entries: ActivityEntry[];
  timeZone: string;
  label: string;
  /** Pass to show which subproject each entry belongs to (project-level history). */
  subprojectName?: (id: string) => string | undefined;
  emptyText?: string;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol aria-label={label} className="space-y-3">
      {entries.map((entry) => {
        const where = subprojectName ? (entry.subprojectId ? (subprojectName(entry.subprojectId) ?? "Archived subproject") : "Project") : null;
        return (
          <li key={entry.id} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt, timeZone)}</time> · {entry.actor}
              {where ? ` · ${where}` : null}
            </p>
            <p className="text-sm font-medium">{entry.summary}</p>
            {entry.details.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {entry.details.map((d, i) => (
                  <li key={i} className={d.startsWith("Overlap:") ? "text-destructive" : undefined}>
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}
            {entry.reason ? (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Reason: </span>
                {entry.reason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
