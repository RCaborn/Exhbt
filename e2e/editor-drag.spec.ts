import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LIMITS, wordCount, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { formatOf, FORMAT_RULES, type Format } from "../lib/exhbt/formats";
import { blockOptions, pageItems, rowsFor, type Cell, type Row } from "../lib/exhbt/layouts";
import { openBankingDoc } from "../lib/exhbt/sample";
import { newImageSection, newSection, roomFor } from "../lib/exhbt/sections";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { labelOf } from "../components/exhbt-editor/labels";
import { HYSTERESIS, makePlan, orderWith, placeAt, pointFor, rowsInfo, type Box } from "../components/exhbt-editor/drag/plan";
import { docNow, frame, freshName, grip, offered, openDoc, pageOrder, READY, SAMPLES, waitReady } from "./page-editor";

/*
 * Dragging on the edit-on-page editor (decision 0026, "Dragging" and "Smoothness"; the prototype's
 * checks, docs/briefs/edit-on-page/drag-prototype.md): a section slides, the flowchart is carried
 * with a line over a still page, nothing moves when a drag starts, a drag changes nothing but
 * transforms until the drop, no place flickers on a boundary, the keyboard does every move, the
 * page scrolls itself near an edge, and nothing animates under reduced motion. Then the "+" between
 * sections and the tray. Each runs on the sample of every layout the editor offers (offered() and
 * SAMPLES), so a layout added later is covered with no change here.
 *
 * Desktop project: everything but the touch checks. Touch project (Pixel 7): the touch checks.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const FRAMES = `${READY} article [data-section-id]`;
/** Tall enough for a whole sample, so a mouse drag never has to scroll. Widths (and so layouts) are a desktop's. */
const TALL = { width: 1440, height: 3600 };

type Rect = { x: number; y: number; w: number; h: number };

/** Signs in as a fresh user with every sample, in a look, and opens the editor on the sample of layout `f`. */
async function open(page: Page, f: Format, look?: string): Promise<string> {
  const user = freshName(`drag${f}`);
  await page.goto(`/dev/portfolio?username=${user}&plan=max&count=0&with=${SAMPLES[f].with}${look ? `&look=${look}` : ""}`);
  await page.goto(`/auth/dev?email=${user}@example.com&next=/exhbts`);
  const href = await page.locator('a[href$="/edit"]').first().getAttribute("href");
  await page.goto(href!);
  await waitReady(page);
  await settle(page);
  return href!;
}

/** Fonts in, pictures loaded, laid out. */
const settle = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.addEventListener("load", done, { once: true }), img.addEventListener("error", done, { once: true }))))));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });

/** The main column while something is carried. */
const lifting = (page: Page) => page.locator(`${READY} [data-xe-drag]`);
const place = (page: Page) => page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null);
const said = (page: Page) => page.locator(`${READY} [data-said]`);
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => null));

/** Where every frame is drawn, on the page (so scrolling doesn't count as moving). Includes any transform. */
const drawn = (page: Page) =>
  page.locator(FRAMES).evaluateAll((els) => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const e of els) {
      const r = e.getBoundingClientRect();
      out[(e as HTMLElement).dataset.sectionId!] = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    }
    return out;
  });

/** Every frame's layout box: its offsets summed up the page, and its offset size. Transforms don't change these. */
const layout = (page: Page) =>
  page.locator(FRAMES).evaluateAll((els) => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const e of els as HTMLElement[]) {
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = e; n; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      out[e.dataset.sectionId!] = { x, y, w: e.offsetWidth, h: e.offsetHeight };
    }
    return out;
  });

/** Frames with a transform, a transition or an opacity set by the drag. */
const styled = (page: Page) => page.locator(FRAMES).evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.transform || (e as HTMLElement).style.opacity || (e as HTMLElement).style.transition).map((e) => (e as HTMLElement).dataset.sectionId));

/** Presses the mouse on a section's grip and moves past the 6px threshold. Returns where the pointer is. */
async function pickUp(page: Page, id: string) {
  await frame(page, id).hover();
  const g = (await grip(page, id).boundingBox())!;
  const at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 4, at.y + 8, { steps: 4 });
  await expect(lifting(page)).toHaveAttribute("data-xe-drag", "pointer");
  return { x: at.x + 4, y: at.y + 8 };
}

/** Where every frame is drawn in the window now (where the mouse goes). */
const client = (page: Page) =>
  page.locator(FRAMES).evaluateAll((els) => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const e of els) {
      const r = e.getBoundingClientRect();
      out[(e as HTMLElement).dataset.sectionId!] = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return out;
  });
const union = (list: Rect[]): Rect => {
  const x = Math.min(...list.map((b) => b.x));
  const y = Math.min(...list.map((b) => b.y));
  return { x, y, w: Math.max(...list.map((b) => b.x + b.w)) - x, h: Math.max(...list.map((b) => b.y + b.h)) - y };
};

/** The page's rows now, as the editor draws them. */
async function rowsNow(page: Page): Promise<Row[]> {
  const doc = await docNow(page);
  return rowsFor(pageItems(doc), formatOf(doc));
}
const ids = (c: Cell) => (c.cell === "item" ? [c.item.id] : c.items.map((x) => x.item.id));
const firstPair = (rows: Row[]) => rows.find((r): r is Extract<Row, { row: "pair" }> => r.row === "pair");
/** The page's largest run of pictures in the grid, if it has one of two or more. */
const grid = (rows: Row[]) =>
  rows
    .filter((r): r is Extract<Row, { row: "group" }> => r.row === "group" && r.of === "grid" && r.items.length > 1)
    .sort((a, b) => b.items.length - a.items.length)[0];

/** "Graph 1", as the words read out name it. */
const nameOf = async (page: Page, id: string) => labelOf(await docNow(page), id);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Records every animation a frame is given from now on, as it starts: its length and what it
 * animates. Read with frameMotion(); recorded rather than read off the page afterwards, because a
 * 180ms animation can be over before a slow machine gets round to looking.
 */
const recordMotion = (page: Page) =>
  page.evaluate((sel) => {
    const w = window as unknown as { __motion: { ms: unknown; props: string[] }[]; __animate?: typeof Element.prototype.animate };
    w.__motion = [];
    if (!w.__animate) {
      w.__animate = Element.prototype.animate;
      Element.prototype.animate = function (this: Element, keyframes, options) {
        if (this.matches(sel) && Array.isArray(keyframes)) {
          const props = [...new Set(keyframes.flatMap((k) => Object.keys(k)))].filter((k) => !["offset", "easing", "composite"].includes(k));
          w.__motion.push({ ms: typeof options === "number" ? options : options?.duration, props });
        }
        return w.__animate!.call(this, keyframes, options);
      };
    }
  }, FRAMES);
const frameMotion = (page: Page) => page.evaluate(() => (window as unknown as { __motion: { ms: unknown; props: string[] }[] }).__motion);

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).include(READY).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

/* ------------------------------------------------------------------------------------------------
 * The plan, in-process: no page needed
 * ---------------------------------------------------------------------------------------------- */

test.describe("the drag's plan", () => {
  test.skip(({ isMobile }) => isMobile, "in-process; once is enough");

  /** A page: a lone row, a pair whose right side is a stack of two, a grid of five tiles on two lines, and a lone row. */
  const W = 700;
  const boxes: Record<string, Box> = {
    flow: { x: 0, y: 0, w: W, h: 120 },
    left: { x: 0, y: 164, w: 330, h: 300 },
    top: { x: 370, y: 164, w: 330, h: 120 },
    under: { x: 370, y: 308, w: 330, h: 140 },
    t1: { x: 0, y: 508, w: 220, h: 160 },
    t2: { x: 232, y: 508, w: 220, h: 160 },
    t3: { x: 464, y: 508, w: 236, h: 160 },
    t4: { x: 0, y: 680, w: 340, h: 200 },
    t5: { x: 352, y: 680, w: 200, h: 200 },
    last: { x: 0, y: 924, w: W, h: 100 },
  };
  const order = Object.keys(boxes);
  const rows = rowsInfo([
    { row: "one", cell: { cell: "item", item: { id: "flow", kind: "flow", index: 0, steps: [] }, as: "plain" } },
    {
      row: "pair",
      ratio: "even",
      reversed: false,
      left: { cell: "item", item: { id: "left", kind: "findings", index: 1 } as never, as: "plain" },
      right: { cell: "stack", name: "happened", items: ["top", "under"].map((id) => ({ cell: "item" as const, item: { id, kind: "graph", index: 2 } as never, as: "stacked" as const })) },
    },
    { row: "group", of: "grid", items: ["t1", "t2", "t3", "t4", "t5"].map((id) => ({ cell: "item" as const, item: { id, kind: "image", index: 3 } as never, as: "tile" as const })) },
    { row: "one", cell: { cell: "item", item: { id: "last", kind: "quote", index: 9 } as never, as: "plain" } },
  ]);

  test("every place has a point where it, and no other, is the nearest", () => {
    for (const id of [...order, "new"]) {
      const plan = makePlan(id, order, boxes, rows, W);
      for (let p = 0; p < plan.anchors.length; p++) {
        const at = pointFor(plan, p);
        expect(placeAt(plan, at.x, at.y, -1), `${id} at place ${p}`).toBe(p);
      }
    }
  });

  test("a pointer resting on the boundary between two places and trembling 2px either side never changes the place", () => {
    for (const id of ["last", "t2", "top", "new"]) {
      const plan = makePlan(id, order, boxes, rows, W);
      for (let p = 0; p + 1 < plan.anchors.length; p++) {
        const a = pointFor(plan, p);
        const b = pointFor(plan, p + 1);
        // Walk from one place's point towards the next until the place changes: that is the boundary.
        let current = p;
        let at = a;
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
        for (let i = 1; i <= n && current === p; i++) {
          at = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
          current = placeAt(plan, at.x, at.y, current);
        }
        const crossed = current;
        const ux = (b.x - a.x) / n;
        const uy = (b.y - a.y) / n;
        for (let i = 0; i < 40; i++) {
          const d = i % 2 ? 2 : -2;
          current = placeAt(plan, at.x + ux * d, at.y + uy * d, current);
          expect(current, `${id}: between places ${p} and ${p + 1}`).toBe(crossed);
        }
      }
    }
    expect(HYSTERESIS).toBe(10);
  });

  test("a pointer still on the grip is at home, whatever row the section is in", () => {
    for (const id of ["top", "under", "t2", "t4", "last"]) {
      const b = boxes[id]!;
      // The toolbar sits above the section's top right corner, in the gap above it.
      const tools = { x: b.x + b.w - 150, y: b.y - 42, w: 150, h: 42 };
      const plan = makePlan(id, order, boxes, rows, W, tools);
      expect(placeAt(plan, b.x + b.w - 130, b.y - 18, plan.home), id).toBe(plan.home);
    }
  });

  test("places count the page items with the carried one taken out, as store.move does", () => {
    expect(orderWith(["a", "b", "c", "d"], "b", 0)).toEqual(["b", "a", "c", "d"]);
    expect(orderWith(["a", "b", "c", "d"], "b", 3)).toEqual(["a", "c", "d", "b"]);
    expect(orderWith(["a", "b"], "new", 1)).toEqual(["a", "new", "b"]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Dragging with the mouse
 * ---------------------------------------------------------------------------------------------- */

test.describe("dragging with a mouse", () => {
  test.skip(({ isMobile }) => isMobile, "the touch checks are below");

  for (const f of offered()) {
    test(`${f}: the hidden copy the drag measures in lays the page out as the page does`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f);
      for (const id of await pageOrder(page)) {
        await grip(page, id).focus();
        await page.keyboard.press("Space");
        await expect(lifting(page)).toHaveAttribute("data-xe-drag", "keys");
        expect(await page.evaluate(() => window.__exhbtDrag!.fidelity()), `${f}, ${id} lifted`).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(lifting(page)).toHaveCount(0);
      }
    });

    test(`${f}: picked up by its grip with a mouse, every section stays where it is, at its own place`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f);
      const order = await pageOrder(page);
      const before = await drawn(page);
      for (const [i, id] of order.entries()) {
        await pickUp(page, id);
        expect(await place(page), `${f}, ${id}`).toBe(i);
        expect(await drawn(page), `${f}, ${id}`).toEqual(before);
        await page.keyboard.press("Escape");
        await page.mouse.up();
        await expect(lifting(page)).toHaveCount(0);
        // The section goes back from where it was let go, raised over its neighbours for those 180ms.
        await settled(page);
      }
      expect(await pageOrder(page)).toEqual(order);
    });

    test(`${f}: a click on a grip, or a nudge under 6px, is not a drag; a section's words can still be selected`, async ({ page }) => {
      await open(page, f);
      const order = await pageOrder(page);
      const id = order[order.length - 1]!;
      await frame(page, id).scrollIntoViewIfNeeded();
      const before = await drawn(page);
      await frame(page, id).hover();
      const g = (await grip(page, id).boundingBox())!;
      await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + g.width / 2 + 3, g.y + g.height / 2 + 3, { steps: 3 });
      await page.mouse.up();
      await expect(lifting(page)).toHaveCount(0);
      expect(await pageOrder(page)).toEqual(order);
      expect(await drawn(page)).toEqual(before);
      // Selecting a section's words by dragging across them selects them, and carries nothing: here, a flowchart box's.
      const words = page.locator(`${READY} [data-section-id="flow"] [data-path="flow.0.step"]`);
      await words.scrollIntoViewIfNeeded();
      const t = (await words.boundingBox())!;
      await page.mouse.move(t.x + 4, t.y + t.height / 2);
      await page.mouse.down();
      await page.mouse.move(t.x + t.width * 0.6, t.y + t.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect(lifting(page)).toHaveCount(0);
      expect(await page.evaluate(() => {
        const el = document.activeElement as HTMLTextAreaElement | null;
        return (el?.selectionEnd ?? 0) - (el?.selectionStart ?? 0) || window.getSelection()?.toString().length || 0;
      })).toBeGreaterThan(3);
    });

    test(`${f}: nothing moves when a drag starts; until the drop only transforms change; the drop moves things by transform alone, in 180ms`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f);
      const order = await pageOrder(page);
      const last = order[order.length - 1]!;
      const before = await drawn(page);
      const boxes = await layout(page);
      const name = await nameOf(page, last);
      const from = await pickUp(page, last);
      // Nothing moved as it lifted.
      expect(await drawn(page)).toEqual(before);
      expect(await layout(page)).toEqual(boxes);
      expect(await place(page)).toBe(order.length - 1);
      await expect(lifting(page)).toHaveAttribute("data-xe-style", "slide");
      // Carried to the top of the column: the others slide down to make room, by transform only.
      const top = before[order[0]!]!;
      const to = { x: top.x + top.w / 2, y: top.y - 12 };
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6, { steps: 4 });
        expect(await layout(page), `layout boxes at step ${i}`).toEqual(boxes);
      }
      await expect.poll(() => place(page)).toBe(0);
      await expect(page.locator(`${READY} [data-xe-landing]`)).toBeVisible();
      await expect(page.locator(`${READY} [data-xe-line]`)).toBeHidden();
      await expect.poll(async () => (await drawn(page))[order[0]!]!.y, { message: "the first section has slid down" }).toBeGreaterThan(before[order[0]!]!.y + 20);
      expect(await layout(page)).toEqual(boxes);
      await recordMotion(page);
      await page.mouse.up();
      // Dropped: first, and what slides into place does so by transform alone, in 180ms.
      expect(await pageOrder(page)).toEqual([last, ...order.slice(0, -1)]);
      const motion = await frameMotion(page);
      expect(motion.length).toBeGreaterThan(0);
      for (const m of motion) expect(m).toEqual({ ms: 180, props: ["transform"] });
      await settled(page);
      await expect(lifting(page)).toHaveCount(0);
      await expect(page.locator(`${READY} [data-xe-copy]`)).toHaveCount(0);
      expect(await styled(page)).toEqual([]);
      await expect(said(page)).toHaveText(`${name} dropped in place 1 of ${order.length}.`);
    });

    test(`${f}: the flowchart is carried with a line over a still page, by mouse and by keyboard; any other section slides`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f);
      const order = await pageOrder(page);
      expect(order).toContain("flow");
      const before = await drawn(page);
      const boxes = await layout(page);
      const from = await pickUp(page, "flow");
      await expect(lifting(page)).toHaveAttribute("data-xe-style", "line");
      const end = before[order[order.length - 1]!]!;
      const to = { x: end.x + end.w / 2, y: end.y + end.h + 30 };
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6, { steps: 4 });
        await page.waitForTimeout(40);
        expect(await drawn(page), `a still page at step ${i}`).toEqual(before);
        expect(await layout(page)).toEqual(boxes);
      }
      await expect(page.locator(`${READY} [data-xe-line]`)).toBeVisible();
      await expect(page.locator(`${READY} [data-xe-landing]`)).toBeHidden();
      await expect(said(page)).toHaveText(`Flowchart would go to place ${order.length} of ${order.length}.`);
      await page.mouse.up();
      expect(await pageOrder(page)).toEqual([...order.filter((id) => id !== "flow"), "flow"]);
      await settled(page);

      // Any other section: the page makes room.
      const now = await pageOrder(page);
      const still = await drawn(page);
      const other = now[0]!;
      const start = await pickUp(page, other);
      await expect(lifting(page)).toHaveAttribute("data-xe-style", "slide");
      const flow = still.flow!;
      await page.mouse.move(flow.x + flow.w / 2, flow.y + flow.h + 30, { steps: 30 });
      expect(start.y).toBeLessThan(flow.y);
      await expect(page.locator(`${READY} [data-xe-landing]`)).toBeVisible();
      await expect(page.locator(`${READY} [data-xe-line]`)).toBeHidden();
      const slid = async () => {
        const mid = await drawn(page);
        return now.filter((id) => Math.abs(mid[id]!.y - still[id]!.y) > 0.5 || Math.abs(mid[id]!.x - still[id]!.x) > 0.5).length;
      };
      await expect.poll(slid).toBeGreaterThan(0);
      await page.mouse.up();
      expect((await pageOrder(page)).at(-1)).toBe(other);
      await settled(page);

      // From the keyboard the flowchart keeps its place and the line moves.
      await grip(page, "flow").focus();
      const rest = await layout(page);
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowUp");
      await expect(lifting(page)).toHaveAttribute("data-xe-style", "line");
      await expect(page.locator(`${READY} [data-xe-line]`)).toBeVisible();
      expect(await layout(page)).toEqual(rest);
      expect(await styled(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(lifting(page)).toHaveCount(0);
    });

    test(`${f}: dropped into a pair, out of a pair, into the image grid and out of it, the stored order is the place shown`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f);
      const pair = firstPair(await rowsNow(page))!;
      expect(pair, "every sample has a pair").toBeTruthy();
      const left = ids(pair.left);
      const right = ids(pair.right);
      let order = await pageOrder(page);
      // Into the pair: a section from elsewhere carried to the gap between its two sides.
      const mover = [...order].reverse().find((id) => !left.includes(id) && !right.includes(id))!;
      let at = await client(page);
      const L = union(left.map((id) => at[id]!));
      const R = union(right.map((id) => at[id]!));
      await pickUp(page, mover);
      await page.mouse.move((L.x + L.w + R.x) / 2, R.y + Math.min(R.h, L.h) / 2, { steps: 20 });
      const into = order.filter((id) => id !== mover).indexOf(right[0]!);
      await expect.poll(() => place(page)).toBe(into);
      await expect(said(page)).toHaveText(`${await nameOf(page, mover)} would go to place ${into + 1} of ${order.length}.`);
      await page.mouse.up();
      expect(await pageOrder(page)).toEqual(orderWith(order, mover, into));
      await settled(page);
      // A drop is one undo entry: Undo puts the pair back.
      await page.keyboard.press("ControlOrMeta+z");
      expect(await pageOrder(page)).toEqual(order);

      // Out of a pair: its second side, carried to the foot of the page.
      const out = right[0]!;
      at = await client(page);
      const end = at[order[order.length - 1]!]!;
      await pickUp(page, out);
      await page.mouse.move(end.x + end.w / 2, end.y + end.h + 40, { steps: 20 });
      await expect.poll(() => place(page)).toBe(order.length - 1);
      await page.mouse.up();
      expect(await pageOrder(page)).toEqual(orderWith(order, out, order.length - 1));
      await settled(page);

      const tiles = grid(await rowsNow(page));
      if (!tiles) return;
      // Into the grid: between two tiles on one line.
      order = await pageOrder(page);
      at = await client(page);
      const ts = tiles.items.map((c) => c.item.id);
      const k = ts.findIndex((id, i) => i > 0 && Math.abs(at[id]!.y - at[ts[i - 1]!]!.y) < 1);
      const [a, b] = [ts[k - 1]!, ts[k]!];
      const visitor = order.find((id) => !ts.includes(id) && id !== "flow")!;
      await pickUp(page, visitor);
      await page.mouse.move((at[a]!.x + at[a]!.w + at[b]!.x) / 2, at[a]!.y + at[a]!.h / 2, { steps: 20 });
      const between = order.filter((id) => id !== visitor).indexOf(b);
      await expect.poll(() => place(page)).toBe(between);
      await page.mouse.up();
      expect(await pageOrder(page)).toEqual(orderWith(order, visitor, between));
      await settled(page);
      // And a tile out of it, to the foot of the page.
      order = await pageOrder(page);
      at = await client(page);
      const last = at[order[order.length - 1]!]!;
      await pickUp(page, a);
      await page.mouse.move(last.x + last.w / 2, last.y + last.h + 40, { steps: 20 });
      await expect.poll(() => place(page)).toBe(order.length - 1);
      await page.mouse.up();
      expect(await pageOrder(page)).toEqual(orderWith(order, a, order.length - 1));
    });

    test(`${f}: no flicker: resting on a boundary and trembling 2px either side 40 times never changes the place`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f);
      const order = await pageOrder(page);
      const rows = await rowsNow(page);
      const pair = firstPair(rows)!;
      const at = await client(page);
      const L = union(ids(pair.left).map((id) => at[id]!));
      const R = union(ids(pair.right).map((id) => at[id]!));
      const mover = order[order.length - 1]!;
      await pickUp(page, mover);
      // Counts every change of place, and every time a section is given a new transform.
      await page.evaluate((sel) => {
        const w = window as unknown as { __places: number; __slides: number };
        w.__places = 0;
        w.__slides = 0;
        const main = document.querySelector<HTMLElement>("[data-xe-drag]")!;
        new MutationObserver(() => (w.__places += 1)).observe(main, { attributes: true, attributeFilter: ["data-xe-place"] });
        const slides = new MutationObserver((list) => (w.__slides += list.length));
        document.querySelectorAll(sel).forEach((el) => slides.observe(el, { attributes: true, attributeFilter: ["style"] }));
      }, FRAMES);
      const seen = () => page.evaluate(() => ({ places: (window as unknown as { __places: number }).__places, slides: (window as unknown as { __slides: number }).__slides }));

      /** Walks the pointer a pixel at a time towards a point until the place changes, then rests there and trembles 2px either side, 40 times. */
      async function restOnBoundary(from: { x: number; y: number }, to: { x: number; y: number }, where: string) {
        await page.mouse.move(from.x, from.y, { steps: 10 });
        const start = await place(page);
        const n = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
        let p = from;
        for (let i = 1; i <= n && (await place(page)) === start; i++) {
          p = { x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n };
          await page.mouse.move(p.x, p.y);
        }
        expect(await place(page), `${where}: the pointer crossed a boundary`).not.toBe(start);
        const crossed = await place(page);
        const ux = (to.x - from.x) / n;
        const uy = (to.y - from.y) / n;
        await page.waitForTimeout(250);
        const before = await seen();
        for (let i = 0; i < 40; i++) {
          const d = i % 2 ? 2 : -2;
          await page.mouse.move(p.x + ux * d, p.y + uy * d);
        }
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(400);
        expect(await seen(), where).toEqual(before);
        expect(await place(page), where).toBe(crossed);
      }

      const mid = L.y + Math.min(L.h, R.h) / 2;
      await restOnBoundary({ x: L.x + L.w * 0.55, y: mid }, { x: R.x + R.w * 0.45, y: mid }, "beside a pair, across its gap");
      await restOnBoundary({ x: L.x + L.w * 0.2, y: L.y + L.h * 0.3 }, { x: L.x + L.w * 0.2, y: L.y + L.h + 30 }, "down the side of a pair");
      // Beside a stack: at the height of a stacked part, across from the other side; and between two stacked parts.
      const stacked = rows.flatMap((r) => (r.row === "pair" ? [r.left, r.right].filter((c) => c.cell === "stack").map((c) => ({ stack: ids(c), other: ids(c === r.left ? r.right : r.left) })) : []));
      for (const { stack, other } of stacked) {
        const S = at[stack[stack.length - 1]!]!;
        const O = union(other.map((id) => at[id]!));
        const y = S.y + S.h / 2;
        if (y < O.y + O.h) await restOnBoundary({ x: O.x + O.w / 2, y }, { x: S.x + S.w / 2, y }, "beside a stack");
        if (stack.length > 1) {
          const [s1, s2] = [at[stack[0]!]!, at[stack[1]!]!];
          await restOnBoundary({ x: s1.x + s1.w / 2, y: s1.y + s1.h * 0.4 }, { x: s2.x + s2.w / 2, y: s2.y + s2.h * 0.6 }, "between two parts of a stack");
        }
      }
      const tiles = grid(rows);
      if (tiles) {
        const ts = tiles.items.map((c) => at[c.item.id]!);
        const k = ts.findIndex((t, i) => i > 0 && Math.abs(t.y - ts[i - 1]!.y) < 1);
        const [t1, t2] = [ts[k - 1]!, ts[k]!];
        const below = ts.find((t) => t.y > t1.y + t1.h)!;
        await restOnBoundary({ x: t1.x + t1.w * 0.3, y: t1.y + t1.h / 2 }, { x: t2.x + t2.w * 0.7, y: t1.y + t1.h / 2 }, "along a row of the grid");
        await restOnBoundary({ x: t1.x + t1.w / 2, y: t1.y + t1.h * 0.6 }, { x: below.x + below.w / 2, y: below.y + below.h * 0.4 }, "between two rows of the grid");
      }
      await page.keyboard.press("Escape");
      await expect(lifting(page)).toHaveCount(0);
      expect(await pageOrder(page)).toEqual(order);
    });

    test(`${f}: the keyboard moves a section across a pair${f === "gallery" ? " and into and out of the image grid" : ""}, each step read out`, async ({ page }) => {
      await open(page, f);
      let order = await pageOrder(page);
      const pair = firstPair(await rowsNow(page))!;
      const inPair = [...ids(pair.left), ...ids(pair.right)];
      const after = order.indexOf(inPair[inPair.length - 1]!) + 1;
      const mover = order[after]!;
      let name = await nameOf(page, mover);
      const g = grip(page, mover);
      await g.focus();
      await expect(g).toHaveAccessibleDescription(/press Space or Enter, use the arrow keys/);
      const before = await layout(page);
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(`Picked up ${lowerFirst(name)}, place ${after + 1} of ${order.length}.`);
      await expect(lifting(page)).toHaveAttribute("data-xe-drag", "keys");
      expect(await layout(page)).toEqual(before);
      for (let i = 1; i <= inPair.length; i++) {
        await page.keyboard.press("ArrowUp");
        await expect(said(page)).toHaveText(`${name} would go to place ${after + 1 - i} of ${order.length}.`);
      }
      // Still nothing has changed its layout box: the page has slid, or a line has been drawn.
      expect(await layout(page)).toEqual(before);
      await page.keyboard.press("Space");
      const to = after - inPair.length;
      await expect(said(page)).toHaveText(`${name} dropped in place ${to + 1} of ${order.length}.`);
      expect(await pageOrder(page)).toEqual(orderWith(order, mover, to));
      await expect(grip(page, mover)).toBeFocused();
      // Into the pair, and Escape puts it back. (Its name may have changed with its place: the key figure is the first figure.)
      order = await pageOrder(page);
      name = await nameOf(page, mover);
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await expect(said(page)).toHaveText(`${name} would go to place ${to + 3} of ${order.length}.`);
      await page.keyboard.press("Escape");
      await expect(said(page)).toHaveText(`Moving ${lowerFirst(name)} cancelled. It's back where it was.`);
      expect(await pageOrder(page)).toEqual(order);
      await expect(lifting(page)).toHaveCount(0);
      // Space, down, up, Space: dropped where it was.
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(`${name} dropped where it was.`);

      const tiles = grid(await rowsNow(page));
      if (!tiles) return;
      // A link goes into the run of pictures, splitting it, and out at the far side.
      order = await pageOrder(page);
      const grids = async () => (await rowsNow(page)).filter((r) => r.row === "group" && r.of === "grid").length;
      const runs = await grids();
      const ts = tiles.items.map((c) => c.item.id);
      const link = order.find((id) => id.startsWith("link-"))!;
      const from = order.indexOf(link);
      const into = order.indexOf(ts[2]!) - (order.indexOf(ts[2]!) > from ? 1 : 0);
      await grip(page, link).focus();
      await page.keyboard.press("Space");
      for (let p = from; p !== into; p += into < from ? -1 : 1) await page.keyboard.press(into < from ? "ArrowUp" : "ArrowDown");
      await page.keyboard.press("Space");
      expect(await pageOrder(page)).toEqual(orderWith(order, link, into));
      expect(await grids(), "the run of pictures is split in two").toBe(runs + 1);
      await expect(grip(page, link)).toBeFocused();
      order = await pageOrder(page);
      await page.keyboard.press("Space");
      for (let p = order.indexOf(link); p < order.length - 1; p++) await page.keyboard.press("ArrowDown");
      await expect(said(page)).toHaveText(new RegExp(`would go to place ${order.length} of ${order.length}`));
      await page.keyboard.press("Space");
      expect(await pageOrder(page)).toEqual(orderWith(order, link, order.length - 1));
      expect(await grids()).toBe(runs);
      // The ends stop.
      await grip(page, order[0]!).focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowUp");
      await expect(said(page)).toHaveText(`Picked up ${lowerFirst(await nameOf(page, order[0]!))}, place 1 of ${order.length}.`);
      await page.keyboard.press("Escape");
    });
  }

  test("move up and move down do the same a place at a time, with the motion, and keep the focus", async ({ page }) => {
    await open(page, "case-study");
    const order = await pageOrder(page);
    const id = order[order.length - 1]!;
    await frame(page, id).hover();
    const up = frame(page, id).locator('[data-tool="up"]');
    await up.focus();
    await recordMotion(page);
    await page.keyboard.press("Enter");
    expect(await pageOrder(page)).toEqual(orderWith(order, id, order.length - 2));
    const moved = await frameMotion(page);
    expect(moved.length).toBeGreaterThan(0);
    for (const m of moved) expect(m).toEqual({ ms: 180, props: ["transform"] });
    await expect(said(page)).toHaveText(`${await nameOf(page, id)} moved up, to place ${order.length - 1} of ${order.length}.`);
    await expect(frame(page, id).locator('[data-tool="up"]')).toBeFocused();
    for (let i = 2; i < order.length; i++) await page.keyboard.press("Enter");
    expect((await pageOrder(page))[0]).toBe(id);
    // At the top, move up is off and the focus goes to move down.
    await expect(frame(page, id).locator('[data-tool="up"]')).toBeDisabled();
    await expect(frame(page, id).locator('[data-tool="down"]')).toBeFocused();
  });
});

/* ------------------------------------------------------------------------------------------------
 * The page scrolling itself, reduced motion, the look's colours, axe
 * ---------------------------------------------------------------------------------------------- */

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const atFoot = (page: Page) => page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1);
const pageHeight = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight);

/** A colour as the look draws it: `value` (a CSS colour, e.g. var(--xp-link)) resolved inside the exhbt's page. */
const lookColour = (page: Page, value: string) =>
  page.evaluate((v) => {
    const probe = document.createElement("span");
    probe.style.color = v;
    document.querySelector(`[data-editor="page"] article`)!.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, value);

/** WCAG contrast between two rgb() colours. */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = c
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((n) => {
        const v = Number(n) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

test.describe("while carrying", () => {
  test.skip(({ isMobile }) => isMobile, "the touch checks are below");

  test("the page scrolls itself with the pointer still near the bottom edge and near the top edge, and stops at its ends", async ({ page }) => {
    await open(page, "gallery");
    const order = await pageOrder(page);
    const height = await pageHeight(page);
    const view = page.viewportSize()!;
    await pickUp(page, order[0]!);
    await page.mouse.move(view.width / 2, view.height - 12, { steps: 12 });
    const p0 = await place(page);
    await expect.poll(() => scrollY(page), { timeout: 10_000 }).toBeGreaterThan(300);
    await expect.poll(() => atFoot(page), { timeout: 30_000 }).toBe(true);
    // It stops at its end: the carried copy never makes the page longer.
    await page.waitForTimeout(500);
    expect(await pageHeight(page)).toBe(height);
    // The place keeps up with the page moving under a still pointer.
    expect(await place(page)).not.toBe(p0);
    // Near the top edge it scrolls back, and stops at the top.
    await page.mouse.move(view.width / 2, 70, { steps: 12 });
    await expect.poll(() => scrollY(page), { timeout: 30_000 }).toBe(0);
    await page.mouse.up();
    await expect(lifting(page)).toHaveCount(0);
  });

  test("with reduced motion nothing animates, during or after a drag, from the keyboard or from the move buttons", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(TALL);
    await open(page, "case-study");
    const motion = () => page.evaluate((root) => document.getAnimations().filter((a) => ((a.effect as KeyframeEffect).target as Element | null)?.closest(root)).length, READY);
    const order = await pageOrder(page);
    const before = await client(page);
    const last = order[order.length - 1]!;
    await pickUp(page, last);
    const target = before[order[1]!]!;
    await page.mouse.move(target.x + target.w / 2, target.y - 12, { steps: 10 });
    await expect.poll(() => place(page)).toBe(1);
    expect(await page.locator(FRAMES).evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration))).toEqual(order.map(() => "0s"));
    expect(await motion()).toBe(0);
    await page.mouse.up();
    expect(await motion()).toBe(0);
    expect(await pageOrder(page)).toEqual(orderWith(order, last, 1));
    // Dropped straight into its place.
    const after = await client(page);
    expect(Math.abs(after[last]!.y - before[order[1]!]!.y)).toBeLessThan(1);
    await grip(page, last).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    expect(await motion()).toBe(0);
    await page.keyboard.press("Space");
    expect(await motion()).toBe(0);
    await frame(page, last).hover();
    await frame(page, last).locator('[data-tool="down"]').click();
    expect(await motion()).toBe(0);
  });

  test("the frame, the line, the room made and the lifted copy take the look's colours, and pass contrast in all eight looks", async ({ page }) => {
    await page.setViewportSize(TALL);
    for (const theme of PORTFOLIO_THEMES) {
      await open(page, "case-study", theme.id);
      const link = await lookColour(page, "var(--xp-link)");
      const ground = await page.locator(`${READY} article`).evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(contrast(link, ground), `${theme.id}: the link colour on the ground`).toBeGreaterThanOrEqual(3);
      if (theme.id === "exhbt") expect(link).toBe("rgb(0, 117, 93)");
      // The frame, while the focus is in the section.
      await grip(page, "findings").focus();
      expect(await frame(page, "findings").evaluate((el) => getComputedStyle(el).outlineColor), theme.id).toBe(link);
      // Lifted from the keyboard, the section itself is the card: the ground, an outline in the link colour, the pack shadow.
      await page.keyboard.press("Space");
      const card = await frame(page, "findings").evaluate((el) => {
        const s = getComputedStyle(el, "::before");
        return { bg: s.backgroundColor, outline: s.outlineColor, width: s.outlineWidth, shadow: s.boxShadow };
      });
      expect(card, theme.id).toMatchObject({ bg: ground, outline: link, width: "2px" });
      expect(card.shadow).not.toBe("none");
      await page.keyboard.press("Escape");
      // The flowchart's line.
      await grip(page, "flow").focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      expect(await page.locator(`${READY} [data-xe-line]`).evaluate((el) => getComputedStyle(el).backgroundColor), theme.id).toBe(link);
      await page.keyboard.press("Escape");
      if (theme.id !== "exhbt" && theme.id !== "night") continue;
      // With a mouse: the copy's card and the dashed room made.
      const at = await client(page);
      await pickUp(page, "findings");
      const copy = await page.locator(`${READY} [data-xe-copy] .xe-card`).evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, outline: s.outlineColor, width: s.outlineWidth };
      });
      expect(copy, theme.id).toEqual({ bg: ground, outline: link, width: "2px" });
      const end = at[(await pageOrder(page)).at(-1)!]!;
      await page.mouse.move(end.x + end.w / 2, end.y + end.h + 30, { steps: 10 });
      expect(await page.locator(`${READY} [data-xe-landing]`).evaluate((el) => getComputedStyle(el).borderTopColor), theme.id).toBe(link);
      await page.keyboard.press("Escape");
      await page.mouse.up();
    }
  });

  for (const f of offered()) {
    test(`${f}: axe finds nothing with a section lifted`, async ({ page }) => {
      await open(page, f);
      const order = await pageOrder(page);
      await grip(page, order[1]!).focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowDown");
      await expect(lifting(page)).toHaveAttribute("data-xe-drag", "keys");
      await axe(page, `${f} lifted`);
      await page.keyboard.press("Escape");
    });
  }
});

/* ------------------------------------------------------------------------------------------------
 * The "+" between sections
 * ---------------------------------------------------------------------------------------------- */

/** What a menu or the tray offers: each kind, and whether it can be added. */
const kindsIn = (page: Page, sel: string) =>
  page.locator(sel).evaluateAll((els) => els.map((b) => `${b.getAttribute("data-block")}${(b as HTMLButtonElement).disabled || b.getAttribute("aria-disabled") === "true" ? " (full)" : ""}`));
const expectedKinds = (doc: ExhbtDoc) => blockOptions(doc).map((o) => `${o.kind}${o.full ? " (full)" : ""}`);
const wordsLeftText = (doc: ExhbtDoc) => `${LIMITS.totalWords - wordCount(doc)} words left of ${LIMITS.totalWords}.`;
const MENU = `${READY} [data-xe-menu]`;

/** A case study with every kind the layout holds at its cap. */
function fullCaseStudy(): ExhbtDoc {
  const sections: Section[] = [...openBankingDoc.sections];
  const f = "case-study" as const;
  for (const kind of FORMAT_RULES[f].kinds) {
    while (roomFor(sections, kind, f) > 0) sections.push(kind === "image" ? { ...newImageSection("x", sections, { w: 1200, h: 800 }), alt: "A picture" } : newSection(kind, sections));
  }
  return { ...openBankingDoc, format: "case-study", sections };
}

test.describe("the + between sections", () => {
  test.skip(({ isMobile }) => isMobile, "desktop");

  for (const f of offered()) {
    test(`${f}: each + has its own name; the menu offers every kind the layout holds, with the real caps and reasons; nothing moves when it opens`, async ({ page }) => {
      await open(page, f);
      const doc = await docNow(page);
      const rows = rowsFor(pageItems(doc), formatOf(doc));
      const first = (r: Row) => (r.row === "one" ? ids(r.cell)[0]! : r.row === "pair" ? ids(r.left)[0]! : r.items[0]!.item.id);
      const names = await page.locator(`${READY} .xe-plus`).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      expect(names).toEqual([...rows.map((r) => `Add a section before ${labelOf(doc, first(r))}`), "Add a section"]);
      expect(new Set(names).size).toBe(names.length);
      const before = await drawn(page);
      const end = page.locator(`${READY} #add-section`);
      await expect(page.locator(`${READY} [data-path="sections"] button`)).toHaveId("add-section");
      await end.click();
      await expect(page.locator(MENU)).toBeVisible();
      expect(await drawn(page)).toEqual(before);
      expect(await kindsIn(page, `${MENU} .xe-plus-item`)).toEqual(expectedKinds(doc));
      for (const o of blockOptions(doc)) {
        const item = page.locator(`${MENU} [data-block="${o.kind}"]`);
        await expect(item).toContainText(o.name);
        if (o.full) await expect(item).toHaveAccessibleDescription(o.full);
      }
      await expect(page.locator(`${MENU} [data-testid="words-left"]`)).toHaveText(wordsLeftText(doc));
      await page.keyboard.press("Escape");
      await expect(page.locator(MENU)).toHaveCount(0);
      await expect(end).toBeFocused();
    });

    test(`${f}: a new block lands where its + was, with the cursor in it`, async ({ page }) => {
      await open(page, f);
      const order = await pageOrder(page);
      const doc = await docNow(page);
      const kind = blockOptions(doc).find((o) => !o.full && ["quote", "reflection", "link", "pullquote"].includes(o.kind))!;
      const starts = await page.locator(`${READY} .xe-insert:not([data-end])`).evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-at"))));
      const at = starts[Math.floor(starts.length / 2)]!;
      await page.locator(`${READY} .xe-insert[data-at="${at}"] .xe-plus`).click();
      await page.locator(`${MENU} [data-block="${kind.kind}"]`).click();
      const now = await pageOrder(page);
      expect(now.length).toBe(order.length + 1);
      const added = now[at]!;
      expect(now.filter((id) => id !== added)).toEqual(order);
      await expect(said(page)).toHaveText(`${kind.name} added, place ${at + 1} of ${now.length}.`);
      await expect.poll(() => page.evaluate((id) => Boolean(document.activeElement?.closest(`[data-section-id="${id}"]`)), added)).toBe(true);
    });
  }

  test("a new graph opens its figures sheet; on a full case study the + says so, and Things to fix opens it", async ({ page }) => {
    await open(page, "case-study");
    await page.locator(`${READY} #add-section`).click();
    await page.locator(`${MENU} [data-block="graph"]`).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await openDoc(page, freshName("dragfull"), fullCaseStudy());
    const doc = await docNow(page);
    expect(blockOptions(doc).every((o) => o.full)).toBe(true);
    await page.locator(`${READY} #add-section`).click();
    await expect(page.locator(`${MENU} .xe-plus-full`)).toHaveText("This case study is full. Remove a section to add another, or try another layout.");
    expect(await kindsIn(page, `${MENU} .xe-plus-item`)).toEqual(expectedKinds(doc));
    // "Things to fix" landing on the end + opens its menu.
    await page.keyboard.press("Escape");
    await expect(page.locator(MENU)).toHaveCount(0);
    await page.evaluate(() => window.__exhbtUi!.jumpTo("sections"));
    await expect(page.locator(MENU)).toBeVisible();
    // The path is on the "+" alone, so the jump's anchor is one button, with the menu open beside it.
    await expect(page.locator(`${READY} [data-path="sections"] button`)).toBeFocused();
  });

  test.fixme("a new link opens its Web address popover with the cursor in it", async () => {
    // Waits for G's milestone 2 (the jump opens a popover first) and J's popover. board.add already calls ui.jumpTo on the new link's href.
  });

  test("on a gallery with the flowchart off, Flowchart from the + before the last section goes back there", async ({ page }) => {
    await page.setViewportSize(TALL);
    await open(page, "gallery");
    await frame(page, "flow").hover();
    await frame(page, "flow").locator('[data-tool="remove"]').click();
    const order = await pageOrder(page);
    expect(order).not.toContain("flow");
    const starts = await page.locator(`${READY} .xe-insert:not([data-end])`).evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-at"))));
    const at = starts[starts.length - 1]!;
    const plus = page.locator(`${READY} .xe-insert[data-at="${at}"] .xe-plus`);
    await expect(plus).toHaveAccessibleName(`Add a section before ${await nameOf(page, order[at]!)}`);
    await plus.click();
    await page.locator(`${MENU} [data-block="flow"]`).click();
    expect(await pageOrder(page)).toEqual(orderWith(order, "flow", at));
    // The stored marker is there, not at the flowchart's usual place.
    const doc = await docNow(page);
    const marker = doc.sections.findIndex((s) => s.kind === "flow");
    expect(doc.sections[marker + 1]!.id).toBe(order[at]);
    expect(doc.flowOff).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------------------------------
 * The tray
 * ---------------------------------------------------------------------------------------------- */

const TRAY = `${READY} [data-xe-tray]`;
const block = (page: Page, kind: string) => page.locator(`${TRAY} [data-block="${kind}"]`);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Presses the mouse on a block in the tray and moves past the 6px threshold. */
async function liftBlock(page: Page, kind: string) {
  const g = (await block(page, kind).boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2 - 5, g.y + g.height / 2 + 6, { steps: 4 });
  await expect(lifting(page)).toHaveAttribute("data-xe-drag", "pointer");
  return g;
}

test.describe("the tray", () => {
  test.skip(({ isMobile }) => isMobile, "a desktop only; the touch check says it is not there");

  test("it sits beside the page, never over it, clear of where the page scrolls itself, at 77rem and not at 76rem", async ({ page }) => {
    for (const f of offered()) {
      await open(page, f);
      const tray = page.locator(TRAY);
      await expect(tray).toBeVisible();
      const view = page.viewportSize()!;
      const t = (await tray.boundingBox())!;
      const article = (await page.locator(`${READY} article`).boundingBox())!;
      expect(t.x, f).toBeGreaterThanOrEqual(article.x + article.width);
      expect(t.x + t.width, f).toBeLessThanOrEqual(view.width);
      expect(t.y, f).toBeGreaterThanOrEqual(view.height * 0.2);
      expect(t.y + t.height, f).toBeLessThanOrEqual(view.height * 0.8);
      await page.evaluate(() => window.scrollTo(0, 900));
      expect(await tray.boundingBox()).toEqual(t);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // The same kinds as the +, and the words left.
      const doc = await docNow(page);
      expect(await kindsIn(page, `${TRAY} .xe-tray-block`)).toEqual(expectedKinds(doc));
      await expect(page.locator(`${TRAY} [data-testid="tray-words-left"]`)).toHaveText(wordsLeftText(doc));
    }
    await page.setViewportSize({ width: 1232, height: 800 });
    await expect(page.locator(TRAY)).toBeVisible();
    const narrow = (await page.locator(TRAY).boundingBox())!;
    const article = (await page.locator(`${READY} article`).boundingBox())!;
    expect(narrow.x).toBeGreaterThanOrEqual(article.x + article.width);
    expect(narrow.x + narrow.width).toBeLessThanOrEqual(1232);
    await page.setViewportSize({ width: 1216, height: 800 });
    await expect(page.locator(TRAY)).toBeHidden();
  });

  test("a block dragged from it lands in a gap, beside the findings and in the image grid, by the rules of a moved section", async ({ page }) => {
    await page.setViewportSize(TALL);
    await open(page, "case-study");
    let order = await pageOrder(page);
    let before = await drawn(page);
    const boxes = await layout(page);
    const tile = await liftBlock(page, "quote");
    expect(await drawn(page)).toEqual(before);
    expect(await place(page)).toBe(-1);
    await expect(lifting(page)).toHaveAttribute("data-xe-style", "slide");
    await expect(page.locator(`${READY} [data-xe-landing]`)).toBeHidden();
    await expect(said(page)).toHaveText("Picked up a new block: quote. Carry it onto the page.");
    const chip = (await page.locator(`${READY} [data-xe-chip]`).boundingBox())!;
    expect([Math.round(chip.width), Math.round(chip.height)]).toEqual([Math.round(tile.width), Math.round(tile.height)]);
    // Into the gap above the last section: the room is made, by transform.
    let at = await client(page);
    const last = order[order.length - 1]!;
    const prev = union(order.slice(0, -1).map((id) => at[id]!));
    await page.mouse.move(at[last]!.x + at[last]!.w / 2, (prev.y + prev.h + at[last]!.y) / 2, { steps: 25 });
    await expect.poll(() => place(page)).toBe(order.length - 1);
    await expect(said(page)).toHaveText(`Quote would go to place ${order.length} of ${order.length + 1}.`);
    expect(await layout(page)).toEqual(boxes);
    await expect(page.locator(`${READY} [data-xe-landing]`)).toBeVisible();
    await expect.poll(async () => (await drawn(page))[last]!.y).toBeGreaterThan(before[last]!.y + 40);
    await recordMotion(page);
    await page.mouse.up();
    let now = await pageOrder(page);
    expect(now[order.length - 1]).toMatch(/^quote-/);
    expect(now.filter((id) => id !== now[order.length - 1])).toEqual(order);
    await expect(said(page)).toHaveText(`Quote added in place ${order.length} of ${order.length + 1}.`);
    const motion = await frameMotion(page);
    expect(motion.length).toBeGreaterThan(0);
    for (const m of motion) expect(m.ms).toBe(180);
    await settled(page);

    // Let go off the page: nothing is added.
    order = await pageOrder(page);
    await liftBlock(page, "link");
    await page.mouse.move(1400, 500, { steps: 6 });
    expect(await place(page)).toBe(-1);
    await page.mouse.up();
    await expect(said(page)).toHaveText("Link was not added.");
    expect(await pageOrder(page)).toEqual(order);

    // Beside the findings: a picture dropped in the gap between the findings and the figure beside them is chosen there.
    at = await client(page);
    const pair = firstPair(await rowsNow(page))!;
    const L = union(ids(pair.left).map((id) => at[id]!));
    const R = union(ids(pair.right).map((id) => at[id]!));
    await liftBlock(page, "image");
    await page.mouse.move((L.x + L.w + R.x) / 2, R.y + R.h / 2, { steps: 25 });
    const into = order.indexOf(ids(pair.right)[0]!);
    await expect.poll(() => place(page)).toBe(into);
    const chooser = page.waitForEvent("filechooser");
    await page.mouse.up();
    await (await chooser).setFiles({ name: "beside.png", mimeType: "image/png", buffer: PNG });
    await expect.poll(async () => (await pageOrder(page)).length).toBe(order.length + 1);
    now = await pageOrder(page);
    expect(now[into]).toMatch(/^image-/);
    expect(now.filter((id) => id !== now[into])).toEqual(order);

    // Into the image grid of a gallery: between two tiles on one line.
    await open(page, "gallery");
    order = await pageOrder(page);
    before = await drawn(page);
    at = await client(page);
    const ts = grid(await rowsNow(page))!.items.map((c) => c.item.id);
    const k = ts.findIndex((id, i) => i > 0 && Math.abs(at[id]!.y - at[ts[i - 1]!]!.y) < 1);
    const [a, b] = [at[ts[k - 1]!]!, at[ts[k]!]!];
    await liftBlock(page, "quote");
    await page.mouse.move((a.x + a.w + b.x) / 2, a.y + a.h / 2, { steps: 25 });
    const between = order.indexOf(ts[k]!);
    await expect.poll(() => place(page)).toBe(between);
    await page.mouse.up();
    now = await pageOrder(page);
    expect(now[between]).toMatch(/^quote-/);
    expect(now.filter((id) => id !== now[between])).toEqual(order);
  });

  test("with the flowchart off, its block dropped in a gap lands there", async ({ page }) => {
    await page.setViewportSize(TALL);
    await open(page, "gallery");
    await frame(page, "flow").hover();
    await frame(page, "flow").locator('[data-tool="remove"]').click();
    await settled(page);
    const order = await pageOrder(page);
    await expect(block(page, "flow")).toBeVisible();
    const at = await client(page);
    const lastRow = (await rowsNow(page)).at(-1)!;
    const firstOfLast = lastRow.row === "group" ? lastRow.items[0]!.item.id : lastRow.row === "pair" ? ids(lastRow.left)[0]! : ids(lastRow.cell)[0]!;
    const above = union(order.slice(0, order.indexOf(firstOfLast)).map((id) => at[id]!));
    const target = at[firstOfLast]!;
    await liftBlock(page, "flow");
    await expect(lifting(page)).toHaveAttribute("data-xe-style", "line");
    await page.mouse.move(target.x + 40, (above.y + above.h + target.y) / 2, { steps: 25 });
    const p = order.indexOf(firstOfLast);
    await expect.poll(() => place(page)).toBe(p);
    await expect(page.locator(`${READY} [data-xe-line]`)).toBeVisible();
    await page.mouse.up();
    expect(await pageOrder(page)).toEqual(orderWith(order, "flow", p));
    const doc = await docNow(page);
    expect(doc.sections[doc.sections.findIndex((s) => s.kind === "flow") + 1]!.id).toBe(firstOfLast);
    await expect(block(page, "flow")).toHaveCount(0);
  });

  test("from the keyboard: Enter adds a block after the section last in focus, or at the end; a full kind is refused with its reason", async ({ page }) => {
    await open(page, "case-study");
    const quote = block(page, "quote");
    await quote.focus();
    await expect(quote).toHaveAccessibleDescription(/Press Enter to add it after the section you were last in, or at the end of the page/);
    let order = await pageOrder(page);
    await page.keyboard.press("Enter");
    await expect(said(page)).toHaveText(`Quote added at the end, place ${order.length + 1} of ${order.length + 1}.`);
    expect((await pageOrder(page)).at(-1)).toMatch(/^quote-/);
    await expect(quote).toBeFocused();
    // After the section the focus was last in.
    order = await pageOrder(page);
    await grip(page, "findings").focus();
    await block(page, "link").focus();
    await page.keyboard.press("Enter");
    const at = order.indexOf("findings") + 1;
    await expect(said(page)).toHaveText(`Link added after ${lowerFirst(await nameOf(page, "findings"))}, place ${at + 1} of ${order.length + 1}.`);
    expect((await pageOrder(page))[at]).toMatch(/^link-/);
    // A full kind: dimmed, its reason read out and shown beside it, and it cannot be dragged.
    const findings = block(page, "findings");
    const reason = blockOptions(await docNow(page)).find((o) => o.kind === "findings")!.full!;
    await expect(findings).toHaveAttribute("aria-disabled", "true");
    await expect(findings).toHaveAccessibleDescription(reason);
    order = await pageOrder(page);
    await findings.focus();
    await page.keyboard.press("Enter");
    await expect(said(page)).toHaveText(`${reason}.`);
    const g = (await findings.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x - 300, g.y + 40, { steps: 10 });
    await expect(lifting(page)).toHaveCount(0);
    await page.mouse.up();
    expect(await pageOrder(page)).toEqual(order);
    await findings.hover();
    await expect(page.locator(`${TRAY} #xe-tray-why-findings`)).toHaveCSS("opacity", "1");
  });

  test("carrying a block from it near the bottom edge scrolls the page, and stops at its end", async ({ page }) => {
    await open(page, "gallery");
    const height = await pageHeight(page);
    const g = (await block(page, "quote").boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x - 300, g.y + 30, { steps: 8 });
    await expect(lifting(page)).toHaveAttribute("data-xe-drag", "pointer");
    const view = page.viewportSize()!;
    await page.mouse.move(view.width / 2, view.height - 10, { steps: 10 });
    const p0 = await place(page);
    await expect.poll(() => scrollY(page), { timeout: 10_000 }).toBeGreaterThan(300);
    await expect.poll(() => atFoot(page), { timeout: 30_000 }).toBe(true);
    expect(await place(page)).not.toBe(p0);
    await page.waitForTimeout(400);
    expect(await pageHeight(page)).toBe(height);
    await page.mouse.up();
    expect((await pageOrder(page)).at(-1)).toMatch(/^quote-/);
  });
});

/* ------------------------------------------------------------------------------------------------
 * By touch (the touch project: a Pixel 7)
 * ---------------------------------------------------------------------------------------------- */

test.describe("by touch", () => {
  test.skip(({ isMobile }) => !isMobile, "runs in the touch project");

  /** Real touch input through the browser, so scrolling and the press delay behave as they do under a finger. */
  async function finger(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    return {
      down: (x: number, y: number) => send("touchStart", x, y),
      move: (x: number, y: number) => send("touchMove", x, y),
      up: () => send("touchEnd"),
      async slide(from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
        for (let i = 1; i <= steps; i++) {
          await send("touchMove", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
          await page.waitForTimeout(16);
        }
      },
    };
  }

  test("a swipe on a section's words or a picture scrolls and moves nothing; a quick swipe from a grip picks nothing up; a 260ms press does; no tray", async ({ page }) => {
    await open(page, "gallery");
    await expect(page.locator(TRAY)).toBeHidden();
    const touch = await finger(page);
    const order = await pageOrder(page);

    const words = frame(page, "findings");
    await words.scrollIntoViewIfNeeded();
    const w = (await words.boundingBox())!;
    const y0 = await scrollY(page);
    await touch.down(w.x + 80, w.y + 40);
    await touch.slide({ x: w.x + 80, y: w.y + 40 }, { x: w.x + 80, y: w.y - 260 });
    await touch.up();
    await expect.poll(() => scrollY(page)).toBeGreaterThan(y0 + 150);
    expect(await pageOrder(page)).toEqual(order);
    await expect(lifting(page)).toHaveCount(0);

    const tiles = grid(await rowsNow(page))!.items.map((c) => c.item.id);
    const picture = frame(page, tiles[2]!).locator("img").first();
    await picture.scrollIntoViewIfNeeded();
    const t = (await picture.boundingBox())!;
    const y1 = await scrollY(page);
    await touch.down(t.x + t.width / 2, t.y + t.height / 2);
    await touch.slide({ x: t.x + t.width / 2, y: t.y + t.height / 2 }, { x: t.x + t.width / 2, y: t.y + t.height / 2 - 220 });
    await touch.up();
    await expect.poll(() => scrollY(page)).toBeGreaterThan(y1 + 120);
    expect(await pageOrder(page)).toEqual(order);
    await expect(lifting(page)).toHaveCount(0);

    // A quick swipe that starts on a grip picks nothing up.
    const id = tiles[1]!;
    // The grip sits above the section's corner: brought to the middle of the screen, clear of the top bar.
    await grip(page, id).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    let g = (await grip(page, id).boundingBox())!;
    let at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
    await touch.down(at.x, at.y);
    await touch.slide(at, { x: at.x, y: at.y + 120 }, 5);
    await touch.up();
    await expect(lifting(page)).toHaveCount(0);
    expect(await pageOrder(page)).toEqual(order);

    // A 260ms press picks up; nothing moves as it does; carried over the next tile's far half, it drops after it.
    g = (await grip(page, id).boundingBox())!;
    at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
    const still = await drawn(page);
    const boxes = await layout(page);
    await touch.down(at.x, at.y);
    await page.waitForTimeout(260);
    await touch.move(at.x, at.y + 2);
    await expect(lifting(page)).toHaveAttribute("data-xe-drag", "pointer");
    expect(await drawn(page)).toEqual(still);
    const next = (await frame(page, tiles[2]!).boundingBox())!;
    await touch.slide(at, { x: next.x + next.width * 0.8, y: next.y + next.height * 0.7 }, 14);
    await page.waitForTimeout(250);
    expect(await layout(page)).toEqual(boxes);
    const shown = (await place(page))!;
    expect(shown).not.toBe(order.indexOf(id));
    await touch.up();
    expect(await pageOrder(page)).toEqual(orderWith(order, id, shown));
    await settled(page);
    await expect(lifting(page)).toHaveCount(0);
  });
});
