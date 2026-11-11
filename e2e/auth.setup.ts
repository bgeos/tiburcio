import { expect, test as setup } from "@playwright/test";
import { E2E_USER, STORAGE_STATE, ensureE2eFixtures } from "./support/users";

/**
 * Runs before the browser tests: makes sure the fictional E2E users and
 * organizations exist in the local Supabase, signs in through the real login form once, and saves the
 * session for every other test. Needs `npm run db:start` and `.env.local`.
 */
setup("sign in as the E2E user", async ({ page }) => {
  await ensureE2eFixtures();

  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/e2e-org\/dashboard$/);
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
