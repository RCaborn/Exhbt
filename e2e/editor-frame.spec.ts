import { expect, test, type Page } from "./editor-test";
import { draftAndOpen, seeAsVisitor, startRewrite } from "./editor";
import { freshName, openSeeded, READY, SAMPLES } from "./page-editor";

/*
 * The frame round the editor (components/exhbt-editor/focus.ts): the app draws the page in #main, the skip link's
 * target, inside Astryx's AppShell, and both take the focus. No press on the page may end with the focus on either:
 * the editor was written for a focus on nothing. These are the cases the frame's let-go was mended for (the review of
 * 4289009 and its repair, 855f58e). The WebKit job runs this file on Safari's engine, with Safari's rule about the
 * focus and without it (playwright.config.ts, the `safari` project), so what WebKit does to a selection when the frame
 * lets go is tried there on WebKit itself, not on a copy of its rule.
 *  - A press on the page's own words selects them as it did before the frame: a drag across them and a double-click on
 *    one, in the edit view and in See as a visitor, from the focus on nothing and from the focus on #main (where the
 *    skip link puts it). Letting go inside the press, as 4289009 did, made Chromium select nothing.
 *  - A press in #main, then Escape, closes an open rewrite form (it reads only a focus on nothing as nowhere): on the
 *    editor's own margin, and on the band of #main above the editor (the team strip), which 4289009 did not let go of.
 *  - A drag the browser takes over (chosen words carried away) ends with the frame let go too. Chromium takes it
 *    over, and there the case checks that it did; elsewhere it notes which event ended the press.
 */

/** Where the focus is: "BODY" for nothing, else the element's tag and id. */
const focusName = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return !a || a === document.body ? "BODY" : `${a.tagName}${a.id ? `#${a.id}` : ""}`;
  });

const chosen = (page: Page) => page.evaluate(() => String(document.getSelection()));

/** For what a press leads to: each failing check is reported and the test goes on to the next, so one run says all it can. */
const soft = expect.configure({ soft: true, timeout: 10_000 });

type Line = { x: number; y: number; width: number; height: number };
type Words = { text: string; line: Line; word: { x: number; text: string } };

/**
 * Up to three runs of the page's own words in view under `scope`: text that is not in a field, a button, a link or
 * anything else that takes the focus inside the editor's root, so a press on it goes to the frame. For each, its first
 * line and a whole word on that line (letters only, with no apostrophe or hyphen beside it), measured where the page is.
 */
const pageWords = (page: Page, scope: string) =>
  page.evaluate(
    ({ READY, scope }) => {
      const root = document.querySelector(READY)!;
      const within = document.querySelector(scope)!;
      const TAKES = "a[href], button, input, textarea, select, [tabindex], [contenteditable]:not([contenteditable=false]), label, summary";
      const out: Words[] = [];
      const walker = document.createTreeWalker(within, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n && out.length < 3; n = walker.nextNode()) {
        const raw = n.textContent ?? "";
        if (raw.trim().length < 14) continue;
        const el = n.parentElement;
        if (!el || el.closest("[aria-hidden=true], [hidden], dialog:not([open])")) continue;
        const focusable = el.closest(TAKES);
        if (focusable && root.contains(focusable)) continue;
        const style = getComputedStyle(el);
        if (style.userSelect === "none" || style.visibility === "hidden") continue;
        const all = document.createRange();
        all.selectNodeContents(n);
        const first = all.getClientRects()[0];
        if (!first || first.width < 60 || first.height < 6 || first.top < 80 || first.bottom > innerHeight - 10) continue;
        const m = /(?<![\w'’-])[A-Za-z]{3,}(?![\w'’-])/.exec(raw);
        if (!m) continue;
        const w = document.createRange();
        w.setStart(n, m.index);
        w.setEnd(n, m.index + m[0].length);
        const wb = w.getClientRects()[0];
        // The word must sit on the first line, where the drag runs, and nothing may lie over the words where they are pressed.
        if (!wb || Math.abs(wb.top + wb.height / 2 - (first.top + first.height / 2)) > first.height / 2) continue;
        const pressable = (x: number) => {
          const hit = document.elementFromPoint(x, first.top + first.height / 2);
          return Boolean(hit && (hit === el || el.contains(hit)));
        };
        if (!pressable(first.x + 2) || !pressable(wb.x + wb.width / 2)) continue;
        out.push({ text: raw.trim().slice(0, 40), line: { x: first.x, y: first.y, width: Math.min(first.width, 400), height: first.height }, word: { x: wb.x + wb.width / 2, text: m[0] } });
      }
      return out;
    },
    { READY, scope },
  );

/** Nothing chosen, and the focus on nothing or on #main (without a scroll: the words were measured where the page is). */
const startFrom = (page: Page, from: "nothing" | "#main") =>
  page.evaluate((from) => {
    document.getSelection()!.removeAllRanges();
    if (from === "#main") document.getElementById("main")!.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, from);

/** A press on the first words of `line` that runs across it, in ten steps, then the release. */
async function dragAcross(page: Page, line: Line) {
  const y = line.y + line.height / 2;
  await page.mouse.move(line.x + 2, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(line.x + 2 + ((line.width - 4) * i) / 10, y);
  await page.mouse.up();
}

/** The editor on a full case study (the open banking sample), signed in as its owner. */
const openCaseStudy = (page: Page) => openSeeded(page, freshName("frame"), SAMPLES["case-study"].with, SAMPLES["case-study"].slug);

test.describe("a press on the page's own words selects them, and the frame lets go", () => {
  for (const view of ["edit", "visitor"] as const)
    for (const from of ["nothing", "#main"] as const)
      test(`${view === "edit" ? "the edit view" : "See as a visitor"}, the focus on ${from} first: a drag across words and a double-click on one`, async ({ page }) => {
        await openCaseStudy(page);
        if (view === "visitor") await seeAsVisitor(page, true);
        const list = await pageWords(page, view === "visitor" ? `${READY} section[aria-label="Preview"]` : READY);
        expect(list.length, "the page's own words in view").toBeGreaterThan(0);
        for (const w of list) {
          const y0 = await page.evaluate(() => window.scrollY);

          await startFrom(page, from);
          expect(await focusName(page), `${w.text}: the start`).toBe(from === "#main" ? "DIV#main" : "BODY");
          await dragAcross(page, w.line);
          await soft.poll(async () => (await chosen(page)).length, `${w.text}: a drag across the words chooses them`).toBeGreaterThan(5);
          await soft.poll(() => focusName(page), `${w.text}: after the drag the frame has let go`).toBe("BODY");

          await startFrom(page, from);
          await page.mouse.dblclick(w.word.x, w.line.y + w.line.height / 2);
          await soft.poll(async () => (await chosen(page)).trim(), `${w.text}: a double-click chooses "${w.word.text}"`).toBe(w.word.text);
          await soft.poll(() => focusName(page), `${w.text}: after the double-click the frame has let go`).toBe("BODY");

          soft(await page.evaluate(() => window.scrollY), `${w.text}: the page has not moved`).toBe(y0);
        }
      });
});

test.describe("a press in #main, then Escape, closes an open rewrite form", () => {
  for (const where of ["margin", "band"] as const)
    test(where === "margin" ? "a press on the editor's own margin" : "a press on the band of #main above the editor (the team strip)", async ({ page }) => {
      await draftAndOpen(page, "frameesc");
      const block = "gap";
      const rewriteNow = page.getByTestId(`tools-${block}`).getByRole("button", { name: /^Rewrite the .+ now$/ });
      await startRewrite(page, block);
      await expect(rewriteNow).toHaveCount(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      const at = await page.evaluate(
        ({ READY, where }) => {
          const main = document.getElementById("main")!.getBoundingClientRect();
          const root = document.querySelector(READY)!.getBoundingClientRect();
          // The margin as e2e/phase2-draft-tools.spec.ts presses it; the band halfway between #main's top and the editor's.
          const y = where === "margin" ? 600 : Math.round((main.top + root.top) / 2);
          const el = document.elementFromPoint(4, y);
          return { y, band: root.top - main.top, inMain: Boolean(el && document.getElementById("main")!.contains(el)), inRoot: Boolean(el && document.querySelector(READY)!.contains(el)) };
        },
        { READY, where },
      );
      if (where === "band") expect(at.band, "#main has a band above the editor").toBeGreaterThan(4);
      expect(at.inMain, "the press is inside #main").toBe(true);
      expect(at.inRoot, where === "margin" ? "the press is inside the editor" : "the press is above the editor").toBe(where === "margin");
      await page.mouse.click(4, at.y);
      await soft.poll(() => focusName(page), "after the press the frame has let go").toBe("BODY");
      await page.keyboard.press("Escape");
      await soft(rewriteNow, "Escape closes the rewrite form").toHaveCount(0);
    });
});

test("a drag the browser takes over, chosen words carried out of the editor, ends with the frame let go", async ({ page, browserName }) => {
  await openCaseStudy(page);
  const [w] = await pageWords(page, READY);
  expect(w, "the page's own words in view").toBeTruthy();
  const y = w!.line.y + w!.line.height / 2;
  await dragAcross(page, w!.line);
  await expect.poll(async () => (await chosen(page)).length, "the words are chosen").toBeGreaterThan(5);
  // Carried out of the editor, to the band of #main above it (the team strip's), at its margin, where nothing takes a drop.
  const drop = await page.evaluate((READY) => {
    const main = document.getElementById("main")!.getBoundingClientRect();
    const root = document.querySelector(READY)!.getBoundingClientRect();
    const y = Math.round((main.top + root.top) / 2);
    const el = document.elementFromPoint(4, y);
    return {
      y,
      band: root.top - main.top,
      inMain: Boolean(el && document.getElementById("main")!.contains(el)),
      inRoot: Boolean(el && document.querySelector(READY)!.contains(el)),
      takes: Boolean(el?.closest("a[href], button, input, textarea, [contenteditable]:not([contenteditable=false])")),
    };
  }, READY);
  expect(drop.band, "#main has a band above the editor").toBeGreaterThan(4);
  expect(drop.inMain && !drop.inRoot, "the drop point is in #main, above the editor").toBe(true);
  expect(drop.takes, "nothing at the drop point takes the words").toBe(false);
  // Which event ends the press: a drag the browser took over ends with dragend, and one it did not with mouseup.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __frameEnds: string[] }).__frameEnds = seen;
    for (const t of ["dragstart", "dragend", "mouseup"]) document.addEventListener(t, () => seen.push(t), true);
  });
  await page.mouse.move(w!.word.x, y);
  await page.mouse.down();
  const held = await focusName(page);
  for (let i = 1; i <= 10; i++) await page.mouse.move(w!.word.x + ((4 - w!.word.x) * i) / 10, y + ((drop.y - y) * i) / 10);
  await page.mouse.up();
  await expect.poll(() => focusName(page), "after the drag the frame has let go").toBe("BODY");
  const ends = await page.evaluate(() => (window as unknown as { __frameEnds: string[] }).__frameEnds);
  test.info().annotations.push({ type: "the press", description: `focus while held: ${held}; events: ${ends.join(", ") || "none"}` });
  // Chromium takes such a drag over, so there the case holds to the path it is named for: had the browser not taken
  // the drag (the words no longer draggable), the press would end with mouseup and the let-go above would pass on that.
  // On WebKit the annotation says which event ended the press.
  if (browserName === "chromium") {
    expect(ends, "the browser took the drag over").toEqual(expect.arrayContaining(["dragstart", "dragend"]));
    expect(ends, "the press did not end with mouseup").not.toContain("mouseup");
  }
});
