import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  E2E_EXTERNAL,
  E2E_MEMBER,
  addE2eSubprojects,
  addE2eTasks,
  createE2eProject,
  deleteE2eProjects,
  linkE2eSubprojects,
  orgPath,
} from "./support/users";

// P3-19: what members and external collaborators see (D-025). The database already refuses
// their writes (supabase/tests/projects_rls, cronograma_rls); this checks the UI matches.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "permission journeys run once, on desktop");

const PROJECT = `E2E Permissions ${Date.now()}`;
let projectId = "";
const ids: Record<string, string> = {};

test.beforeAll(async ({ isMobile }) => {
  if (isMobile) return;
  projectId = await createE2eProject(PROJECT);
  Object.assign(ids, await addE2eSubprojects(projectId, [
    { name: "Structure", startDate: "2027-01-04" },
    { name: "Shade Sail", startDate: "2027-01-14" },
  ]));
  await linkE2eSubprojects(projectId, ids["Structure"], ids["Shade Sail"]);
  await addE2eTasks(projectId, "Structure", [3, 4]);
});

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});

async function signInAs(browser: Browser, user: { email: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

/** Any control that would change something. */
const EDIT_CONTROL = /^(New|Add|Edit|Archive|Restore|Remove|Lock|Update|Make owner|Start daily check-in)/;

test("a member sees the whole project but no control that changes it", async ({ browser }) => {
  const page = await signInAs(browser, E2E_MEMBER);
  const main = page.getByRole("main");

  await page.goto(orgPath("/projects"));
  await expect(main.getByRole("link", { name: PROJECT })).toBeVisible();
  await expect(main.getByRole("button", { name: EDIT_CONTROL })).toHaveCount(0);

  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(page.getByRole("heading", { level: 1, name: PROJECT })).toBeVisible();
  const cards = page.getByRole("list", { name: "Subprojects" });
  await expect(cards.getByRole("heading", { name: "Structure", exact: true })).toBeVisible();
  await expect(cards.getByRole("heading", { name: "Shade Sail", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Links between subprojects" })).toContainText("Shade Sail starts after Structure finishes");
  await expect(main.getByRole("button", { name: EDIT_CONTROL })).toHaveCount(0);
  await expect(main.getByRole("link", { name: EDIT_CONTROL })).toHaveCount(0);
  await expect(main.getByRole("combobox")).toHaveCount(0);

  // Even with the check-in link, a member just reads the subproject.
  await page.goto(orgPath(`/projects/${projectId}/${ids["Structure"]}?checkin=1`));
  await expect(page.getByRole("heading", { level: 1, name: "Structure" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Structure task 2" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Daily check-in" })).toHaveCount(0);
  for (const tab of ["Cronograma", "Materials", "Crew", "History"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    await expect(main.getByRole("button", { name: EDIT_CONTROL })).toHaveCount(0);
    await expect(main.getByRole("combobox")).toHaveCount(0);
    await expect(main.getByRole("textbox")).toHaveCount(0);
  }

  await page.goto(orgPath("/materials"));
  await expect(page.getByRole("heading", { level: 1, name: "Materials" })).toBeVisible();
  await page.context().close();
});

test("an external collaborator sees no projects, and direct links lead nowhere", async ({ browser }) => {
  const page = await signInAs(browser, E2E_EXTERNAL);

  await page.goto(orgPath("/projects"));
  await expect(page.getByText("No projects to show")).toBeVisible();
  await expect(page.getByText(PROJECT)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New project" })).toHaveCount(0);

  await page.goto(orgPath("/materials"));
  await expect(page.getByText("No materials to show")).toBeVisible();

  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.goto(orgPath(`/projects/${projectId}/${ids["Structure"]}`));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.context().close();
});
