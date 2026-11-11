import { CircleCheck, OctagonAlert } from "lucide-react";
import type { PlanChange } from "@/lib/domain/project-plan";

/**
 * "What moves" before saving a schedule change: moved dates, new overlaps (red,
 * with icon) and overlaps that go away. Nothing else is ever moved automatically.
 */
export function PlanPreview({ change, emptyText = "No dates change." }: { change: PlanChange | null; emptyText?: string }) {
  return (
    <section aria-label="Preview" aria-live="polite" className="space-y-2 rounded-lg border bg-muted/40 p-3">
      <h3 className="text-sm font-semibold">Preview</h3>
      {!change ? (
        <p className="text-sm text-muted-foreground">Make a change to see what moves.</p>
      ) : (
        <>
          {change.lines.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {change.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          )}
          {change.newOverlaps.map((warning) => (
            <p key={warning} className="flex gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              <OctagonAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">Overlap: </span>
                {warning} It won&apos;t be moved automatically.
              </span>
            </p>
          ))}
          {change.resolvedOverlaps.map((note) => (
            <p key={note} className="flex gap-2 text-sm text-status-done">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {note}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
