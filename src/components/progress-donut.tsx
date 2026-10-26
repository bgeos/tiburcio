import { cn } from "@/lib/utils";

/**
 * Single-value progress ring: one colour on a muted track, the number in the
 * middle. `value === null` means nothing to measure and shows "—", never 0%.
 */
export function ProgressDonut({
  value,
  label,
  size = 64,
  className,
}: {
  /** 0–100, or null when there is no data. */
  value: number | null;
  /** What the ring measures, e.g. "Structure progress". */
  label: string;
  size?: number;
  className?: string;
}) {
  const stroke = Math.max(4, Math.round(size / 9));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rounded = value === null ? null : Math.round(value);
  const text = rounded === null ? "—" : `${rounded}%`;
  const description = `${label}: ${rounded === null ? "no tasks yet" : `${rounded}% complete`}`;

  return (
    <div
      role="img"
      aria-label={description}
      title={description}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        {rounded ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(circumference * rounded) / 100} ${circumference}`}
            className="stroke-primary transition-[stroke-dasharray] duration-500"
          />
        ) : null}
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          "absolute font-semibold tabular-nums",
          size >= 96 ? "text-xl" : "text-xs",
          rounded === null && "text-muted-foreground",
        )}
      >
        {text}
      </span>
    </div>
  );
}
