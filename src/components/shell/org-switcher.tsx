import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyMemberships } from "@/lib/dal/organizations";
import { OrgSwitcherMenu } from "./org-switcher-menu";

/**
 * Current organization + role at the top of the sidebar. Reads the session, so
 * the layout renders it behind <Suspense>; `OrgSwitcherSkeleton` is the fallback.
 */
export async function OrgSwitcher() {
  const memberships = await getMyMemberships();
  return <OrgSwitcherMenu memberships={memberships} />;
}

export function OrgSwitcherSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2 p-2" aria-hidden="true">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-28 group-data-[collapsible=icon]:hidden" />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
