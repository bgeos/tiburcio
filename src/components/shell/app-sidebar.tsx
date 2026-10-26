"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette } from "lucide-react";
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
  type NavItem,
} from "@/lib/navigation";

const DESIGN_SYSTEM_ITEM: NavItem = {
  title: "Design system",
  href: "/design",
  icon: Palette,
  description: "Internal reference for components and states.",
};

function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = isNavItemActive(item.href, pathname);
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

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <span
                  aria-hidden="true"
                  className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                >
                  J
                </span>
                <span className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">JupiGenio</span>
                  <span className="text-xs text-muted-foreground">
                    Production manager
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavLinks items={PRIMARY_NAV} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavLinks items={[...SECONDARY_NAV, DESIGN_SYSTEM_ITEM]} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
