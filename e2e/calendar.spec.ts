import AxeBuilder from "@axe-core/playwright";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { addE2eSubprojects, addE2eTasks, createE2eProject, deleteE2eMilestones, deleteE2eProjects, orgPath } from "./support/users";

// P4-07: tasks on the days they run and milestones on theirs, by month or week, filterable by
// project. Dates in March 2031 so no other test's plan shows up.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "calendar journeys run once, on desktop (the phone list is checked inside)");

const STAMP = Date.now();
const STAGE = `E2E Cal ${STAMP} Stage`;
const GARDEN = `E2E Cal ${STAMP} Garden`;
const OPENS = `E2E Cal ${STAMP} opens`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await Promise.all([deleteE2eProjects(STAGE), deleteE2eProjects(GARDEN), deleteE2eMilestones(OPENS)]);
});

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

const day = (page: Page, n: number) =>
  page.getByRole("list", { name: "March 2031" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: new RegExp(`day ${n} March`) }) });

test("the month shows tasks on the days they run, and the milestones", async ({ page }) => {
  ids.stage = await createE2eProject(STAGE);
  ids.garden = await createE2eProject(GARDEN);
  // Stage › Structure: task 1 on 4–6 Mar 2031. Garden › Dome: task 1 on 5 Mar.
  Object.assign(ids, await addE2eSubprojects(ids.stage, [{ name: "Structure", startDate: "2031-03-04" }]));
  await addE2eSubprojects(ids.garden, [{ name: "Dome", startDate: "2031-03-05" }]);
  await addE2eTasks(ids.stage, "Structure", [3]);
  await addE2eTasks(ids.garden, "Dome", [1]);
  execSync("docker exec -i supabase_db_jupigenio psql -U postgres -qAt", {
    input: `insert into milestones (organization_id, name, date) select organization_id, '${OPENS}', '2031-03-08' from projects where id = '${ids.stage}';`,
  });

  await page.goto(orgPath("/calendar?view=month&date=2031-03-01"));
  await expect(page.getByRole("heading", { level: 2, name: "March 2031" })).toBeVisible();
  for (const n of [4, 5, 6]) await expect(day(page, n)).toContainText("Structure task 1");
  await expect(day(page, 7)).not.toContainText("Structure task 1");
  await expect(day(page, 5)).toContainText("Dome task 1");
  await expect(day(page, 8)).toContainText(OPENS);
  await expect(day(page, 5).getByRole("link", { name: /^Structure task 1/ })).toHaveAttribute("href", new RegExp(`${ids.Structure}$`));
  await expectNoAxeViolations(page);

  // Next month, and back.
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "April 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "March 2031" })).toBeVisible();
});

test("one project at a time, and the week view lists each day", async ({ page }) => {
  await page.goto(orgPath("/calendar?view=month&date=2031-03-01"));
  await page.getByRole("combobox", { name: "Project" }).click();
  await page.getByRole("option", { name: STAGE }).click();
  await expect(page).toHaveURL(new RegExp(`project=${ids.stage}`));
  await expect(day(page, 5)).toContainText("Structure task 1");
  await expect(day(page, 5)).not.toContainText("Dome task 1");

  await page.getByRole("navigation", { name: "Calendar view" }).getByRole("link", { name: "Week" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "24 Feb – 2 Mar 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "3 – 9 Mar 2031" })).toBeVisible();
  const days = page.getByRole("list", { name: "Days" });
  await expect(days.getByRole("listitem").filter({ hasText: /^Wednesday 5 Mar/ })).toContainText(`Structure task 1Task · ${STAGE} › Structure · day 2 of 3`);
  await expect(days).not.toContainText("Dome task 1");
  await expectNoAxeViolations(page);
});

test("on a phone the month is a list of the days with something on", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(orgPath(`/calendar?view=month&date=2031-03-01&project=${ids.stage}`));
  const days = page.getByRole("list", { name: "Days" });
  await expect(days.locator(":scope > li")).toHaveCount(4); // 4, 5, 6 Mar and the milestone on the 8th
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectNoAxeViolations(page);
});
