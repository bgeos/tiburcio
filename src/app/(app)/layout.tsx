import { Suspense } from "react";
import { AccountMenu, AccountMenuSkeleton } from "@/components/shell/account-menu";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Authenticated app shell. Signed-out visitors are redirected by the proxy
 * (optimistic); data is protected by RLS and the DAL. The session is read only
 * inside <Suspense> (Cache Components). Organization context arrives with P2-07.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="bg-canvas">
        <AppHeader
          account={
            <Suspense fallback={<AccountMenuSkeleton />}>
              <AccountMenu />
            </Suspense>
          }
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
