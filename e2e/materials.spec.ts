import { expect, test, type Page } from "@playwright/test";
import { E2E_MEMBER, addE2eSubprojects, createE2eProject, deleteE2eProjects, orgPath } from "./support/users";

// Materials of two projects, built step by step: serial, desktop only.
// Multi-step journeys: allow more than the default 30 s while other workers are busy.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "materials editing runs once, on desktop");

const STAGE = `E2E Materials Stage ${Date.now()}`;
const GARDEN = `E2E Materials Garden ${Date.now()}`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await Promise.all([deleteE2eProjects(STAGE), deleteE2eProjects(GARDEN)]);
});

async function openMaterialsTab(page: Page, projectId: string, subprojectId: string) {
  await page.goto(orgPath(`/projects/${projectId}/${subprojectId}`));
  await page.getByRole("tab", { name: /Materials/ }).click();
}

async function addMaterial(page: Page, description: string) {
  await page.getByLabel("New material").fill(description);
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: description })).toBeVisible();
}

test("materials are listed per subproject and follow their request status", async ({ page }) => {
  ids.stage = await createE2eProject(STAGE);
  ids.garden = await createE2eProject(GARDEN);
  Object.assign(ids, await addE2eSubprojects(ids.stage, [
    { name: "Structure", startDate: "2027-01-04" },
    { name: "DJ Booth", startDate: "2027-01-14" },
  ]));
  ids.dome = (await addE2eSubprojects(ids.garden, [{ name: "Bamboo Dome", startDate: "2027-01-08" }]))["Bamboo Dome"];

  await openMaterialsTab(page, ids.stage, ids["Structure"]);
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Describe the material." })).toBeVisible();

  await addMaterial(page, "Steel cable, 8 mm");
  await addMaterial(page, "Bamboo poles, 6 m");
  await addMaterial(page, "Screws, 3 boxes");
  await expect(page.getByLabel("New material")).toHaveValue(""); // the field clears after adding

  await page.getByRole("combobox", { name: "Status of Steel cable, 8 mm" }).click();
  await page.getByRole("option", { name: "On site" }).click();
  await expect(page.getByRole("combobox", { name: "Status of Steel cable, 8 mm" })).toContainText("On site");

  await page.getByRole("button", { name: "Remove Screws, 3 boxes" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Screws, 3 boxes" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Materials (2)" })).toBeVisible();

  await openMaterialsTab(page, ids.stage, ids["DJ Booth"]);
  await addMaterial(page, "Plywood sheets, 18 mm");
  await openMaterialsTab(page, ids.garden, ids.dome);
  await addMaterial(page, "Rope, 10 mm");
});

test("the Materials page lists every subproject's materials, with filters", async ({ page }) => {
  await page.goto(orgPath("/materials"));
  await expect(page.getByRole("heading", { level: 1, name: "Materials" })).toBeVisible();

  const table = page.getByRole("table");
  const row = (text: string) => table.getByRole("row").filter({ hasText: text });
  await expect(row("Steel cable, 8 mm")).toContainText(STAGE);
  await expect(row("Steel cable, 8 mm")).toContainText("On site");
  await expect(row("Rope, 10 mm")).toContainText("Bamboo Dome");
  await expect(row("Screws, 3 boxes")).toHaveCount(0); // removed materials stay out

  await page.getByRole("combobox", { name: "Project", exact: true }).click();
  await page.getByRole("option", { name: STAGE }).click();
  await expect(page.getByText("Showing 3 of")).toBeVisible();
  await page.getByRole("combobox", { name: "Subproject", exact: true }).click();
  await page.getByRole("option", { name: "Structure", exact: true }).click();
  await expect(page.getByText("Showing 2 of")).toBeVisible();
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "On site" }).click();
  await expect(page.getByText("Showing 1 of")).toBeVisible();

  // The subproject links straight to its Materials tab.
  await row("Steel cable, 8 mm").getByRole("link", { name: "Structure" }).click();
  await expect(page).toHaveURL(/\?tab=materials$/);
  await expect(page.getByRole("tab", { name: /Materials/ })).toHaveAttribute("aria-selected", "true");
});

test("a member sees materials but cannot change them", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(orgPath(`/projects/${ids.stage}/${ids["Structure"]}?tab=materials`));
  await expect(page.getByRole("listitem").filter({ hasText: "Steel cable, 8 mm" })).toContainText("On site");
  await expect(page.getByLabel("New material")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Status of / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await context.close();
});
