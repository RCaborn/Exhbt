import type { ExhbtDoc } from "../lib/exhbt/blocks";
import { blockOptions } from "../lib/exhbt/layouts";
import { devices, expect, safariFocus, test, type Page } from "./editor-test";
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
 *  3. An iPhone zooms the page in on a field under 16px. WebKit on Linux never does, so the test shows
 *     only that the editor's answer (components/exhbt-editor/phone/noZoom.ts) is set for an iPhone and
 *     for nothing else. Whether it stops the zoom is for a real iPhone to say.
 *  4. Safari before 17 (an iPhone on iOS 16 or older) has no popovers. No browser Playwright has is that
 *     old, so these tests take the popover API out of the page before it loads, and make its selector
 *     the error it is there: the chips' panels must still open (components/exhbt-editor/figures/pop.ts).
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

  // Until decision 0032 a case study's flowchart could not be removed: its Remove was off, and pressed, it showed why until
  // the person pressed elsewhere (which a press that gives no focus made hard to end on Safari). It is taken off like any
  // other part now, so a press on Remove, which gets no focus here, must still take it off.
  test("a case study's flowchart is taken off by a press on its Remove", async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone's bar has Remove instead");
    await openTiming(page, "case-study", { full: true });
    const remove = frame(page, "flow").locator('[data-tool="remove"]');
    await expect(remove).not.toHaveAttribute("aria-disabled", "true");
    await frame(page, "flow").hover();
    await remove.click();
    expect(await pageOrder(page)).not.toContain("flow");
    expect((await docNow(page)).flowOff).toBe(true);
  });
});

test.describe("the viewport while the editor is open (an iPhone zooms in on a field under 16px)", () => {
  test.skip(({ isMobile }) => isMobile, "each test sets its own user agent: once is enough");

  const viewport = (page: Page) => page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "");
  const WHO = [
    ["an iPhone", devices["iPhone 14"].userAgent, true],
    ["an Android phone", devices["Pixel 7"].userAgent, false],
    ["an iPad", devices["iPad (gen 7)"].userAgent, false],
    ["a Mac", devices["Desktop Safari"].userAgent, false],
  ] as const;

  for (const [who, userAgent, held] of WHO) {
    test.describe(who, () => {
      test.use({ userAgent });

      test(held ? `${who}: maximum-scale=1 while the editor is open, and the viewport as it was once the editor has gone` : `${who}: the viewport is left as it is`, async ({ page }) => {
        await openDoc(page, freshName("zoom"), sampleDoc("case-study"));
        const open = await viewport(page);
        expect(open).toContain("width=device-width");
        if (held) expect(open).toMatch(/maximum-scale=1$/);
        else expect(open).not.toMatch(/maximum-scale/);
        // Out by the top bar's own link: no new document, so it is the editor going that puts the viewport back.
        await page.locator(`${READY} [data-topbar] a.xe-back`).click();
        await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
        expect(await viewport(page)).not.toMatch(/maximum-scale/);
      });
    });
  }
});

test.describe("in a browser with no popovers (Safari before 17)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const without = (proto: object, names: string[]) => names.forEach((name) => delete (proto as Record<string, unknown>)[name]);
      without(HTMLElement.prototype, ["popover", "showPopover", "hidePopover", "togglePopover"]);
      for (const C of [HTMLButtonElement, HTMLInputElement]) without(C.prototype, ["popoverTargetElement", "popoverTargetAction"]);
      // Its selector is no selector there: asking for it throws.
      const refuse = (proto: object, names: string[]) => {
        for (const name of names) {
          const real = (proto as Record<string, (selector: string) => unknown>)[name]!;
          (proto as Record<string, unknown>)[name] = function (this: unknown, selector: string) {
            if (String(selector).includes(":popover-open")) throw new DOMException("':popover-open' is not a valid selector.", "SyntaxError");
            return real.call(this, selector);
          };
        }
      };
      refuse(Element.prototype, ["matches", "closest", "querySelector", "querySelectorAll"]);
      refuse(Document.prototype, ["querySelector", "querySelectorAll"]);
    });
  });

  test("a link's Web address opens under its button with the cursor in it; the address is stored; Enter, Escape and a press outside it close it; a jump to its issue opens it", async ({ page }) => {
    const doc = sampleDoc("case-study");
    const n = doc.sections.findIndex((x) => x.kind === "link");
    await openDoc(page, freshName("nopop"), doc);
    expect(await page.evaluate(() => "popover" in HTMLElement.prototype)).toBe(false);
    const chip = page.locator(`${READY} article`).getByRole("button", { name: /^Web address: / }).first();
    const panel = page.locator(`${READY} dialog.xe-fig-pop-link`).first();
    const input = panel.locator(`[data-path="sections.${n}.href"]`);
    await expect(panel).toBeHidden();
    await chip.scrollIntoViewIfNeeded();
    await chip.click();
    await expect(panel).toBeVisible();
    await expect(input).toBeFocused();
    // Under its button, and on the screen.
    const c = (await chip.boundingBox())!;
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(c.y + c.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await input.fill("https://example.com/paper");
    await expect.poll(async () => ((await docNow(page)).sections[n] as { href?: string }).href).toBe("https://example.com/paper");
    await page.keyboard.press("Enter");
    await expect(panel).toBeHidden();
    await chip.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await chip.click();
    await expect(panel).toBeVisible();
    // A press outside it: the corner of the screen.
    await page.mouse.click(3, 3);
    await expect(panel).toBeHidden();
    await jump(page, `sections.${n}.href`);
    await expect(panel).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("a picked figure's label opens its strip, and Escape closes it", async ({ page }) => {
    const gallery = sampleDoc("gallery");
    const doc = { ...gallery, sections: gallery.sections.map((x) => (x.kind === "image" ? { ...x, picked: { from: "report.pdf", page: 3, box: { x: 0, y: 0, w: 1, h: 1 }, shareOk: false } } : x)) } as ExhbtDoc;
    await openDoc(page, freshName("nopoppick"), doc);
    await waitLive(page);
    const label = page.locator(`${READY} article .xe-fig-picked`).first();
    const strip = label.locator("dialog.xe-fig-pop-picked");
    await expect(strip).toBeHidden();
    await label.locator(".xe-fig-picked-open").scrollIntoViewIfNeeded();
    await label.locator(".xe-fig-picked-open").click();
    await expect(strip).toBeVisible();
    await expect(strip.getByRole("checkbox", { name: "I may share this figure on my portfolio" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(strip).toBeHidden();
  });
});
