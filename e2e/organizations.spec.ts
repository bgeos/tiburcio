import { expect, test } from "@playwright/test";
import { E2E_NO_ORG_USER, E2E_ORG, E2E_OTHER_ORG, orgPath } from "./support/users";

test("the sidebar shows the current workspace", async ({ page, isMobile }) => {
  await page.goto(orgPath("/projects"));
  // On phones the sidebar lives in a drawer.
  if (isMobile) await page.getByRole("button", { name: "Toggle navigation" }).click();
  const sidebar = isMobile ? page.getByRole("dialog") : page.locator('[data-slot="sidebar"]').first();
  await expect(sidebar.getByText(E2E_ORG.name)).toBeVisible();
  await expect(sidebar.getByText("Workspace", { exact: true })).toBeVisible();
});

test("another organization's address shows 'not found', not its data", async ({ page }) => {
  await page.goto(orgPath("/dashboard", E2E_OTHER_ORG.slug));
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText(E2E_OTHER_ORG.name)).toHaveCount(0);
});

test("old addresses without the jupigenio prefix are not pages any more", async ({ page }) => {
  await page.goto(`/${E2E_ORG.slug}/dashboard`);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("links outside a workspace lead into the first workspace", async ({ page, isMobile }) => {
  test.skip(isMobile, "sidebar links checked on desktop");
  await page.goto("/design");
  await page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/jupigenio/${E2E_ORG.slug}/projects$`));
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
});

test.describe("someone without a workspace", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("lands on Home and is offered a new workspace in jupigenio", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_NO_ORG_USER.email);
    await page.getByLabel("Password").fill(E2E_NO_ORG_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/localhost:3100\/$/);
    await page.goto("/jupigenio");
    await expect(page.getByText("No workspace yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "New workspace" })).toBeVisible();

    // Typing someone else's workspace address doesn't help.
    await page.goto(orgPath("/dashboard"));
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });
});
