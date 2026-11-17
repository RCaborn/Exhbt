import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { ALL_THEMES, contrastPairs, contrastRatio, FONTS, PORTFOLIO_THEMES, themeById, type FontKey, type PortfolioTheme } from "../lib/portfolio-themes";

// The portfolio looks on the pages themselves (decision 0018): every look's colours checked from its
// definition, axe on the portfolio home and an exhbt page in every look, only the look's own faces
// fetched, a dark look's graphs drawn on its own card, paper for print, and real-world content.
// Portfolios are seeded by app/dev/portfolio (`look=`, `rich=1`, `name=`, `graphs=none`).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PIXEL_7 = { viewport: devices["Pixel 7"].viewport, deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor, isMobile: true, hasTouch: true };
const stamp = () => Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 100);

const rgb = (hex: string) => {
  const n = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${n(0)}, ${n(1)}, ${n(2)})`;
};

/** A fictional Max portfolio in a look, with everything filled in and the open-banking exhbt. */
async function seed(page: Page, look: string, extra = "") {
  const username = `lk${look.replace(/[^a-z]/g, "").slice(0, 8)}${stamp()}`;
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=max&look=${look}&rich=1&with=open-banking${extra}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  return username;
}

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("Every look's colours", () => {
  test("every pairing in every look and colourway reaches its contrast, worked out from the definitions", () => {
    const failures: string[] = [];
    for (const t of ALL_THEMES) {
      for (const p of contrastPairs(t)) {
        const r = contrastRatio(p.fg, p.bg);
        if (r < p.min) failures.push(`${t.id}: ${p.label} (${p.fg} on ${p.bg}) is ${r.toFixed(2)}, needs ${p.min}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the contrast maths agrees with known values, and every colour is an opaque hex the maths can read", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#00755d")).toBeGreaterThan(5.5);
    expect(contrastRatio("#ffffff", "#4fe9b4")).toBeLessThan(2); // why mint takes ink text
    for (const t of ALL_THEMES) {
      for (const [key, value] of Object.entries(t.palette)) {
        for (const c of Array.isArray(value) ? value : [value]) expect(c, `${t.id}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  test("a dark look's graphs are drawn light on its own dark card, still one hue in two shades", () => {
    const night = themeById("night")!.palette;
    expect(contrastRatio(night.figure, "#ffffff")).toBeGreaterThan(10); // a dark card, not a white one
    // The highlighted series is the lighter shade on a dark card.
    expect(contrastRatio(night.chartStrong, night.figure)).toBeGreaterThan(contrastRatio(night.chartSoft, night.figure));
  });

  test("every look's graph ramp steps away from its strongest shade in order (one hue, four distinct steps)", () => {
    // The dataviz palette validator passed every ramp as ordinal on its card (decision 0018); this keeps the order.
    for (const t of ALL_THEMES) {
      const r = t.palette.chartRamp.map((c) => contrastRatio(c, t.palette.figure));
      for (let i = 1; i < r.length; i++) expect(r[i]!, `${t.id} step ${i + 1}`).toBeLessThan(r[i - 1]! - 0.2);
    }
  });
});

test.describe("Every look on both pages", () => {
  for (const t of PORTFOLIO_THEMES) {
    test(`${t.name}: axe passes on the portfolio home and an exhbt page, and only the look's own faces are fetched`, async ({ page }) => {
      const username = await seed(page, t.id);
      const faces = new Set(["Bricolage Grotesque Variable", "Inter", family(t.type.display), family(t.type.body)]);

      await page.goto(`/p/${username}`);
      const home = page.locator("[data-portfolio-home]");
      await expect(home).toHaveAttribute("data-theme", t.id);
      await expect(home).toHaveCSS("background-color", rgb(t.palette.ground));
      await axe(page, `${t.id} home`);
      expect(await loadedFaces(page)).toContain(family(t.type.display));
      for (const f of await loadedFaces(page)) expect(faces.has(f), `${t.id} home loaded ${f}`).toBe(true);

      await page.goto(`/p/${username}/open-banking`);
      // The frame takes the look: the ground behind the page, the exhbt, the pager and the sign-off.
      const frame = page.locator(`[data-look="${t.look}"]:has(> main#main)`);
      await expect(frame).toHaveCSS("background-color", rgb(t.palette.ground));
      await expect(page.locator("article")).toHaveCSS("background-color", rgb(t.palette.ground));
      await expect(page.locator("article h1")).toHaveCSS("color", rgb(t.palette.heading));
      await expect(page.locator("article [data-last]").first()).toHaveCSS("background-color", rgb(t.palette.flowEnd));
      await expect(page.getByRole("link", { name: /^See the work/ })).toHaveCSS("background-color", rgb(t.palette.action));
      await expect(page.getByRole("complementary", { name: "Made with exhbt" })).toHaveCSS("color", rgb(t.palette.soft));
      await axe(page, `${t.id} exhbt`);
      for (const f of await loadedFaces(page)) expect(faces.has(f), `${t.id} exhbt loaded ${f}`).toBe(true);
    });
  }
});

/** The family name a face loads under (the site's Bricolage is the variable build). */
const family = (k: FontKey) => (k === "bricolage" ? "Bricolage Grotesque Variable" : FONTS[k].label);

/** The font families the page has downloaded and used. */
const loadedFaces = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, "")))];
  });

test.describe("Night, the dark look", () => {
  test("its graphs sit on its own dark card in its own shades, with light labels", async ({ page }) => {
    const night: PortfolioTheme = themeById("night")!;
    const username = await seed(page, "night");
    await page.goto(`/p/${username}/open-banking`);
    const graph = page.locator('[data-part="graph"]').first();
    await expect(graph).toHaveCSS("background-color", rgb(night.palette.figure));
    // The highlighted bar takes the strong shade, and its value is printed in the page's ink.
    const bars = graph.locator("[role=img] span[style*='--chart']");
    expect(await bars.count()).toBeGreaterThan(0);
    const colours = await bars.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(colours).toContain(rgb(night.palette.chartStrong));
    await expect(graph.locator("figcaption span").first()).toHaveCSS("color", rgb(night.palette.ink));
  });

  test("it prints on paper", async ({ page }) => {
    const username = await seed(page, "night");
    await page.goto(`/p/${username}/open-banking`);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("article")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator("article h1")).toHaveCSS("color", rgb("#0e0f12"));
    await expect(page.locator('[data-part="graph"]').first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });
});

test.describe("Real-world content", () => {
  test.use(PIXEL_7);

  test("a long name, no photo, no graphs and one exhbt still fit a phone in every look", async ({ page }) => {
    const name = "Oluwaseun Adebayo-Montgomery-Fitzwilliam";
    for (const t of PORTFOLIO_THEMES) {
      const username = await seed(page, t.id, `&count=0&graphs=none&name=${encodeURIComponent(name)}`);
      await page.goto(`/p/${username}`);
      await expect(page.locator("[data-portfolio-home] h1")).toContainText("Oluwaseun");
      await expect(page.locator("[data-portfolio-home] [data-avatar=initials]").first()).toBeVisible();
      expect(await noSideScroll(page), `${t.id} home`).toBe(true);
      await page.goto(`/p/${username}/open-banking`);
      await expect(page.locator("article h1")).toBeVisible();
      expect(await noSideScroll(page), `${t.id} exhbt`).toBe(true);
    }
  });

  test("an id saved before the eight looks shows the nearest one", async ({ page }) => {
    const username = await seed(page, "ink");
    await page.goto(`/p/${username}`);
    await expect(page.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", "night");
  });
});
