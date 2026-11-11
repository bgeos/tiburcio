import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single metric. `value === null` means "no data", rendered as an em dash
 * with an explanation — never as a fake 0.
 */
export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode | null;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-5">
        {value === null ? (
          <>
            <p className="text-3xl font-semibold text-muted-foreground" aria-hidden="true">
              —
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint ?? "No data yet"}</p>
            <span className="sr-only">{`${label}: ${hint ?? "No data yet"}`}</span>
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold tabular-nums">{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
