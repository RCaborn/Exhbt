import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { formatOf, FORMAT_RULES, type Format } from "../lib/exhbt/formats";
import { pageItems, rowsFor, type Cell, type Row } from "../lib/exhbt/layouts";
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

/** The motion of the frames since the drop: each animation's length and what it animates. */
const frameMotion = (page: Page) =>
  page.evaluate((sel) =>
    document
      .getAnimations()
      .filter((a) => (a.effect as KeyframeEffect).target?.matches(sel))
      .map((a) => {
        const effect = a.effect as KeyframeEffect;
        return { ms: effect.getTiming().duration, props: [...new Set(effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)) };
      }),
  FRAMES);

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
      // Selecting words by dragging across them selects them, and carries nothing.
      const words = page.locator(`${READY} .xp-title`);
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
      await page.waitForTimeout(250);
      const mid = await drawn(page);
      expect(mid[order[0]!]!.y, "the first section has slid down").toBeGreaterThan(before[order[0]!]!.y + 20);
      expect(await layout(page)).toEqual(boxes);
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
      await page.waitForTimeout(250);
      expect(start.y).toBeLessThan(flow.y);
      await expect(page.locator(`${READY} [data-xe-landing]`)).toBeVisible();
      await expect(page.locator(`${READY} [data-xe-line]`)).toBeHidden();
      const mid = await drawn(page);
      expect(now.filter((id) => Math.abs(mid[id]!.y - still[id]!.y) > 0.5 || Math.abs(mid[id]!.x - still[id]!.x) > 0.5).length).toBeGreaterThan(0);
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
    await page.keyboard.press("Enter");
    expect(await pageOrder(page)).toEqual(orderWith(order, id, order.length - 2));
    expect((await frameMotion(page)).every((m) => m.ms === 180 && m.props.join() === "transform")).toBe(true);
    await expect(said(page)).toHaveText(`${await nameOf(page, id)} moved up, to place ${order.length - 1} of ${order.length}.`);
    await expect(frame(page, id).locator('[data-tool="up"]')).toBeFocused();
    for (let i = 2; i < order.length; i++) await page.keyboard.press("Enter");
    expect((await pageOrder(page))[0]).toBe(id);
    // At the top, move up is off and the focus goes to move down.
    await expect(frame(page, id).locator('[data-tool="up"]')).toBeDisabled();
    await expect(frame(page, id).locator('[data-tool="down"]')).toBeFocused();
  });
});
