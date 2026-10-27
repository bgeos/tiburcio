import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { orgPath } from "./support/users";

const PAGES = [
  ...["/dashboard", "/projects", "/tasks", "/materials", "/team", "/settings"].map((p) => orgPath(p as `/${string}`)),
  "/design",
  "/no-organization",
  "/does-not-exist",
];

/** Pages people see while signed out. */
const SIGNED_OUT_PAGES = ["/login", "/login?error=link"];

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    for (const path of PAGES) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        await page.goto(path);
        await page.locator("h1").first().waitFor();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(
          blocking.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
          })),
        ).toEqual([]);
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme, signed out`, () => {
    test.use({ colorScheme: theme, storageState: { cookies: [], origins: [] } });

    for (const path of SIGNED_OUT_PAGES) {
      test(`${path} has no serious or critical axe violations`, async ({ page }) => {
        await page.goto(path);
        await page.locator("h1").first().waitFor();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(blocking.map((v) => ({ id: v.id, impact: v.impact, help: v.help }))).toEqual([]);
      });
    }
  });
}

test("keyboard users can skip to the main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow checked on desktop");
  await page.goto(orgPath("/dashboard"));
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("every theme colour keeps text readable, in light and dark (D-027)", async ({ page, isMobile }) => {
  test.skip(isMobile, "colours checked once, on desktop");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(orgPath("/settings"));
    await page.locator("h1").first().waitFor();
    for (const accent of ["green", "teal", "blue", "violet", "pink", "slate"]) {
      await page.evaluate((a) => (document.documentElement.dataset.accent = a), accent);
      const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(results.violations.map((v) => `${accent}/${colorScheme}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
  }
});
