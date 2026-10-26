import {
  BarChart3,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

/**
 * Primary navigation (blueprint § 7 "Global navigation").
 * Phase 2 will prefix these with the organization slug: /[org]/projects…
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Progress, schedule risks, materials and costs at a glance.",
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
    description: "Festivals, areas, structures and every nested subproject.",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListChecks,
    description: "Your work queue across all projects.",
  },
  {
    title: "Materials",
    href: "/materials",
    icon: Package,
    description: "Catalogue, stock, reservations and consumption.",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "Budgets, costs and exports.",
  },
  {
    title: "Team",
    href: "/team",
    icon: Users,
    description: "Members, roles and external collaborators.",
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Organization, statuses, fields and preferences.",
  },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

/** True when `pathname` is the nav item's route or one of its children. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV.find((item) => isNavItemActive(item.href, pathname));
}
