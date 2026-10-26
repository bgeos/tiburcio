import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/support/users";

// Local Supabase URL and keys for the auth setup (see README, Local database).
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E smoke tests run against a production build (`next build && next start`)
 * so they exercise the same output that is deployed. They need the local
 * Supabase stack (`npm run db:start`): `auth.setup.ts` signs in a fictional
 * user once, and every other test reuses that session.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // One local server and database serve every worker: with more than 4, saves in the
  // multi-step journeys queue for over 10 s. CI keeps Playwright's default (half the cores).
  workers: process.env.CI ? undefined : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Navigations to data pages can take a few seconds while every worker and the
  // server are busy (and longer on CI runners); 5 s (the default) is too tight.
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    { name: "mobile", use: { ...devices["Pixel 7"], storageState: STORAGE_STATE }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    // Links in invitation emails must point at this test server, not the dev server.
    env: { NEXT_PUBLIC_SITE_URL: BASE_URL },
    timeout: 300_000,
  },
});
