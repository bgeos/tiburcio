import { expect, test, type Page } from "@playwright/test";
import {
  E2E_MEMBER,
  E2E_USER,
  addE2eSubprojects,
  addE2eTasks,
  createE2eProject,
  deleteE2eProjects,
  linkE2eSubprojects,
  orgPath,
} from "./support/users";

// Lock plan, history and the daily check-in on one project: serial, desktop only.
// Multi-step journeys: allow more than the default 30 s while other workers are busy.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "plan and history journeys run once, on desktop");

const PROJECT = `E2E Plan ${Date.now()}`;
let projectId = "";
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});

const card = (page: Page, name: string) =>
  page.getByRole("list", { name: "Subprojects" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });

test("locking the plan makes 'vs. original' appear", async ({ page }) => {
  projectId = await createE2eProject(PROJECT);
  Object.assign(ids, await addE2eSubprojects(projectId, [
    { name: "Structure", startDate: "2027-01-04" },
    { name: "Shade Sail", startDate: "2027-01-14" },
  ]));
  await linkE2eSubprojects(projectId, ids["Structure"], ids["Shade Sail"]);
  await addE2eTasks(projectId, "Structure", [3, 4, 3]);
  await addE2eTasks(projectId, "Shade Sail", [2, 2]);

  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(page.getByText("Plan not locked yet")).toBeVisible();
  await expect(card(page, "Structure")).not.toContainText("vs. original");

  await page.getByRole("button", { name: "Lock plan" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Lock plan" }).click();
  await expect(page.getByText(/Plan locked on \d{1,2} \w{3}/)).toBeVisible();
  await expect(card(page, "Structure")).toContainText("On plan");
  await expect(page.getByText("All subprojects on the original plan.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lock plan again" })).toBeVisible();
});

test("a delay is measured against the original plan and recorded with its reason", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}/${ids["Structure"]}`));
  await page.getByRole("button", { name: "Update Structure task 1" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Duration (calendar days)").fill("4");
  await dialog.getByLabel("Reason (optional)").fill("Bamboo delivery came late");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  const row = (task: string) => page.getByRole("row").filter({ has: page.getByText(task, { exact: true }) });
  await expect(row("Structure task 1")).toContainText("1 day later");
  await expect(row("Structure task 3")).toContainText("1 day later");
  await expect(page.getByText(/ends 1 day later than the original plan/)).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  const history = page.getByRole("list", { name: "Structure history" });
  const entry = history.getByRole("listitem").filter({ hasText: "Structure task 1: duration 3 → 4 days" }).first();
  await expect(entry).toContainText("Bamboo delivery came late");
  await expect(entry).toContainText(E2E_USER.fullName);
  await expect(entry).toContainText("Structure task 3: 11 Jan – 13 Jan → 12 Jan – 14 Jan");
  await expect(entry).toContainText("Overlap: Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");

  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(card(page, "Structure")).toContainText("Ends 1 day later");
  await expect(page.getByText("1 of 2 subprojects end later than the original plan.")).toBeVisible();
  const recent = page.getByRole("list", { name: "Recent changes" });
  await expect(recent).toContainText("Plan locked");
  await expect(recent.getByRole("listitem").filter({ hasText: "duration 3 → 4 days" }).first()).toContainText("· Structure");
});

test("the daily check-in steps through every subproject", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Start daily check-in" }).click();

  const bar = page.getByRole("region", { name: "Daily check-in" });
  await expect(page.getByRole("heading", { level: 1, name: "Structure" })).toBeVisible();
  await expect(bar).toContainText("1 of 2");
  await bar.getByRole("link", { name: "Next subproject" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Shade Sail" })).toBeVisible();
  await expect(bar).toContainText("2 of 2");
  await bar.getByRole("link", { name: "Previous" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Structure" })).toBeVisible();
  await bar.getByRole("link", { name: "Next subproject" }).click();
  await bar.getByRole("link", { name: "Finish check-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: PROJECT })).toBeVisible();
});

test("a member reads the history but cannot lock the plan", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(page.getByRole("list", { name: "Recent changes" })).toContainText("Plan locked");
  await expect(page.getByRole("button", { name: /Lock plan/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Start daily check-in" })).toHaveCount(0);
  await context.close();
});
