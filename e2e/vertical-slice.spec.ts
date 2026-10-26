import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_OUTSIDER, deleteE2eProjects, orgPath } from "./support/users";

// P3-20: the whole Phase 3 story through the UI only, as the production manager lives it:
// create Main Stage, split it into subprojects with owners, tasks and materials, link them,
// delay a task, see the red overlap, reload; another organization sees none of it. Serial, desktop only (phone width checked at the end).
test.describe.configure({ mode: "serial", timeout: 120_000 });
test.skip(({ isMobile }) => isMobile, "the vertical slice runs once, on desktop");

const PROJECT = `E2E Slice Main Stage ${Date.now()}`;
let projectUrl = "";

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eProjects(PROJECT);
});

// Fictional people and plan.
const SUBPROJECTS = [
  { name: "Structure", start: "2027-01-04", owner: "Tomás Ferraz", tasks: [["Prepare bamboo", "3"], ["Assemble poles", "4"], ["Set up structure", "3"]] },
  { name: "Shade Sail", start: "2027-01-14", owner: "Lúcia Andrade", tasks: [["Cut fabric", "2"], ["Rig sail", "2"]] },
  { name: "DJ Booth", start: "2027-01-14", owner: "Rui Moreira", tasks: [["Build frame", "3"], ["Finish booth", "2"]] },
  { name: "Bar", start: "2027-01-20", owner: "Inês Prado", tasks: [["Build counter", "2"], ["Paint bar", "1"]] },
] as const;

const card = (page: Page, name: string) =>
  page.getByRole("list", { name: "Subprojects" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
const row = (page: Page, task: string) => page.getByRole("row").filter({ has: page.getByText(task, { exact: true }) });

async function openSubproject(page: Page, name: string) {
  await page.goto(projectUrl);
  await card(page, name).getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function closedDialogs(page: Page) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("the production manager creates Main Stage and its subprojects", async ({ page }) => {
  await page.goto(orgPath("/projects"));
  await page.getByRole("button", { name: "New project" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(PROJECT);
  await dialog.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Active" }).click();
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: PROJECT }).click();
  await expect(page.getByRole("heading", { level: 1, name: PROJECT })).toBeVisible();
  projectUrl = new URL(page.url()).pathname;

  for (const sub of SUBPROJECTS) {
    await closedDialogs(page);
    await page.getByRole("button", { name: "Add subproject" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(sub.name);
    await dialog.getByLabel("Start date").fill(sub.start);
    await dialog.getByRole("button", { name: "Add subproject" }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, sub.name)).toBeVisible();
  }

  for (const successor of ["Shade Sail", "DJ Booth"]) {
    await page.getByRole("combobox", { name: "Subproject" }).click();
    await page.getByRole("option", { name: successor, exact: true }).click();
    await page.getByRole("combobox", { name: "finishes" }).click();
    await page.getByRole("option", { name: "Structure", exact: true }).click();
    await page.getByRole("button", { name: "Add link" }).click();
    await expect(page.getByRole("list", { name: "Links between subprojects" })).toContainText(`${successor} starts after Structure finishes`);
  }
});

test("each subproject gets its crew, owner, tasks and materials", async ({ page }) => {
  for (const sub of SUBPROJECTS) {
    await openSubproject(page, sub.name);

    for (const [task, days] of sub.tasks) {
      await closedDialogs(page);
      await page.getByRole("button", { name: "Add task" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Task name").fill(task);
      await dialog.getByLabel("Duration (calendar days)").fill(days);
      await dialog.getByRole("button", { name: "Add task" }).click();
      await expect(dialog).toBeHidden();
      await expect(row(page, task)).toBeVisible();
    }

    await page.getByRole("tab", { name: /Materials/ }).click();
    await page.getByLabel("New material").fill(`${sub.name} hardware kit`);
    await page.getByRole("button", { name: "Add material" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: `${sub.name} hardware kit` })).toBeVisible();

    await page.getByRole("tab", { name: /Crew/ }).click();
    await page.getByLabel("Name", { exact: true }).fill(sub.owner);
    await page.getByLabel("Role", { exact: true }).fill("Lead");
    await page.getByRole("button", { name: "Add crew member" }).click();
    await page.getByRole("button", { name: `Make owner ${sub.owner}` }).click();
    await expect(page.getByText(`Owner: ${sub.owner}`)).toBeVisible();
  }

  await page.goto(projectUrl);
  await expect(card(page, "Structure")).toContainText("4 Jan – 13 Jan");
  await expect(card(page, "Shade Sail")).toContainText("14 Jan – 17 Jan");
  await expect(card(page, "DJ Booth")).toContainText("14 Jan – 18 Jan");
  await expect(card(page, "Bar")).toContainText("20 Jan – 22 Jan");
  for (const sub of SUBPROJECTS) await expect(card(page, sub.name)).toContainText(`Owner: ${sub.owner}`);
  await expect(page.getByText("No overlaps between subprojects.")).toBeVisible();
  await expect(page.getByText("0 of 9 tasks done")).toBeVisible();
});

test("a delayed task previews the red overlap, nothing else moves, and it survives a reload", async ({ page }) => {
  await openSubproject(page, "Structure");
  await row(page, "Prepare bamboo").getByRole("button", { name: "Update Prepare bamboo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Duration (calendar days)").fill("4");
  const preview = dialog.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText("Structure: 4 Jan – 13 Jan → 4 Jan – 14 Jan");
  await expect(preview).toContainText("Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");
  await expect(preview).toContainText("DJ Booth starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");
  await dialog.getByLabel("Reason (optional)").fill("Bamboo delivery came late");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("combobox", { name: "Status of Prepare bamboo" }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(row(page, "Prepare bamboo")).toContainText("100%");

  await page.goto(projectUrl);
  await page.reload();
  const warnings = page.getByRole("region", { name: "Warnings" });
  await expect(warnings).toContainText("Shade Sail starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");
  await expect(warnings).toContainText("DJ Booth starts 14 Jan, but Structure finishes 14 Jan (1 day overlap).");
  await expect(page.getByText("2 overlaps between subprojects")).toBeVisible();
  await expect(card(page, "Shade Sail")).toContainText("Overlaps Structure by 1 day");
  await expect(card(page, "Shade Sail")).toContainText("14 Jan – 17 Jan"); // never moved automatically
  // Rollup rule (D-007): every task counts equally, 1 of 9 done.
  await expect(page.getByText("1 of 9 tasks done")).toBeVisible();
  await expect(page.getByRole("img", { name: `${PROJECT} progress: 11% complete` })).toBeVisible();
  await expect(page.getByRole("list", { name: "Recent changes" })).toContainText("Bamboo delivery came late");

  await page.goto(orgPath("/materials"));
  for (const sub of SUBPROJECTS) await expect(page.getByRole("row").filter({ hasText: `${sub.name} hardware kit` })).toContainText(PROJECT);
});

test("the project and subproject pages are accessible and fit a phone, in light and dark", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const open of [() => page.goto(projectUrl), () => openSubproject(page, "Structure")]) {
      await open();
      await page.locator("h1").first().waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${page.url()} (${colorScheme})`).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }))).toEqual([]);
    }
  }
});

test("another organization cannot see any of it", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_OUTSIDER.email);
  await page.getByLabel("Password").fill(E2E_OUTSIDER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(projectUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText(PROJECT)).toHaveCount(0);
  await context.close();
});
