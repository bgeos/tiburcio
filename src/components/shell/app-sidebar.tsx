"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { House, Palette } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  isNavItemActive,
  orgHref,
  type NavItem,
} from "@/lib/navigation";

type SidebarLink = Pick<NavItem, "title" | "icon"> & { href: string; active: boolean };

/** Internal reference page; not part of an organization. */
const DESIGN_SYSTEM_HREF = "/design";

function useNavLinks(items: NavItem[]): SidebarLink[] {
  const pathname = usePathname();
  const { org } = useParams<{ org?: string }>();
  return items.map((item) => ({
    title: item.title,
    icon: item.icon,
    href: orgHref(org, item.section),
    active: Boolean(org) && isNavItemActive(item.section, pathname),
  }));
}

function NavLinks({ links }: { links: SidebarLink[] }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {links.map((item) => {
        const active = item.active;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <item.icon aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/** Links before the URL is known (prerendered shell): no active state, workspace picked by /jupigenio. */
function staticLinks(items: NavItem[]): SidebarLink[] {
  return items.map((item) => ({
    title: item.title,
    icon: item.icon,
    href: orgHref(undefined, item.section),
    active: false,
  }));
}

const DESIGN_TITLE = "Design system";

function PrimaryLinks() {
  return <NavLinks links={useNavLinks(PRIMARY_NAV)} />;
}

/** Tibúrcio's own modules, outside any workspace. More arrive phase by phase (docs/PLAN.md § 11). */
const TIBURCIO_NAV = [{ title: "Home", icon: House, href: "/" }];

function TiburcioLinks() {
  const pathname = usePathname();
  return <NavLinks links={TIBURCIO_NAV.map((item) => ({ ...item, active: pathname === item.href }))} />;
}

function FooterLinks() {
  const secondary = useNavLinks(SECONDARY_NAV);
  const pathname = usePathname();
  const design: SidebarLink = {
    title: DESIGN_TITLE,
    icon: Palette,
    href: DESIGN_SYSTEM_HREF,
    active: pathname === DESIGN_SYSTEM_HREF || pathname.startsWith(`${DESIGN_SYSTEM_HREF}/`),
  };
  return <NavLinks links={[...secondary, design]} />;
}

/** `orgSwitcher` is the session-reading organization menu, passed in from the server layout. */
export function AppSidebar({ orgSwitcher }: { orgSwitcher: React.ReactNode }) {
  // Reading the URL suspends under /[org]/… while prerendering (Cache Components),
  // so only the link lists wait; the rest of the sidebar is in the static shell.
  return (
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <SidebarHeader>{orgSwitcher}</SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tibúrcio</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense fallback={<NavLinks links={TIBURCIO_NAV.map((item) => ({ ...item, active: false }))} />}>
              <TiburcioLinks />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>jupigenio</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense fallback={<NavLinks links={staticLinks(PRIMARY_NAV)} />}>
              <PrimaryLinks />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Suspense
          fallback={
            <NavLinks
              links={[
                ...staticLinks(SECONDARY_NAV),
                { title: DESIGN_TITLE, icon: Palette, href: DESIGN_SYSTEM_HREF, active: false },
              ]}
            />
          }
        >
          <FooterLinks />
        </Suspense>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
