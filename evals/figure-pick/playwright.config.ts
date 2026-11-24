import { defineConfig, devices } from "@playwright/test";

/**
 * The figure eval's own Playwright set-up (evals/figure-pick/README.md). Not part of the e2e
 * suite: `npm run test:e2e` never runs it, because every real run makes paid API calls. Start it
 * with `npm run eval:figures` (scripts/eval-figures.ts), which sets the mode and the run folder.
 *
 * It starts the app in development, as the e2e suite does, with whatever API key the environment
 * holds. With a key, /api/exhbts/figure-pick calls the real model; without one, its stand-in.
 */
const PORT = Number(process.env.FIGURE_EVAL_PORT) || Number(process.env.E2E_PORT) || 3213;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.eval\.ts$/,
  // One model call, at most 30 page images, and pages compiled for the first time in dev.
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Always the plain list: the eval's own lines are printed by scripts/eval-figures.ts.
  reporter: "list",
  outputDir: "runs/.playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "eval", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    cwd: "../..",
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    // Its own build folder, so it never trips over a dev server or an e2e run in the same checkout.
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-eval-figures", EXHBT_LOGINS_PER_HOUR: "1000" },
  },
});
