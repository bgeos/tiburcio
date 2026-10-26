import type { HistoryEntry } from "@/lib/demo/demo-projects";
import { formatDate } from "./prototype-model";

/** "What changed": newest first, with the reason given at the time. */
export function HistoryList({
  entries,
  subprojectName,
  label,
}: {
  entries: HistoryEntry[];
  /** Pass to show which subproject each entry belongs to. */
  subprojectName?: (id: string) => string;
  label: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes yet.</p>;
  }
  return (
    <ol aria-label={label} className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <time dateTime={entry.on}>{formatDate(entry.on)}</time>
            {subprojectName ? ` · ${entry.subprojectId ? subprojectName(entry.subprojectId) : "Project"}` : null}
          </p>
          <p className="text-sm font-medium">{entry.summary}</p>
          {entry.details.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              {entry.details.map((d) => (
                <li key={d}>{d}</li>
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
      ))}
    </ol>
  );
}
