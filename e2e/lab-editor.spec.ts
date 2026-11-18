import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { isLabEnabled } from "../lib/site";

// The editor lab (/lab/editor): the prototype that decides how drag and drop and typing on the
// page should feel (docs/briefs/edit-on-page/drag-prototype.md). These checks are written to be
// carried over to the real editor: typing re-renders one section, nothing moves when a field takes
// focus or a drag starts, a drag moves things by transform only, the keyboard can do every move,
// a swipe scrolls, and neither version flickers on a boundary.
//
// Desktop project: everything but the touch tests. Mobile project (Pixel 7): the touch tests.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const LAB = "/lab/editor";
const SAMPLES = ["case-study", "gallery", "research"] as const;
const VERSIONS = ["a", "b"] as const;
const NAME = { a: "A (slide)", b: "B (line)" };

const SECTIONS = "[data-lab-rows] [data-lab-section]";
const board = (page: Page) => page.locator("[data-lab-board]");
const section = (page: Page, id: string) => page.locator(`[data-lab-rows] [data-lab-section="${id}"]`);
const status = (page: Page) => page.locator("[data-lab-status]");

async function open(page: Page, query = "") {
  await page.goto(`${LAB}${query}`);
  await expect(page.locator("[data-lab][data-ready]")).toBeAttached();
  if (!query.includes("read=1")) await expect(page.locator('[data-lab-context="field"]')).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
}

const order = (page: Page) => page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel), (e) => e.dataset.labSection!), SECTIONS);

type Rect = { x: number; y: number; w: number; h: number };

/** Where every section is drawn, on the page (so scrolling doesn't count as moving). Includes any transform. */
const drawn = (page: Page, selector = SECTIONS) =>
  page.evaluate((sel) => {
    const out: Record<string, Rect> = {};
    document.querySelectorAll<HTMLElement>(sel).forEach((e, i) => {
      const r = e.getBoundingClientRect();
      out[e.dataset.labSection ?? `${e.className.toString().split(" ")[0]}#${i}`] = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    });
    return out;
  }, selector);

/** Every section's layout box: its offsets summed up to the board, and its offset size. Transforms don't change these. */
const layout = (page: Page) =>
  page.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>("[data-lab-board]")!;
    const out: Record<string, Rect> = {};
    document.querySelectorAll<HTMLElement>(sel).forEach((e) => {
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = e; n && n !== root; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      out[e.dataset.labSection!] = { x, y, w: e.offsetWidth, h: e.offsetHeight };
    });
    return out;
  }, SECTIONS);

const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => null));

/** Presses the mouse on a section's grip and moves past the 6px threshold. Returns where the pointer is. */
async function pickUp(page: Page, id: string) {
  const grip = section(page, id).locator("[data-grip]");
  await grip.scrollIntoViewIfNeeded();
  const g = (await grip.boundingBox())!;
  const at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 4, at.y + 8, { steps: 4 });
  await expect(board(page)).toHaveAttribute("data-lab-lifting", "pointer");
  return { x: at.x + 4, y: at.y + 8 };
}

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

/** A viewport tall enough for a whole sample, so a mouse drag never has to scroll. Widths (and so layouts) are unchanged. */
const TALL = { width: 1440, height: 2800 };

/* ------------------------------------------------------------------------------------------ */

test.describe("The lab's gate", () => {
  test("it is off in production unless EXHBT_LAB=1, and only the preview Worker sets that", () => {
    const env = process.env as Record<string, string | undefined>;
    const before = { NODE_ENV: env.NODE_ENV, EXHBT_LAB: env.EXHBT_LAB };
    try {
      env.NODE_ENV = "production";
      delete env.EXHBT_LAB;
      expect(isLabEnabled()).toBe(false);
      env.EXHBT_LAB = "0";
      expect(isLabEnabled()).toBe(false);
      env.EXHBT_LAB = "1";
      expect(isLabEnabled()).toBe(true);
      env.NODE_ENV = "development";
      delete env.EXHBT_LAB;
      expect(isLabEnabled()).toBe(true);
    } finally {
      env.NODE_ENV = before.NODE_ENV;
      if (before.EXHBT_LAB === undefined) delete env.EXHBT_LAB;
      else env.EXHBT_LAB = before.EXHBT_LAB;
    }
    // wrangler.jsonc: every comment in it is a whole line.
    const wrangler = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "")) as { vars: Record<string, string>; env: { preview: { vars: Record<string, string> } } };
    expect(wrangler.env.preview.vars.EXHBT_LAB).toBe("1");
    expect(wrangler.vars).not.toHaveProperty("EXHBT_LAB");
  });

  test("the page is never indexed, and says nothing is saved", async ({ page }) => {
    await open(page);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("A try-out. Nothing here is saved.")).toBeVisible();
    await expect(page.getByRole("radio", { name: "A, slide" })).toBeChecked();
  });
});

/* ------------------------------------------------------------------------------------------ */

test.describe("Desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the touch tests are below");

  test("the page being edited is the published page: every box matches the real ProjectView", async ({ page }) => {
    const PARTS =
      ".xp-aside, .xp-card, .xp-name, .xp-fact, .xp-work-button, .xp-pill, .xp-title, .xp-context, .xp-mark, .xp-flow-box, .xp-flow-arrow, .xp-found-heading, .xp-finding, .xp-figure, [data-part=quote], [data-part=reflection], [data-part=link]";
    const read = () =>
      page.evaluate((sel) => {
        const root = document.querySelector("[data-exhbt-page]")!;
        const o = root.getBoundingClientRect();
        return Array.from(root.querySelectorAll<HTMLElement>(sel), (el) => {
          const r = el.getBoundingClientRect();
          const name = el.className.toString().split(" ").find((c) => c.startsWith("xp-")) ?? el.dataset.part ?? "";
          return { name, x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
        });
      }, PARTS);
    for (const look of ["exhbt", "classic", "night"]) {
      await open(page, `?look=${look}`);
      const lab = await read();
      await open(page, `?look=${look}&read=1`);
      const real = await read();
      expect(lab.map((p) => p.name), look).toEqual(real.map((p) => p.name));
      expect(lab.length).toBeGreaterThan(30);
      for (const [i, a] of lab.entries()) {
        const b = real[i]!;
        const where = `${look} ${a.name} #${i}`;
        expect(Math.abs(a.x - b.x), where).toBeLessThan(0.05);
        expect(Math.abs(a.y - b.y), where).toBeLessThan(0.05);
        // The one known difference: a highlight that wraps keeps the space at the end of its line in a field (about 5px).
        expect(Math.abs(a.w - b.w), where).toBeLessThan(a.name === "xp-mark" ? 7 : 0.05);
        expect(Math.abs(a.h - b.h), where).toBeLessThan(0.05);
      }
    }
  });

  test("typing in one section re-renders only that section", async ({ page }) => {
    await open(page, "?sample=gallery");
    const counts = () => page.evaluate(() => ({ ...window.__labRenders }));
    const typed = "ten chars.";
    const cases: { field: () => Promise<void>; key: string }[] = [
      { key: "findings", field: () => page.getByLabel("Finding 1").click() },
      { key: "title", field: () => page.getByLabel("Title").click() },
      { key: "flow", field: () => page.getByLabel("Box 2", { exact: true }).click() },
      { key: "image-3", field: () => section(page, "image-3").locator("textarea").click() },
      { key: "context", field: () => page.getByRole("textbox", { name: "Context line" }).click() },
    ];
    for (const c of cases) {
      await c.field();
      const before = await counts();
      await page.keyboard.type(typed);
      const after = await counts();
      const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
      expect(changed, c.key).toEqual([c.key]);
      // One render a keystroke. (Tiptap's own state adds a few to the context line.)
      if (c.key !== "context") expect(after[c.key]! - before[c.key]!, c.key).toBe(typed.length);
    }
    // Every section is counted, so "only that section" means all of these stood still.
    expect(Object.keys(await counts()).sort()).toEqual(["aside", "board", "context", "findings", "flow", "image-1", "image-2", "image-3", "image-4", "image-5", "image-6", "image-7", "link-1", "link-2", "skills", "title"].sort());
  });

  test("nothing moves when a field takes focus", async ({ page }) => {
    const EVERYTHING = `${SECTIONS}, .xp-aside, .xp-pill, .xp-title, [data-lab-context], .xp-flow-box, .xp-found-heading, .xp-finding, .xp-figure`;
    for (const sample of SAMPLES) {
      await open(page, `?sample=${sample}`);
      const before = await drawn(page, EVERYTHING);
      expect(Object.keys(before).length).toBeGreaterThan(15);
      const fields = [page.getByLabel("Title"), page.getByRole("textbox", { name: "Context line" }), page.getByLabel("Finding 1"), page.getByLabel("Box 1", { exact: true }), page.getByLabel("Box 4", { exact: true })];
      if (sample !== "case-study") fields.push(page.locator(`${SECTIONS} figcaption textarea`).first());
      for (const field of fields) {
        await field.click();
        await expect(field).toBeFocused();
        expect(await drawn(page, EVERYTHING), `${sample}: focus`).toEqual(before);
      }
      // The context line's Highlight button shows with the focus, outside the flow.
      await page.getByRole("textbox", { name: "Context line" }).click();
      await expect(page.getByRole("button", { name: "Highlight" })).toBeVisible();
      expect(await drawn(page, EVERYTHING), `${sample}: highlight button`).toEqual(before);
    }
  });

  test("a field grows with its words, by CSS or by the fallback, and both come out the same size", async ({ page }) => {
    await open(page, "?sample=research");
    await expect(page.getByLabel("Title")).toHaveAttribute("data-grow", "css");
    const css = await drawn(page);
    const title = await page.getByLabel("Title").boundingBox();
    await open(page, "?sample=research&grow=mirror");
    await expect(page.getByLabel("Title")).toHaveAttribute("data-grow", "mirror");
    expect(await drawn(page)).toEqual(css);
    expect(await page.getByLabel("Title").boundingBox()).toEqual(title);
    // Typing a long finding makes the field taller, and it never scrolls inside itself.
    const finding = page.getByLabel("Finding 1");
    const h0 = (await finding.boundingBox())!.height;
    await finding.click();
    await page.keyboard.type(" and then a good deal more was found, enough to need another line or two of the column.");
    const fits = () => finding.evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 1);
    expect((await finding.boundingBox())!.height).toBeGreaterThan(h0);
    expect(await fits()).toBe(true);
    // The same by CSS.
    await open(page, "?sample=research");
    await page.getByLabel("Finding 1").click();
    await page.keyboard.type(" and then a good deal more was found, enough to need another line or two of the column.");
    expect((await page.getByLabel("Finding 1").boundingBox())!.height).toBeGreaterThan(h0);
  });

  for (const v of VERSIONS) {
    for (const sample of SAMPLES) {
      test(`version ${NAME[v]}, ${sample}: nothing moves when a drag starts, and until the drop sections move by transform only`, async ({ page }) => {
        await page.setViewportSize(TALL);
        await open(page, `?sample=${sample}&v=${v}`);
        const ids = await order(page);
        const last = ids[ids.length - 1]!;
        const boxBefore = await layout(page);
        const drawnBefore = await drawn(page);

        const from = await pickUp(page, last);
        // Picked up: every section is drawn exactly where it was, the lifted one's own place included.
        expect(await drawn(page)).toEqual(drawnBefore);
        expect(await layout(page)).toEqual(boxBefore);
        // The lifted copy is the section, the same size, moved only by how far the pointer has gone. It isn't scaled.
        const copy = (await page.locator("[data-lab-copy]").boundingBox())!;
        const src = drawnBefore[last]!;
        expect(copy.width).toBeCloseTo(src.w, 1);
        expect(copy.height).toBeCloseTo(src.h, 1);
        expect(copy.x - 4).toBeCloseTo(src.x, 1);
        expect(copy.y - 8).toBeCloseTo(src.y, 1);
        expect(await page.locator("[data-lab-copy]").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBe(1);

        // Up the page to the top of the first section, looking at the page on the way.
        const first = drawnBefore[ids[0]!]!;
        const to = { x: first.x + first.w / 2, y: first.y + 4 };
        let slid = 0;
        let lines = 0;
        for (let i = 1; i <= 8; i++) {
          await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8, { steps: 6 });
          await page.waitForTimeout(60);
          expect(await layout(page), `layout boxes at step ${i}`).toEqual(boxBefore);
          const now = await drawn(page);
          const moved = ids.filter((id) => Math.abs(now[id]!.x - drawnBefore[id]!.x) > 0.5 || Math.abs(now[id]!.y - drawnBefore[id]!.y) > 0.5);
          slid += moved.length;
          if (v === "b") expect(moved, `version B keeps the page still (step ${i})`).toEqual([]);
          // A slide never resizes anything. (A transformed box's size comes back with rounding noise in the fifth decimal place.)
          for (const id of ids) {
            expect(now[id]!.w, id).toBeCloseTo(drawnBefore[id]!.w, 2);
            expect(now[id]!.h, id).toBeCloseTo(drawnBefore[id]!.h, 2);
          }
          if (await page.locator("[data-lab-line]").isVisible()) lines++;
        }
        if (v === "a") {
          expect(slid).toBeGreaterThan(0);
          await expect(page.locator("[data-lab-landing]")).toBeVisible();
          expect(lines).toBe(0);
        } else {
          expect(lines).toBeGreaterThan(0);
          await expect(page.locator("[data-lab-landing]")).toBeHidden();
        }
        await expect(status(page)).toContainText(`would go to place 1 of ${ids.length}`);

        await page.mouse.up();
        // Dropped: it is first, the page is laid out again, and what slides into place does so by transform alone, in 180ms.
        expect(await order(page)).toEqual([last, ...ids.slice(0, -1)]);
        const motion = await page.evaluate((sel) =>
          document
            .getAnimations()
            // The sections' own motion. (A handle's hover colour also fades, in 160ms; that is feedback, not the drop.)
            .filter((a) => (a.effect as KeyframeEffect).target?.matches(sel))
            .map((a) => {
              const effect = a.effect as KeyframeEffect;
              return { ms: effect.getTiming().duration, props: [...new Set(effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)) };
            }),
          SECTIONS,
        );
        expect(motion.length).toBeGreaterThan(0);
        for (const m of motion) expect(m).toEqual({ ms: 180, props: ["transform"] });
        await settled(page);
        await expect(board(page)).not.toHaveAttribute("data-lab-lifting");
        await expect(page.locator("[data-lab-copy]")).toHaveCount(0);
        expect(await page.locator(SECTIONS).evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.transform || (e as HTMLElement).style.opacity || (e as HTMLElement).style.transition).length)).toBe(0);
        const after = await layout(page);
        expect(after[last]!.y).toBeLessThan(boxBefore[ids[0]!]!.y + 1);
        await expect(status(page)).toHaveText(/dropped in place 1 of/);
      });
    }
  }

  for (const v of VERSIONS) {
    test(`version ${NAME[v]}: dropped into a pair and into the image grid, the order is the place shown`, async ({ page }) => {
      await page.setViewportSize(TALL);
      // Between the findings and the graph beside them: the pair is split.
      await open(page, `?v=${v}`);
      let before = await drawn(page);
      await pickUp(page, "quote-1");
      const f = before.findings!;
      const g = before["graph-1"]!;
      await page.mouse.move((f.x + f.w + g.x) / 2, f.y + f.h / 2, { steps: 20 });
      await expect(status(page)).toContainText("would go to place 3 of 7");
      if (v === "b") {
        // The line stands upright in the gap between the two.
        const line = (await page.locator("[data-lab-line]").boundingBox())!;
        expect(line.height).toBeGreaterThan(line.width * 10);
        expect(line.x).toBeGreaterThan(f.x + f.w - 1);
        expect(line.x + line.width).toBeLessThan(g.x + 1);
      }
      await page.mouse.up();
      expect(await order(page)).toEqual(["flow", "findings", "quote-1", "graph-1", "graph-2", "reflection-1", "link-1"]);
      await settled(page);
      // The two graphs are now neighbours, so they share a row.
      const now = await drawn(page);
      expect(now["graph-1"]!.y).toBeCloseTo(now["graph-2"]!.y, 0);

      // Inside the grid: an image dragged from the first row to the gap between two tiles of the second.
      await open(page, `?sample=gallery&v=${v}`);
      before = await drawn(page);
      await pickUp(page, "image-2");
      const a = before["image-5"]!;
      const b = before["image-6"]!;
      await page.mouse.move((a.x + a.w + b.x) / 2, a.y + a.h / 2, { steps: 20 });
      await expect(status(page)).toContainText("would go to place 8 of 11");
      if (v === "a") {
        // The tiles between shuffle along by one slot; a tile that changes row moves across and up.
        await page.waitForTimeout(250);
        const mid = await drawn(page);
        expect(mid["image-3"]!.x).toBeCloseTo(before["image-2"]!.x, 0);
        expect(mid["image-4"]!.x).toBeCloseTo(before["image-3"]!.x, 0);
        expect(mid["image-5"]!.x).toBeCloseTo(before["image-4"]!.x, 0);
        expect(mid["image-5"]!.y).toBeCloseTo(before["image-4"]!.y, 0);
        expect(mid["image-6"]!).toEqual(before["image-6"]!);
      }
      await page.mouse.up();
      expect(await order(page)).toEqual(["image-1", "flow", "findings", "link-1", "image-3", "image-4", "image-5", "image-2", "image-6", "image-7", "link-2"]);
    });

    test(`version ${NAME[v]}: no flicker on a boundary, beside a pair and inside the image grid`, async ({ page }) => {
      await page.setViewportSize(TALL);
      /** Counts every change of place, and (version A) every time a section is given a new transform. */
      const watch = () =>
        page.evaluate((sel) => {
          const w = window as unknown as { __places: string[]; __slides: number };
          w.__places = [];
          w.__slides = 0;
          const root = document.querySelector<HTMLElement>("[data-lab-board]")!;
          new MutationObserver(() => w.__places.push(root.dataset.labPlace ?? "")).observe(root, { attributes: true, attributeFilter: ["data-lab-place"] });
          const slides = new MutationObserver((list) => (w.__slides += list.length));
          document.querySelectorAll(sel).forEach((el) => slides.observe(el, { attributes: true, attributeFilter: ["style"] }));
        }, SECTIONS);
      const seen = () => page.evaluate(() => ({ places: (window as unknown as { __places: string[] }).__places.length, slides: (window as unknown as { __slides: number }).__slides }));
      const place = () => board(page).getAttribute("data-lab-place");

      /**
       * Walks the pointer a pixel at a time from one point towards another until the place changes,
       * then rests there and trembles 2px either side, 40 times. The place must not change again.
       */
      async function restOnBoundary(from: { x: number; y: number }, to: { x: number; y: number }, where: string) {
        await page.mouse.move(from.x, from.y, { steps: 10 });
        const start = await place();
        const n = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
        let at = from;
        for (let i = 1; i <= n && (await place()) === start; i++) {
          at = { x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n };
          await page.mouse.move(at.x, at.y);
        }
        expect(await place(), `${where}: the pointer crossed a boundary`).not.toBe(start);
        const crossed = await place();
        const ux = (to.x - from.x) / n;
        const uy = (to.y - from.y) / n;
        await page.waitForTimeout(250);
        const before = await seen();
        for (let i = 0; i < 40; i++) {
          const d = i % 2 ? 2 : -2;
          await page.mouse.move(at.x + ux * d, at.y + uy * d);
        }
        await page.mouse.move(at.x, at.y);
        // Resting: half a second with the pointer still.
        await page.waitForTimeout(500);
        expect(await seen(), where).toEqual(before);
        expect(await place(), where).toBe(crossed);
      }

      // Beside a pair: the link is carried up to the findings-and-graph row and moved across the gap between the two.
      await open(page, `?v=${v}`);
      let at = await drawn(page);
      await pickUp(page, "link-1");
      await watch();
      const f = at.findings!;
      const g = at["graph-1"]!;
      const mid = f.y + f.h / 2;
      await restOnBoundary({ x: f.x + f.w * 0.55, y: mid }, { x: g.x + g.w * 0.45, y: mid }, "across the pair's gap");
      // And down its left side: from before the pair to after it.
      await restOnBoundary({ x: f.x + f.w * 0.2, y: f.y + f.h * 0.3 }, { x: f.x + f.w * 0.2, y: f.y + f.h + 30 }, "down the side of the pair");
      await page.keyboard.press("Escape");
      await expect(board(page)).not.toHaveAttribute("data-lab-lifting");
      expect(await order(page)).toEqual(["flow", "findings", "graph-1", "graph-2", "quote-1", "reflection-1", "link-1"]);

      // Inside the grid: a tile carried along a row, and from one row to the next.
      await open(page, `?sample=gallery&v=${v}`);
      at = await drawn(page);
      await pickUp(page, "image-2");
      await watch();
      const t3 = at["image-3"]!;
      const t4 = at["image-4"]!;
      const t6 = at["image-6"]!;
      await restOnBoundary({ x: t3.x + t3.w * 0.3, y: t3.y + t3.h / 2 }, { x: t4.x + t4.w * 0.7, y: t3.y + t3.h / 2 }, "along a row of the grid");
      await restOnBoundary({ x: t3.x + t3.w / 2, y: t3.y + t3.h * 0.6 }, { x: t6.x + t6.w / 2, y: t6.y + t6.h * 0.4 }, "between two rows of the grid");
      await page.mouse.up();
    });
  }

  for (const v of VERSIONS) {
    test(`version ${NAME[v]}: the keyboard moves a section across a pair and into and out of the image grid`, async ({ page }) => {
      await open(page, `?v=${v}`);
      // Across the pair: the quote, from under the second graph to above the findings.
      const grip = section(page, "quote-1").locator("[data-grip]");
      await grip.focus();
      await expect(grip).toHaveAccessibleDescription(/press Space or Enter, use the arrow keys/);
      const before = await layout(page);
      await page.keyboard.press("Space");
      await expect(status(page)).toHaveText("Picked up quote, place 5 of 7.");
      await expect(board(page)).toHaveAttribute("data-lab-lifting", "keys");
      expect(await layout(page)).toEqual(before);
      await page.keyboard.press("ArrowUp");
      await expect(status(page)).toHaveText("Quote would go to place 4 of 7.");
      await page.keyboard.press("ArrowUp");
      await expect(status(page)).toHaveText("Quote would go to place 3 of 7.");
      await page.keyboard.press("ArrowUp");
      await expect(status(page)).toHaveText("Quote would go to place 2 of 7.");
      // Still nothing has changed its layout box: version A has slid things, version B has drawn a line.
      expect(await layout(page)).toEqual(before);
      if (v === "b") await expect(page.locator("[data-lab-line]")).toBeVisible();
      else await expect(section(page, "findings")).toHaveAttribute("style", /translate/);
      await page.keyboard.press("Space");
      await expect(status(page)).toHaveText("Quote dropped in place 2 of 7.");
      expect(await order(page)).toEqual(["flow", "quote-1", "findings", "graph-1", "graph-2", "reflection-1", "link-1"]);
      await expect(section(page, "quote-1").locator("[data-grip]")).toBeFocused();
      // Down into the pair, splitting it, and Escape puts it back.
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await expect(status(page)).toHaveText("Quote would go to place 4 of 7.");
      await page.keyboard.press("Escape");
      await expect(status(page)).toHaveText("Moving quote cancelled. It's back where it was.");
      expect(await order(page)).toEqual(["flow", "quote-1", "findings", "graph-1", "graph-2", "reflection-1", "link-1"]);
      await expect(board(page)).not.toHaveAttribute("data-lab-lifting");
      // Space, right arrow, left arrow, Space: dropped where it was.
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Space");
      await expect(status(page)).toHaveText("Quote dropped where it was.");

      // The image grid: a link goes in, splitting the run of images, and out the far side.
      await open(page, `?sample=gallery&v=${v}`);
      await section(page, "link-1").locator("[data-grip]").focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Space");
      expect(await order(page)).toEqual(["image-1", "flow", "findings", "image-2", "image-3", "link-1", "image-4", "image-5", "image-6", "image-7", "link-2"]);
      await expect(section(page, "link-1").locator("[data-grip]")).toBeFocused();
      await page.keyboard.press("Space");
      for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Space");
      expect(await order(page)).toEqual(["image-1", "flow", "findings", "image-2", "image-3", "image-4", "image-5", "image-6", "image-7", "link-1", "link-2"]);
      // An image comes out of the grid to sit before the findings (they pair), and the lead image goes into it.
      await section(page, "image-2").locator("[data-grip]").focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Space");
      expect(await order(page)).toEqual(["image-1", "flow", "image-2", "findings", "image-3", "image-4", "image-5", "image-6", "image-7", "link-1", "link-2"]);
      await settled(page);
      const paired = await drawn(page);
      expect(paired["image-2"]!.y + paired["image-2"]!.h).toBeGreaterThan(paired.findings!.y);
      expect(paired["image-2"]!.x).toBeLessThan(paired.findings!.x);
      await section(page, "image-1").locator("[data-grip]").focus();
      await page.keyboard.press("Space");
      for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
      await expect(status(page)).toHaveText("Lead image would go to place 6 of 11.");
      await page.keyboard.press("Space");
      expect(await order(page)).toEqual(["flow", "image-2", "findings", "image-3", "image-4", "image-1", "image-5", "image-6", "image-7", "link-1", "link-2"]);
      // The far ends stop.
      await section(page, "flow").locator("[data-grip]").focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowUp");
      await expect(status(page)).toHaveText("Picked up flowchart, place 1 of 11.");
      await page.keyboard.press("Escape");
    });
  }

  test("move up and move down do the same a place at a time, and keep the focus", async ({ page }) => {
    await open(page);
    const up = section(page, "graph-2").locator('[data-move="up"]');
    await up.focus();
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText("Graph 2 moved up: now 3 of 7.");
    expect(await order(page)).toEqual(["flow", "findings", "graph-2", "graph-1", "quote-1", "reflection-1", "link-1"]);
    await expect(section(page, "graph-2").locator('[data-move="up"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    expect(await order(page)).toEqual(["graph-2", "flow", "findings", "graph-1", "quote-1", "reflection-1", "link-1"]);
    // At the top, move up is off and the focus goes to move down.
    await expect(section(page, "graph-2").locator('[data-move="up"]')).toBeDisabled();
    await expect(section(page, "graph-2").locator('[data-move="down"]')).toBeFocused();
    // The flowchart moves like any other section.
    await section(page, "flow").locator('[data-move="down"]').click();
    expect((await order(page)).slice(0, 3)).toEqual(["graph-2", "findings", "flow"]);
    // Reset puts the sample back.
    await page.getByRole("button", { name: "Reset" }).click();
    expect(await order(page)).toEqual(["flow", "findings", "graph-1", "graph-2", "quote-1", "reflection-1", "link-1"]);
  });

  test("the page scrolls itself when a section is held near the bottom edge, with the pointer still", async ({ page }) => {
    await open(page, "?sample=gallery&v=b");
    await pickUp(page, "image-1");
    const view = page.viewportSize()!;
    await page.mouse.move(view.width / 2, view.height - 12, { steps: 12 });
    const y0 = await page.evaluate(() => window.scrollY);
    const p0 = await board(page).getAttribute("data-lab-place");
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 }).toBeGreaterThan(y0 + 300);
    // The place keeps up with the page under the still pointer.
    expect(await board(page).getAttribute("data-lab-place")).not.toBe(p0);
    await page.mouse.up();
    expect((await order(page))[0]).not.toBe("image-1");
  });

  test("with reduced motion nothing animates, in either version", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(TALL);
    for (const v of VERSIONS) {
      await open(page, `?v=${v}`);
      const before = await drawn(page);
      await pickUp(page, "link-1");
      const g = before["graph-2"]!;
      await page.mouse.move(g.x + g.w / 2, g.y + 10, { steps: 10 });
      expect(await page.locator(SECTIONS).evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration))).toEqual(Array(7).fill("0s"));
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      await page.mouse.up();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      expect(await order(page)).toEqual(["flow", "findings", "graph-1", "link-1", "graph-2", "quote-1", "reflection-1"]);
      // Dropped straight into place.
      const after = await drawn(page);
      expect(after["link-1"]!.y).toBeCloseTo(before["graph-2"]!.y, 0);
    }
    // The keyboard and the move buttons too.
    await section(page, "flow").locator('[data-move="down"]').click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("the frames, handles and lifted copy take the look's own colours, and stay sharp on the dark one", async ({ page }) => {
    await page.setViewportSize(TALL);
    const LINK = { exhbt: "rgb(0, 117, 93)", night: "rgb(79, 233, 180)" };
    for (const look of ["exhbt", "night"] as const) {
      await open(page, `?look=${look}&v=b`);
      const ground = await page.locator("[data-exhbt-page]").evaluate((el) => getComputedStyle(el).backgroundColor);
      // A handle: the look's outline button.
      const grip = section(page, "findings").locator("[data-grip]");
      const gripStyle = await grip.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, size: el.getBoundingClientRect().width }));
      expect(gripStyle.bg).toBe(ground);
      expect(gripStyle.size).toBe(36);
      // The frame, when the focus is in the section.
      await page.getByLabel("Finding 1").focus();
      expect(await section(page, "findings").evaluate((el) => getComputedStyle(el).outlineColor)).toBe(LINK[look]);
      // The lifted copy's card and the line.
      const before = await drawn(page);
      await pickUp(page, "findings");
      const card = await page.locator("[data-lab-copy] .lab-card").evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, outline: s.outlineColor, width: s.outlineWidth, shadow: s.boxShadow };
      });
      expect(card.bg).toBe(ground);
      expect(card.outline).toBe(LINK[look]);
      expect(card.width).toBe("2px");
      expect(card.shadow).not.toBe("none");
      const q = before["quote-1"]!;
      await page.mouse.move(q.x + q.w / 2, q.y + q.h + 20, { steps: 10 });
      expect(await page.locator("[data-lab-line]").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(LINK[look]);
      await page.mouse.up();
    }
  });

  test("flow boxes: a box is dragged along the row, moved from the keyboard, and a + on an arrow adds one there", async ({ page }) => {
    await open(page);
    const boxes = () => page.locator("[data-flow-step]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.flowStep));
    const words = () => page.locator("[data-flow-step] textarea").evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
    expect(await boxes()).toEqual(["step-1", "step-2", "step-3", "step-4", "step-5"]);
    const sectionsBefore = await drawn(page);
    // By mouse: the first box to the third place.
    const grip = page.locator('[data-flow-step="step-1"] [data-flow-grip]');
    const g = (await grip.boundingBox())!;
    const third = (await page.locator('[data-flow-step="step-3"] .xp-flow-box').boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2 + 10, g.y + g.height / 2, { steps: 3 });
    await page.mouse.move(third.x + third.width * 0.7, third.y + third.height / 2, { steps: 15 });
    await expect(page.locator('[data-flow-step="step-1"]')).toHaveAttribute("data-dragging", "true");
    // The sections round the flowchart don't move while a box is dragged.
    expect(await drawn(page)).toEqual(sectionsBefore);
    await page.mouse.up();
    expect(await boxes()).toEqual(["step-2", "step-3", "step-1", "step-4", "step-5"]);
    // The result is still the last box, in ink.
    await expect(page.locator('[data-flow-step="step-5"] .xp-flow-box')).toHaveAttribute("data-last", "true");
    // By keyboard: Space, right arrow, Space.
    await page.locator('[data-flow-step="step-2"] [data-flow-grip]').focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Picked up box 1 of 5.")).toBeAttached();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("The box would go to place 2 of 5.")).toBeAttached();
    await page.keyboard.press("Space");
    await expect(page.getByText("Box dropped in place 2 of 5.")).toBeAttached();
    expect(await boxes()).toEqual(["step-3", "step-2", "step-1", "step-4", "step-5"]);
    // "+" on the second arrow: an empty box there, with the cursor in it.
    await page.getByRole("button", { name: "Add a box after box 2" }).click();
    expect((await words())[2]).toBe("");
    expect((await boxes()).length).toBe(6);
    await expect(page.getByLabel("Box 3", { exact: true })).toBeFocused();
    await page.keyboard.type("A new step");
    expect((await words())[2]).toBe("A new step");
    // Six is the most, so the "+" buttons go.
    await expect(page.getByRole("button", { name: /Add a box after/ })).toHaveCount(0);
  });

  test("+ between sections adds a placeholder there", async ({ page }) => {
    await open(page);
    const add = page.getByRole("button", { name: "Add a section before graph 2" });
    await add.click();
    await expect(page.getByRole("group", { name: "Add a section" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Add a section" })).toHaveCount(0);
    await add.click();
    await page.getByRole("button", { name: "Quote", exact: true }).click();
    expect(await order(page)).toEqual(["flow", "findings", "graph-1", "quote-2", "graph-2", "quote-1", "reflection-1", "link-1"]);
    await expect(status(page)).toHaveText("Quote added in place 4 of 8.");
    await page.getByRole("button", { name: "Add a section at the end" }).click();
    await page.getByRole("button", { name: "Findings", exact: true }).click();
    expect((await order(page)).at(-1)).toBe("findings-1");
    await expect(section(page, "findings-1").getByLabel("Finding 1")).toBeFocused();
    await page.keyboard.type("A new finding");
    // An image placeholder next to the new findings pairs with them.
    await page.getByRole("button", { name: "Add a section at the end" }).click();
    await page.getByRole("button", { name: "Image", exact: true }).click();
    await settled(page);
    const now = await drawn(page);
    expect(now["image-1"]!.y).toBeLessThan(now["findings-1"]!.y + now["findings-1"]!.h);
    expect(now["image-1"]!.x).toBeGreaterThan(now["findings-1"]!.x + 100);
  });

  for (const v of VERSIONS) {
    test(`version ${NAME[v]}: axe finds nothing on any sample, at rest or with a section lifted`, async ({ page }) => {
      for (const sample of SAMPLES) {
        await open(page, `?sample=${sample}&v=${v}`);
        await axe(page, `${sample} ${v}`);
      }
      // Lifted from the keyboard, in the dark look.
      await open(page, `?sample=gallery&look=night&v=${v}`);
      await axe(page, `night ${v}`);
      await section(page, "image-3").locator("[data-grip]").focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await axe(page, `night ${v} lifted`);
      await page.keyboard.press("Escape");
      // With a field in use and the Highlight button showing.
      await open(page, `?look=classic&v=${v}`);
      await page.getByRole("textbox", { name: "Context line" }).click();
      await axe(page, `classic ${v} typing`);
    });
  }
});

/* ------------------------------------------------------------------------------------------ */

test.describe("Touch (Pixel 7)", () => {
  test.skip(({ isMobile }) => !isMobile, "runs in the mobile project");

  /** Real touch input through the browser, so scrolling and the press delay behave as they do under a finger. */
  async function finger(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    return {
      down: (x: number, y: number) => send("touchStart", x, y),
      move: (x: number, y: number) => send("touchMove", x, y),
      up: () => send("touchEnd"),
      /** A drag from one point to another in steps, a frame apart. */
      async slide(from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
        for (let i = 1; i <= steps; i++) {
          await send("touchMove", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
          await page.waitForTimeout(16);
        }
      },
    };
  }

  test("the handles are always there and big enough for a finger", async ({ page }) => {
    await open(page, "?sample=gallery");
    const tools = section(page, "findings").locator(".lab-tools");
    expect(await tools.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    for (const b of await page.locator(`${SECTIONS} .lab-tools button, [data-insert], [data-flow-grip], [data-flow-add]`).all()) {
      const r = (await b.boundingBox())!;
      expect(Math.min(r.width, r.height), (await b.getAttribute("aria-label")) ?? "").toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  for (const v of VERSIONS) {
    test(`version ${NAME[v]}: a swipe on a section scrolls the page and moves nothing; a short press on the grip picks up`, async ({ page }) => {
      await open(page, `?sample=gallery&v=${v}`);
      const touch = await finger(page);
      const start = await order(page);
      const before = await drawn(page);

      // A swipe up, starting on a section's words.
      const words = section(page, "findings");
      await words.scrollIntoViewIfNeeded();
      const w = (await words.boundingBox())!;
      const y0 = await page.evaluate(() => window.scrollY);
      await touch.down(w.x + 80, w.y + 40);
      await touch.slide({ x: w.x + 80, y: w.y + 40 }, { x: w.x + 80, y: w.y - 260 });
      await touch.up();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0 + 150);
      expect(await order(page)).toEqual(start);
      expect(await drawn(page)).toEqual(before);
      // No drag ever started.
      await expect(board(page)).not.toHaveAttribute("data-lab-place");

      // A swipe on a picture in the grid scrolls too.
      const tile = section(page, "image-4");
      await tile.scrollIntoViewIfNeeded();
      const t = (await tile.locator("img").boundingBox())!;
      const y1 = await page.evaluate(() => window.scrollY);
      await touch.down(t.x + t.width / 2, t.y + t.height / 2);
      await touch.slide({ x: t.x + t.width / 2, y: t.y + t.height / 2 }, { x: t.x + t.width / 2, y: t.y + t.height / 2 - 220 });
      await touch.up();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y1 + 120);
      expect(await order(page)).toEqual(start);
      await expect(board(page)).not.toHaveAttribute("data-lab-place");

      // A quick swipe that starts on a grip is not a press: nothing is picked up.
      const shell = section(page, "image-3");
      await shell.locator("[data-grip]").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      let g = (await shell.locator("[data-grip]").boundingBox())!;
      let at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
      await touch.down(at.x, at.y);
      await touch.slide(at, { x: at.x, y: at.y + 120 }, 5);
      await touch.up();
      await expect(board(page)).not.toHaveAttribute("data-lab-place");
      expect(await order(page)).toEqual(start);

      // A short press (longer than 150ms) on the grip picks the tile up; nothing moves as it lifts.
      g = (await shell.locator("[data-grip]").boundingBox())!;
      at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
      const still = await drawn(page);
      const boxes = await layout(page);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await touch.down(at.x, at.y);
      await page.waitForTimeout(260);
      await touch.move(at.x, at.y + 2);
      await expect(board(page)).toHaveAttribute("data-lab-lifting", "pointer");
      expect(await drawn(page)).toEqual(still);
      // Down and to the left, to the far side of the first tile of the next row. The page doesn't scroll under a held section.
      const next = (await section(page, "image-4").boundingBox())!;
      await touch.slide(at, { x: next.x + next.width * 0.8, y: next.y + next.height / 2 }, 14);
      await page.waitForTimeout(250);
      expect(await layout(page)).toEqual(boxes);
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(2);
      await expect(status(page)).toContainText("would go to place 7 of 11");
      if (v === "b") await expect(page.locator("[data-lab-line]")).toBeVisible();
      else await expect(page.locator("[data-lab-landing]")).toBeVisible();
      await touch.up();
      expect(await order(page)).toEqual(["image-1", "flow", "findings", "link-1", "image-2", "image-4", "image-3", "image-5", "image-6", "image-7", "link-2"]);
      await settled(page);
      await expect(board(page)).not.toHaveAttribute("data-lab-lifting");
    });
  }

  test("flow boxes are a column on a phone, and a box is dragged down it", async ({ page }) => {
    await open(page);
    const touch = await finger(page);
    const boxes = () => page.locator("[data-flow-step]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.flowStep));
    const first = page.locator('[data-flow-step="step-1"]');
    await first.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const one = (await first.locator(".xp-flow-box").boundingBox())!;
    const two = (await page.locator('[data-flow-step="step-2"] .xp-flow-box').boundingBox())!;
    const three = (await page.locator('[data-flow-step="step-3"] .xp-flow-box').boundingBox())!;
    expect(two.y).toBeGreaterThan(one.y + one.height);
    expect(two.x).toBe(one.x);
    const g = (await first.locator("[data-flow-grip]").boundingBox())!;
    const at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
    await touch.down(at.x, at.y);
    await page.waitForTimeout(260);
    await touch.slide(at, { x: at.x, y: three.y + three.height * 0.7 }, 14);
    await page.waitForTimeout(250);
    await touch.up();
    expect(await boxes()).toEqual(["step-2", "step-3", "step-1", "step-4", "step-5"]);
  });

  test("axe finds nothing on a phone, and the page matches the published one", async ({ page }) => {
    for (const sample of SAMPLES) {
      await open(page, `?sample=${sample}&v=b`);
      await axe(page, `phone ${sample}`);
    }
    const read = () =>
      page.evaluate(() => {
        const root = document.querySelector("[data-exhbt-page]")!;
        const o = root.getBoundingClientRect();
        return Array.from(root.querySelectorAll<HTMLElement>(".xp-card, .xp-title, .xp-context, .xp-flow-box, .xp-found-heading, .xp-finding, .xp-figure, [data-part=quote], [data-part=reflection], [data-part=link]"), (el) => {
          const r = el.getBoundingClientRect();
          return [Math.round((r.left - o.left) * 20) / 20, Math.round((r.top - o.top) * 20) / 20, Math.round(r.width * 20) / 20, Math.round(r.height * 20) / 20];
        });
      });
    await open(page);
    const lab = await read();
    await open(page, "?read=1");
    expect(lab).toEqual(await read());
  });
});
