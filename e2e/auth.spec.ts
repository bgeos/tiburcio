import { expect, test } from "@playwright/test";
import { E2E_USER, orgPath } from "./support/users";

// These tests start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out visitors are sent to the login page, then back where they were going", async ({ page }) => {
  await page.goto(orgPath("/projects/prototype"));
  await expect(page).toHaveURL(/\/login\?next=%2Fe2e-org%2Fprojects%2Fprototype$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/e2e-org\/projects\/prototype$/);
  await expect(page.getByRole("heading", { level: 1, name: "Main Stage" })).toBeVisible();
});

test("a wrong password shows one generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill("not-the-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Filter: Next.js also renders an (empty) role="alert" route announcer.
  await expect(page.getByRole("alert").filter({ hasText: "Email or password" })).toHaveText(
    "Email or password is incorrect.",
  );
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toHaveValue(E2E_USER.email);
});

test("an off-site next= link is ignored after signing in", async ({ page }) => {
  await page.goto("/login?next=//evil.example/steal");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:3100\/e2e-org\/dashboard$/);
});

test("an invalid email link explains itself", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=nope&type=invite");
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible();
});

test("signing out ends the session", async ({ page }) => {
  // Own sign-in, so signing out doesn't affect the session other tests share.
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menu")).toContainText(E2E_USER.email);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(orgPath("/dashboard"));
  await expect(page).toHaveURL(/\/login\?next=%2Fe2e-org%2Fdashboard$/);
});
