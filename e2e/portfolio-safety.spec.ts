import type { Page } from "@playwright/test";
import type { BuilderState } from "../app/(app)/portfolio/steps";
import { BUILDER_LOOK_CARDS, FULL, PORTFOLIO_PAGES, type PortfolioFixture } from "./fixtures/portfolio-pages";
import { HOME, READY, call, changeWith, countActions, expect, fresh, openEditor, saveState, settle, stateNow, test, textbox, typeIn, valueAt, waitReady, waitSaved } from "./portfolio-editor";

// What the one-page portfolio editor must never do to what a person has stored (decision 0031; brief J of
// docs/briefs/portfolio-first): change it by being opened, lose words on a failed save, or disagree with the
// step builder about what is saved. Each test seeds a portfolio of its own (/dev/portfolio-parity) and opts its
// own browser in with the development cookie. What e2e/portfolio-core.spec.ts already proves is not repeated
// here: the crash fallback, the kept copy after a deploy, the two-tabs note and the Back fix.

/** A fixture from A's list, by name. */
const named = (name: string): PortfolioFixture => PORTFOLIO_PAGES.find((p) => p.name === name)!.fixture;

/** The visitor's page as drawn: the markup of its root (`[data-portfolio-home]`), as the parity gate reads it. */
async function visitorsMarkup(page: Page, username: string): Promise<string> {
  await page.goto(`/p/${username}`);
  await settle(page);
  return page.locator(HOME).first().evaluate((el) => el.outerHTML);
}

/** The step builder's save status (app/(app)/portfolio/Builder.tsx). */
const builderStatus = (page: Page) => page.getByTestId("save-status");

test.describe("Opening the editor changes nothing stored", () => {
  // The legacy shapes the loader reads and a save would rewrite: decision 0014's layout ("p" markers, a links
  // tile), held extras on Free, a stored look the plan does not have, an exhbt over the plan's limit.
  const CASES: { name: string; fixture: PortfolioFixture; publicPage: boolean }[] = [
    { name: "the full portfolio", fixture: FULL, publicPage: true },
    { name: "decision 0014's layout", fixture: named("legacy-layout"), publicPage: true },
    { name: "held extras on Free", fixture: named("held-extras"), publicPage: false },
    { name: "a stored locked look and an exhbt over the limit", fixture: BUILDER_LOOK_CARDS, publicPage: true },
  ];
  for (const c of CASES) {
    test(`${c.name}: opened, looked at and left without a change, sends no save, and what is stored is as it was`, async ({ page }) => {
      const f = fresh(c.fixture, `open${c.name}`);
      await openEditor(page, f);
      const loaded: BuilderState = await stateNow(page);
      const visitorsPage = c.publicPage ? await visitorsMarkup(page, f.username) : null;
      if (c.publicPage) {
        await page.goto("/portfolio");
        await waitReady(page);
      }

      // From here on, any save this browser sends is counted.
      const actions = countActions(page);
      await settle(page);
      // Everything a person does that is not a change: scroll, put the cursor in a field and take it out,
      // look at the page as a visitor and come back.
      await page.mouse.wheel(0, 1500);
      await textbox(page, "profile.headline").click();
      await page.keyboard.press("End");
      await textbox(page, "profile.name").click();
      await page.keyboard.press("Tab");
      await call(page, "seeAsVisitor", true);
      await call(page, "seeAsVisitor", false);
      await page.waitForTimeout(1500);
      await expect(saveState(page)).toHaveAttribute("data-save", "saved");
      // Away, as a person leaves (the editor sends what is waiting as it goes, if anything is).
      await page.goto("/account");
      await page.waitForTimeout(500);
      expect(actions(), "server actions sent").toBe(0);

      // Read afresh: the loader gives the same state, and visitors get the same page, markup for markup.
      await page.goto("/portfolio");
      await waitReady(page);
      expect(await stateNow(page)).toEqual(loaded);
      if (visitorsPage !== null) expect(await visitorsMarkup(page, f.username)).toBe(visitorsPage);
      expect(actions(), "server actions sent").toBe(0);
    });
  }
});

test.describe("The step builder and the editor read each other's saves", () => {
  test("arranged and typed in the editor, the step builder shows it; changed there, the editor shows that", async ({ page }) => {
    const f = fresh(FULL, "roundtrip");
    const seeded = await openEditor(page, f);
    const actions = countActions(page);
    // In the editor: words in three fields, About moved to the top, one exhbt hidden.
    await typeIn(page, "profile.name", "Jordan Mensah");
    await typeIn(page, "profile.location", "Leeds");
    await typeIn(page, "arrangement.tiles.about.text", "I map bus delays for fun.");
    await changeWith(page, { moveSection: { from: 2, to: 0 } }, "moved About me");
    await changeWith(page, { hide: [seeded.ids.library!] }, "hid Where do students sit in the library?");
    await waitSaved(page);
    // The counter the test above relies on sees saves when there are some.
    expect(actions()).toBeGreaterThan(0);
    const sections = (await stateNow(page)).arrangement.sections;
    expect(sections[0]).toBe("about");

    // The step builder, on the same save.
    await page.goto("/portfolio?builder=steps");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Jordan Mensah");
    await expect(page.getByLabel(/Where you’re based/)).toHaveValue("Leeds");
    const preview = page.getByTestId("preview").locator(HOME);
    await expect(preview.locator("h1")).toContainText("Jordan Mensah");
    await expect(preview.locator("[data-section=about]")).toContainText("I map bus delays for fun.");
    expect(await preview.locator("[data-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section")))).toEqual(sections);
    await expect(preview.locator(`[data-card="${seeded.ids.library}"]`)).toHaveCount(0);

    // Changed in the step builder, then the editor reads it.
    await page.getByLabel(/Headline/).fill("Transport analyst");
    await expect(builderStatus(page)).not.toHaveText("Saved");
    await expect(builderStatus(page)).toHaveText("Saved");
    await page.goto("/portfolio");
    await waitReady(page);
    expect(await valueAt(page, "profile.headline")).toBe("Transport analyst");
    await expect(textbox(page, "profile.headline")).toHaveValue("Transport analyst");
    // And what the editor saved before is all still there.
    expect(await valueAt(page, "profile.name")).toBe("Jordan Mensah");
    expect((await stateNow(page)).arrangement.sections).toEqual(sections);
    expect((await stateNow(page)).arrangement.hidden).toEqual([seeded.ids.library]);
  });
});

test.describe("A save that fails", () => {
  test("keeps the words on the page, says it was not saved, and offers Retry; nothing reached the server", async ({ page }) => {
    const f = fresh(FULL, "savefail");
    await openEditor(page, f, { query: "?save=fail" });
    await typeIn(page, "profile.headline", "Words the server refused");
    const status = saveState(page);
    await expect(status).toHaveAttribute("data-save", "error");
    await expect(status).toContainText("Not saved.");
    await expect(status.getByRole("button", { name: "Retry" })).toBeVisible();
    // Still on screen, and still in the state, for a Retry.
    await expect(textbox(page, "profile.headline")).toHaveValue("Words the server refused");
    expect(await valueAt(page, "profile.headline")).toBe("Words the server refused");
    expect(await page.evaluate(() => window.__portfolioEditor!.waiting())).toBe(true);
    // The server kept what it had.
    await page.goto("/portfolio?builder=steps");
    await expect(page.getByLabel(/Headline/)).toHaveValue("Operations analyst, food service and retail");
    await expect(page.locator(READY)).toHaveCount(0);
  });
});
