"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { findNavItem } from "@/lib/navigation";
import { AccountMenu } from "./account-menu";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  const pathname = usePathname();
  const section = pathname.startsWith("/design")
    ? "Design system"
    : findNavItem(pathname)?.title;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-5 data-vertical:self-center" />
      <p className="truncate text-sm font-medium text-muted-foreground">
        {section ?? "JupiGenio"}
      </p>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}
