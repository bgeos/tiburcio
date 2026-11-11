import {
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Minus,
  type LucideIcon,
} from "lucide-react";
import {
  PRIORITY_LABELS,
  STATUS_CATEGORY_LABELS,
  type Priority,
  type StatusCategory,
} from "@/lib/domain/status";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<StatusCategory, { icon: LucideIcon; className: string }> = {
  todo: { icon: CircleDashed, className: "bg-status-todo-soft text-status-todo" },
  in_progress: {
    icon: Circle,
    className: "bg-status-in-progress-soft text-status-in-progress",
  },
  blocked: { icon: CircleSlash, className: "bg-status-blocked-soft text-status-blocked" },
  done: { icon: CircleCheck, className: "bg-status-done-soft text-status-done" },
  cancelled: {
    icon: CircleX,
    className: "bg-status-cancelled-soft text-status-cancelled line-through",
  },
};

const badgeBase =
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5";

/**
 * Status pill: icon + text + colour, so the state is readable without colour.
 * `label` lets organizations show their own status name (Phase 7) while the
 * category drives icon and colour.
 */
export function StatusBadge({
  category,
  label,
  className,
}: {
  category: StatusCategory;
  label?: string;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STATUS_STYLES[category];
  return (
    <span className={cn(badgeBase, tone, className)} data-status={category}>
      <Icon aria-hidden="true" />
      {label ?? STATUS_CATEGORY_LABELS[category]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, { icon: LucideIcon; className: string }> = {
  low: { icon: ArrowDown, className: "text-muted-foreground" },
  medium: { icon: Minus, className: "text-foreground" },
  high: { icon: ArrowUp, className: "text-warning" },
  urgent: { icon: ChevronsUp, className: "text-status-blocked font-semibold" },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const { icon: Icon, className: tone } = PRIORITY_STYLES[priority];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs [&>svg]:size-3.5", tone, className)}
    >
      <Icon aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
