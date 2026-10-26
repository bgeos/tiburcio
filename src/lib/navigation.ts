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
  /** First path segment after the organization: /<org>/<section>. */
  section: string;
  icon: LucideIcon;
  description: string;
};

/**
 * Primary navigation (blueprint § 7 "Global navigation"). Every section lives
 * under the organization: /<org>/<section> (D-016).
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    title: "Overview",
    section: "dashboard",
    icon: LayoutDashboard,
    description: "Progress, schedule risks, materials and costs at a glance.",
  },
  {
    title: "Projects",
    section: "projects",
    icon: FolderKanban,
    description: "Festivals, areas, structures and every nested subproject.",
  },
  {
    title: "Tasks",
    section: "tasks",
    icon: ListChecks,
    description: "Your work queue across all projects.",
  },
  {
    title: "Materials",
    section: "materials",
    icon: Package,
    description: "Catalogue, stock, reservations and consumption.",
  },
  {
    title: "Reports",
    section: "reports",
    icon: BarChart3,
    description: "Budgets, costs and exports.",
  },
  {
    title: "Team",
    section: "team",
    icon: Users,
    description: "Members, roles and external collaborators.",
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    title: "Settings",
    section: "settings",
    icon: Settings,
    description: "Organization, statuses, fields and preferences.",
  },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export const DEFAULT_SECTION = "dashboard";

export function isSection(value: unknown): value is string {
  return typeof value === "string" && ALL_NAV.some((item) => item.section === value);
}

/**
 * Link to a section of an organization. Without an organization (e.g. on /design)
 * the link goes to `/`, which picks the person's organization (see app/route.ts).
 */
export function orgHref(org: string | undefined, section: string): string {
  return org ? `/${org}/${section}` : `/?section=${encodeURIComponent(section)}`;
}

/** "/jupi/projects/main-stage" → "projects". Undefined outside an organization. */
export function sectionFromPath(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[1];
}

/** True when `pathname` is inside the nav item's section. */
export function isNavItemActive(section: string, pathname: string): boolean {
  return sectionFromPath(pathname) === section;
}

export function findNavItem(pathname: string): NavItem | undefined {
  const section = sectionFromPath(pathname);
  return ALL_NAV.find((item) => item.section === section);
}
