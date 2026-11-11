import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_PROFILE, orgPath, resetE2eProfile } from "./support/users";

// D-027: each person's theme colour and light/dark mode, saved on their profile.
// Uses its own account so other tests' colours never change. Serial, desktop only.
test.describe.configure({ mode: "serial", timeout: 90_000 });
test.skip(({ isMobile }) => isMobile, "profile journeys run once, on desktop");

test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await resetE2eProfile();
});

/** A fresh browser = another device: nothing remembered locally. */
async function signIn(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_PROFILE.email);
  await page.getByLabel("Password").fill(E2E_PROFILE.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

const html = (page: Page) => page.locator("html");
/** Click the visible option (the radio itself is visually hidden behind its swatch). */
const choose = (page: Page, name: string) => page.locator("label").filter({ has: page.getByRole("radio", { name }) }).click();

test("a person picks a theme colour and dark mode, and every device follows", async ({ browser }) => {
  const page = await signIn(browser);
  await expect(html(page)).not.toHaveAttribute("data-accent");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Your profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your profile" })).toBeVisible();

  // The name is required.
  await page.getByLabel("Name").fill("");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await page.getByLabel("Name").fill("Pat Example");

  // Choices preview straight away.
  await choose(page, "Violet");
  await expect(html(page)).toHaveAttribute("data-accent", "violet");
  await choose(page, "Dark");
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  // The page is accessible in the chosen look.
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-accent", "violet");
  await expect(page.getByRole("radio", { name: "Violet" })).toBeChecked();
  await page.context().close();

  const other = await signIn(browser);
  await expect(html(other)).toHaveAttribute("data-accent", "violet");
  await expect(html(other)).toHaveClass(/\bdark\b/);
  await other.context().close();
});

test("leaving without saving puts the saved look back", async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto(orgPath("/profile"));
  await choose(page, "Pink");
  await expect(html(page)).toHaveAttribute("data-accent", "pink");
  await page.getByRole("link", { name: "Projects", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-accent", "violet");
  await page.context().close();
});

test("the top bar light/dark switch is remembered too", async ({ browser }) => {
  const page = await signIn(browser);
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  // Saved in the background: wait until the profile page shows it.
  await expect(async () => {
    await page.goto(orgPath("/profile"));
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked({ timeout: 1_000 });
  }).toPass();
  await page.context().close();

  const other = await signIn(browser);
  await expect(html(other)).toHaveAttribute("data-accent", "violet");
  await expect(html(other)).not.toHaveClass(/\bdark\b/);
  await other.context().close();
});
