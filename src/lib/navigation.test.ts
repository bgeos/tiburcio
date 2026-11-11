import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_NAV, findNavItem, isNavItemActive, isSection, orgHref, sectionFromPath, workspacePath } from "./navigation";

const ORG_DIR = join(process.cwd(), "src", "app", "(app)", "jupigenio", "[org]");

describe("navigation config", () => {
  it("has unique sections and titles", () => {
    const sections = ALL_NAV.map((item) => item.section);
    const titles = ALL_NAV.map((item) => item.title);
    expect(new Set(sections).size).toBe(sections.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(ALL_NAV.map((item) => [item.section]))("%s has a page in src/app/(app)/jupigenio/[org]", (section) => {
    expect(existsSync(join(ORG_DIR, section, "page.tsx"))).toBe(true);
  });
});

describe("orgHref", () => {
  it("prefixes the jupigenio module and the workspace", () => {
    expect(orgHref("jupi", "projects")).toBe("/jupigenio/jupi/projects");
    expect(workspacePath("jupi", "/projects/1")).toBe("/jupigenio/jupi/projects/1");
  });

  it("falls back to the workspace picker at /jupigenio without a workspace", () => {
    expect(orgHref(undefined, "projects")).toBe("/jupigenio?section=projects");
  });
});

describe("sections", () => {
  it("reads the section after the workspace", () => {
    expect(sectionFromPath("/jupigenio/jupi/projects/main-stage")).toBe("projects");
    expect(sectionFromPath("/jupigenio/jupi")).toBeUndefined();
    expect(sectionFromPath("/jupigenio")).toBeUndefined();
    expect(sectionFromPath("/")).toBeUndefined();
  });

  it("matches the section and its children only", () => {
    expect(isNavItemActive("projects", "/jupigenio/jupi/projects")).toBe(true);
    expect(isNavItemActive("projects", "/jupigenio/jupi/projects/main-stage")).toBe(true);
    expect(isNavItemActive("projects", "/jupigenio/jupi/projects-archive")).toBe(false);
    expect(isNavItemActive("projects", "/jupi/projects")).toBe(false);
    expect(isNavItemActive("projects", "/projects")).toBe(false);
  });

  it("finds the section for nested routes", () => {
    expect(findNavItem("/jupigenio/jupi/materials/plywood")?.title).toBe("Materials");
    expect(findNavItem("/jupigenio/jupi/unknown")).toBeUndefined();
  });

  it("only accepts known sections", () => {
    expect(isSection("projects")).toBe(true);
    expect(isSection("../admin")).toBe(false);
    expect(isSection(undefined)).toBe(false);
  });
});
