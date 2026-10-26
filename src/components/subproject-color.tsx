import type { SubprojectColor } from "@/lib/domain/subproject-colors";
import { cn } from "@/lib/utils";

/** Literal class names, so Tailwind generates them. */
export const SUBPROJECT_BG: Record<SubprojectColor, string> = {
  blue: "bg-sub-blue",
  aqua: "bg-sub-aqua",
  yellow: "bg-sub-yellow",
  magenta: "bg-sub-magenta",
  green: "bg-sub-green",
  violet: "bg-sub-violet",
};

/** The subproject's colour as a dot. Decorative: always placed next to the subproject's name. */
export function SubprojectDot({ color, className }: { color: SubprojectColor; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2.5 shrink-0 rounded-full", SUBPROJECT_BG[color], className)} />;
}
