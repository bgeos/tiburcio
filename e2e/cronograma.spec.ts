import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_MEMBER,
  addE2eSubprojects,
  createE2eProject,
  deleteE2eProjects,
  linkE2eSubprojects,
  orgPath,
} from "./support/users";

// One subproject's cronograma, built step by step: serial, desktop only.
// Multi-step journeys: allow more than the default 30 s while other workers are busy.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "cronograma editing runs once, on desktop");

const PROJECT = `E2E Cronograma ${Date.now()}`;
let projectId = "";

// Only this file's project: other test files run at the same time.
test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});

function row(page: Page, task: string) {
  return page.getByRole("row").filter({ has: page.getByText(task, { exact: true }) });
}

async function addTask(page: Page, name: string, days: string) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task name").fill(name);
  await dialog.getByLabel("Duration (calendar days)").fill(days);
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
}

test("tasks are added from the subproject page and run one after another", async ({ page }) => {
  projectId = await createE2eProject(PROJECT);
  const ids = await addE2eSubprojects(projectId, [
    { name: "Structure", startDate: "2027-01-04" },
    { name: "Shade Sail", startDate: "2027-01-14" },
  ]);
  await linkE2eSubprojects(projectId, ids["Structure"], ids["Shade Sail"]);

  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Structure", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Structure" })).toBeVisible();
  await expect(page.getByText("No tasks yet", { exact: true }).filter({ visible: true })).toBeVisible();

  // Validation.
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("dialog").getByLabel("Task name").fill("Nothing");
  await page.getByRole("dialog").getByLabel("Duration (calendar days)").fill("0");
  await page.getByRole("dialog").getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("dialog").getByText("Enter a whole number of days, 1 or more.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  await addTask(page, "Prepare bamboo", "3");
  await addTask(page, "Assemble poles", "4");
  await addTask(page, "Set up structure", "3");
  await expect(row(page, "Prepare bamboo")).toContainText("4 Jan – 6 Jan");
  await expect(row(page, "Assemble poles")).toContainText("7 Jan – 10 Jan");
  await expect(row(page, "Set up structure")).toContainText("11 Jan – 13 Jan");
  await expect(page.getByRole("region", { name: "Warnings" })).toHaveCount(0);
});

test("a longer task previews the knock-on effect and the red overlap, then shifts later tasks", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Structure", exact: true }).first().click();
  await row(page, "Prepare bamboo").getByRole("button", { name: "Update Prepare bamboo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Duration (calendar days)").fill("4");

  const preview = dialog.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText("Assemble poles: 7 Jan – 10 Jan → 8 Jan – 11 Jan");
  await expect(preview).toContainText("Structure: 4 Jan – 13 Jan → 4 Jan – 14 Jan");
  await expect(preview).toContainText("Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");

  await dialog.getByLabel("Reason (optional)").fill("Bamboo delivery came late");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(row(page, "Set up structure")).toContainText("12 Jan – 14 Jan");
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText("1 day overlap");
});

test("status and progress keep each other and the actual dates consistent", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Structure", exact: true }).first().click();

  await page.getByRole("combobox", { name: "Status of Prepare bamboo" }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(row(page, "Prepare bamboo")).toContainText("100%");
  await expect(row(page, "Prepare bamboo")).toContainText(/Done \d{1,2} \w{3}/);
  await expect(page.getByRole("img", { name: "Structure progress: 33% complete" })).toBeVisible();

  await row(page, "Assemble poles").getByRole("button", { name: "Update Assemble poles" }).click();
  await page.getByRole("dialog").getByLabel("Progress (%)").fill("50");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Status of Assemble poles" })).toContainText("In progress");
  await expect(row(page, "Assemble poles")).toContainText(/Started \d{1,2} \w{3}/);
  await expect(page.getByRole("img", { name: "Structure progress: 50% complete" })).toBeVisible();
});

test("removing a task previews the change and moves later tasks earlier", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Structure", exact: true }).first().click();
  await page.getByRole("button", { name: "Remove Set up structure" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: "Preview" })).toContainText("Set up structure: removed");
  await expect(dialog.getByRole("region", { name: "Preview" })).toContainText("Shade Sail no longer overlaps Structure.");
  await dialog.getByRole("button", { name: "Remove task" }).click();
  await expect(dialog).toBeHidden();

  await expect(row(page, "Set up structure")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Warnings" })).toHaveCount(0);
});

test("the cronograma is accessible, also at phone width (the table scrolls by keyboard)", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Structure", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Structure cronograma" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("a member sees the cronograma but cannot change it", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("link", { name: "Structure", exact: true }).first().click();
  await expect(row(page, "Prepare bamboo")).toContainText("Done");
  await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Status of / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Update / })).toHaveCount(0);
  await context.close();
});
