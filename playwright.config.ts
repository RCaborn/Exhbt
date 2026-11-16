import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets several suites run side by side (parallel agents, worktrees).
const PORT = Number(process.env.E2E_PORT) || 3200;

/**
 * End-to-end tests run against the dev server with no external services:
 * in-memory store, placeholder AI roadmap, and the dev email outbox.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // In environments with a preinstalled Chromium (e.g. Claude Code cloud), point at it.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    // A fresh server per run: the in-memory store (and its rate limits) starts empty.
    reuseExistingServer: false,
    // The suite builds many roadmaps from one address, more than the production per-connection cap.
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-e2e", EXHBT_PER_IP_PER_DAY: "100", EXHBT_LOGINS_PER_HOUR: "100",
      STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_PREMIUM: "price_test_premium", STRIPE_PRICE_MAX: "price_test_max",
      // "Use a link" on job links may read this server's own /dev/listing page (never in production).
      EXHBT_LISTING_TEST_ORIGIN: `http://localhost:${PORT}` },
  },
});
