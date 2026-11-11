import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  E2E_MEMBER,
  addE2eSubprojects,
  addE2eTasks,
  createE2eProject,
  deleteE2eProjects,
  orgPath,
} from "./support/users";

// P4-01 (D-027): a task can wait for any task, also in another subproject or project.
// The product owner's example: sewing the shade sail runs alongside the structure, but
// rigging it waits for the structure. Nothing moves by itself; overlaps show in red.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "task link journeys run once, on desktop");

const STAGE = `E2E Links ${Date.now()}`;
const GARDEN = `${STAGE} Garden`;
const ids: Record<string, string> = {};

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await Promise.all([deleteE2eProjects(STAGE), deleteE2eProjects(GARDEN)]);
});

const sub = (name: string) => orgPath(`/projects/${name === "Dome" ? ids.garden : ids.stage}/${ids[name]}`);
const row = (page: Page, task: string) => page.getByRole("row").filter({ has: page.getByText(task, { exact: true }) });

/** Pick the task inside its subproject's group: other test projects may have tasks with the same name. */
async function link(page: Page, task: string, group: string, waitsFor: RegExp) {
  await row(page, task).getByRole("button", { name: `Links for ${task}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: `Add: ${task} waits for…` }).click();
  await page.getByRole("group", { name: group, exact: true }).getByRole("option", { name: waitsFor }).click();
  return dialog;
}

async function expectNoAxeViolations(page: Page) {
  // Scan settled colours, not a notification or dialog halfway through fading in.
  // A cancelled animation (e.g. a notification closing) rejects `finished`: that's settled too.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }))).toEqual([]);
}

async function signInAsMember(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_MEMBER.email);
  await page.getByLabel("Password").fill(E2E_MEMBER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

test("rigging the sail waits for the structure, while sewing runs alongside", async ({ page }) => {
  ids.stage = await createE2eProject(STAGE);
  ids.garden = await createE2eProject(GARDEN);
  // Structure: task 1 4–10 Jan, task 2 11–13 Jan. Shade Sail: task 1 (sewing) 10–13 Jan, task 2 (rigging) 14–15 Jan.
  Object.assign(ids, await addE2eSubprojects(ids.stage, [
    { name: "Structure", startDate: "2027-01-04" },
    { name: "Shade Sail", startDate: "2027-01-10" },
  ]));
  Object.assign(ids, await addE2eSubprojects(ids.garden, [{ name: "Dome", startDate: "2027-01-16" }]));
  await addE2eTasks(ids.stage, "Structure", [7, 3]);
  await addE2eTasks(ids.stage, "Shade Sail", [4, 2]);
  await addE2eTasks(ids.garden, "Dome", [2]);

  await page.goto(sub("Shade Sail"));
  const dialog = await link(page, "Shade Sail task 2", "Structure", /^Structure task 2/);
  await expect(dialog.getByRole("region", { name: "Preview" })).toContainText(
    "No overlap: Structure task 2 (Structure) finishes 13 Jan, and Shade Sail task 2 starts 14 Jan.",
  );
  // Tasks of the same subproject aren't offered: they already run in order.
  await dialog.getByRole("combobox").click();
  await expect(page.getByRole("group", { name: "Shade Sail", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Add link" }).click();
  await expect(dialog.getByRole("list", { name: "Waits for" })).toContainText("Structure task 2 (Structure)");
  await page.keyboard.press("Escape");

  await expect(row(page, "Shade Sail task 2")).toContainText("Waits for Structure task 2 (Structure)");
  await expect(row(page, "Shade Sail task 1")).not.toContainText("Waits for");
  await expect(page.getByRole("region", { name: "Warnings" })).toHaveCount(0);
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByRole("list", { name: "Shade Sail history" })).toContainText(
    "Shade Sail task 2 now waits for Structure task 2 (Structure)",
  );
});

test("a task can wait for a task in another project", async ({ page }) => {
  await page.goto(sub("Dome"));
  const dialog = await link(page, "Dome task 1", `${STAGE} › Shade Sail`, /^Shade Sail task 2/);
  await expect(dialog.getByRole("region", { name: "Preview" })).toContainText("No overlap");
  await dialog.getByRole("button", { name: "Add link" }).click();
  await expect(dialog.getByRole("list", { name: "Waits for" })).toContainText(`Shade Sail task 2 (${STAGE} › Shade Sail)`);
  await page.keyboard.press("Escape");
  await expect(row(page, "Dome task 1")).toContainText(`Waits for Shade Sail task 2 (${STAGE} › Shade Sail)`);
});

test("a delay previews the red overlap with the linked task, and nothing else moves", async ({ page }) => {
  await page.goto(sub("Structure"));
  await row(page, "Structure task 1").getByRole("button", { name: "Update Structure task 1" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Duration (calendar days)").fill("8");
  const preview = dialog.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText("Structure task 2: 11 Jan – 13 Jan → 12 Jan – 14 Jan");
  await expect(preview).toContainText(
    "Shade Sail task 2 (Shade Sail) starts 14 Jan, but Structure task 2 (Structure) finishes 14 Jan (1 day overlap).",
  );
  await expect(preview).not.toContainText("Shade Sail task 2: "); // linked tasks never move
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  const warning = "Shade Sail task 2 (Shade Sail) starts 14 Jan, but Structure task 2 (Structure) finishes 14 Jan (1 day overlap).";
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText(warning);
  await expect(row(page, "Structure task 2")).toContainText("Needed by Shade Sail task 2 (Shade Sail) (overlaps 1 day)");

  // Accessible with a red overlap on the page, and with the links dialog open.
  await expectNoAxeViolations(page);
  await row(page, "Structure task 2").getByRole("button", { name: "Links for Structure task 2" }).click();
  const links = page.getByRole("dialog");
  await expect(links.getByRole("list", { name: "Needed by" })).toContainText("(1 day overlap)");
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");

  await page.goto(orgPath(`/projects/${ids.stage}`));
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText(warning);
  await expect(page.getByText("1 overlap between linked tasks")).toBeVisible();
  // The project timeline turns those days red on both subprojects' bars (and says so to screen readers).
  const timeline = page.getByRole("list", { name: "Subprojects timeline" });
  for (const name of ["Structure", "Shade Sail"]) {
    await expect(timeline.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) })).toContainText(`Warning: ${warning}`);
  }

  await page.goto(sub("Shade Sail"));
  await expect(page.getByRole("region", { name: "Warnings" })).toContainText(warning);
  await expect(row(page, "Shade Sail task 2")).toContainText("14 Jan – 15 Jan"); // unchanged

  // The other project's task didn't move either: it starts after the sail is rigged.
  await page.goto(sub("Dome"));
  await expect(row(page, "Dome task 1")).toContainText("16 Jan – 17 Jan");
  await expect(page.getByRole("region", { name: "Warnings" })).toHaveCount(0);
});

test("a circle of links is refused, and removing a link clears its overlap", async ({ page }) => {
  await page.goto(sub("Structure"));
  const dialog = await link(page, "Structure task 2", `${GARDEN} › Dome`, /^Dome task 1/);
  await dialog.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText("That would make tasks wait for each other in a circle.")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(sub("Shade Sail"));
  await row(page, "Shade Sail task 2").getByRole("button", { name: "Links for Shade Sail task 2" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove link: Shade Sail task 2 waits for Structure task 2" }).click();
  await expect(page.getByRole("dialog").getByRole("list", { name: "Waits for" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Warnings" })).toHaveCount(0);
  await expect(row(page, "Shade Sail task 2")).not.toContainText("Waits for Structure task 2");
});

test("a member sees the links but cannot change them", async ({ browser }) => {
  const page = await signInAsMember(browser);
  await page.goto(sub("Dome"));
  await expect(row(page, "Dome task 1")).toContainText(`Waits for Shade Sail task 2 (${STAGE} › Shade Sail)`);
  await expect(page.getByRole("button", { name: /^Links for / })).toHaveCount(0);
  await page.context().close();
});
