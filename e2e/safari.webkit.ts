import { blockOptions } from "../lib/exhbt/layouts";
import { expect, safariFocus, test, type Page } from "./editor-test";
import { docNow, field, frame, freshName, jump, openDoc, openTiming, pageOrder, READY, sampleDoc, waitLive } from "./page-editor";

/*
 * What Safari does that Chromium does not, and the editor must live with. These run in the two WebKit
 * projects only (playwright.config.ts: `safari` and `iphone`, in .github/workflows/webkit.yml), so the
 * other projects and CI's ten e2e groups are as they were. E2E_WEBKIT=chromium runs them on Chromium.
 *
 *  1. Safari stops a page's loads the moment the person goes somewhere else, while the page is still
 *     there: a chunk on its way then fails. Only WebKit shows this (the engine is the same on Linux).
 *  2. On a Mac and an iPhone a press on a button gives it no focus, and takes the focus from whatever
 *     had it. WebKit on Linux does not do that, so these tests give the page the rule themselves
 *     (safariFocus, editor-test.ts): they fail on any browser if the editor forgets the rule.
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

test.describe("under Safari's rule about the focus (a press gives a button none)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(safariFocus);
  });

  /** A section a new exhbt has room for, to add from the "+" (a picture or a graph would open its own sheet). */
  const roomFor = async (page: Page) => {
    const kind = blockOptions(await docNow(page)).find((o) => !o.full && ["quote", "reflection", "link", "pullquote"].includes(o.kind));
    expect(kind, "a new exhbt has room for one of them").toBeTruthy();
    return kind!.kind;
  };

  test("on a phone, Add on the bar opens the + at the end of the page, and a tap on a section there adds it", async ({ page, isMobile }) => {
    test.skip(!isMobile, "a phone's bar");
    await openTiming(page, "new");
    await waitLive(page);
    const order = await pageOrder(page);
    const kind = await roomFor(page);
    await page.locator(`${READY} .xe-phonebar`).getByRole("button", { name: "Add a section at the end", exact: true }).tap();
    const menu = page.locator(`${READY} .xe-insert[data-end] [data-xe-menu]`);
    await expect(menu).toBeVisible();
    // The "+" has the focus, as the bar put it there: the tap takes it away to nowhere.
    await expect(page.locator("#add-section")).toBeFocused();
    await menu.locator(`[data-block="${kind}"]`).tap();
    await expect.poll(async () => (await pageOrder(page)).length).toBe(order.length + 1);
    await expect(menu).toHaveCount(0);
  });

  test("with a mouse, Things to fix lands on the + at the end and opens it, and a click on a section there adds it; a second click on the + shuts it", async ({ page, isMobile }) => {
    test.skip(isMobile, "a mouse's");
    await openTiming(page, "new");
    await waitLive(page);
    const order = await pageOrder(page);
    const kind = await roomFor(page);
    const plus = page.locator("#add-section");
    const menu = page.locator(`${READY} .xe-insert[data-end] [data-xe-menu]`);
    await jump(page, "sections");
    await expect(menu).toBeVisible();
    await expect(plus).toBeFocused();
    // The "+" itself, pressed while it has the focus, shuts its menu (it does not shut and open again).
    await plus.click();
    await expect(menu).toHaveCount(0);
    await jump(page, "sections");
    await expect(menu).toBeVisible();
    await menu.locator(`[data-block="${kind}"]`).click();
    await expect.poll(async () => (await pageOrder(page)).length).toBe(order.length + 1);
  });

  test("the reason a case study's flowchart can't be removed is shown when its Remove is pressed, and goes when the person presses elsewhere", async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone's bar says it instead");
    await openTiming(page, "case-study", { full: true });
    const remove = frame(page, "flow").locator('[data-tool="remove"]');
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    await frame(page, "flow").hover();
    // aria-disabled, so Playwright won't press it unless told: a person can.
    await remove.click({ force: true });
    await expect(remove).toHaveAttribute("data-explain", "");
    await page.locator(`${READY} article h1, ${READY} article .xp-title`).first().click({ position: { x: 2, y: 2 } });
    await expect(remove).not.toHaveAttribute("data-explain", "");
  });
});
