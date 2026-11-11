import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  E2E_MEMBER,
  addE2eSubprojects,
  addE2eTasks,
  createE2eProject,
  deleteE2eMilestones,
  deleteE2eProjects,
  orgPath,
} from "./support/users";

// P4-05 (D-030): milestones are key dates of the organization, shown in every project.
// A task linked to one must be done before its day; running into it shows in red. Dates are in
// 2031 so no other test's plan reaches them.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "milestone journeys run once, on desktop");

const STAMP = Date.now();
const NAME = `E2E Milestones ${STAMP}`;
const OPENS = `E2E MS ${STAMP} opens`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await Promise.all([deleteE2eProjects(NAME), deleteE2eMilestones(`E2E MS ${STAMP}`)]);
});

const row = (page: Page, task: string) => page.getByRole("row").filter({ has: page.getByText(task, { exact: true }) });
const LATE = `Structure task 2 (Structure) finishes 7 Mar, but must be done before ${OPENS} (7 Mar): 1 day late.`;

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("an editor adds a milestone on the Projects page", async ({ page }) => {
  ids.project = await createE2eProject(NAME);
  // Structure: task 1 on 1–3 Mar 2031, task 2 on 4–7 Mar.
  Object.assign(ids, await addE2eSubprojects(ids.project, [{ name: "Structure", startDate: "2031-03-01" }]));
  await addE2eTasks(ids.project, "Structure", [3, 4]);

  await page.goto(orgPath("/projects"));
  await page.getByRole("button", { name: "New milestone" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(OPENS);
  await dialog.getByLabel("Date").fill("2031-03-07");
  await dialog.getByRole("button", { name: "Add milestone" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Milestones" })).toContainText(`7 Mar${OPENS}`);
  await expectNoAxeViolations(page);
});

test("a task linked to it previews and shows the red days late", async ({ page }) => {
  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await row(page, "Structure task 2").getByRole("button", { name: "Links for Structure task 2" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Add: Structure task 2 must be done before…" }).click();
  await page.getByRole("option", { name: new RegExp(`^${OPENS}`) }).click();
  await expect(dialog.getByRole("region", { name: "Milestone preview" })).toContainText(LATE);
  await dialog.getByRole("button", { name: "Add milestone" }).click();
  await expect(dialog.getByRole("list", { name: "Must be done before" })).toContainText(OPENS);
  await page.keyboard.press("Escape");

  await expect(row(page, "Structure task 2")).toContainText(`Must be done before ${OPENS} (7 Mar) (1 day late)`);
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText(LATE);
  await expectNoAxeViolations(page);

  await page.goto(orgPath(`/projects/${ids.project}`));
  await expect(page.getByText("1 task is late for a milestone")).toBeVisible();
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText(LATE);
  await expect(page.getByRole("list", { name: "Milestones" })).toContainText(OPENS);
});

test("shortening the task previews the fix, and the warning goes", async ({ page }) => {
  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await row(page, "Structure task 2").getByRole("button", { name: "Update Structure task 2" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Duration (calendar days)").fill("3");
  await expect(dialog.getByRole("region", { name: "Preview" })).toContainText(`Structure task 2 (Structure) is done before ${OPENS} again.`);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Warnings" })).toHaveCount(0);
  await expect(row(page, "Structure task 2")).toContainText(`Must be done before ${OPENS} (7 Mar)`);
  await expect(row(page, "Structure task 2")).not.toContainText("late");
});

async function signInAsMember(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

test("members see milestones everywhere but cannot change them", async ({ browser }) => {
  const page = await signInAsMember(browser);
  await expect(page.getByRole("list", { name: "Upcoming milestones" })).toContainText(OPENS);
  await page.goto(orgPath("/projects"));
  await expect(page.getByRole("list", { name: "Milestones" })).toContainText(OPENS);
  await expect(page.getByRole("button", { name: "New milestone" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Delete ${OPENS}` })).toHaveCount(0);
  await page.context().close();
});

test("deleting a milestone removes it from every project", async ({ page }) => {
  await page.goto(orgPath("/projects"));
  await page.getByRole("button", { name: `Delete ${OPENS}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(OPENS)).toHaveCount(0);
  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await expect(row(page, "Structure task 2")).not.toContainText("Must be done before");
});
