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
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
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
    timeout: 300_000,
  },
});
