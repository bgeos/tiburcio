"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/projects/prototype", label: "Projects", icon: FolderKanban },
  { href: "/projects/prototype/materials", label: "All materials", icon: Package },
];

export function PrototypeNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Prototype" className="inline-flex rounded-lg bg-muted p-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
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
