import { expect, test, type Page } from "@playwright/test";
import { latestEmailTo, linkIn } from "./support/mail";
import { E2E_INVITEE, E2E_ORG, E2E_OUTSIDER, orgPath, resetE2eInvitations } from "./support/users";

// These tests change the shared E2E organization, so they run one at a time, on desktop only.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "invitation flows run once, on desktop");
// afterAll runs even in projects where every test is skipped; clean up only where the
// tests ran, or the mobile worker deletes invitations the desktop tests are using.
test.afterAll(async ({ isMobile }) => {
  if (!isMobile) await resetE2eInvitations();
});

async function invite(page: Page, email: string, role: string) {
  await page.goto(orgPath("/team"));
  await page.getByLabel("Email").fill(email);
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Send invitation" }).click();
}

test("a new person is invited by email, chooses a password and joins with the invited role", async ({ page, browser }) => {
  const email = `e2e.new.${Date.now()}@example.test`;
  await invite(page, email, "Member");
  await expect(page.getByText(`Invitation email sent to ${email}`)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: email })).toContainText("Member");

  const mail = await latestEmailTo(email);
  expect(mail.subject).toBe("You're invited to JupiGenio");
  const link = linkIn(mail.html, "Accept the invitation");

  const invitee = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const newcomer = await invitee.newPage();
  await newcomer.goto(link);
  await expect(newcomer).toHaveURL(/\/accept-invite\?token=/);
  await expect(newcomer.getByRole("heading", { level: 1, name: `Join ${E2E_ORG.name}` })).toBeVisible();

  // The password rules are enforced before joining.
  await newcomer.getByLabel("New password").fill("short");
  await newcomer.getByLabel("Repeat password").fill("short");
  await newcomer.getByRole("button", { name: `Join ${E2E_ORG.name}` }).click();
  await expect(newcomer.getByText("Use at least 8 characters.")).toBeVisible();

  await newcomer.getByLabel("New password").fill("festival2027");
  await newcomer.getByLabel("Repeat password").fill("festival2027");
  await newcomer.getByRole("button", { name: `Join ${E2E_ORG.name}` }).click();
  await expect(newcomer).toHaveURL(new RegExp(`/${E2E_ORG.slug}/dashboard$`));
  await expect(newcomer.locator('[data-slot="sidebar"]').first().getByText("Member", { exact: true })).toBeVisible();

  // The invitation works only once. (The email link's sign-in token is one-time too;
  // reopening it while signed in just lands on the dashboard.)
  const acceptPath = new URL(link).searchParams.get("next")!;
  expect(acceptPath).toMatch(/^\/accept-invite\?token=/);
  await newcomer.goto(acceptPath);
  await expect(newcomer.getByText("This invitation has already been used.")).toBeVisible();
  await invitee.close();

  // The admin now sees them as a member, and the invitation is no longer open.
  await page.reload();
  await expect(page.getByRole("region", { name: /^Members/ })).toContainText(email);
  await expect(page.getByRole("button", { name: `Revoke invitation for ${email}` })).toHaveCount(0);
});

test("someone with an account gets a link to share, signs in and joins", async ({ page, browser }) => {
  await invite(page, E2E_INVITEE.email, "External collaborator");
  await expect(page.getByText("already has a JupiGenio account")).toBeVisible();
  const link = (await page.getByTestId("invite-link").textContent())!.trim();
  expect(link).toMatch(/\/accept-invite\?token=[\w-]{20,}$/);

  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const person = await other.newPage();
  await person.goto(link);
  await expect(person).toHaveURL(/\/login\?next=%2Faccept-invite/);
  await person.getByLabel("Email").fill(E2E_INVITEE.email);
  await person.getByLabel("Password").fill(E2E_INVITEE.password);
  await person.getByRole("button", { name: "Sign in" }).click();

  await expect(person.getByRole("heading", { level: 1, name: `Join ${E2E_ORG.name}` })).toBeVisible();
  await expect(person.getByLabel("New password")).toHaveCount(0); // existing accounts keep their password
  await person.getByRole("button", { name: `Join ${E2E_ORG.name}` }).click();
  await expect(person).toHaveURL(new RegExp(`/${E2E_ORG.slug}/dashboard$`));
  await other.close();
});

test("a link only works for the invited email, and a revoked link stops working", async ({ page }) => {
  await invite(page, E2E_OUTSIDER.email, "Member");
  const link = (await page.getByTestId("invite-link").textContent())!.trim();

  // The admin (a different account) opens the outsider's link.
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "This invitation is for someone else" })).toBeVisible();

  await page.goto(orgPath("/team"));
  await page.getByRole("button", { name: `Revoke invitation for ${E2E_OUTSIDER.email}` }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Revoke" }).click();
  // While the dialog is open the page behind it is hidden from assistive tech, so wait
  // for it to close before checking that the invitation is gone.
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: E2E_OUTSIDER.email })).toHaveCount(0);

  await page.goto(link);
  await expect(page.getByText("This invitation was cancelled.")).toBeVisible();
});

test("admins can invite every role", async ({ page }) => {
  // Production managers are limited to members and externals: that rule is enforced by
  // the database and proved in supabase/tests/tenancy_rls.test.sql.
  await page.goto(orgPath("/team"));
  await page.getByRole("combobox", { name: "Role" }).click();
  for (const role of ["Admin", "Production manager", "Member", "External collaborator"]) {
    await expect(page.getByRole("option", { name: role, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
});
