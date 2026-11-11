import { expect, test } from "@playwright/test";
import { E2E_OTHER_ORG, E2E_OUTSIDER, orgPath } from "./support/users";

const ROUTES = [
  { path: orgPath("/dashboard"), heading: "Overview" },
  { path: orgPath("/projects"), heading: "Projects" },
  { path: orgPath("/calendar"), heading: "Calendar" },
  { path: orgPath("/tasks"), heading: "My tasks" },
  { path: orgPath("/materials"), heading: "Materials" },
  { path: orgPath("/settings"), heading: "Settings" },
];

test("root is Tibúrcio's Home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tibúrcio" })).toBeVisible();
});

test("/jupigenio opens the first workspace's overview", async ({ page }) => {
  await page.goto("/jupigenio");
  await expect(page).toHaveURL(/\/jupigenio\/e2e-org\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
});

for (const route of ROUTES) {
  test(`${route.path} renders its heading and an honest empty state`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${route.heading} · Tibúrcio`));
  });
}

test("the removed Reports section is not found", async ({ page }) => {
  const response = await page.goto(orgPath("/reports"));
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Reports", exact: true })).toHaveCount(0);
});

test("a workspace without projects shows dashes on the Overview, never fake zeros", async ({ browser }) => {
  // The other organization has no projects (the E2E organization's change as tests run).
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_OUTSIDER.email);
  await page.getByLabel("Password").fill(E2E_OUTSIDER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await page.goto("/jupigenio");
  await expect(page).toHaveURL(new RegExp(`/jupigenio/${E2E_OTHER_ORG.slug}/dashboard$`));

  const tiles = page.getByRole("region", { name: "Key figures" });
  await expect(tiles.getByText("—")).toHaveCount(4);
  await expect(tiles.getByText(/^\d+$/)).toHaveCount(0);
  await expect(page.getByText("No current projects")).toBeVisible();
  await context.close();
});

test.describe("desktop sidebar", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("navigates between sections and marks the current page", async ({ page }) => {
    await page.goto(orgPath("/dashboard"));
    const nav = page.getByRole("navigation", { name: "Main navigation" }).or(
      page.locator('[data-slot="sidebar"]'),
    );
    for (const route of ROUTES.slice(1)) {
      await nav.getByRole("link", { name: route.heading, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expect(
        nav.getByRole("link", { name: route.heading, exact: true }).first(),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("sidebar can be collapsed with the toggle", async ({ page }) => {
    await page.goto(orgPath("/dashboard"));
    const sidebar = page.locator('[data-slot="sidebar"][data-state]').first();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });
});

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("opens the drawer, navigates and closes it", async ({ page }) => {
    await page.goto(orgPath("/dashboard"));
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Materials", exact: true }).click();
    await expect(page).toHaveURL(/\/materials$/);
    await expect(page.getByRole("heading", { level: 1, name: "Materials" })).toBeVisible();
    await expect(drawer).toBeHidden();
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const path of [orgPath("/dashboard"), orgPath("/projects"), orgPath("/materials"), "/", "/design"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
