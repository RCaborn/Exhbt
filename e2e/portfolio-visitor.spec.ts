import type { Page } from "@playwright/test";
import { canUseTheme } from "../lib/plan-rules";
import { PORTFOLIO_THEMES, themeById } from "../lib/portfolio-themes";
import { LOOK_IDS, PORTFOLIO_PAGES, fullFixture, type PortfolioFixture } from "./fixtures/portfolio-pages";
import { HOME, boxes, call, differences, expect, fresh, openEditor, settle, test, uiNow } from "./portfolio-editor";

// "See as a visitor" is exactly the page visitors get (decision 0031; brief J of docs/briefs/portfolio-first):
// in every look and colourway, at 1440 and 412, the view the bar's button draws matches /p/<name> (the public
// page, in development) box for box, and leaves out what visitors never see: a draft, a hidden exhbt, a held
// extra and a look that is only being previewed. Each portfolio carries all four at once where its plan allows.

/** The view "See as a visitor" draws. */
const VISITOR = "[data-canvas=visitor]";

/** The first look the plan does not have, to preview while "See as a visitor" is on; null when it has them all. */
const lockedOn = (plan: PortfolioFixture["plan"]) => PORTFOLIO_THEMES.find((t) => !canUseTheme(plan, t).ok)?.id ?? null;

/**
 * Measures "See as a visitor" and the public page at one width; returns what differs. `ownersPreview`: the
 * page is Free's, where /p/<name> is the owner's own preview, which outlines each empty section for its
 * owner (EmptySection, `[data-empty]`); a visitor's page leaves them out, so they are taken out first.
 */
async function compare(page: Page, username: string, width: number, ownersPreview = false): Promise<string[]> {
  await page.setViewportSize({ width, height: 900 });
  await settle(page);
  const seen = await page.evaluate((v) => document.querySelector(v) !== null, VISITOR);
  expect(seen, "See as a visitor is on").toBe(true);
  const preview = await boxes(page);
  const editor = page.url();
  await page.goto(`/p/${username}`);
  await settle(page);
  if (ownersPreview) await page.evaluate((h) => document.querySelectorAll(`${h} [data-section][data-empty]`).forEach((el) => el.remove()), HOME);
  const visiting = await boxes(page);
  expect(visiting.length, "the public page drew its landmarks").toBeGreaterThan(10);
  await page.goto(editor);
  return differences(visiting, preview);
}

for (const look of LOOK_IDS) {
  test(`${look}: See as a visitor is /p/<name> box for box at 1440 and 412, without the draft, the hidden exhbt or a previewed look`, async ({ page }) => {
    test.slow();
    const theme = themeById(look)!;
    // Premium where the look comes with it, so a locked look can be previewed; Max otherwise.
    const plan: PortfolioFixture["plan"] = canUseTheme("premium", theme).ok ? "premium" : "max";
    const base = fullFixture("x", look === "exhbt" ? null : look, plan);
    const f = fresh({ ...base, exhbts: base.exhbts.map((e) => ({ ...e, draft: e.key === "poster", hidden: e.key === "rota" })) }, `vis${look}`);
    const seeded = await openEditor(page, f);
    const locked = lockedOn(plan);

    for (const width of [1440, 412]) {
      await page.setViewportSize({ width, height: 900 });
      if (locked) await call(page, "previewLook", locked);
      await call(page, "seeAsVisitor", true);
      const view = page.locator(`${VISITOR} ${HOME}`);
      await expect(view).toBeVisible();
      // The saved look, never the previewed one; no draft and no hidden exhbt; the others are there.
      await expect(view).toHaveAttribute("data-look", theme.look);
      await expect(view.locator(`[data-card="${seeded.ids.poster}"], [data-card="${seeded.ids.rota}"]`)).toHaveCount(0);
      await expect(view.locator(`[data-card="${seeded.ids.library}"]`)).toHaveCount(1);
      // Measured in the same state the next time round: compare() leaves the editor and comes back.
      expect(await compare(page, f.username, width), `${look} at ${width}`).toEqual([]);
      await page.waitForURL(/\/portfolio/);
      await expect(page.locator('[data-editor="portfolio"][data-ready="true"]')).toBeAttached();
      expect((await uiNow(page)).visitor).toBe(false);
    }
  });
}

test("held extras on Free: See as a visitor leaves out Experience and the quote, as the owner's own preview of /p/<name> does", async ({ page }) => {
  const fixture = PORTFOLIO_PAGES.find((p) => p.name === "held-extras")!.fixture;
  const f = fresh(fixture, "visheld");
  await openEditor(page, f);
  for (const width of [1440, 412]) {
    await page.setViewportSize({ width, height: 900 });
    await call(page, "seeAsVisitor", true);
    const view = page.locator(`${VISITOR} ${HOME}`);
    await expect(view).toBeVisible();
    await expect(view.locator('[data-section="experience"], [data-section="quote"]')).toHaveCount(0);
    // Free has no public page: /p/<name> is the owner's preview, compared from the page down.
    expect(await compare(page, f.username, width, true), `held extras at ${width}`).toEqual([]);
    await expect(page.locator('[data-editor="portfolio"][data-ready="true"]')).toBeAttached();
  }
});
