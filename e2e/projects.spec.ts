import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_MEMBER, orgPath, resetE2eProjects } from "./support/users";

// These tests change the E2E organization's projects: one at a time, on desktop only.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "project editing runs once, on desktop");
test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await resetE2eProjects();
});

const NAME = `E2E Festival ${Date.now()}`;
const RENAMED = `${NAME} (renamed)`;

function card(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test("an admin creates a project, and it is still there after a reload", async ({ page }) => {
  await page.goto(orgPath("/projects"));
  await page.getByRole("button", { name: "New project" }).first().click();
  const dialog = page.getByRole("dialog");

  // The form explains what's wrong instead of failing silently.
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog.getByText("Enter a project name.")).toBeVisible();

  // The open dialog is accessible too (scanned after its fade-in, so colours aren't half-blended).
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await dialog.getByLabel("Name").fill(NAME);
  await dialog.getByLabel("Description (optional)").fill("The main stage of the festival");
  await dialog.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Active" }).click();
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();

  await expect(card(page, NAME)).toContainText("Active");
  await expect(card(page, NAME)).toContainText("No subprojects yet");
  await page.reload();
  await expect(card(page, NAME)).toContainText("The main stage of the festival");
});

test("an admin edits a project", async ({ page }) => {
  await page.goto(orgPath("/projects"));
  await card(page, NAME).getByRole("button", { name: `Edit ${NAME}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(RENAMED);
  await dialog.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Finished" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(card(page, RENAMED)).toContainText("Finished");
  await expect(card(page, NAME)).toHaveCount(0);
});

test("a member sees projects but cannot change them", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(orgPath("/projects"));
  await expect(card(page, RENAMED)).toBeVisible();
  await expect(page.getByRole("button", { name: "New project" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Archive / })).toHaveCount(0);
  await context.close();
});

test("an admin archives a project and restores it", async ({ page }) => {
  await page.goto(orgPath("/projects"));
  await card(page, RENAMED).getByRole("button", { name: `Archive ${RENAMED}` }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("button", { name: "Archive" }).click();
  await expect(confirm).toBeHidden();
  await expect(card(page, RENAMED)).toHaveCount(0);

  await page.getByRole("link", { name: /^Archived/ }).click();
  await expect(page).toHaveURL(/view=archived/);
  await card(page, RENAMED).getByRole("button", { name: `Restore ${RENAMED}` }).click();
  await expect(card(page, RENAMED)).toHaveCount(0);

  await page.getByRole("link", { name: /^Current/ }).click();
  await expect(card(page, RENAMED)).toBeVisible();
});
