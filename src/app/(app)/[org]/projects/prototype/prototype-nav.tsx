"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Package } from "lucide-react";
import { useOrgPath } from "@/components/org-link";
import { cn } from "@/lib/utils";

const LINKS = [
  { path: "/projects/prototype", label: "Projects", icon: FolderKanban },
  { path: "/projects/prototype/materials", label: "All materials", icon: Package },
] as const;

export function PrototypeNav() {
  const pathname = usePathname();
  const hrefs = [useOrgPath(LINKS[0].path), useOrgPath(LINKS[1].path)];
  return (
    <nav aria-label="Prototype" className="inline-flex rounded-lg bg-muted p-1">
      {LINKS.map(({ label, icon: Icon }, i) => {
        const href = hrefs[i];
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
