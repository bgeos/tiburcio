import {
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** The jupigenio module lives under this path: /jupigenio/<workspace>/<section> (D-003, D-004). */
export const JUPIGENIO_PATH = "/jupigenio";

export type NavItem = {
  title: string;
  /** First path segment after the workspace: /jupigenio/<org>/<section>. */
  section: string;
  icon: LucideIcon;
  description: string;
};

/**
 * jupigenio navigation (blueprint § 7 "Global navigation"). Every section lives
 * under the workspace: /jupigenio/<org>/<section> (D-016, D-004).
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
    title: "Calendar",
    section: "calendar",
    icon: CalendarDays,
    description: "Tasks and milestones by month or week, across projects.",
  },
  {
    title: "My tasks",
    section: "tasks",
    icon: ListChecks,
    description: "Your own to-dos and reminders. Only you can see them.",
  },
  {
    title: "Materials",
    section: "materials",
    icon: Package,
    description: "Catalogue, stock, reservations and consumption.",
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

/** A path inside a workspace: ("jupi", "/projects") → "/jupigenio/jupi/projects". */
export function workspacePath(org: string, path: `/${string}`): string {
  return `${JUPIGENIO_PATH}/${org}${path}`;
}

/**
 * Link to a section of a workspace. Without a workspace (e.g. on /design) the link
 * goes to /jupigenio, which picks the first workspace (see app/(app)/jupigenio/page.tsx).
 */
export function orgHref(org: string | undefined, section: string): string {
  return org ? workspacePath(org, `/${section}`) : `${JUPIGENIO_PATH}?section=${encodeURIComponent(section)}`;
}

/** "/jupigenio/jupi/projects/main-stage" → "projects". Undefined outside a workspace. */
export function sectionFromPath(pathname: string): string | undefined {
  const [module, , section] = pathname.split("/").filter(Boolean);
  return `/${module}` === JUPIGENIO_PATH ? section : undefined;
}

/** True when `pathname` is inside the nav item's section. */
export function isNavItemActive(section: string, pathname: string): boolean {
  return sectionFromPath(pathname) === section;
}

export function findNavItem(pathname: string): NavItem | undefined {
  const section = sectionFromPath(pathname);
  return ALL_NAV.find((item) => item.section === section);
}
