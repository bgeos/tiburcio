import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_NAV, findNavItem, isNavItemActive } from "./navigation";

const APP_GROUP_DIR = join(process.cwd(), "src", "app", "(app)");

describe("navigation config", () => {
  it("has unique hrefs and titles", () => {
    const hrefs = ALL_NAV.map((item) => item.href);
    const titles = ALL_NAV.map((item) => item.title);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(ALL_NAV.map((item) => [item.href]))(
    "%s has a page in src/app/(app)",
    (href) => {
      expect(existsSync(join(APP_GROUP_DIR, href, "page.tsx"))).toBe(true);
    },
  );
});

describe("isNavItemActive", () => {
  it("matches the route and its children only", () => {
    expect(isNavItemActive("/projects", "/projects")).toBe(true);
    expect(isNavItemActive("/projects", "/projects/main-stage")).toBe(true);
    expect(isNavItemActive("/projects", "/projects-archive")).toBe(false);
    expect(isNavItemActive("/projects", "/")).toBe(false);
  });
});

describe("findNavItem", () => {
  it("finds the section for nested routes", () => {
    expect(findNavItem("/materials/plywood")?.title).toBe("Materials");
    expect(findNavItem("/unknown")).toBeUndefined();
  });
});
