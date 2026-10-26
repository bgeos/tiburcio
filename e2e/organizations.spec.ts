import { expect, test } from "@playwright/test";
import { E2E_NO_ORG_USER, E2E_ORG, E2E_OTHER_ORG, orgPath } from "./support/users";

test("the sidebar shows the current organization and the person's role", async ({ page, isMobile }) => {
  await page.goto(orgPath("/projects"));
  // On phones the sidebar lives in a drawer.
  if (isMobile) await page.getByRole("button", { name: "Toggle navigation" }).click();
  const sidebar = isMobile ? page.getByRole("dialog") : page.locator('[data-slot="sidebar"]').first();
  await expect(sidebar.getByText(E2E_ORG.name)).toBeVisible();
  await expect(sidebar.getByText("Admin", { exact: true })).toBeVisible();
});

test("another organization's address shows 'not found', not its data", async ({ page }) => {
  await page.goto(`/${E2E_OTHER_ORG.slug}/dashboard`);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText(E2E_OTHER_ORG.name)).toHaveCount(0);
});

test("old addresses without an organization are not pages any more", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("links outside an organization lead into the person's organization", async ({ page, isMobile }) => {
  test.skip(isMobile, "sidebar links checked on desktop");
  await page.goto("/design");
  await page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${E2E_ORG.slug}/projects$`));
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
});

test.describe("someone without an organization", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("is told to ask for an invitation", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_NO_ORG_USER.email);
    await page.getByLabel("Password").fill(E2E_NO_ORG_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/no-organization$/);
    await expect(page.getByRole("heading", { level: 1, name: "You're not in an organization yet" })).toBeVisible();
    await expect(page.getByText(E2E_NO_ORG_USER.email)).toBeVisible();

    // Typing an organization's address doesn't help.
    await page.goto(orgPath("/dashboard"));
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });
});
