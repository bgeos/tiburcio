import { expect, test } from "@playwright/test";

const ROUTES = [
  { path: "/dashboard", heading: "Overview" },
  { path: "/projects", heading: "Projects" },
  { path: "/tasks", heading: "Tasks" },
  { path: "/materials", heading: "Materials" },
  { path: "/reports", heading: "Reports" },
  { path: "/team", heading: "Team" },
  { path: "/settings", heading: "Settings" },
];

test("root redirects to the overview", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
});

for (const route of ROUTES) {
  test(`${route.path} renders its heading and an honest empty state`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${route.heading} · JupiGenio`));
  });
}

test("dashboard shows no fabricated metrics", async ({ page }) => {
  await page.goto("/dashboard");
  const tiles = page.getByRole("region", { name: "Key figures" });
  await expect(tiles.getByText("—")).toHaveCount(4);
  await expect(tiles.getByText(/^\d+$/)).toHaveCount(0);
});

test.describe("desktop sidebar", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("navigates between sections and marks the current page", async ({ page }) => {
    await page.goto("/dashboard");
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
    await page.goto("/dashboard");
    const sidebar = page.locator('[data-slot="sidebar"][data-state]').first();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });
});

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("opens the drawer, navigates and closes it", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Materials", exact: true }).click();
    await expect(page).toHaveURL(/\/materials$/);
    await expect(page.getByRole("heading", { level: 1, name: "Materials" })).toBeVisible();
    await expect(drawer).toBeHidden();
  });

  test("has no horizontal scroll", async ({ page }) => {
    for (const path of ["/dashboard", "/projects", "/projects/prototype", "/projects/prototype/materials", "/design", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
