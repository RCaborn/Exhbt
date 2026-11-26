import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { decidePortfolio, DEFAULT_PORTFOLIO, isPortfolioKind, PORTFOLIO_KIND_COOKIE, PORTFOLIO_OWN_COOKIE, portfolioForEveryone, type PortfolioFacts, type PortfolioKind } from "../lib/portfolio-kind";

// The switch for portfolio first (decision 0031, "The switch"): "steps" is today's app for everyone, "page"
// is the one-page editor and the new structure. Nothing of the new structure exists yet but the nav and
// the landings after sign-in, so this spec tests the switch itself, twice:
//  - directly: the rule (lib/portfolio-kind.ts), run here as production runs it;
//  - in the browser: through /dev/portfolio-kind?kind=, a development-only cookie that stands in for the
//    runtime variable EXHBT_PORTFOLIO for one browser ("page", "steps", or "default" for not set), the
//    admin's own route (POST /api/portfolio/editor) and /api/health.
// The test server is started without EXHBT_PORTFOLIO, so the default decides unless a test says otherwise.
// Each browser test signs in with /auth/dev, and /dev/admin?role=admin makes that person an admin, as
// e2e/admin.spec.ts and e2e/editor-admin-switch.spec.ts do.

/**
 * The default the live site ships with. This is the one line that pins it, so that a merge cannot switch
 * portfolio first on for everyone unseen. When DEFAULT_PORTFOLIO in lib/portfolio-kind.ts becomes "page"
 * (the switch-on), change this to "page" in the same commit. Switching on with the variable
 * (EXHBT_PORTFOLIO=page) needs neither change.
 */
const SHIPPED_DEFAULT: PortfolioKind = "steps";

const other = (kind: PortfolioKind): PortfolioKind => (kind === "page" ? "steps" : "page");

type Variable = PortfolioKind | "default";

const uniqueEmail = (tag: string) => `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`;

/** Sets what EXHBT_PORTFOLIO says for this browser; returns what the cookie route answered (it redirects to /portfolio). */
async function sayVariable(page: Page, variable: Variable) {
  return page.request.get(`/dev/portfolio-kind?kind=${variable}`, { maxRedirects: 0 });
}

/** What /api/health says an ordinary person gets. It is the cut-down answer, so it needs no database. */
const healthSays = async (request: APIRequestContext) => ((await (await request.get("/api/health?only=portfolio")).json()) as { portfolio: string }).portfolio;

async function signIn(page: Page, tag: string, opts: { admin?: boolean } = {}) {
  await page.goto(`/auth/dev?email=${uniqueEmail(tag)}&next=/roadmap`);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  if (opts.admin) await admin(page, true);
}

/** Makes the signed-in person an admin, or takes it back (the stand-in for profiles.role). */
async function admin(page: Page, on: boolean) {
  expect((await page.request.get(`/dev/admin?role=${on ? "admin" : "user"}`)).status()).toBe(200);
}

/** The labels of the signed-in nav, in order, as the header draws them on a desktop screen. */
async function navLabels(page: Page): Promise<string[]> {
  await page.goto("/roadmap");
  return page.getByRole("navigation", { name: "Main" }).getByRole("link").allInnerTexts();
}

const STEPS_NAV = ["Roadmaps", "Your exhbts", "Portfolio"];
const PAGE_NAV = ["Your portfolio", "Roadmaps"];
const navFor = (kind: PortfolioKind) => (kind === "page" ? PAGE_NAV : STEPS_NAV);

const ownCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === PORTFOLIO_OWN_COOKIE);

test.describe("the rule that decides, run directly, as the live site runs it", () => {
  /** The live site: production, and no development cookie counts. */
  const live = (facts: Partial<PortfolioFacts> = {}) => decidePortfolio({ variable: undefined, production: true, ...facts });

  test("the default is the one pinned here: today's app until portfolio first is switched on", () => {
    expect(DEFAULT_PORTFOLIO, "DEFAULT_PORTFOLIO in lib/portfolio-kind.ts has changed. If this is the switch-on, change SHIPPED_DEFAULT at the top of this file to match; if not, change it back.").toBe(SHIPPED_DEFAULT);
  });

  test("with EXHBT_PORTFOLIO not set, or set to anything but page or steps, everyone gets the default", () => {
    for (const variable of [undefined, "", "Page", "STEPS", " page", "steps ", "1", "on", "new", "default", "classic"]) {
      expect(live({ variable }), `EXHBT_PORTFOLIO=${JSON.stringify(variable)}`).toBe(DEFAULT_PORTFOLIO);
      expect(portfolioForEveryone({ variable, production: true })).toBe(DEFAULT_PORTFOLIO);
    }
  });

  test("EXHBT_PORTFOLIO overrides the default for everyone, both ways", () => {
    expect(live({ variable: "page" })).toBe("page");
    expect(live({ variable: "steps" })).toBe("steps");
    expect(live({ variable: other(DEFAULT_PORTFOLIO) })).toBe(other(DEFAULT_PORTFOLIO));
  });

  test("an admin's own choice wins over the default and over EXHBT_PORTFOLIO", () => {
    for (const variable of [undefined, "page", "steps", "nonsense"]) {
      expect(live({ variable, admin: true, own: "page" }), `EXHBT_PORTFOLIO=${variable}`).toBe("page");
      expect(live({ variable, admin: true, own: "steps" }), `EXHBT_PORTFOLIO=${variable}`).toBe("steps");
    }
  });

  test("the same cookie from a person who is not an admin counts for nothing", () => {
    for (const variable of [undefined, "page", "steps"]) {
      const everyone = portfolioForEveryone({ variable, production: true });
      for (const own of ["page", "steps"]) {
        expect(live({ variable, admin: false, own }), `EXHBT_PORTFOLIO=${variable}, cookie ${own}`).toBe(everyone);
        expect(live({ variable, own }), `EXHBT_PORTFOLIO=${variable}, cookie ${own}, nobody checked`).toBe(everyone);
      }
    }
  });

  test("an admin with no choice, or a cookie that says neither, gets what everyone gets", () => {
    for (const own of [undefined, "", "new", "Page", "default", "classic"]) {
      expect(live({ admin: true, own })).toBe(DEFAULT_PORTFOLIO);
      expect(live({ variable: "page", admin: true, own })).toBe("page");
      expect(live({ variable: "steps", admin: true, own })).toBe("steps");
    }
  });

  test("what /api/health reports never follows an admin's own choice", () => {
    expect(portfolioForEveryone({ variable: undefined, production: true, admin: true, own: other(DEFAULT_PORTFOLIO) })).toBe(DEFAULT_PORTFOLIO);
    expect(portfolioForEveryone({ variable: "steps", production: true, admin: true, own: "page" })).toBe("steps");
    expect(portfolioForEveryone({ variable: "page", production: true, admin: true, own: "steps" })).toBe("page");
  });

  test("every combination of variable, setting, development cookie and admin's choice gives a kind, and only the right facts count", () => {
    const variables = [undefined, "page", "steps", "rubbish"];
    const devCookies = [undefined, "page", "steps", "default", "rubbish"];
    const owns = [undefined, "page", "steps", "rubbish"];
    for (const variable of variables)
      for (const production of [true, false])
        for (const devCookie of devCookies)
          for (const adminNow of [undefined, true, false])
            for (const own of owns) {
              const facts: PortfolioFacts = { variable, production, devCookie, admin: adminNow, own };
              const said = !production && (isPortfolioKind(devCookie) || devCookie === "default") ? devCookie : variable;
              const everyone = isPortfolioKind(said) ? said : DEFAULT_PORTFOLIO;
              expect(portfolioForEveryone(facts), JSON.stringify(facts)).toBe(everyone);
              const mine = adminNow && isPortfolioKind(own) ? own : everyone;
              expect(decidePortfolio(facts), JSON.stringify(facts)).toBe(mine);
            }
  });

  test("the development cookie is never read on the live site; in development it stands in for the variable, under an admin's choice", () => {
    for (const devCookie of ["page", "steps", "default"]) {
      expect(live({ devCookie })).toBe(DEFAULT_PORTFOLIO);
      expect(live({ variable: "steps", devCookie })).toBe("steps");
      expect(live({ variable: "page", devCookie })).toBe("page");
    }
    const dev = (facts: Partial<PortfolioFacts>) => decidePortfolio({ variable: "page", production: false, ...facts });
    expect(dev({})).toBe("page");
    expect(dev({ devCookie: "steps" })).toBe("steps");
    expect(dev({ devCookie: "page" })).toBe("page");
    expect(dev({ devCookie: "default" })).toBe(DEFAULT_PORTFOLIO);
    // A cookie that says none of the three leaves the variable in charge.
    expect(dev({ devCookie: "nonsense" })).toBe("page");
    expect(dev({ devCookie: "steps", admin: true, own: "page" })).toBe("page");
    expect(dev({ devCookie: "page", admin: true, own: "steps" })).toBe("steps");
    expect(dev({ devCookie: "steps", admin: false, own: "page" })).toBe("steps");
  });
});

test.describe("in the browser", () => {
  test("with nothing set, a person gets the default, and /api/health says the same", async ({ page }) => {
    await signIn(page, "unset");
    expect((await sayVariable(page, "default")).status()).toBe(307);
    expect(await healthSays(page.request)).toBe(SHIPPED_DEFAULT);
    expect(await navLabels(page)).toEqual(navFor(SHIPPED_DEFAULT));
  });

  test("the development cookie stands in for the variable, both ways, per browser, and /api/health follows", async ({ page, browser }) => {
    await signIn(page, "dev");
    for (const kind of ["page", "steps"] as const) {
      const res = await sayVariable(page, kind);
      expect(res.status()).toBe(307);
      expect(new URL(res.headers()["location"]!, "http://localhost").pathname).toBe("/portfolio");
      expect(await healthSays(page.request)).toBe(kind);
      expect(await navLabels(page)).toEqual(navFor(kind));
    }
    // "default" is the variable not set.
    await sayVariable(page, other(SHIPPED_DEFAULT));
    await sayVariable(page, "default");
    expect(await healthSays(page.request)).toBe(SHIPPED_DEFAULT);
    // A word that is none of them is refused and changes nothing.
    await sayVariable(page, "page");
    expect((await page.request.get("/dev/portfolio-kind?kind=rubbish", { maxRedirects: 0 })).status()).toBe(400);
    expect(await healthSays(page.request)).toBe("page");
    // Another browser is not affected.
    const fresh = await browser.newContext();
    try {
      expect(await healthSays(fresh.request)).toBe(SHIPPED_DEFAULT);
    } finally {
      await fresh.close();
    }
  });

  test("the choice is stored only for an admin: anyone else's request is not found and leaves no cookie", async ({ page, request }) => {
    // Nobody signed in.
    const out = await request.post("/api/portfolio/editor", { form: { kind: "page" }, maxRedirects: 0 });
    expect(out.status()).toBe(404);
    expect(out.headers()["set-cookie"] ?? "").not.toContain(PORTFOLIO_OWN_COOKIE);

    // Signed in, and not an admin.
    await signIn(page, "refused");
    const refused = await page.request.post("/api/portfolio/editor", { form: { kind: "page" }, maxRedirects: 0 });
    expect(refused.status()).toBe(404);
    expect(refused.headers()["set-cookie"] ?? "").not.toContain(PORTFOLIO_OWN_COOKIE);
    expect(await ownCookie(page)).toBeUndefined();

    // An admin: stored for a year, out of reach of the page's scripts, and sent to /portfolio.
    await admin(page, true);
    const stored = await page.request.post("/api/portfolio/editor", { form: { kind: "page" }, maxRedirects: 0 });
    expect(stored.status()).toBe(303);
    expect(new URL(stored.headers()["location"]!, "http://localhost").pathname).toBe("/portfolio");
    const cookie = await ownCookie(page);
    expect(cookie).toMatchObject({ value: "page", httpOnly: true, sameSite: "Lax", path: "/" });
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(360 * 24 * 60 * 60);

    // Something that is neither kind is refused, and the cookie stays as it was.
    const bad = await page.request.post("/api/portfolio/editor", { form: { kind: "classic" }, maxRedirects: 0 });
    expect(bad.status()).toBe(400);
    expect((await ownCookie(page))?.value).toBe("page");
  });

  test("an admin's own choice shows in their nav and nowhere else; /api/health never follows it", async ({ page }) => {
    await signIn(page, "own", { admin: true });
    await sayVariable(page, "default");
    expect(await navLabels(page)).toEqual(navFor(SHIPPED_DEFAULT));
    for (const kind of ["page", "steps"] as const) {
      expect((await page.request.post("/api/portfolio/editor", { form: { kind }, maxRedirects: 0 })).status()).toBe(303);
      expect(await navLabels(page), `own choice ${kind}`).toEqual(navFor(kind));
      expect(await healthSays(page.request)).toBe(SHIPPED_DEFAULT);
    }
  });

  test("it is checked on every request: a person who stops being an admin gets what everyone gets, with the same cookie in the browser", async ({ page }) => {
    await signIn(page, "demoted", { admin: true });
    await sayVariable(page, "default");
    const mine = other(SHIPPED_DEFAULT);
    expect((await page.request.post("/api/portfolio/editor", { form: { kind: mine }, maxRedirects: 0 })).status()).toBe(303);
    expect(await navLabels(page)).toEqual(navFor(mine));

    await admin(page, false);
    expect((await ownCookie(page))?.value).toBe(mine);
    expect(await navLabels(page)).toEqual(navFor(SHIPPED_DEFAULT));

    await admin(page, true);
    expect(await navLabels(page)).toEqual(navFor(mine));
  });

  test("the same cookie put in the browser by hand by someone who is not an admin counts for nothing", async ({ page, baseURL }) => {
    await signIn(page, "hand");
    await sayVariable(page, "default");
    await page.context().addCookies([{ name: PORTFOLIO_OWN_COOKIE, value: other(SHIPPED_DEFAULT), url: baseURL! }]);
    expect(await navLabels(page)).toEqual(navFor(SHIPPED_DEFAULT));
  });

  test("the dev cookie's name is the one the rule reads", async ({ page }) => {
    await signIn(page, "name");
    await sayVariable(page, "page");
    expect((await page.context().cookies()).find((c) => c.name === PORTFOLIO_KIND_COOKIE)?.value).toBe("page");
  });
});
