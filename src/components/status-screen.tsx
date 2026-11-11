import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Full-page message used by not-found, unauthorized and forbidden screens. */
export function StatusScreen({
  icon: Icon,
  code,
  title,
  description,
  actions,
  tone = "neutral",
}: {
  icon: LucideIcon;
  code: string;
  title: string;
  description: React.ReactNode;
  actions: React.ReactNode;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <main
      id="main"
      className="flex min-h-svh items-center justify-center bg-canvas px-4 py-12"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-xl",
            tone === "neutral" && "bg-accent text-accent-foreground",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "danger" && "bg-status-blocked-soft text-status-blocked",
          )}
        >
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium tracking-widest text-muted-foreground">
            {code}
          </p>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </main>
  );
}
