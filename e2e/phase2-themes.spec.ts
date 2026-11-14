import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { ENTITLEMENTS } from "../lib/entitlements";
import { canUseTheme } from "../lib/plan-rules";
import { contrastRatio, DEFAULT_THEME, PORTFOLIO_THEMES, textPairs, themeAllowance, themeById, themeFor } from "../lib/portfolio-themes";

// Portfolio looks (decision 0012): the library, who gets which, choosing one on the settings page,
// and how it shows on the public portfolio. Counts come from lib/entitlements.ts.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const stamp = () => Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);

// Must match the webServer env in playwright.config.ts.
const SECRET = "whsec_test";
const PRICES = { premium: "price_test_premium", max: "price_test_max" } as const;

const rgb = (hex: string) => {
  const n = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${n(0)}, ${n(1)}, ${n(2)})`;
};

test.describe("The library of looks", () => {
  test("every text on every band reaches WCAG AA", () => {
    for (const t of PORTFOLIO_THEMES) {
      for (const p of textPairs(t)) {
        expect(contrastRatio(p.fg, p.bg), `${t.name}: ${p.label} (${p.fg} on ${p.bg})`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("the contrast maths agrees with known values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#00755d")).toBeGreaterThan(5.5);
    expect(contrastRatio("#ffffff", "#4fe9b4")).toBeLessThan(2); // why mint takes ink text
  });

  test("ids are unique, the default is first, and colours stay on the kit", () => {
    const ids = PORTFOLIO_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_THEME).toBe(PORTFOLIO_THEMES[0]);
    expect(PORTFOLIO_THEMES.length).toBeGreaterThanOrEqual(10);
    expect(PORTFOLIO_THEMES.length).toBeLessThanOrEqual(20);
    const kit = new Set(["#0e0f12", "#ffffff", "#4fe9b4", "#00755d", "#00513f", "#f6f7f8", "#e3fcf0", "#3e4044", "#c9cbcf"]);
    for (const t of PORTFOLIO_THEMES) for (const c of [t.bg, t.text, t.soft, t.accent, t.initials.bg, t.initials.text]) expect(kit.has(c), `${t.name} uses ${c}`).toBe(true);
  });

  test("plans get their share of the list, and a plan the choice is not on shows the default", () => {
    expect(themeAllowance("free")).toBe(1);
    expect(themeAllowance("premium")).toBe(ENTITLEMENTS.premium.portfolioThemes);
    expect(themeAllowance("max")).toBe(PORTFOLIO_THEMES.length);
    expect(themeAllowance("institutional")).toBe(PORTFOLIO_THEMES.length);

    const premiumLook = PORTFOLIO_THEMES[themeAllowance("premium") - 1]!;
    const maxOnly = PORTFOLIO_THEMES[themeAllowance("premium")]!;
    expect(themeFor({ themeId: premiumLook.id }, "premium")).toBe(premiumLook);
    expect(themeFor({ themeId: maxOnly.id }, "premium")).toBe(DEFAULT_THEME);
    expect(themeFor({ themeId: maxOnly.id }, "max")).toBe(maxOnly);
    expect(themeFor({ themeId: maxOnly.id }, "free")).toBe(DEFAULT_THEME);
    expect(themeFor({ themeId: null }, "max")).toBe(DEFAULT_THEME);
    expect(themeFor({ themeId: "gone" }, "max")).toBe(DEFAULT_THEME);

    expect(canUseTheme("premium", maxOnly)).toMatchObject({ ok: false, upgradeTo: "max" });
    expect(canUseTheme("free", premiumLook)).toMatchObject({ ok: false, upgradeTo: "premium" });
    expect(canUseTheme("max", maxOnly).ok).toBe(true);
  });
});

/** A hand-built subscription event for the plan behind `price`. */
function subscriptionEvent(type: string, userId: string, status: string, plan: keyof typeof PRICES) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    id: `evt_${type}_${userId}_${plan}_${now}`,
    object: "event",
    type,
    created: now,
    data: {
      object: {
        id: `sub_${userId}`,
        object: "subscription",
        customer: `cus_${userId}`,
        status,
        metadata: { user_id: userId, plan },
        items: { object: "list", data: [{ id: "si_test", price: { id: PRICES[plan] }, current_period_end: now + 30 * 86_400 }] },
      },
    },
  });
}

async function setSubscription(request: APIRequestContext, userId: string, plan: keyof typeof PRICES) {
  const payload = subscriptionEvent("customer.subscription.updated", userId, "active", plan);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res = await request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
  expect(res.status()).toBe(200);
}

/** Seeds a fictional portfolio and signs in as its owner, on the portfolio settings page. */
async function openSettings(page: Page, username: string, plan: string) {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=/account/portfolio`);
  await expect(page.getByRole("heading", { level: 1, name: "Portfolio settings" })).toBeVisible();
  await expect(page.locator("form[data-ready=true] [data-testid=theme-preview]")).toBeAttached();
}

const option = (page: Page, id: string) => page.locator(`[data-theme-option="${id}"]`);
const preview = (page: Page) => page.getByTestId("theme-preview");

async function chooseAndSave(page: Page, id: string) {
  await option(page, id).click();
  await expect(preview(page)).toHaveAttribute("data-preview-theme", id);
  await page.getByRole("button", { name: "Save look" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
}

/** The band on the public portfolio: its data attribute and its background colour. */
async function band(page: Page, username: string) {
  await page.goto(`/p/${username}`);
  const header = page.locator("header[data-theme]");
  await expect(header).toBeVisible();
  const bg = await header.locator("> div").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  return { id: await header.getAttribute("data-theme"), bg };
}

test.describe("Portfolio looks (Phase 2)", () => {
  test("Premium: the plan's looks are open, the rest are locked, and a choice shows on the portfolio", async ({ page }) => {
    const username = `thp${stamp()}`;
    await openSettings(page, username, "premium");

    const open = themeAllowance("premium");
    await expect(page.getByRole("radio")).toHaveCount(PORTFOLIO_THEMES.length);
    await expect(page.locator("[data-theme-option]:not([data-locked])")).toHaveCount(open);
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(PORTFOLIO_THEMES.length - open);
    // Locked looks say so to a screen reader, and the default is what is shown first.
    await expect(preview(page)).toHaveAttribute("data-preview-theme", DEFAULT_THEME.id);
    const lockedId = PORTFOLIO_THEMES[open]!.id;
    await expect(option(page, lockedId)).toContainText("locked");

    // A locked look previews but can't be saved: the upgrade offer replaces the save button.
    await option(page, lockedId).click();
    await expect(preview(page)).toHaveAttribute("data-preview-theme", lockedId);
    await expect(page.getByTestId("upgrade-prompt")).toContainText("Max");
    await expect(page.getByRole("button", { name: "Save look" })).toHaveCount(0);

    // An open look saves, and the portfolio's band changes to it.
    const jade = themeById("jade")!;
    await chooseAndSave(page, jade.id);
    expect(await band(page, username)).toEqual({ id: jade.id, bg: rgb(jade.bg) });

    await page.goto("/account/portfolio");
    await expect(page.getByRole("radio", { name: /^Jade/ })).toBeChecked();
    await expect(preview(page)).toHaveAttribute("data-preview-theme", jade.id);
  });

  test("the radios work from the keyboard", async ({ page }) => {
    await openSettings(page, `thk${stamp()}`, "premium");
    await page.getByRole("radio", { name: /^Ink/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /^Jade/ })).toBeFocused();
    await expect(page.getByRole("radio", { name: /^Jade/ })).toBeChecked();
    await expect(preview(page)).toHaveAttribute("data-preview-theme", "jade");
  });

  test("Max can pick a Max-only look, and the heading face and photo shape follow it", async ({ page }) => {
    const username = `thm${stamp()}`;
    await openSettings(page, username, "max");
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(0);

    const maxOnly = PORTFOLIO_THEMES[themeAllowance("premium")]!;
    await chooseAndSave(page, maxOnly.id);
    expect(await band(page, username)).toEqual({ id: maxOnly.id, bg: rgb(maxOnly.bg) });
    const radius = await page.locator("header [data-avatar]").first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    if (maxOnly.photo === "round") expect(radius).toBeGreaterThan(1000);
    else expect(radius).toBeLessThan(40);

    // A project page takes the look's heading face through --font-display.
    await page.getByRole("link", { name: /GP|reminder/i }).first().click();
    await page.waitForURL(/\/p\/[^/]+\/[^/]+$/);
    await expect(page.locator(`div[data-theme="${maxOnly.id}"]`)).toBeVisible();
    const h1Font = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
    if (maxOnly.face !== "bricolage") expect(h1Font).not.toContain("Bricolage");
  });

  test("a downgrade shows the default and keeps the choice; upgrading again restores it", async ({ page, request }) => {
    const username = `thd${stamp()}`;
    const userId = `dev-${username}@example.com`;
    const maxOnly = PORTFOLIO_THEMES[themeAllowance("premium")]!;

    // No plan override here: the plan follows the (signed) Stripe webhook.
    const seeded = await page.request.get(`/dev/portfolio?username=${username}&plan=subscription`, { maxRedirects: 0 });
    expect(seeded.status()).toBe(307);
    await setSubscription(request, userId, "max");
    await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=/account/portfolio`);
    await expect(page.locator("form[data-ready=true] [data-testid=theme-preview]")).toBeAttached();
    await chooseAndSave(page, maxOnly.id);
    expect((await band(page, username)).id).toBe(maxOnly.id);

    await setSubscription(request, userId, "premium");
    expect(await band(page, username)).toEqual({ id: DEFAULT_THEME.id, bg: rgb(DEFAULT_THEME.bg) });
    await page.goto("/account/portfolio");
    await expect(page.getByTestId("look-held")).toContainText(maxOnly.name);
    await expect(preview(page)).toHaveAttribute("data-preview-theme", DEFAULT_THEME.id);
    await expect(option(page, maxOnly.id)).toHaveAttribute("data-locked", "true");

    await setSubscription(request, userId, "max");
    expect(await band(page, username)).toEqual({ id: maxOnly.id, bg: rgb(maxOnly.bg) });
    await page.goto("/account/portfolio");
    await expect(page.getByTestId("look-held")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: new RegExp(`^${maxOnly.name}`) })).toBeChecked();
  });

  test("the saving is checked on the server: a look the plan doesn't have is refused", async ({ page }) => {
    // The picker hides Save on a locked look, so submit the form by hand to test the action.
    await openSettings(page, `thr${stamp()}`, "premium");
    const maxOnly = PORTFOLIO_THEMES[themeAllowance("premium")]!;
    await option(page, maxOnly.id).click();
    await page.evaluate(() => document.querySelector<HTMLFormElement>("form[data-ready=true]")!.requestSubmit());
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toHaveCount(0);
    await page.goto("/account/portfolio");
    await expect(preview(page)).toHaveAttribute("data-preview-theme", DEFAULT_THEME.id);
  });

  test("axe passes on the settings page and on the portfolio in several looks", async ({ page }) => {
    const username = `tha${stamp()}`;
    await openSettings(page, username, "max");
    const settings = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(settings.violations, JSON.stringify(settings.violations.map((v) => v.id))).toEqual([]);

    // One of each kind: a light ground, the mint ground, a deep jade ground, and a serif face.
    for (const id of ["paper", "mint", "deep-jade", "folio"]) {
      await chooseAndSave(page, id);
      await page.goto(`/p/${username}`);
      await expect(page.locator(`header[data-theme="${id}"]`)).toBeVisible();
      const res = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(res.violations, `${id}: ${JSON.stringify(res.violations.map((v) => v.id))}`).toEqual([]);
      await page.goto("/account/portfolio");
      await expect(page.locator("form[data-ready=true] [data-testid=theme-preview]")).toBeAttached();
    }
  });
});
