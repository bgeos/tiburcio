import { expect, test } from "@playwright/test";

test("unknown URL shows the 404 screen", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("notFound() renders the 404 screen", async ({ page }) => {
  await page.goto("/design/states/not-found");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("unauthorized() renders the sign-in prompt", async ({ page }) => {
  const response = await page.goto("/design/states/unauthorized");
  expect(response?.status()).toBe(401);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute("href", "/login");
});

test("forbidden() renders the no-access screen", async ({ page }) => {
  const response = await page.goto("/design/states/forbidden");
  expect(response?.status()).toBe(403);
  await expect(page.getByRole("heading", { level: 1, name: "You don't have access" })).toBeVisible();
});

test("a render error shows the error boundary and recovers", async ({ page }) => {
  page.on("pageerror", () => {}); // the thrown demo error is expected
  await page.goto("/design/states/error");
  await page.getByRole("button", { name: "Throw a render error" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Something went wrong" });
  await expect(alert).toBeVisible();
  await alert.getByRole("link", { name: "Go to Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("slow pages show a loading skeleton, then content", async ({ page }) => {
  await page.goto("/design");
  // Start watching before the click: the skeleton is on screen for ~1.5 s only, and a
  // busy test run could otherwise look after it has already gone.
  const skeletonSeen = page.getByRole("status").filter({ hasText: "Loading…" }).waitFor({ state: "attached" });
  await page.getByRole("link", { name: "Loading" }).click();
  await skeletonSeen;
  await expect(page.getByRole("heading", { level: 1, name: "Loaded" })).toBeVisible({
    timeout: 10_000,
  });
});

test.describe("login form", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows validation errors for empty and invalid input", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });
});

test.describe("design system", () => {
  test("sorts the demo table and confirms destructive actions", async ({ page }) => {
    await page.goto("/design");
    await expect(page.getByText(/Demo data — fictional examples/).first()).toBeVisible();

    const table = page.getByRole("table", { name: "Demo tasks" });
    const firstTask = table.locator("tbody tr").first().locator("td").first();
    await table.getByRole("button", { name: "Task" }).click();
    await expect(firstTask).toContainText("Bamboo arch templates");
    await expect(table.getByRole("columnheader", { name: "Task" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await table.getByRole("button", { name: "Task" }).click();
    await expect(firstTask).toContainText("Sew stage curtain panels");

    await page.getByRole("button", { name: "Archive project" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Archived projects are hidden");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});
