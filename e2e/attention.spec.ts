import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { addE2eSubprojects, addE2eTasks, createE2eProject, deleteE2eProjects, linkE2eTasks, orgPath } from "./support/users";

// P4-04: overdue and blocked work is marked on the cronograma, the project page and the Overview.
// Dates are relative to today, with days to spare so the organization's timezone doesn't matter.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "attention journeys run once, on desktop");

const NAME = `E2E Attention ${Date.now()}`;
const ids: Record<string, string> = {};
const daysFromToday = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(NAME);
});

test("overdue and blocked tasks are marked in the cronograma", async ({ page }) => {
  ids.project = await createE2eProject(NAME);
  // Structure ran 20–11 days ago and isn't done: both tasks overdue (by 10+ days).
  // Shade Sail started 2 days ago and its rigging waits for Structure task 2: blocked.
  Object.assign(ids, await addE2eSubprojects(ids.project, [
    { name: "Structure", startDate: daysFromToday(-20) },
    { name: "Shade Sail", startDate: daysFromToday(-2) },
  ]));
  await addE2eTasks(ids.project, "Structure", [5, 5]);
  await addE2eTasks(ids.project, "Shade Sail", [5, 3]);
  await linkE2eTasks(ids.project, "Structure task 2", "Shade Sail task 1");

  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  await expect(page.getByText("2 tasks are overdue")).toBeVisible();
  const row = (task: string) => page.getByRole("row").filter({ has: page.getByText(task, { exact: true }) });
  await expect(row("Structure task 1")).toContainText(/Overdue by \d+ days/);

  await page.goto(orgPath(`/projects/${ids.project}/${ids["Shade Sail"]}`));
  await expect(page.getByText("1 task is blocked")).toBeVisible();
  await expect(row("Shade Sail task 1")).toContainText("Can't start yet: Structure task 2 (Structure) isn't done");
  await expect(row("Shade Sail task 2")).not.toContainText("Can't start yet"); // starts later: just the plan

  // The amber marks stay readable in light and dark.
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.reload();
    await expect(page.getByText("1 task is blocked")).toBeVisible();
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), colorScheme).toEqual([]);
  }
});

test("the project page and the Overview count them, and they clear when the work is done", async ({ page }) => {
  await page.goto(orgPath(`/projects/${ids.project}`));
  const progress = page.getByRole("region", { name: "Project progress" }).or(page.locator("section", { has: page.getByRole("heading", { name: "Project progress" }) }));
  await expect(progress.first()).toContainText("2 overdue tasks");
  await expect(progress.first()).toContainText("1 blocked task");

  await page.goto(orgPath("/dashboard"));
  const project = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: NAME, exact: true }) });
  await expect(project).toContainText("2 overdue");
  await expect(project).toContainText("1 blocked");

  // Finishing the structure clears both marks: nothing overdue there, and the rigging can start.
  await page.goto(orgPath(`/projects/${ids.project}/${ids.Structure}`));
  for (const task of ["Structure task 1", "Structure task 2"]) {
    await page.getByRole("combobox", { name: `Status of ${task}` }).click();
    await page.getByRole("option", { name: "Done" }).click();
    await expect(page.getByRole("combobox", { name: `Status of ${task}` })).toContainText("Done");
  }
  await expect(page.getByText(/is overdue|are overdue|Overdue by/)).toHaveCount(0);
  await page.goto(orgPath(`/projects/${ids.project}/${ids["Shade Sail"]}`));
  await expect(page.getByText("Can't start yet")).toHaveCount(0);
});
