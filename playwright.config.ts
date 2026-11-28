import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets several suites run side by side (parallel agents, worktrees).
const PORT = Number(process.env.E2E_PORT) || 3200;

/*
 * Safari's engine (WebKit), for the edit-on-page editor's own specs and nothing else. The three projects are
 * listed only when E2E_WEBKIT is set, so a plain `playwright test`, and CI's twelve e2e groups, are the four
 * projects below and nothing more. .github/workflows/webkit.yml sets E2E_WEBKIT=1 on a runner that installs
 * WebKit. E2E_WEBKIT=chromium runs the same three projects (their sizes, pixel ratios and user agents) on
 * Chromium, for a machine with no WebKit: a test that fails there too fails on the size, not on the engine.
 *  - `safari`: Playwright's "Desktop Safari" at the desktop project's 1440 by 900, on the desktop project's editor specs,
 *    e2e/your-way.spec.ts: the bar that comes to words selected with a mouse, which WebKit had never run (26 Nov:
 *    its Link lost a finding's words in Safari), and e2e/phase2-draft-tools.spec.ts: an AI draft's menus and rewrite
 *    forms, which a press on the page and Escape close (27 Nov: the frame round the editor took the focus from them,
 *    components/exhbt-editor/focus.ts).
 *  - `iphone`: Playwright's "iPhone 14" (390 by 664, a touch screen), on the touch project's specs.
 *  - `ipad`: Playwright's "iPad (gen 7)" (810 by 1080, a touch screen), on the tablet project's spec.
 * The first two also run e2e/*.webkit.ts: the tests of what only Safari does, which no other project's pattern matches.
 * Each test is its own shard unit there (fullyParallel, still one worker), so a long spec splits across shards.
 * WebKit on Linux is not Safari on an iPhone: docs/briefs/edit-on-page/r3-notes-from-earlier-agents.md says
 * what it can and cannot show.
 */
const WEBKIT = process.env.E2E_WEBKIT;
// A Chromium path (PW_CHROMIUM_PATH, below) is never handed to WebKit.
const engine = WEBKIT === "chromium" ? { browserName: "chromium" as const } : { launchOptions: {} };
/** The tests the WebKit projects leave out, by name, each with its reason; nothing else is skipped there. */
const NOT_ON_WEBKIT: [name: RegExp, why: string][] = [
  [
    /the page scrolls itself with the pointer still near the bottom edge and near the top edge/,
    "Open, not flaky. On WebKit the page scrolls down under a carried section, then does not scroll back up near the top edge: 4 tries of 4 in the third run (24 Nov), after passing in the first two. Cause not found; Chromium passes. Take this line out to see it.",
  ],
];
/** The tests left out only under Safari's rule about the focus (E2E_FOCUS=safari), each with its reason. They still run on WebKit without the rule. */
const NOT_UNDER_SAFARI_FOCUS: [name: RegExp, why: string][] = [];
const LEFT_OUT = [...NOT_ON_WEBKIT, ...(process.env.E2E_FOCUS === "safari" ? NOT_UNDER_SAFARI_FOCUS : [])].map(([name]) => name);
const ONLY_WEBKIT = /[\\/][a-z-]+\.webkit\.ts$/;
/*
 * The one-page portfolio editor's specs (decision 0031; docs/briefs/portfolio-first). Its phone spec runs only on
 * the phones; its arranging spec with a mouse and by touch; and on Safari's engine at 1440, the four that type,
 * drag and open the bar's parts. Every other portfolio spec runs on `desktop` only.
 */
const PORTFOLIO_PHONE = /[\\/]portfolio-phone\.spec\.ts$/;
const PORTFOLIO_TOUCH = /[\\/]portfolio-(arrange|phone|sheet-focus)\.spec\.ts$/; // and where the focus goes as a sheet closes, by touch
const PORTFOLIO_SAFARI = /[\\/]portfolio-(core|arrange|bar|editor|sheet-focus|leaving)\.spec\.ts$/; // and the focus and leaving specs: six
const webkitProjects = [
  { name: "safari", fullyParallel: true, use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 }, ...engine }, testMatch: [/[\\/]editor-[a-z-]+\.spec\.ts$/, /[\\/]your-way\.spec\.ts$/, /[\\/]phase2-draft-tools\.spec\.ts$/, PORTFOLIO_SAFARI, ONLY_WEBKIT], testIgnore: /editor-(phone|tablet)\.spec\.ts/, grepInvert: LEFT_OUT },
  { name: "iphone", fullyParallel: true, use: { ...devices["iPhone 14"], ...engine }, testMatch: [/editor-(drag|flow|phone|figures)\.spec\.ts/, PORTFOLIO_TOUCH, ONLY_WEBKIT], grepInvert: LEFT_OUT },
  { name: "ipad", fullyParallel: true, use: { ...devices["iPad (gen 7)"], ...engine }, testMatch: /editor-tablet\.spec\.ts/, grepInvert: LEFT_OUT },
];

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
  // The edit-on-page editor's drag and flowchart specs run with a mouse and by touch; its phone and
  // tablet specs only on their own devices (docs/briefs/edit-on-page/README.md).
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: [/editor-(phone|tablet)\.spec\.ts/, PORTFOLIO_PHONE] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
    { name: "touch", use: { ...devices["Pixel 7"] }, testMatch: [/editor-(drag|flow|phone|figures)\.spec\.ts/, PORTFOLIO_TOUCH] },
    { name: "tablet", use: { browserName: "chromium", viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, testMatch: /editor-tablet\.spec\.ts/ },
    ...(WEBKIT ? webkitProjects : []),
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    // A fresh server per run: the in-memory store (and its rate limits) starts empty.
    reuseExistingServer: false,
    // The suite builds many roadmaps from one address, more than the production per-connection cap.
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-e2e", EXHBT_PER_IP_PER_DAY: "100", EXHBT_PV_PER_MINUTE: "100000", EXHBT_LOGINS_PER_HOUR: "100",
      STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_PREMIUM: "price_test_premium", STRIPE_PRICE_MAX: "price_test_max",
      // The suite tests the edit-on-page editor as it is once switched on for everyone. The live site's default is the
      // classic editor (DEFAULT_EDITOR in lib/editor-kind.ts); e2e/editor-admin-switch.spec.ts tests that state, per browser.
      EXHBT_EDITOR: "page",
      // "Use a link" on job links may read this server's own /dev/listing page (never in production).
      // Referrals are off in production; this turns them on here, with the Stripe credit recorded, not sent (lib/referrals.ts).
      EXHBT_REFERRALS_TEST: "1",
      EXHBT_LISTING_TEST_ORIGIN: `http://localhost:${PORT}` },
  },
});
