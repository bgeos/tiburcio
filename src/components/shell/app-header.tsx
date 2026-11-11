"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { findNavItem } from "@/lib/navigation";
import { ThemeToggle } from "./theme-toggle";

/** `account` is the session-reading account menu, passed in from the server layout. */
/** Current section's title. Reads the URL, so it renders inside <Suspense>. */
function SectionTitle() {
  const pathname = usePathname();
  const section = pathname.startsWith("/design")
    ? "Design system"
    : findNavItem(pathname)?.title; // reads the section after /<org>/
  return <>{section ?? "Tibúrcio"}</>;
}

export function AppHeader({ account }: { account: React.ReactNode }) {

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-5 data-vertical:self-center" />
      <p className="truncate text-sm font-medium text-muted-foreground">
        <Suspense fallback="Tibúrcio">
          <SectionTitle />
        </Suspense>
      </p>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        {account}
      </div>
    </header>
  );
}
