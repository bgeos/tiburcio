import { expect, test, type Page } from "@playwright/test";
import { addE2eSubprojects, addE2eTasks, createE2eProject, deleteE2eProjects, orgPath } from "./support/users";

// D-029: the project's status follows the work. Planning → Active when a task starts,
// → Finished when every task is done, back to Active when one re-opens. Logged in the history.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "status journeys run once, on desktop");

const NAME = `E2E Status ${Date.now()}`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(NAME);
});

async function setStatus(page: Page, task: string, status: string) {
  await page.getByRole("combobox", { name: `Status of ${task}` }).click();
  await page.getByRole("option", { name: status }).click();
  await expect(page.getByRole("combobox", { name: `Status of ${task}` })).toContainText(status);
}

async function expectProjectStatus(page: Page, status: string, change: string) {
  await page.goto(orgPath(`/projects/${ids.project}`));
  await expect(page.locator('[data-status]').first()).toHaveText(status);
  await expect(page.getByText(change).first()).toBeVisible();
}

test("a planning project becomes active when a task starts", async ({ page }) => {
  ids.project = await createE2eProject(NAME, "planning");
  Object.assign(ids, await addE2eSubprojects(ids.project, [{ name: "Structure", startDate: "2027-01-04" }]));
  await addE2eTasks(ids.project, "Structure", [2, 3]);

  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await setStatus(page, "Structure task 1", "In progress");
  await expectProjectStatus(page, "Active", "Project status: Planning → Active");
});

test("it finishes when every task is done, and re-opens with a task", async ({ page }) => {
  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await setStatus(page, "Structure task 1", "Done");
  await setStatus(page, "Structure task 2", "Done");
  await expectProjectStatus(page, "Finished", "Project status: Active → Finished");

  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await setStatus(page, "Structure task 2", "In progress");
  await expectProjectStatus(page, "Active", "Project status: Finished → Active");
});
