import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_MEMBER, deleteE2eMyTasks, orgPath } from "./support/users";

// D-028: My tasks are a person's own to-dos and reminders, private to them.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "my tasks journeys run once, on desktop");

const PREFIX = `E2E My ${Date.now()}`;
const CALL = `${PREFIX} call the bamboo supplier`;
const DRILL = `${PREFIX} bring the drill`;

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eMyTasks(PREFIX);
});

const item = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function addTask(page: Page, name: string, tag: "To do" | "Reminder", description = "") {
  await page.getByRole("button", { name: "New task" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  if (description) await dialog.getByLabel("Description (optional)").fill(description);
  await dialog.getByRole("combobox", { name: "Tag" }).click();
  await page.getByRole("option", { name: tag, exact: true }).click();
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
}

test("I add a reminder and a to do, and filter by tag", async ({ page }) => {
  await page.goto(orgPath("/tasks"));
  await expect(page.getByRole("heading", { level: 1, name: "My tasks" })).toBeVisible();

  // Nothing is saved without a name.
  await page.getByRole("button", { name: "New task" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("dialog").getByText("Enter a name.")).toBeVisible();
  await page.keyboard.press("Escape");

  await addTask(page, CALL, "Reminder", "Ask for 40 poles.");
  await addTask(page, DRILL, "To do");

  const open = page.getByRole("list", { name: "Open tasks" });
  await expect(item(page, CALL)).toContainText("Reminder");
  await expect(item(page, CALL)).toContainText("Ask for 40 poles.");
  await expect(open.getByRole("heading", { name: DRILL })).toBeVisible();

  await page.getByRole("link", { name: /^Reminders/ }).click();
  await expect(page).toHaveURL(/\?tag=reminder$/);
  await expect(open.getByRole("heading", { name: CALL })).toBeVisible();
  await expect(open.getByRole("heading", { name: DRILL })).toHaveCount(0);
  await page.getByRole("link", { name: /^All/ }).click();
  await expect(open.getByRole("heading", { name: DRILL })).toBeVisible();

  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("I edit a task, finish it, and delete it", async ({ page }) => {
  await page.goto(orgPath("/tasks"));
  await item(page, DRILL).getByRole("button", { name: `Edit ${DRILL}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description (optional)").fill("The big one, with the long bits.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(item(page, DRILL)).toContainText("The big one, with the long bits.");

  await item(page, DRILL).getByRole("combobox", { name: `Status of ${DRILL}` }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(page.getByRole("list", { name: "Done tasks" }).getByRole("heading", { name: DRILL })).toBeVisible();

  await item(page, DRILL).getByRole("button", { name: `Delete ${DRILL}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: DRILL })).toHaveCount(0);
  await expect(item(page, CALL)).toBeVisible();
});

test("nobody else sees my tasks, not even in the same organization", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(orgPath("/tasks"));
  await expect(page.getByRole("heading", { level: 1, name: "My tasks" })).toBeVisible();
  await expect(page.getByText(CALL)).toHaveCount(0);
  await context.close();
});
