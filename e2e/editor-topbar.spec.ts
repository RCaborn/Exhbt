import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { validateForPublish, type ExhbtDoc } from "../lib/exhbt/blocks";
import { FORMAT_RULES } from "../lib/exhbt/formats";
import { openBankingDoc } from "../lib/exhbt/sample";
import { canon, docNow, field, focusedPath, freshName, offered, openDoc, openNew, pageOrder, READY, typeIn, undoLabel, waitReady, waitSaved } from "./page-editor";

/*
 * The edit-on-page editor's top bar (decision 0026, "The chrome"): the row, the layout menu, Undo, the word
 * bar, "Things to fix", See as a visitor, the save status, the menu. The selectors the migrated tests look
 * for are exactly as the brief writes them: [data-word-bar], the radiogroup "Layout", the region "Things to
 * fix before publishing" and the status words.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const bar = (page: Page) => page.locator(`${READY} [data-topbar]`);
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

/** The phone's row keeps a short list; the rest is in the menu. */
const openMenu = (page: Page) => bar(page).getByRole("button", { name: "Menu" }).click();

/** Opens the layout menu wherever it is (in the row, or in the menu on a phone). */
async function openLayout(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) < 768) await openMenu(page);
  await bar(page).getByRole("button", { name: /^Layout:/ }).click();
  const group = page.getByRole("radiogroup", { name: "Layout" });
  await expect(group).toBeVisible();
  return group;
}

/** The open-banking sample made complete: no issue stops it, one number is flagged as not found in the files. */
function flaggedDoc(): ExhbtDoc {
  const sections = openBankingDoc.sections.map((s) => (s.kind === "findings" ? { ...s, items: [[{ t: "Fees cut cooperation by 18% in the model." }], ...s.items.slice(1)] } : s));
  return { ...openBankingDoc, sections, unverified: ["18%"] } as ExhbtDoc;
}

test.describe("the top bar", () => {
  test("has the way back, the heading, the chip and Review and publish", async ({ page }) => {
    await openNew(page, freshName("tbrow"));
    await expect(bar(page).getByRole("link", { name: "Your exhbts" })).toHaveAttribute("href", "/exhbts");
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toHaveCount(1);
    await expect(bar(page).locator(".chip")).toHaveText("Draft");
    await expect(bar(page).getByRole("button", { name: "Review and publish" })).toBeVisible();
    // It is exactly the height the loading view leaves room for.
    const h = await bar(page).evaluate((el) => ({ box: el.getBoundingClientRect().height, token: parseFloat(getComputedStyle(el.closest("[data-editor]")!).getPropertyValue("--xe-topbar-h")) * 16 }));
    expect(h.box).toBe(h.token);
    await bar(page).getByRole("button", { name: "Review and publish" }).click();
    await expect(page.locator('dialog[data-sheet="publish"]')).toBeVisible();
  });

  test("the layout menu lists the offered layouts, each on one line at 390px; Gallery changes the page and Undo gives it back", async ({ page }) => {
    const user = freshName("tblayout");
    await openDoc(page, user, openBankingDoc);
    await page.setViewportSize({ width: 390, height: 844 });
    const before = await docNow(page);
    const orderBefore = await pageOrder(page);
    // One undo entry first, so Undo can still be pressed after the layout is given back.
    await page.evaluate(() => window.__exhbtEditor!.remove("graph-1"));
    const afterRemove = await docNow(page);
    const orderAfterRemove = await pageOrder(page);

    const group = await openLayout(page);
    const radios = group.getByRole("radio");
    await expect(radios).toHaveCount(offered().length);
    for (const [i, f] of offered().entries()) {
      await expect(radios.nth(i)).toHaveAccessibleName(new RegExp(`^${FORMAT_RULES[f].name}`));
      // The name and the line each sit on one line: no wrapping, and no sideways scroll in the panel.
      const lines = await group.locator("label").nth(i).locator(".xe-layout-name, .xe-layout-line").evaluateAll((els) => els.map((e) => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) || 20 })));
      for (const l of lines) expect(l.h).toBeLessThanOrEqual(l.lh * 1.4);
    }
    const panel = page.locator(".xe-layout-panel");
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    // The longer line is under the list for the radio that has the focus.
    await group.getByRole("radio", { name: /^Gallery/ }).focus();
    await expect(page.locator(".xe-layout-best")).toHaveText(FORMAT_RULES.gallery.bestFor);

    await group.getByRole("radio", { name: /^Gallery/ }).check();
    await expect(page.locator("article[data-format]")).toHaveAttribute("data-format", "gallery");
    await expect(page.locator("[data-layout-status]")).toContainText("Laid out as a gallery. Undo restores your order.");
    expect((await docNow(page)).format).toBe("gallery");
    expect(await undoLabel(page)).toMatch(/gallery/i);

    await page.keyboard.press("Escape");
    await expect(group).toHaveCount(0);
    await openMenu(page);
    const undo = page.getByRole("button", { name: /^Undo: .*gallery/i });
    await undo.click();
    await expect(page.locator("article[data-format]")).toHaveAttribute("data-format", before.format ?? "case-study");
    expect(canon(await docNow(page))).toBe(canon(afterRemove));
    expect(await pageOrder(page)).toEqual(orderAfterRemove);
    expect(orderAfterRemove).not.toEqual(orderBefore);
  });

  test("right after an AI draft the layout line is said once and kept out of the address", async ({ page }) => {
    await openDoc(page, freshName("tbdrafted"), openBankingDoc, { query: "?drafted=case-study" });
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(page.locator("[data-said]")).toContainText("Laid out as Case study.");
    const group = await openLayout(page);
    await expect(page.locator("[data-drafted]")).toContainText("Laid out as Case study.");
    await group.getByRole("radio", { name: /^Research/ }).check();
    await expect(page.locator("[data-drafted]")).toHaveCount(0);
  });

  test("Undo is named for what it undoes, aria-disabled with nothing to undo, and gives the focus a place to go", async ({ page }) => {
    await openDoc(page, freshName("tbundo"), openBankingDoc);
    const undo = bar(page).getByRole("button", { name: /^Undo/ });
    await expect(undo).toHaveAttribute("aria-disabled", "true");
    await expect(undo).toHaveAccessibleName("Undo");

    await page.evaluate(() => window.__exhbtEditor!.remove("graph-1"));
    await expect(undo).not.toHaveAttribute("aria-disabled", "true");
    await expect(undo).toHaveAccessibleName("Undo: remove graph 1");
    await undo.click();
    // The graph is back and the focus is in it (its first field, or the frame when it has none).
    await expect(page.locator(`${READY} [data-section-id="graph-1"]`)).toBeVisible();
    await expect(undo).toHaveAttribute("aria-disabled", "true");
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[data-section-id]")?.getAttribute("data-section-id"))).toBe("graph-1");
    expect(await undoLabel(page)).toBeNull();

    // An entry about no one section (a layout switch) leaves the focus on Undo while it can still be pressed ...
    await page.evaluate(() => {
      window.__exhbtEditor!.setLayout("gallery");
      window.__exhbtEditor!.setLayout("research");
    });
    await undo.click();
    await expect(undo).not.toHaveAttribute("aria-disabled", "true");
    await expect(undo).toBeFocused();
    // ... and sends it to the heading when there is nothing left to undo.
    await undo.click();
    await expect(undo).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeFocused();
  });

  test("the word bar counts as you type and turns over past the cap", async ({ page }) => {
    await openNew(page, freshName("tbwords"));
    const wordBar = page.locator("[data-word-bar]");
    await expect(wordBar).toContainText(/^0 words/);
    await expect(wordBar).not.toHaveAttribute("data-over");
    await typeIn(page, "sections.0.items.0", "one two three");
    await expect(wordBar).toContainText(/^3 words/);
    await typeIn(page, "sections.0.items.0", words(205));
    await expect(wordBar).toHaveAttribute("data-over", "true");
    await expect(wordBar.locator(".text-error")).toHaveText("205");
    await expect(wordBar).toContainText("aim for 150, at most 200");
  });

  test("Things to fix lists an empty title and a box with too many words; each entry puts the cursor in its field; the word total jumps to the word bar", async ({ page }) => {
    await openNew(page, freshName("tbfix"));
    const fixes = page.getByRole("region", { name: "Things to fix before publishing" });
    // A box with too many words shows at once; an empty field only once publishing has been tried.
    await typeIn(page, "flow.0.step", words(12));
    const button = bar(page).getByRole("button", { name: /things? to fix$/ });
    await expect(button).toBeVisible();
    await button.click();
    await expect(fixes).toBeVisible();
    await expect(fixes).toBeFocused();
    await fixes.locator('[data-issue-path="flow.0.step"]').click();
    await expect(fixes).toHaveCount(0);
    await expect(field(page, "flow.0.step")).toBeFocused();

    await page.evaluate(() => window.__exhbtUi!.setTried(true));
    await button.click();
    await expect(fixes.locator('[data-issue-path="title"]')).toBeVisible();
    await fixes.locator('[data-issue-path="title"]').click();
    await expect(field(page, "title")).toBeFocused();

    // Escape closes the panel and the focus goes back to the button.
    await button.click();
    await page.keyboard.press("Escape");
    await expect(fixes).toHaveCount(0);
    await expect(button).toBeFocused();

    // The word total over the cap jumps to the word bar.
    await typeIn(page, "sections.0.items.0", words(205));
    await button.click();
    await fixes.locator('[data-issue-path=""]').click();
    await expect(page.locator("[data-word-bar]")).toBeFocused();
  });

  test("a blank exhbt shows no Things to fix button; one appears after a failed publish", async ({ page }) => {
    await openNew(page, freshName("tbnonag"));
    await expect(bar(page).getByRole("button", { name: /to (fix|check)$/ })).toHaveCount(0);
    await bar(page).getByRole("button", { name: "Review and publish" }).click();
    await page.locator('dialog[data-sheet="publish"]').getByRole("button", { name: /^Publish/ }).click();
    await page.keyboard.press("Escape");
    await expect(bar(page).getByRole("button", { name: /things? to fix$/ })).toBeVisible();
  });

  test("a complete doc with one flagged number: the button, the list, Show me, That's right", async ({ page }) => {
    const doc = flaggedDoc();
    expect(validateForPublish(doc)).toEqual([]);
    await openDoc(page, freshName("tbnum"), doc);
    const button = bar(page).getByRole("button", { name: "1 number to check" });
    await expect(button).toBeVisible();
    await button.click();
    const fixes = page.getByRole("region", { name: "Things to fix before publishing" });
    const list = fixes.getByRole("list", { name: "Numbers to check" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText("Check this number: 18%");

    await list.getByRole("button", { name: "Show me" }).click();
    await expect(fixes).toHaveCount(0);
    await expect.poll(() => focusedPath(page)).toMatch(/^sections\.0\.items\.0/);

    await button.click();
    await page.getByRole("button", { name: "That's right: 18%" }).click();
    await expect(bar(page).getByRole("button", { name: /to check|to fix/ })).toHaveCount(0);
    expect((await docNow(page)).unverified ?? []).toEqual([]);
    expect(await undoLabel(page)).toBe("confirm 18%");
  });

  test("a save that fails as a stale editor shows the reload words and a Reload button", async ({ page }) => {
    const id = await openNew(page, freshName("tbstale"));
    await page.goto(`/exhbts/${id}/edit?save=stale`);
    await waitReady(page);
    await typeIn(page, "title", "Would a second till help?");
    await expect(bar(page).getByText("The editor was updated. Reload to carry on; your changes are kept in this browser.")).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(bar(page).getByRole("button", { name: /Not saved/ })).toHaveCount(0);
  });

  test("See as a visitor shows a region named Preview with no fields, and pressing again brings them back", async ({ page }) => {
    await openDoc(page, freshName("tbvisitor"), openBankingDoc);
    const visitor = bar(page).getByRole("button", { name: "See as a visitor" });
    await expect(visitor).toHaveAttribute("aria-pressed", "false");
    await visitor.click();
    await expect(visitor).toHaveAttribute("aria-pressed", "true");
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview).toBeVisible();
    await expect(preview.locator("textarea, input, [contenteditable]")).toHaveCount(0);
    await visitor.click();
    await expect(page.getByRole("region", { name: "Preview" })).toHaveCount(0);
    await expect(field(page, "title")).toBeVisible();
  });

  test("the status says Saving… and then Saved after a change", async ({ page }) => {
    const id = await openNew(page, freshName("tbsave"));
    const status = page.locator(`${READY} [data-topbar] .xe-save`);
    await expect(status).toHaveText("Saved");
    await typeIn(page, "title", "A question to save");
    await expect(status).toHaveText("Saving…");
    await waitSaved(page, id);
    await expect(status).toHaveText("Saved");
  });

  test("Use the classic editor opens it with the change made just before", async ({ page }) => {
    const id = await openNew(page, freshName("tbclassic"));
    await typeIn(page, "title", "Typed just before the switch");
    await openMenu(page);
    await page.getByRole("button", { name: "Use the classic editor" }).click();
    await expect(page.locator('[data-editor="classic"]')).toBeVisible();
    expect(page.url()).toContain("editor=classic");
    await expect(page.getByRole("textbox", { name: /Your question/ }).first()).toHaveValue("Typed just before the switch");
    expect(id).toBeTruthy();
  });

  test("the menu has Delete, no Unpublish on a draft and, with a mouse, no Reorder sections", async ({ page }) => {
    await openNew(page, freshName("tbmenu"));
    await openMenu(page);
    await expect(page.getByRole("button", { name: "Delete this exhbt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use the classic editor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reorder sections" })).toHaveCount(0);
  });

  test("the row fits without scrolling sideways from a phone to a wide desktop", async ({ page }) => {
    await openDoc(page, freshName("tbwidths"), flaggedDoc());
    await page.evaluate(() => window.__exhbtEditor!.remove("graph-1"));
    for (const width of [390, 600, 768, 820, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const row = bar(page).locator(".xe-topbar-row");
      await expect(row).toBeVisible();
      if (process.env.TOPBAR_SHOTS) await bar(page).screenshot({ path: `${process.env.TOPBAR_SHOTS}/bar-${width}.png` });
      const over = await row.evaluate((el) => [...el.children].filter((c) => c.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5 || c.getBoundingClientRect().left < -0.5).map((c) => c.className));
      expect(over, `at ${width}px`).toEqual([]);
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth), `at ${width}px`).toBe(true);
    }
  });

  test("on a phone the row keeps its short list, does not scroll sideways and every control is 44px", async ({ page }) => {
    await openDoc(page, freshName("tbphone"), flaggedDoc());
    await page.setViewportSize({ width: 390, height: 844 });
    const row = bar(page).locator(".xe-topbar-row");
    await expect(row).toBeVisible();
    expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // What stays: back, the word count, the things to fix, the save status, the menu and Review and publish.
    for (const name of ["Your exhbts", "1 number to check", "Menu", "Review and publish"]) await expect(bar(page).getByRole("button", { name }).or(bar(page).getByRole("link", { name })).first()).toBeVisible();
    await expect(bar(page).locator("[data-word-bar]")).toBeVisible();
    await expect(bar(page).locator(".xe-save")).toBeVisible();
    // What moves into the menu.
    await expect(bar(page).getByRole("button", { name: /^Layout:/ })).toHaveCount(0);
    await expect(bar(page).getByRole("button", { name: "See as a visitor" })).toHaveCount(0);
    const small = await bar(page).locator("a, button").evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => ({ name: e.getAttribute("aria-label") ?? e.textContent?.trim(), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })).filter((e) => e.w < 43.5 || e.h < 43.5),
    );
    expect(small).toEqual([]);
    await openMenu(page);
    for (const name of [/^Layout:/, /^Undo/, "See as a visitor", "Card and link details"]) await expect(bar(page).getByRole("button", { name })).toBeVisible();
  });
});

test.describe("the top bar, axe", () => {
  const scan = async (page: Page, label: string) => {
    const { violations } = await new AxeBuilder({ page }).include("[data-topbar]").withTags(WCAG).analyze();
    expect(violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  };

  test("no violations with each panel open, on a desktop and on a phone", async ({ page }) => {
    await openDoc(page, freshName("tbaxe"), flaggedDoc());
    await scan(page, "at rest");
    await bar(page).getByRole("button", { name: /^Layout:/ }).click();
    await scan(page, "layout menu");
    await page.keyboard.press("Escape");
    await bar(page).getByRole("button", { name: "1 number to check" }).click();
    await scan(page, "things to fix");
    await page.keyboard.press("Escape");
    await openMenu(page);
    await scan(page, "menu");
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await scan(page, "phone at rest");
    await openMenu(page);
    await scan(page, "phone menu");
    await bar(page).getByRole("button", { name: /^Layout:/ }).click();
    await scan(page, "phone layout menu");
    await page.keyboard.press("Escape");
    await bar(page).getByRole("button", { name: "1 number to check" }).click();
    await scan(page, "phone things to fix");
  });
});
