import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

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
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-e2e" },
  },
});
