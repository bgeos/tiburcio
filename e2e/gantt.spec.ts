import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  addE2eSubprojects,
  addE2eTasks,
  createE2eProject,
  deleteE2eProjects,
  linkE2eSubprojects,
  linkE2eTasks,
  orgPath,
} from "./support/users";

// P4-06 (D-031): a read-only Gantt per project, built on our own timeline (no library):
// day/week zoom, finish-to-start arrows, red overlaps, every row in words for screen readers.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Gantt journeys run once, on desktop (the phone layout is checked inside)");

const NAME = `E2E Gantt ${Date.now()}`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(NAME);
});

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("the Gantt opens from the project and shows every subproject and task", async ({ page }) => {
  ids.project = await createE2eProject(NAME);
  // Structure 3–11 Mar 2031; Shade Sail from 6 Mar, its task 2 waits for Structure task 2 (overlap);
  // DJ Booth starts after Structure.
  Object.assign(ids, await addE2eSubprojects(ids.project, [
    { name: "Structure", startDate: "2031-03-03" },
    { name: "Shade Sail", startDate: "2031-03-06" },
    { name: "DJ Booth", startDate: "2031-03-12" },
  ]));
  await addE2eTasks(ids.project, "Structure", [3, 4, 2]);
  await addE2eTasks(ids.project, "Shade Sail", [3, 3]);
  await addE2eTasks(ids.project, "DJ Booth", [2]);
  await linkE2eSubprojects(ids.project, ids.Structure, ids["DJ Booth"]);
  await linkE2eTasks(ids.project, "Structure task 2", "Shade Sail task 2");

  await page.goto(orgPath(`/projects/${ids.project}`));
  await page.getByRole("link", { name: "Gantt" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${NAME}: Gantt` })).toBeVisible();

  const chart = page.getByRole("list", { name: `${NAME} Gantt` });
  await expect(chart.getByRole("listitem")).toHaveCount(9); // 3 subprojects + 6 tasks
  const item = (name: string) => chart.getByRole("listitem").filter({ hasText: new RegExp(`^${name}`) });
  await expect(item("Structure task 2")).toContainText("Task, planned 6 Mar – 9 Mar.");
  await expect(item("Shade Sail task 2")).toContainText("Waits for Structure task 2 (Structure).");
  await expect(item("Shade Sail task 2")).toContainText("Overlap: Shade Sail task 2 (Shade Sail) starts 9 Mar");
  await expect(chart.getByRole("link", { name: "Structure", exact: true })).toHaveAttribute("href", new RegExp(`${ids.Structure}$`));
  await expectNoAxeViolations(page);
});

test("zooms to weeks, and stays readable in dark mode and at phone width", async ({ page }) => {
  await page.goto(orgPath(`/projects/${ids.project}/gantt`));
  await page.getByRole("navigation", { name: "Zoom" }).getByRole("link", { name: "Weeks" }).click();
  await expect(page).toHaveURL(/\?zoom=week$/);
  await expect(page.getByRole("link", { name: "Weeks" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("list", { name: `${NAME} Gantt` }).getByRole("listitem")).toHaveCount(9);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("list", { name: `${NAME} Gantt` })).toBeVisible();
  // The chart scrolls inside its own region; the page itself doesn't scroll sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectNoAxeViolations(page);
});

test("an unknown project's Gantt is not found", async ({ page }) => {
  // Streamed pages show the not-found page (like the project page itself).
  await page.goto(orgPath("/projects/00000000-0000-4000-8000-000000000000/gantt"));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});
