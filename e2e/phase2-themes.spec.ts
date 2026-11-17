import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { ENTITLEMENTS, planFeatures } from "../lib/entitlements";
import { canUseTheme } from "../lib/plan-rules";
import {
  ALL_THEMES,
  DEFAULT_THEME,
  LEGACY_IDS,
  PORTFOLIO_THEMES,
  themeAllowance,
  themeAllowedOn,
  themeById,
  themeFor,
  variantsOf,
} from "../lib/portfolio-themes";

// Portfolio looks (decision 0018, Rory's spec pages 3 and 4): the eight looks, who gets which, the
// ids saved before them, choosing one (and a colourway) in the builder, and how it shows on the
// public pages. Counts come from lib/entitlements.ts. The contrast of every look, axe on both pages
// in every look, and the fonts each page loads are in e2e/phase2-looks.spec.ts.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const stamp = () => Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);

// Must match the webServer env in playwright.config.ts.
const SECRET = "whsec_test";
const PRICES = { premium: "price_test_premium", max: "price_test_max" } as const;

/** Every id decision 0012's sixteen looks (and the Exhbt look) could have saved. */
const OLD_IDS = ["exhbt", "ink", "jade", "mint", "paper", "mist", "night", "deep-jade", "pine", "editorial", "folio", "meadow", "fresh", "studio", "circuit", "drift", "chalk"];

test.describe("The eight looks", () => {
  test("Rory's eight, in plan order, the default first, with their colourways", () => {
    expect(PORTFOLIO_THEMES.map((t) => t.name)).toEqual(["Exhbt", "Classic professional", "Notebook", "Mono", "Night", "Studio", "Ledger", "Bloom"]);
    expect(DEFAULT_THEME.id).toBe("exhbt");
    expect(variantsOf("classic").map((t) => t.variant?.name)).toEqual(["Deep green", "Burgundy", "Black", "Ochre"]);
    expect(variantsOf("studio")).toHaveLength(5);
    expect(variantsOf("bloom")).toHaveLength(4);
    const ids = ALL_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Stored ids fit the column (profiles.portfolio_theme, 40 characters).
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(40);
  });

  test("every old saved id shows the nearest new look; anything else shows the default", () => {
    for (const id of OLD_IDS) expect(themeById(id), id).toBeDefined();
    expect(Object.keys(LEGACY_IDS).every((id) => !PORTFOLIO_THEMES.some((t) => t.id === id))).toBe(true);
    expect(themeById("ink")!.id).toBe("night");
    expect(themeById("editorial")!.id).toBe("classic");
    expect(themeById("deep-jade")!.look).toBe("ledger");
    expect(themeById("gone")).toBeUndefined();
    expect(themeFor({ themeId: "gone" }, "max")).toBe(DEFAULT_THEME);
    expect(themeFor({ themeId: "ink" }, "max").id).toBe("night");
  });

  test("Free has Exhbt; Premium Exhbt, Classic professional, Notebook and Mono; Max all eight", () => {
    const open = (plan: "free" | "premium" | "max") => PORTFOLIO_THEMES.filter((t) => themeAllowedOn(plan, t)).map((t) => t.look);
    expect(open("free")).toEqual(["exhbt"]);
    expect(open("premium")).toEqual(["exhbt", "classic", "notebook", "mono"]);
    expect(open("max")).toEqual(PORTFOLIO_THEMES.map((t) => t.look));
    expect(themeAllowance("premium")).toBe(ENTITLEMENTS.premium.portfolioThemes);
    expect(themeAllowance("institutional")).toBe(PORTFOLIO_THEMES.length);
    // A look's colourways come with it.
    expect(themeAllowedOn("premium", themeById("classic-burgundy")!)).toBe(true);
    expect(themeAllowedOn("premium", themeById("studio-pink")!)).toBe(false);

    const night = themeById("night")!;
    expect(themeFor({ themeId: "mono" }, "premium").id).toBe("mono");
    expect(themeFor({ themeId: "night" }, "premium")).toBe(DEFAULT_THEME);
    expect(themeFor({ themeId: "night" }, "max")).toBe(night);
    expect(themeFor({ themeId: "classic-ochre" }, "free")).toBe(DEFAULT_THEME);
    expect(themeFor({ themeId: null }, "max")).toBe(DEFAULT_THEME);

    expect(canUseTheme("premium", night)).toMatchObject({ ok: false, upgradeTo: "max" });
    expect(canUseTheme("free", themeById("classic")!)).toMatchObject({ ok: false, upgradeTo: "premium" });
    expect(canUseTheme("max", night).ok).toBe(true);
  });

  test("the pricing lines read the figure, not a typed count", () => {
    expect(planFeatures("premium")).toContain(`${ENTITLEMENTS.premium.portfolioThemes} portfolio looks to choose from`);
    expect(planFeatures("max")).toContain("Every portfolio look, in every colour");
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

/** Seeds a fictional portfolio and signs in as its owner, on the builder's look step. */
async function openSettings(page: Page, username: string, plan: string) {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=${encodeURIComponent("/portfolio?step=look")}`);
  await openLook(page);
}

async function openLook(page: Page) {
  if (!page.url().includes("step=look")) await page.goto("/portfolio?step=look");
  await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
  await expect(page.locator("[data-ready=true] [data-testid=preview]")).toBeAttached();
}

const option = (page: Page, id: string) => page.locator(`[data-theme-option="${id}"]`);
const swatch = (page: Page, id: string) => page.locator(`[data-variant-option="${id}"]`);
/** The page in the builder's live preview. */
const preview = (page: Page) => page.locator("[data-testid=preview] [data-portfolio-home]");
const status = (page: Page) => page.getByTestId("save-status");
const lookRadios = (page: Page) => page.locator("input[name=themeId]");

async function chooseAndSave(page: Page, id: string, by: "look" | "swatch" = "look") {
  await (by === "look" ? option(page, id) : swatch(page, id)).click();
  await expect(preview(page)).toHaveAttribute("data-theme", id);
  await expect(status(page)).not.toHaveText("Saved");
  await expect(status(page)).toHaveText("Saved");
}

/** The look on the public portfolio: its stored id and its band colour. */
async function shown(page: Page, username: string) {
  await page.goto(`/p/${username}`);
  const home = page.locator("[data-portfolio-home]");
  await expect(home).toBeVisible();
  const band = await home.evaluate((el) => getComputedStyle(el).getPropertyValue("--band-bg").trim());
  return { id: await home.getAttribute("data-theme"), band };
}

test.describe("Portfolio looks (Phase 2)", () => {
  test("Premium: four looks open, four locked with the plan that opens them, and a choice shows on both pages", async ({ page }) => {
    const username = `thp${stamp()}`;
    await openSettings(page, username, "premium");

    const open = themeAllowance("premium");
    await expect(lookRadios(page)).toHaveCount(PORTFOLIO_THEMES.length);
    await expect(page.locator("[data-theme-option]:not([data-locked])")).toHaveCount(open);
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(PORTFOLIO_THEMES.length - open);
    // Each look is drawn as the person's own page, and a locked one says which plan opens it.
    await expect(page.locator("[data-look-card] [data-portfolio-home]")).toHaveCount(PORTFOLIO_THEMES.length);
    await expect(option(page, "night")).toContainText("Max");
    await expect(option(page, "night")).toContainText("locked");
    await expect(preview(page)).toHaveAttribute("data-theme", DEFAULT_THEME.id);

    // A locked look previews at once but isn't saved: the upgrade offer shows instead.
    await option(page, "night").click();
    await expect(preview(page)).toHaveAttribute("data-theme", "night");
    await expect(page.getByTestId("upgrade-prompt")).toContainText("Max");
    await expect(status(page)).toHaveText("Saved");

    // An open look, in one of its colourways, saves; the portfolio and its exhbts take it.
    await chooseAndSave(page, "classic-burgundy", "swatch");
    expect(await shown(page, username)).toEqual({ id: "classic-burgundy", band: themeById("classic-burgundy")!.palette.band });
    await page.locator("[data-portfolio-home] a", { hasText: "See how I did it" }).first().click();
    await page.waitForURL(/\/p\/[^/]+\/[^/]+$/);
    await expect(page.locator('[data-look="classic"][data-theme="classic-burgundy"]')).toContainText("Portfolio made with");

    await openLook(page);
    await expect(lookRadios(page).and(page.locator("[value=classic-burgundy]"))).toBeChecked();
    await expect(swatch(page, "classic-burgundy").locator("input")).toBeChecked();
  });

  test("the looks work from the keyboard", async ({ page }) => {
    await openSettings(page, `thk${stamp()}`, "premium");
    await page.getByRole("radio", { name: /^Exhbt/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /^Classic professional/ })).toBeFocused();
    await expect(page.getByRole("radio", { name: /^Classic professional/ })).toBeChecked();
    await expect(preview(page)).toHaveAttribute("data-theme", "classic");
  });

  test("Max can pick a Max-only look, and the faces and photo shape follow it", async ({ page }) => {
    const username = `thm${stamp()}`;
    await openSettings(page, username, "max");
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(0);

    await chooseAndSave(page, "studio-pink", "swatch");
    expect((await shown(page, username)).id).toBe("studio-pink");
    // Studio's photo stand-in is its loud block; its name is very heavy.
    const weight = await page.locator("[data-portfolio-home] h1").evaluate((el) => getComputedStyle(el).fontWeight);
    expect(Number(weight)).toBeGreaterThanOrEqual(800);

    await page.locator("[data-portfolio-home] a", { hasText: "See how I did it" }).first().click();
    await page.waitForURL(/\/p\/[^/]+\/[^/]+$/);
    const h1Font = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).not.toContain("Bricolage");
    const radius = await page.locator("article [data-avatar]").first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBe(0);
  });

  test("a downgrade shows the default and keeps the choice; upgrading again restores it", async ({ page, request }) => {
    const username = `thd${stamp()}`;
    const userId = `dev-${username}@example.com`;

    // No plan override here: the plan follows the (signed) Stripe webhook.
    const seeded = await page.request.get(`/dev/portfolio?username=${username}&plan=subscription`, { maxRedirects: 0 });
    expect(seeded.status()).toBe(307);
    await setSubscription(request, userId, "max");
    await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=${encodeURIComponent("/portfolio?step=look")}`);
    await openLook(page);
    await chooseAndSave(page, "night");
    expect((await shown(page, username)).id).toBe("night");

    await setSubscription(request, userId, "premium");
    expect(await shown(page, username)).toEqual({ id: DEFAULT_THEME.id, band: DEFAULT_THEME.palette.band });
    await openLook(page);
    await expect(page.getByTestId("look-held")).toContainText("Night");
    await expect(preview(page)).toHaveAttribute("data-theme", DEFAULT_THEME.id);
    await expect(option(page, "night")).toHaveAttribute("data-locked", "true");

    await setSubscription(request, userId, "max");
    expect((await shown(page, username)).id).toBe("night");
    await openLook(page);
    await expect(page.getByTestId("look-held")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /^Night/ })).toBeChecked();
  });

  test("a look the plan doesn't have is never saved, even after a wait and a reload", async ({ page }) => {
    // The server check itself is canUseTheme in saveBuilderAction (covered by the rule tests above);
    // here the page must not send it.
    const username = `thr${stamp()}`;
    await openSettings(page, username, "premium");
    await swatch(page, "bloom-lavender").click();
    await expect(preview(page)).toHaveAttribute("data-theme", "bloom-lavender");
    await page.waitForTimeout(1500);
    await expect(status(page)).toHaveText("Saved");
    await page.reload();
    await openLook(page);
    await expect(preview(page)).toHaveAttribute("data-theme", DEFAULT_THEME.id);
    expect((await shown(page, username)).id).toBe(DEFAULT_THEME.id);
  });

  test("axe passes on the look step", async ({ page }) => {
    await openSettings(page, `tha${stamp()}`, "premium");
    const res = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(res.violations, JSON.stringify(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`))).toEqual([]);
  });
});
