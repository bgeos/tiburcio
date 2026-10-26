import { expect, test, type Page } from "@playwright/test";
import { createE2eProject, deleteE2eProjects, orgPath } from "./support/users";

// D-027: each subproject has a colour (never red); its card, timeline bar and tasks use it.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "colour editing runs once, on desktop");

const PROJECT = `E2E Colours ${Date.now()}`;
let projectId = "";

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});

const card = (page: Page, name: string) =>
  page.getByRole("list", { name: "Subprojects" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
/** Click the visible option (the radio itself is visually hidden). */
const choose = (page: Page, name: string) =>
  page.getByRole("dialog").locator("label").filter({ has: page.getByRole("radio", { name, exact: true }) }).click();

async function addSubproject(page: Page, name: string, expectedColour: string) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add subproject" }).click();
  const dialog = page.getByRole("dialog");
  // The least-used colour is suggested.
  await expect(dialog.getByRole("radio", { name: expectedColour, exact: true })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Red" })).toHaveCount(0);
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Start date").fill("2027-01-04");
  await dialog.getByRole("button", { name: "Add subproject" }).click();
  await expect(dialog).toBeHidden();
}

test("new subprojects get the next colour, and a colour can be changed", async ({ page }) => {
  projectId = await createE2eProject(PROJECT);
  await page.goto(orgPath(`/projects/${projectId}`));
  await addSubproject(page, "Structure", "Blue");
  await addSubproject(page, "Shade Sail", "Aqua");
  await expect(card(page, "Structure").locator(".bg-sub-blue")).toHaveCount(1);
  await expect(card(page, "Shade Sail").locator(".bg-sub-aqua")).toHaveCount(1);

  await card(page, "Shade Sail").getByRole("button", { name: "Edit Shade Sail" }).click();
  await expect(page.getByRole("dialog").getByRole("radio", { name: "Aqua", exact: true })).toBeChecked();
  await choose(page, "Violet");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(card(page, "Shade Sail").locator(".bg-sub-violet")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Recent changes" })).toContainText("Colour: Aqua → Violet");
  await page.reload();
  await expect(card(page, "Shade Sail").locator(".bg-sub-violet")).toHaveCount(1);
});

test("the subproject page uses its colour for the title and task bars", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await card(page, "Shade Sail").getByRole("link", { name: "Shade Sail", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Shade Sail" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).locator(".bg-sub-violet")).toHaveCount(1);

  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("dialog").getByLabel("Task name").fill("Sew sail");
  await page.getByRole("dialog").getByLabel("Duration (calendar days)").fill("3");
  await page.getByRole("dialog").getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".bg-sub-violet").filter({ visible: true })).not.toHaveCount(0);
});
