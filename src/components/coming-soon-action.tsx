import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A primary action that exists in the design but is not implemented yet.
 * It is visibly disabled and says when it arrives, so nothing pretends to work.
 */
export function ComingSoonAction({
  icon: Icon,
  label,
  phase,
}: {
  icon: LucideIcon;
  label: string;
  phase: string;
}) {
  return (
    <Button disabled title={`Available in ${phase}`}>
      <Icon aria-hidden="true" />
      {label}
      <span className="sr-only">{` (available in ${phase})`}</span>
    </Button>
  );
}
