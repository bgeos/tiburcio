import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_MEMBER, E2E_ORG, E2E_OTHER_ORG, deleteE2eOrganizations, orgPath } from "./support/users";

// D-033: admins and production managers start a new organization (e.g. a second festival)
// and switch between them. The database rules are in supabase/tests/create_my_organization.
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

test("an admin starts a new organization from the sidebar and lands in it", async ({ page }) => {
  await page.goto(orgPath("/dashboard"));
  await sidebar(page).getByRole("button", { name: /switch organization/ }).click();
  await page.getByRole("menuitem", { name: "New organization" }).click();

  const dialog = page.getByRole("dialog", { name: "New organization" });
  await dialog.getByLabel("Name").fill(NAME);
  // The address follows the name.
  await expect(dialog.getByLabel("Address")).toHaveValue(SLUG);
  await expectNoAxeViolations(page);

  // A taken address is refused, and the form keeps what was typed.
  await dialog.getByLabel("Address").fill(E2E_OTHER_ORG.slug);
  await dialog.getByRole("button", { name: "Create organization" }).click();
  await expect(dialog.getByText("This address is taken. Choose another.")).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue(NAME);

  await dialog.getByLabel("Address").fill(SLUG);
  await dialog.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(new RegExp(`/${SLUG}/dashboard$`));
  await expect(sidebar(page).getByText(NAME)).toBeVisible();
  await expect(sidebar(page).getByText("Admin", { exact: true })).toBeVisible();

  // It starts empty: the E2E organization's projects aren't here.
  await page.goto(`/${SLUG}/projects`);
  await expect(page.getByRole("main").getByRole("link", { name: /^E2E / })).toHaveCount(0);
});

test("the sidebar menu switches between the organizations", async ({ page }) => {
  await page.goto(`/${SLUG}/dashboard`);
  await sidebar(page).getByRole("button", { name: /switch organization/ }).click();
  await page.getByRole("menuitem", { name: new RegExp(E2E_ORG.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/${E2E_ORG.slug}/dashboard$`));
  await expect(sidebar(page).getByText(E2E_ORG.name)).toBeVisible();
});

test("the profile lists every organization, with a way to open each", async ({ page }) => {
  await page.goto(orgPath("/profile"));
  const section = page.getByRole("region", { name: "Your organizations" });
  await expect(section.getByRole("listitem").filter({ hasText: E2E_ORG.name })).toContainText("Current");
  await section.getByRole("link", { name: `Open ${NAME}` }).click();
  await expect(page).toHaveURL(new RegExp(`/${SLUG}/dashboard$`));
  await page.goto(orgPath("/profile"));
  await expect(page.getByRole("region", { name: "Your organizations" }).getByRole("button", { name: "New organization" })).toBeVisible();
  await expectNoAxeViolations(page);
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

test("a member can't start an organization", async ({ browser }) => {
  const page = await signInAs(browser, E2E_MEMBER);
  // Only one organization and no way to create one: the name is a plain link, not a menu.
  await expect(sidebar(page).getByRole("button", { name: /switch organization/ })).toHaveCount(0);
  await page.goto(orgPath("/profile"));
  await expect(page.getByRole("region", { name: "Your organizations" })).toContainText(E2E_ORG.name);
  await expect(page.getByRole("button", { name: "New organization" })).toHaveCount(0);
  await page.context().close();
});
