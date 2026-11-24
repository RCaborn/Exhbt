import { expect, test } from "./editor-test";
import { field, freshName, openDoc, sampleDoc } from "./page-editor";

/*
 * What Safari does that Chromium does not, and the editor must live with. These run in the two WebKit
 * projects only (playwright.config.ts: `safari` and `iphone`, in .github/workflows/webkit.yml), so the
 * other projects and CI's ten e2e groups are as they were. E2E_WEBKIT=chromium runs them on Chromium.
 *
 *  1. Safari stops a page's loads the moment the person goes somewhere else, while the page is still
 *     there: a chunk on its way then fails. Only WebKit shows this (the engine is the same on Linux).
 */

test.describe("leaving the editor before the formatted fields' code has arrived", () => {
  test.skip(({ isMobile }) => isMobile, "the engine is the same on a phone: once is enough");

  test("the page opened next is the one the person went to, not the classic editor", async ({ page }) => {
    // The fields' code is asked for, and does not come.
    let asked = 0;
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(/RichEditor/, async (route) => {
      asked++;
      await held;
      await route.continue().catch(() => {});
    });
    const doc = sampleDoc("case-study");
    await openDoc(page, freshName("leave"), doc);
    // A formatted field is pressed, so the editor is waiting on that code.
    await field(page, `sections.${doc.sections.findIndex((s) => s.kind === "findings")}.items.0`).click();
    await expect.poll(() => asked).toBeGreaterThan(0);

    // Somewhere else, as Reload, Back, a link out and a typed address all go.
    await page.goto("/exhbts");
    await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
    // And the page that was left opens nothing after it: three seconds on, this is still the list.
    await page.waitForTimeout(3000);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/exhbts");
    await expect(page.locator('[data-editor="failed"], [data-editor="classic"]')).toHaveCount(0);
    release();
  });
});
