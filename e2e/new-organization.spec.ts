import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ORG, E2E_OTHER_ORG, deleteE2eOrganizations, orgPath } from "./support/users";

// D-033, D-004: Bruno starts a new workspace (e.g. a festival) and switches between them. The database rules are in supabase/tests/create_my_organization.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "organization journeys run once, on desktop");

const STAMP = Date.now();
// "E2E Zz…" sorts after "E2E Test Org", so other tests still land in the E2E organization.
const NAME = `E2E Zz Fest ${STAMP}`;
const SLUG = `e2e-zz-fest-${STAMP}`;

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await deleteE2eOrganizations("e2e-zz-");
});

async function expectNoAxeViolations(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

const sidebar = (page: Page) => page.locator('[data-slot="sidebar"]').first();

test("a new workspace starts from the sidebar and opens", async ({ page }) => {
  await page.goto(orgPath("/dashboard"));
  await sidebar(page).getByRole("button", { name: /switch workspace/ }).click();
  await page.getByRole("menuitem", { name: "New workspace" }).click();

  const dialog = page.getByRole("dialog", { name: "New workspace" });
  await dialog.getByLabel("Name").fill(NAME);
  // The address follows the name.
  await expect(dialog.getByLabel("Address")).toHaveValue(SLUG);
  await expectNoAxeViolations(page);

  // A taken address is refused, and the form keeps what was typed.
  await dialog.getByLabel("Address").fill(E2E_OTHER_ORG.slug);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(dialog.getByText("This address is taken. Choose another.")).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue(NAME);

  await dialog.getByLabel("Address").fill(SLUG);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(new RegExp(`/jupigenio/${SLUG}/dashboard$`));
  await expect(sidebar(page).getByText(NAME)).toBeVisible();

  // It starts empty: the E2E workspace's projects aren't here.
  await page.goto(orgPath("/projects", SLUG));
  await expect(page.getByRole("main").getByRole("link", { name: /^E2E / })).toHaveCount(0);
});

test("the sidebar menu switches between workspaces", async ({ page }) => {
  await page.goto(orgPath("/dashboard", SLUG));
  await sidebar(page).getByRole("button", { name: /switch workspace/ }).click();
  await page.getByRole("menuitem", { name: new RegExp(E2E_ORG.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/jupigenio/${E2E_ORG.slug}/dashboard$`));
  await expect(sidebar(page).getByText(E2E_ORG.name)).toBeVisible();
});

test("the profile lists every workspace, with a way to open each", async ({ page }) => {
  await page.goto(orgPath("/profile"));
  const section = page.getByRole("region", { name: "Your workspaces" });
  await expect(section.getByRole("listitem").filter({ hasText: E2E_ORG.name })).toContainText("Current");
  await section.getByRole("link", { name: `Open ${NAME}` }).click();
  await expect(page).toHaveURL(new RegExp(`/jupigenio/${SLUG}/dashboard$`));
  await page.goto(orgPath("/profile"));
  await expect(page.getByRole("region", { name: "Your workspaces" }).getByRole("button", { name: "New workspace" })).toBeVisible();
  await expectNoAxeViolations(page);
});
