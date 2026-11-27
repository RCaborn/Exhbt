import { defineConfig, devices } from "@playwright/test";

/*
 * The portfolio editor's Back tests on a production build: `next build`, then `next start`, with the stand-in
 * store and no database (EXHBT_ALLOW_MEMORY_STORE, which matters only when Supabase is not configured; with it,
 * /auth/dev signs a person in as it does in development). Run with:
 *
 *   npx playwright test -c playwright.prod.config.ts
 *
 * It builds first (a few minutes), into `.next`: the development tests' server builds into `.next-e2e`.
 * Only the tests that need nothing of development's run here: no /dev route and no development handle.
 * E2E_PROD tells the e2e helpers (e2e/portfolio-editor.ts) that this is the run.
 */
process.env.E2E_PROD = "1";
const PORT = Number(process.env.E2E_PROD_PORT) || 3210;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /portfolio-core\.spec\.ts$/,
  grep: /with nothing of development's/,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      EXHBT_PHASE2: "1",
      EXHBT_PORTFOLIO: "page",
      EXHBT_ALLOW_MEMORY_STORE: "1",
      // A secret for this run's cookies only: production refuses to start without one.
      EXHBT_COOKIE_SECRET: "e2e-production-run-only-not-a-real-secret-0123456789",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_PRICE_PREMIUM: "price_test_premium",
      STRIPE_PRICE_MAX: "price_test_max",
    },
  },
});
