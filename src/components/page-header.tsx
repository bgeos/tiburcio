import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  headingRef,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** For client-side view changes that move focus to the heading. */
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
