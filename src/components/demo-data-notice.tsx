import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mandatory label for any fictional sample data (blueprint § 7 UX rules). */
export function DemoDataNotice({
  children = "Demo data — fictional examples, not stored and not real metrics.",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-dashed border-warning/50 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3.5" />
      {children}
    </p>
  );
}
