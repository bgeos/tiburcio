import { expect, test, type Page } from "@playwright/test";
import { E2E_MEMBER, addE2eSubprojects, createE2eProject, deleteE2eProjects, orgPath } from "./support/users";

// One subproject's crew, built step by step: serial, desktop only.
// Multi-step journeys: allow more than the default 30 s while other workers are busy.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "crew editing runs once, on desktop");

const PROJECT = `E2E Crew ${Date.now()}`;
let projectId = "";
let structureId = "";

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});

const member = (page: Page, name: string) => page.getByRole("list", { name: "Structure crew" }).getByRole("listitem").filter({ hasText: name });

async function openCrewTab(page: Page) {
  await page.goto(orgPath(`/projects/${projectId}/${structureId}?tab=crew`));
  await expect(page.getByRole("tab", { name: /Crew/ })).toHaveAttribute("aria-selected", "true");
}

async function addCrew(page: Page, name: string, role: string) {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Role", { exact: true }).fill(role);
  await page.getByRole("button", { name: "Add crew member" }).click();
  await expect(member(page, name)).toContainText(role);
}

test("crew is typed per subproject and one of them becomes the owner", async ({ page }) => {
  projectId = await createE2eProject(PROJECT);
  structureId = (await addE2eSubprojects(projectId, [{ name: "Structure", startDate: "2027-01-04" }]))["Structure"];
  await openCrewTab(page);

  await page.getByRole("button", { name: "Add crew member" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a name." })).toBeVisible();

  // Fictional people.
  await addCrew(page, "Tomás Ferraz", "Lead");
  await addCrew(page, "Bia Santos", "Carpenter");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");

  await member(page, "Tomás Ferraz").getByRole("button", { name: "Make owner Tomás Ferraz" }).click();
  await expect(member(page, "Tomás Ferraz")).toContainText("Owner");
  await expect(page.getByText("Owner: Tomás Ferraz")).toBeVisible();

  // The owner shows on the project page too.
  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(page.getByRole("list", { name: "Subprojects" })).toContainText("Owner: Tomás Ferraz");
});

test("the owner can change, and removing the owner leaves the subproject without one", async ({ page }) => {
  await openCrewTab(page);
  await member(page, "Bia Santos").getByRole("button", { name: "Make owner Bia Santos" }).click();
  await expect(member(page, "Bia Santos")).toContainText("Owner");
  await expect(member(page, "Tomás Ferraz").getByRole("button", { name: "Make owner Tomás Ferraz" })).toBeVisible();

  await member(page, "Bia Santos").getByRole("button", { name: "Remove Bia Santos" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("will have no owner");
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect(member(page, "Bia Santos")).toHaveCount(0);
  await expect(page.getByText("Owner: —")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Crew (1)" })).toBeVisible();
});

test("a member sees the crew but cannot change it", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await openCrewTab(page);
  await expect(member(page, "Tomás Ferraz")).toContainText("Lead");
  await expect(page.getByRole("button", { name: "Add crew member" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Make owner/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await context.close();
});
