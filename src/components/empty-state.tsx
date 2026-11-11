import type { LucideIcon } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * An empty state explains what belongs here and what to do next.
 * `availability` states plainly when a feature has not been built yet,
 * instead of showing a button that silently does nothing.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  availability,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  availability?: string;
  className?: string;
}) {
  return (
    <Empty className={cn("flex-none border bg-card py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-10 bg-accent text-accent-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action || availability ? (
        <EmptyContent>
          {action}
          {availability ? (
            <p className="text-xs text-muted-foreground">{availability}</p>
          ) : null}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
