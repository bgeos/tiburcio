import { expect, test } from "@playwright/test";
import { orgPath } from "./support/users";

test.beforeEach(async ({ page }) => {
  await page.goto(orgPath("/projects/prototype"));
  await expect(page.getByRole("heading", { level: 1, name: "Main Stage" })).toBeVisible();
});

test("is labelled as demo data", async ({ page }) => {
  await expect(page.getByRole("note").filter({ hasText: "fictional demo data" })).toBeVisible();
});

test("progress donuts follow task progress (every task counts equally)", async ({ page }) => {
  // 8 tasks; only "Prepare bamboo" has progress (60%) → 7.5% rounds to 8%.
  await expect(page.getByRole("img", { name: "Main Stage progress: 8% complete" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Structure progress: 20% complete" })).toBeVisible();
  await expect(page.getByRole("img", { name: "DJ Booth progress: 0% complete" })).toBeVisible();

  await page.getByRole("button", { name: "Structure", exact: true }).first().click();
  await page.getByRole("combobox", { name: "Status of Prepare bamboo" }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(page.getByRole("img", { name: "Structure progress: 33% complete" })).toBeVisible();
});

test("a delay previews its knock-on effects, warns about overlaps and is logged", async ({ page }) => {
  await page.getByRole("button", { name: "Structure", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Structure" })).toBeVisible();

  await page.getByRole("button", { name: "Update Prepare bamboo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Duration (calendar days)").fill("4");

  await expect(dialog.getByText("Assemble poles: 7 Jan – 10 Jan → 8 Jan – 11 Jan")).toBeVisible();
  await expect(dialog.getByText("Structure: 4 Jan – 13 Jan → 4 Jan – 14 Jan")).toBeVisible();
  await expect(dialog.getByText(/Shade Sail starts 14 Jan, but Structure finishes 14 Jan/)).toBeVisible();
  await expect(dialog.getByText(/DJ Booth starts 14 Jan/)).toBeVisible();

  await dialog.getByLabel("Reason (optional)").fill("Bamboo delivery came late");
  await dialog.getByRole("button", { name: "Apply change" }).click();
  await expect(dialog).toBeHidden();

  // Other subprojects are not moved: the overlap is reported instead.
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText("1 day overlap");
  await expect(page.getByRole("cell", { name: "1 day later" }).first()).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Prepare bamboo: duration 3 → 4 days")).toBeVisible();
  await expect(page.getByText("Bamboo delivery came late")).toBeVisible();
});

test("material status can be updated", async ({ page }) => {
  await page.getByRole("button", { name: "Structure", exact: true }).first().click();
  await page.getByRole("tab", { name: /Materials/ }).click();
  await page.getByRole("combobox", { name: "Status of Steel cable, 8 mm" }).click();
  await page.getByRole("option", { name: "On site" }).click();
  await expect(page.getByRole("combobox", { name: "Status of Steel cable, 8 mm" })).toContainText("On site");
});

test("materials added in a subproject appear in All materials, with filters", async ({ page }) => {
  await page.getByRole("button", { name: "Structure", exact: true }).first().click();
  await page.getByRole("tab", { name: /Materials/ }).click();
  await page.getByLabel("New material").fill("Ratchet straps, 5 t");
  await page.getByRole("button", { name: "Add material" }).click();

  await page.getByRole("navigation", { name: "Prototype" }).getByRole("link", { name: "All materials" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "All materials" })).toBeVisible();
  const table = page.getByRole("table");
  const row = table.getByRole("row").filter({ hasText: "Ratchet straps, 5 t" });
  await expect(row).toContainText("Main Stage");
  await expect(row).toContainText("Structure");
  await expect(row).toContainText("To request");
  await expect(page.getByText("Showing 18 of 18 materials")).toBeVisible();

  await page.getByRole("combobox", { name: "Project", exact: true }).click();
  await page.getByRole("option", { name: "Chill-out Garden" }).click();
  await expect(row).toBeHidden();
  await expect(page.getByText("Showing 5 of 18 materials")).toBeVisible();

  await page.getByRole("combobox", { name: "Subproject", exact: true }).click();
  await page.getByRole("option", { name: "Hammock Area" }).click();
  await expect(page.getByText("Showing 2 of 18 materials")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("Showing 18 of 18 materials")).toBeVisible();
});

test("the project picker switches between demo projects", async ({ page }) => {
  await page.getByRole("combobox", { name: "Project", exact: true }).click();
  await page.getByRole("option", { name: "Chill-out Garden" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Chill-out Garden" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bamboo Dome", exact: true }).first()).toBeVisible();
});

test("daily check-in steps through every subproject", async ({ page }) => {
  await page.getByRole("button", { name: "Start daily check-in" }).click();
  for (const name of ["Structure", "Shade Sail", "DJ Booth"]) {
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name })).toBeFocused();
    if (name !== "DJ Booth") await page.getByRole("button", { name: "Next subproject" }).click();
  }
  await page.getByRole("button", { name: "Finish check-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Main Stage" })).toBeVisible();
});
