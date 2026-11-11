import { expect, test, type Page } from "@playwright/test";
import { E2E_MEMBER, addE2eTasks, createE2eProject, deleteE2eProjects, orgPath } from "./support/users";

// One project, built up step by step: serial, desktop only.
// Multi-step journeys: allow more than the default 30 s while other workers are busy.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "project page editing runs once, on desktop");
const PROJECT = `E2E Main Stage ${Date.now()}`;

// Only this file's project: other test files run at the same time.
test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});
let projectId = "";

function subCard(page: Page, name: string) {
  return page.getByRole("list", { name: "Subprojects" }).getByRole("listitem").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
}

async function addSubproject(page: Page, name: string, start: string) {
  // While a dialog is closing, its own "Add subproject" button is still the only one
  // exposed (Radix hides the page behind it), so wait until no dialog is left.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add subproject" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Start date").fill(start);
  await dialog.getByRole("button", { name: "Add subproject" }).click();
  await expect(dialog).toBeHidden();
}

async function link(page: Page, successor: string, predecessor: string) {
  await page.getByRole("combobox", { name: "Subproject" }).click();
  await page.getByRole("option", { name: successor, exact: true }).click();
  await page.getByRole("combobox", { name: "finishes" }).click();
  await page.getByRole("option", { name: predecessor, exact: true }).click();
  await page.getByRole("button", { name: "Add link" }).click();
}

test("the project opens from the list and starts empty", async ({ page }) => {
  projectId = await createE2eProject(PROJECT);
  await page.goto(orgPath("/projects"));
  await page.getByRole("link", { name: PROJECT }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await expect(page.getByRole("heading", { level: 1, name: PROJECT })).toBeVisible();
  // The previous page stays in the DOM, hidden (instant back-navigation): look at visible text only.
  await expect(page.getByText("No subprojects yet").filter({ visible: true })).toBeVisible();
});

test("subprojects are added, and their dates come from their tasks", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));

  // Validation first.
  await page.getByRole("button", { name: "Add subproject" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Structure");
  await page.getByRole("dialog").getByRole("button", { name: "Add subproject" }).click();
  await expect(page.getByRole("dialog").getByText("Choose a date.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await addSubproject(page, "Structure", "2027-01-04");
  await addSubproject(page, "Shade Sail", "2027-01-14");
  await addSubproject(page, "DJ Booth", "2027-01-14");
  await expect(subCard(page, "Structure")).toContainText("— (no tasks yet)");

  await addE2eTasks(projectId, "Structure", [3, 4, 3]);
  await addE2eTasks(projectId, "Shade Sail", [2, 2]);
  await addE2eTasks(projectId, "DJ Booth", [3, 2, 2]);
  await page.reload();

  await expect(subCard(page, "Structure")).toContainText("4 Jan – 13 Jan");
  await expect(subCard(page, "DJ Booth")).toContainText("14 Jan – 20 Jan");
  await expect(page.getByRole("list", { name: "Subprojects timeline" })).toBeVisible();
  await expect(page.getByRole("img", { name: `${PROJECT} progress: 0% complete` })).toBeVisible();
  await expect(page.getByText("0 of 8 tasks done")).toBeVisible();
});

test("subprojects are linked, and a circle is refused", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await link(page, "Shade Sail", "Structure");
  await expect(page.getByRole("list", { name: "Links between subprojects" })).toContainText(
    "Shade Sail starts after Structure finishes",
  );
  await link(page, "DJ Booth", "Structure");
  await expect(subCard(page, "DJ Booth")).toContainText("Starts after");

  await link(page, "Structure", "Shade Sail");
  await expect(page.getByRole("alert").filter({ hasText: "circle" })).toHaveText(
    "That would make subprojects wait for each other in a circle.",
  );
  await expect(page.getByText("No overlaps between subprojects.")).toBeVisible();
});

test("moving a start date previews the clash, nothing else moves, and the overlap shows in red", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await subCard(page, "Structure").getByRole("button", { name: "Edit Structure" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Start date").fill("2027-01-05");

  const preview = dialog.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText("Structure: 4 Jan – 13 Jan → 5 Jan – 14 Jan");
  await expect(preview).toContainText("Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");
  await expect(preview).not.toContainText("Shade Sail:"); // other subprojects never move

  await dialog.getByLabel("Reason (optional)").fill("Site access one day late");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  const warnings = page.getByRole("region", { name: "Warnings" });
  await expect(warnings).toContainText("Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");
  await expect(warnings).toContainText("DJ Booth starts 14 Jan");
  await expect(page.getByText("2 overlaps between subprojects")).toBeVisible();
  await expect(subCard(page, "Shade Sail")).toContainText("Overlaps Structure by 1 day");
  await expect(subCard(page, "Shade Sail")).toContainText("14 Jan – 17 Jan"); // unchanged
});

test("removing a link and archiving a subproject update the warnings", async ({ page }) => {
  await page.goto(orgPath(`/projects/${projectId}`));
  await page.getByRole("button", { name: "Remove link: DJ Booth after Structure" }).click();
  await expect(page.getByText("1 overlap between subprojects")).toBeVisible();

  await subCard(page, "DJ Booth").getByRole("button", { name: "Archive DJ Booth" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(subCard(page, "DJ Booth")).toHaveCount(0);
  await expect(page.getByText("0 of 5 tasks done")).toBeVisible(); // Structure 3 + Shade Sail 2
});

test("a member sees the project without edit controls", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(orgPath(`/projects/${projectId}`));
  await expect(page.getByRole("region", { name: "Warnings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add subproject" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add link" })).toHaveCount(0);
  await context.close();
});

test("a malformed or unknown project address is 'not found'", async ({ page }) => {
  await page.goto(orgPath("/projects/not-a-uuid"));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.goto(orgPath("/projects/00000000-0000-4000-8000-000000000000"));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.goto(orgPath(`/projects/${projectId}/not-a-uuid`));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});
