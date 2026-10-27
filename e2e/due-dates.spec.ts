import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addE2eSubprojects, addE2eTasks, createE2eProject, deleteE2eMyTasks, deleteE2eProjects, orgPath } from "./support/users";

// D-034: materials have a "needed by" day and my tasks a date; the calendar shows them next to
// project tasks and milestones, each kind with its own mark, and each kind can be hidden.
// Dates in May 2031 so no other test's plan shows up.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "due date journeys run once, on desktop");

const STAMP = Date.now();
const STAGE = `E2E Due ${STAMP} Stage`;
const PLYWOOD = `E2E Due ${STAMP} plywood`;
const CALL = `E2E Due ${STAMP} call the crane`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await Promise.all([deleteE2eProjects(STAGE), deleteE2eMyTasks(`E2E Due ${STAMP}`)]);
});

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

/** The material's line in the subproject's list (toasts mention the material too). */
const materialRow = (page: Page) => page.getByRole("list", { name: "Structure materials" }).getByRole("listitem").filter({ hasText: PLYWOOD });

const day = (page: Page, n: number) =>
  page.getByRole("list", { name: "May 2031" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: new RegExp(`day ${n} May`) }) });

test("a material gets a needed-by day, and shows late once it has passed", async ({ page }) => {
  ids.stage = await createE2eProject(STAGE);
  Object.assign(ids, await addE2eSubprojects(ids.stage, [{ name: "Structure", startDate: "2031-05-05" }]));
  await addE2eTasks(ids.stage, "Structure", [2]);

  await page.goto(orgPath(`/projects/${ids.stage}/${ids.Structure}?tab=materials`));
  await page.getByLabel("New material").fill(PLYWOOD);
  await page.getByLabel("Needed by (optional)").fill("2031-05-06");
  await page.getByRole("button", { name: "Add material" }).click();
  const row = materialRow(page);
  await expect(row).toContainText("Needed by 6 May");

  // Changed in the list.
  await row.getByLabel(`${PLYWOOD} needed by`).fill("2031-05-07");
  await row.getByLabel(`${PLYWOOD} needed by`).press("Enter");
  await expect(row).toContainText("Needed by 7 May");
  await page.reload();
  // A value typed before the page is interactive would be lost: wait for it to settle.
  await page.waitForLoadState("networkidle");
  await expect(materialRow(page)).toContainText("Needed by 7 May");

  // A day that has passed: late, in words, until it's on site.
  await row.getByLabel(`${PLYWOOD} needed by`).fill("2020-01-02");
  await row.getByLabel(`${PLYWOOD} needed by`).press("Enter");
  await expect(row).toContainText("Needed by 2 Jan · late");
  await page.goto(orgPath("/materials"));
  await expect(page.getByRole("row").filter({ hasText: PLYWOOD })).toContainText("2 Jan · late");
  await expectNoAxeViolations(page);

  await page.goto(orgPath(`/projects/${ids.stage}/${ids.Structure}?tab=materials`));
  await page.waitForLoadState("networkidle");
  await materialRow(page).getByLabel(`${PLYWOOD} needed by`).fill("2031-05-07");
  await materialRow(page).getByLabel(`${PLYWOOD} needed by`).press("Enter");
  await expect(materialRow(page)).toContainText("Needed by 7 May");
  await expectNoAxeViolations(page);
});

test("a task of my own gets a date", async ({ page }) => {
  await page.goto(orgPath("/tasks"));
  await page.getByRole("button", { name: "New task" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(CALL);
  await dialog.getByLabel("Date (optional)").fill("2031-05-07");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: CALL }) })).toContainText("Due 7 May");
});

test("the calendar shows tasks, materials and my tasks, each told apart, and hides a kind", async ({ page }) => {
  await page.goto(orgPath(`/calendar?view=month&date=2031-05-01&project=${ids.stage}`));
  await expect(day(page, 5)).toContainText("Structure task 1");
  await expect(day(page, 5).getByRole("link", { name: /^Structure task 1\s*, task,/ })).toBeVisible();
  await expect(day(page, 7).getByRole("link", { name: new RegExp(`^${PLYWOOD}\\s*, material needed by this day`) })).toBeVisible();
  // My tasks belong to no project: the project filter leaves them shown.
  await expect(day(page, 7).getByRole("link", { name: new RegExp(`^${CALL}\\s*, my to do`) })).toHaveAttribute("href", /\/tasks$/);
  await expectNoAxeViolations(page);

  await page.getByRole("navigation", { name: "Show on the calendar" }).getByRole("link", { name: "Hide Materials" }).click();
  await expect(page).toHaveURL(/show=tasks%2Cmine%2Cmilestones/);
  await expect(day(page, 7)).not.toContainText(PLYWOOD);
  await expect(day(page, 7)).toContainText(CALL);
  await expect(day(page, 5)).toContainText("Structure task 1");

  // Hidden stays hidden while moving around; showing it again brings it back.
  await page.getByRole("link", { name: "Next month" }).click();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(day(page, 7)).not.toContainText(PLYWOOD);
  await page.getByRole("navigation", { name: "Show on the calendar" }).getByRole("link", { name: "Show Materials" }).click();
  await expect(page).not.toHaveURL(/show=/);
  await expect(day(page, 7)).toContainText(PLYWOOD);

  // The week view says what each line is.
  await page.getByRole("navigation", { name: "Calendar view" }).getByRole("link", { name: "Week" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "28 Apr – 4 May 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Next week" }).click();
  const days = page.getByRole("list", { name: "Days" });
  const wednesday = days.getByRole("listitem").filter({ hasText: /^Wednesday 7 May/ });
  await expect(wednesday).toContainText(`${PLYWOOD}Material needed · ${STAGE} › Structure`);
  await expect(wednesday).toContainText(`${CALL}My task · To do`);
  await expectNoAxeViolations(page);
});
