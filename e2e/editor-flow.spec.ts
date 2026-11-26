import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./editor-test";
import { lineAt, moved, placeAt, within } from "../components/exhbt-editor/flow/geometry";
import { formatLimits, validateForPublish, type ExhbtDoc, type FlowStep } from "../lib/exhbt/blocks";
import { FORMAT_RULES, type Format } from "../lib/exhbt/formats";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { allowEditOnly, boxes, differences, docNow, field, finger, focusedPath, freshName, full, offered, openDoc, openTiming, READY, renders, sampleDoc, SAMPLES, seeAsVisitor, settle, undoLabel, waitLive, waitReady } from "./page-editor";

/*
 * The flowchart edited where it sits (decision 0026; docs/briefs/edit-on-page/r3-k-flowchart.md): type
 * in each box, add a box on any arrow, remove one, drag one to another place, with the page's own
 * markup and classes. On each layout's sample (offered(), so release 4's layouts come in with no
 * change here): a case study's flowchart is a row (with five boxes or fewer at 1440 wide), a gallery's
 * a column beside "What happened", research's a column under "Method".
 *
 * The box style (FLOW_BOX_STYLE) is "slide", as Rory chose on 22 Nov 2026; it is read from the page
 * (data-flow-style), so the file passes with "line" too, whose own checks run only then. Desktop
 * project: everything but the touch checks. Touch project (Pixel 7): the touch checks.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
/** Tall enough for a whole sample, so a mouse drag never has to scroll. Widths (and so layouts) are a desktop's. */
const TALL = { width: 1440, height: 3600 };
/** A flowchart with more boxes than a layout allows: the one count the flowchart is still held to (decision 0032 made the fewest a suggestion). */
const MAX = (f: Format) => `Up to ${formatLimits(f).flow.max} boxes in the flowchart.`;
const FEW = (f: Format) => `Most flowcharts have at least ${formatLimits(f).flow.min} boxes. Add another if it helps.`;

const LIST = `${READY} article .xe-flow`;
const BOX = `${READY} article [data-flow-step]`;
const list = (page: Page) => page.locator(LIST);
const box = (page: Page, i: number) => page.locator(BOX).nth(i);
const gripOf = (page: Page, i: number) => box(page, i).locator("[data-flow-grip]");
const removeOf = (page: Page, i: number) => box(page, i).locator("[data-flow-remove]");
const said = (page: Page) => page.locator(`${READY} [data-said]`);
const plus = (page: Page) => page.locator(`${LIST} [data-flow-add]`);
const line = (page: Page) => page.locator(`${READY} [data-flow-line]`);
const copy = (page: Page) => page.locator(`${READY} [data-flow-copy]`);

/** The boxes' lasting keys, in page order. */
const keysNow = (page: Page) => page.locator(BOX).evaluateAll((els) => els.map((e) => e.getAttribute("data-flow-step")!));
/** The boxes' words, as the store holds them. */
const stepsNow = async (page: Page) => (await docNow(page)).flow.map((s) => s.step);

type Rect = { x: number; y: number; w: number; h: number };
/** Where each box is drawn, on the page (so scrolling doesn't count as moving). Includes any transform. */
const drawn = (page: Page) =>
  page.locator(`${BOX} > .xp-flow-box`).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    }),
  );
/** Each box's layout box: offsets summed up the page, and its offset size. Transforms don't change these. */
const laidOut = (page: Page) =>
  page.locator(`${BOX} > .xp-flow-box`).evaluateAll((els) =>
    (els as HTMLElement[]).map((e) => {
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = e; n; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      return { x, y, w: e.offsetWidth, h: e.offsetHeight };
    }),
  );
/** Where each box is in the window now (where the mouse goes). */
const client = (page: Page): Promise<Rect[]> => page.locator(`${BOX} > .xp-flow-box`).evaluateAll((els) => els.map((e) => ({ x: e.getBoundingClientRect().left, y: e.getBoundingClientRect().top, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => null));
/** Every box drawn where its layout puts it: no transform, no motion running. */
const placed = (page: Page) => page.locator(BOX).evaluateAll((els) => els.every((e) => getComputedStyle(e).transform === "none" && e.getAnimations().length === 0));
const near = (a: Rect[], b: Rect[]) => a.length === b.length && a.every((r, i) => Math.abs(r.x - b[i]!.x) < 0.5 && Math.abs(r.y - b[i]!.y) < 0.5 && Math.abs(r.w - b[i]!.w) < 0.5 && Math.abs(r.h - b[i]!.h) < 0.5);

const EXTRA: FlowStep[] = [
  { step: "Wrote the method up", detail: "a day" },
  { step: "Checked the sums again", detail: "a morning" },
  { step: "Shared the draft", detail: "a week" },
  { step: "Sent the final copy", detail: "a day" },
];
/** The sample's flowchart with `n` boxes. */
const withBoxes = (flow: FlowStep[], n: number): FlowStep[] => (n <= flow.length ? flow.slice(0, n) : [...flow, ...EXTRA.slice(0, n - flow.length)]);

/** Opens the editor on layout `f`'s sample, with `n` boxes in its flowchart (the sample's own when not given). */
async function open(page: Page, f: Format, n?: number, opts: { full?: boolean } = {}): Promise<string> {
  const base = opts.full ? full(sampleDoc(f)) : sampleDoc(f);
  const doc: ExhbtDoc = n === undefined ? base : { ...base, flow: withBoxes(base.flow, n) };
  const { id } = await openDoc(page, freshName(`flow${f}`), doc);
  await settle(page);
  return id;
}

/** How many boxes a case study can show in a row at 1440 wide; the other layouts draw a column. */
const DRAG_BOXES: Partial<Record<Format, number>> = { "case-study": 5 };
const AXIS: Partial<Record<Format, "row" | "column">> = { "case-study": "row", gallery: "column", research: "column" };

/** Presses the mouse on a box's grip and moves past the 6px threshold. Returns where the pointer is. */
async function pickUp(page: Page, i: number) {
  await listen(page, i);
  await box(page, i).hover();
  const g = (await gripOf(page, i).boundingBox())!;
  const at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  // Under 6px it is still a click on the grip.
  await page.mouse.move(at.x + 2, at.y + 2, { steps: 2 });
  expect(await list(page).getAttribute("data-flow-drag")).toBeNull();
  await page.mouse.move(at.x + 6, at.y + 6, { steps: 3 });
  try {
    await expect(list(page)).toHaveAttribute("data-flow-drag", "pointer");
  } catch (e) {
    const heard = await page.evaluate(() => (window as Window & { __press?: string[] }).__press ?? []).catch(() => ["(the page could not be read)"]);
    throw new Error(`The box did not lift. What the press met, in order:\n${heard.join("\n")}\n${(e as Error).message}`);
  }
  return { x: at.x + 6, y: at.y + 6 };
}

/**
 * What a press on box `i`'s grip meets, kept in the page for a pick-up that does not lift: a WebKit run's log is all
 * that a machine without WebKit sees of it. Where the focus is and whether the box is hovered with its tools shown,
 * before the pointer moves to it and again from inside the press (so nothing runs between the move and the press), what
 * the press landed on, and what the page did then. It listens to no event that comes often, such as a mousemove.
 */
function listen(page: Page, i: number) {
  return page.evaluate(
    ({ i, BOX, LIST }) => {
      type Heard = Window & { __press?: string[]; __pressFrom?: number; __pressBox?: number; __lastUp?: number; __pressListening?: boolean };
      const w = window as Heard;
      const name = (t: EventTarget | null): string => {
        if (!(t instanceof Element)) return t === document ? "document" : String(t);
        const mark = ["data-flow-grip", "data-flow-step", "data-path", "data-section-id"].find((a) => t.hasAttribute(a));
        const cls = [...t.classList].find((c) => c.startsWith("xe-") || c.startsWith("xp-"));
        return `${t.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${mark ? `[${mark}=${t.getAttribute(mark)}]` : ""}`;
      };
      /** The focus, and box `n`'s hover and tools, now. */
      const state = (n: number) => {
        const li = document.querySelectorAll(BOX)[n];
        const tools = li?.querySelector(".xe-flow-tools");
        const s = tools ? getComputedStyle(tools) : null;
        return `the focus on ${name(document.activeElement)}; the box hovered ${li?.matches(":hover")}; its tools ${s?.opacity}/${s?.pointerEvents}`;
      };
      const say = (s: string) => w.__press?.push(`  ${Math.round(performance.now() - (w.__pressFrom ?? 0))}ms ${s}`);
      w.__press = [];
      w.__pressFrom = performance.now();
      w.__pressBox = i;
      say(`at the start (${w.__lastUp === undefined ? "no drop yet" : `${Math.round(performance.now() - w.__lastUp)}ms after the last mouseup`}): ${state(i)}`);
      if (w.__pressListening) return;
      w.__pressListening = true;
      // The press as the browser hit it, and the page as it is drawn there now, from inside the press.
      window.addEventListener(
        "mousedown",
        (e) => say(`at the press: on ${name(e.target)}; drawn there now ${document.elementsFromPoint(e.clientX, e.clientY).slice(0, 3).map(name).join(" over ")}; ${state(w.__pressBox ?? 0)}`),
        true,
      );
      // After the page's own handlers and Safari's focus rule (e2e/editor-test.ts), which listens on the window too.
      window.addEventListener("mousedown", (e) => say(`the press done: prevented ${e.defaultPrevented}, taken by the drag ${"dndKit" in e}, the focus on ${name(document.activeElement)}`));
      window.addEventListener("mouseup", () => (w.__lastUp = performance.now()), true);
      for (const type of ["pointercancel", "dragstart", "resize", "visibilitychange", "keydown", "focusin"]) window.addEventListener(type, (e) => say(`${type} on ${name(e.target)}`), true);
      const flow = document.querySelector(LIST);
      if (flow) new MutationObserver(() => say(`data-flow-drag is ${flow.getAttribute("data-flow-drag")}`)).observe(flow, { attributes: true, attributeFilter: ["data-flow-drag"] });
      const region = document.querySelector('[data-editor="page"] [data-said]');
      if (region) new MutationObserver(() => say(`said: ${region.textContent}`)).observe(region, { childList: true, characterData: true, subtree: true });
    },
    { i, BOX, LIST },
  );
}

/** The point `share` of the way along box `i` (along the flowchart's axis), across its middle. */
const along = (r: Rect, axis: "row" | "column", share: number) => (axis === "row" ? { x: r.x + r.w * share, y: r.y + r.h / 2 } : { x: r.x + r.w / 2, y: r.y + r.h * share });

/**
 * Each of the flowchart's chips that shows now, against each control of the drag board's and the
 * sections' that shows now (`theirs`, a selector inside the editor): every pair that overlaps, in words.
 */
const overlaps = (page: Page, theirs: string) =>
  page.evaluate((sel) => {
    const shown = (e: Element) => {
      for (let n: Element | null = e; n; n = n.parentElement) if (getComputedStyle(n).opacity === "0" || getComputedStyle(n).display === "none") return false;
      return true;
    };
    const root = document.querySelector('[data-editor="page"]')!;
    const mine = [...root.querySelectorAll(".xe-flow-chip")].filter(shown);
    const others = [...root.querySelectorAll(sel)].filter(shown);
    const out: string[] = [];
    for (const a of mine)
      for (const b of others) {
        const p = a.getBoundingClientRect();
        const q = b.getBoundingClientRect();
        if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0.5 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0.5) out.push(`${a.getAttribute("aria-label")} on ${b.getAttribute("aria-label")}`);
      }
    return out;
  }, theirs);

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).include(READY).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

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

/* ------------------------------------------------------------------------------------------------
 * The place and the line, in-process: the rules the drag follows
 * ---------------------------------------------------------------------------------------------- */

test.describe("the place and the line, in-process", () => {
  const spans = [
    { start: 0, end: 100 },
    { start: 127, end: 227 },
    { start: 254, end: 354 },
    { start: 381, end: 481 },
  ];

  test("the nearest box's place, held until another is nearer by 10px: resting on a boundary never flickers", () => {
    expect(placeAt(spans, 40, null)).toBe(0);
    expect(placeAt(spans, 300, null)).toBe(2);
    // The boundary between places 1 and 2 is at 240.5; trembling 2px either side of it 40 times never changes the place.
    let place = placeAt(spans, 240, 1);
    for (let i = 0; i < 40; i++) {
      place = placeAt(spans, 240.5 + (i % 2 ? 2 : -2), place);
      expect(place).toBe(1);
    }
    // Nearer by more than 10px, it takes over.
    expect(placeAt(spans, 252, 1)).toBe(2);
    // Past either end, the end place.
    expect(placeAt(spans, -500, 2)).toBe(0);
    expect(placeAt(spans, 5000, 0)).toBe(3);
  });

  test("the line is in the gap the box would go into: after the box it is over going on, before it going back, and none where it was", () => {
    expect(lineAt(spans, 0, 0)).toBeNull();
    expect(lineAt(spans, 0, 2)).toBe((354 + 381) / 2);
    expect(lineAt(spans, 0, 3)).toBe(481 + 8);
    expect(lineAt(spans, 3, 1)).toBe((100 + 127) / 2);
    expect(lineAt(spans, 3, 0)).toBe(0 - 8);
    expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moved(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
    // Far off to the side of the flowchart, it is over no place.
    expect(within(50, 0, 100)).toBe(true);
    expect(within(170, 0, 100)).toBe(true);
    expect(within(190, 0, 100)).toBe(false);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Each layout, with a mouse and a keyboard
 * ---------------------------------------------------------------------------------------------- */

for (const f of offered()) {
  test.describe(`${FORMAT_RULES[f].name}: the flowchart`, () => {
    test.skip(({ isMobile }) => isMobile, "the touch checks are below");

    test("typing in a box re-renders the flowchart only, once a key, and never remounts the box", async ({ page }) => {
      await open(page, f);
      const f1 = field(page, "flow.1.step");
      await f1.click();
      await page.keyboard.press("ControlOrMeta+End");
      // Each box keeps its node while it is typed in.
      await page.locator(BOX).evaluateAll((els) => els.forEach((e, i) => ((e as HTMLElement & { __mark?: number }).__mark = i)));
      for (const key of ["a", "b", "c"]) {
        const before = await renders(page);
        await page.keyboard.type(key);
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        const after = await renders(page);
        const changed = Object.fromEntries(Object.keys({ ...before, ...after }).flatMap((k) => ((after[k] ?? 0) - (before[k] ?? 0) ? [[k, (after[k] ?? 0) - (before[k] ?? 0)]] : [])));
        expect(changed, `the key ${key}`).toEqual({ flow: 1 });
      }
      expect(await page.locator(BOX).evaluateAll((els) => els.map((e) => (e as HTMLElement & { __mark?: number }).__mark))).toEqual((await keysNow(page)).map((_, i) => i));
      expect((await docNow(page)).flow[1]!.step).toMatch(/abc$/);
      await expect(f1).toBeFocused();
    });

    test("with two boxes there is nothing to fix: the list carries no issue, and the suggestion goes to the flowchart", async ({ page }) => {
      // Until decision 0032 two boxes stopped publishing ("The flowchart needs at least 3 boxes."). It is a suggestion now.
      await open(page, f, 2, { full: true });
      await expect(list(page)).not.toHaveAttribute("data-invalid", "");
      await expect(page.locator(`${READY} #flow-issue`)).toHaveCount(0);
      expect(validateForPublish(await docNow(page)).filter((i) => i.path.startsWith("flow"))).toEqual([]);
      // Whatever else the top bar has to say, the suggestion is in its list, and pressed, it goes to the flowchart.
      await page.locator(`${READY} .xe-suggest-button, ${READY} .xe-fix-button`).first().click();
      await page.locator(`${READY} [data-suggestions]`).getByText(FEW(f), { exact: true }).click();
      await expect.poll(() => focusedPath(page)).toBe("flow.0.step");
      await expect(list(page)).not.toHaveAttribute("data-invalid", "");
    });

    test("with more boxes than the layout allows, Things to fix lists the count issue and jumps to the list; the issue takes no room", async ({ page }) => {
      const over = formatLimits(f).flow.max + 1;
      await open(page, f, over, { full: true });
      expect(await keysNow(page)).toHaveLength(over);
      // The list is the anchor, with an outline in the look's error colour and its message tied to it, hidden until it has the focus.
      await expect(list(page)).toHaveAttribute("data-path", "flow");
      await expect(list(page)).toHaveAttribute("tabindex", "-1");
      await expect(list(page)).toHaveAttribute("data-invalid", "");
      const note = page.locator(`${READY} #flow-issue`);
      await expect(list(page)).toHaveAttribute("aria-describedby", "flow-issue");
      await expect(note).toHaveText(MAX(f));
      expect(await note.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
      const error = await list(page).evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--xp-error)";
        el.appendChild(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      });
      expect(await list(page).evaluate((el) => getComputedStyle(el).outlineColor)).toBe(error);
      // The message is never in the flow: the box for box measure, before and after it shows, is the same.
      const atRest = await boxes(page, { frames: true });
      await page.getByRole("button", { name: /things? to fix/ }).click();
      await page.locator(`${READY} [data-issue-path="flow"]`).click();
      await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-path="flow"]')))).toBe(true);
      // The jump lands in the first box (jump.ts puts the cursor in the first field of an anchor).
      expect(await focusedPath(page)).toBe("flow.0.step");
      await expect(note).toBeVisible();
      expect(await note.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      expect(differences(atRest, await boxes(page, { frames: true }))).toEqual([]);
      // And against the visitor's page, box for box: the outline, the message and the controls add nothing.
      await allowEditOnly(page, "always");
      await page.locator(`${READY} h1`).focus();
      await settle(page);
      const editing = await boxes(page);
      await seeAsVisitor(page, true);
      await settle(page);
      expect(differences(await boxes(page), editing)).toEqual([]);
    });

    test("every box can be removed, down to none; then Add a box has the cursor and starts the flowchart again", async ({ page }) => {
      // Until decision 0032 Remove was off at three boxes and said why. Nothing has to be filled in now.
      await page.setViewportSize(TALL);
      await open(page, f, 3);
      for (let left = 3; left > 0; left--) {
        await box(page, 0).hover();
        await expect(removeOf(page, 0)).toBeEnabled();
        await expect(removeOf(page, 0)).toHaveAccessibleDescription("");
        await removeOf(page, 0).click();
        await expect(said(page)).toHaveText("Box 1 removed.");
        expect(await keysNow(page)).toHaveLength(left - 1);
      }
      expect((await docNow(page)).flow).toEqual([]);
      const first = page.getByRole("button", { name: "Add a box", exact: true });
      await expect(first).toBeFocused();
      // An empty flowchart is nothing to fix, and a visitor is shown no flowchart for it.
      expect(validateForPublish(await docNow(page)).filter((i) => i.path.startsWith("flow"))).toEqual([]);
      await first.click();
      await expect.poll(() => focusedPath(page)).toBe("flow.0.step");
      await page.keyboard.type("Started again");
      expect(await stepsNow(page)).toEqual(["Started again"]);
    });

    test("a + on an arrow adds a box there with the cursor in it; at six there is none; Remove takes one away at any count", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, 3);
      expect(await keysNow(page)).toHaveLength(3);
      // Remove is on at three, with nothing to explain (it was off there until decision 0032).
      await box(page, 1).hover();
      await expect(removeOf(page, 1)).toBeEnabled();
      // Nothing moves when the "+" and the tools show: they take no room.
      await page.mouse.move(5, 5);
      const still = await drawn(page);
      const page0 = await boxes(page, { frames: true });
      await box(page, 0).hover();
      await expect(plus(page).first()).toBeVisible();
      expect(near(await drawn(page), still)).toBe(true);
      expect(differences(page0, await boxes(page, { frames: true }))).toEqual([]);
      expect(await plus(page).evaluateAll((els) => els.map((e) => getComputedStyle(e).position))).toEqual(["absolute", "absolute", "absolute"]);
      // "+" on the first arrow: an empty box in place 2, with the cursor in it.
      const steps = await stepsNow(page);
      await page.getByRole("button", { name: "Add a box after box 1", exact: true }).click();
      await expect(said(page)).toHaveText("Box added in place 2 of 4.");
      await expect.poll(() => focusedPath(page)).toBe("flow.1.step");
      expect(await stepsNow(page)).toEqual([steps[0], "", ...steps.slice(1)]);
      await page.keyboard.type("A new step");
      expect((await stepsNow(page))[1]).toBe("A new step");
      // At the end.
      await box(page, 3).hover();
      await page.getByRole("button", { name: "Add a box at the end", exact: true }).click();
      await expect.poll(() => focusedPath(page)).toBe("flow.4.step");
      await page.keyboard.type("The end");
      await box(page, 0).hover();
      await page.getByRole("button", { name: "Add a box after box 2", exact: true }).click();
      await expect.poll(() => focusedPath(page)).toBe("flow.2.step");
      expect(await keysNow(page)).toHaveLength(6);
      // Six is the most: no "+" anywhere.
      await expect(plus(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Add a box/ })).toHaveCount(0);
      // Remove is on again; the cursor goes to the box that took the removed one's place.
      const keys = await keysNow(page);
      await box(page, 1).hover();
      await expect(removeOf(page, 1)).toBeEnabled();
      await removeOf(page, 1).click();
      await expect(said(page)).toHaveText("Box 2 removed.");
      expect(await keysNow(page)).toEqual(keys.filter((_, i) => i !== 1));
      await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[data-flow-step]")?.getAttribute("data-flow-step") ?? null)).toBe(keys[2]);
    });

    test("a box dragged along the flowchart lands where shown; nothing moves as it lifts; the line and the copy, or the others sliding", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, DRAG_BOXES[f]);
      const axis = (await list(page).getAttribute("data-axis")) as "row" | "column";
      if (AXIS[f]) expect(axis).toBe(AXIS[f]);
      const style = await list(page).getAttribute("data-flow-style");
      const keys = await keysNow(page);
      const steps = await stepsNow(page);
      const n = keys.length;
      await page.mouse.move(5, 5);
      const still = await drawn(page);
      const layout = await laidOut(page);
      const page0 = await boxes(page, { frames: true });

      // Nothing moves when it lifts: no layout box changes, and no other box is drawn anywhere else. (Sliding, the
      // lifted box is under the pointer, which has moved past the 6px threshold: by transform only.)
      await pickUp(page, 0);
      await expect(said(page)).toHaveText(`Picked up box 1 of ${n}.`);
      expect(near(await laidOut(page), layout)).toBe(true);
      expect(near((await drawn(page)).slice(style === "line" ? 0 : 1), still.slice(style === "line" ? 0 : 1))).toBe(true);
      const outside0 = (all: Awaited<ReturnType<typeof boxes>>) => all.filter((b) => !b.key.startsWith("flowchart box"));
      expect(differences(outside0(page0), outside0(await boxes(page, { frames: true })))).toEqual([]);
      if (style === "line") await expect(copy(page)).toBeVisible();

      // Over the far part of box 3: place 3, shown.
      const third = (await client(page))[2]!;
      const to = along(third, axis, 0.7);
      await page.mouse.move(to.x, to.y, { steps: 15 });
      await expect(said(page)).toHaveText(`The box would go to place 3 of ${n}.`);
      // No box's layout box has changed; nothing round the flowchart has moved (the boxes themselves are checked by style below).
      expect(near(await laidOut(page), layout)).toBe(true);
      const outside = (all: Awaited<ReturnType<typeof boxes>>) => all.filter((b) => !b.key.startsWith("flowchart box"));
      expect(differences(outside(page0), outside(await boxes(page, { frames: true })))).toEqual([]);
      if (style === "line") {
        // Every box is where it was, the line is in the gap after box 3, and the copy the size of the box is under the pointer.
        expect(near(await drawn(page), still)).toBe(true);
        const l = (await line(page).boundingBox())!;
        const c = await client(page);
        if (axis === "row") {
          expect(l.x + l.width / 2).toBeGreaterThan(c[2]!.x + c[2]!.w);
          expect(l.x + l.width / 2).toBeLessThan(c[3]!.x);
        } else {
          expect(l.y + l.height / 2).toBeGreaterThan(c[2]!.y + c[2]!.h);
          expect(l.y + l.height / 2).toBeLessThan(c[3]!.y);
        }
        const k = (await copy(page).boundingBox())!;
        expect(k.width).toBeCloseTo(still[0]!.w, 0);
        expect(k.height).toBeCloseTo(still[0]!.h, 0);
        expect(Math.abs(k.x + k.width / 2 - to.x)).toBeLessThan(k.width);
        expect(Math.abs(k.y + k.height / 2 - to.y)).toBeLessThan(k.height);
      } else {
        await expect(line(page)).toHaveCount(0);
        await expect(copy(page)).toHaveCount(0);
        // The others slide aside: box 2 and box 3 have moved back a place, box 4 is still.
        const now = await drawn(page);
        expect(near([now[1]!], [still[1]!])).toBe(false);
        expect(near([now[3]!], [still[3]!])).toBe(true);
      }
      await page.mouse.up();
      expect(await keysNow(page)).toEqual(moved(keys, 0, 2));
      expect(await stepsNow(page)).toEqual(moved(steps, 0, 2));
      await expect(said(page)).toHaveText(`Box dropped in place 3 of ${n}.`);
      await settled(page);
      await expect(copy(page)).toHaveCount(0);
      await expect(line(page)).toHaveCount(0);
      await expect(list(page)).not.toHaveAttribute("data-flow-drag", /./);
      // Each box is in its place, with nothing left over from the motion.
      expect(await placed(page)).toBe(true);
      // The dropped box's grip has the focus, as after a drag from the keyboard. Under Safari's rule a press gives the grip
      // none, and WebKit can lose the hover of a box the drop has moved under the pointer: with neither, the box's tools
      // hid under the pointer and the pick-up below went to the box (FlowList.tsx, keepGrip).
      await expect(gripOf(page, 2)).toBeFocused();

      // Back again, towards the start: over the near part of box 1, place 1; in line style the line goes before it.
      await pickUp(page, 2);
      const first = (await client(page))[0]!;
      const back = along(first, axis, 0.3);
      await page.mouse.move(back.x, back.y, { steps: 15 });
      await expect(said(page)).toHaveText(`The box would go to place 1 of ${n}.`);
      if (style === "line") {
        const l = (await line(page).boundingBox())!;
        if (axis === "row") expect(l.x + l.width / 2).toBeLessThan(first.x);
        else expect(l.y + l.height / 2).toBeLessThan(first.y);
      }
      await page.mouse.up();
      expect(await keysNow(page)).toEqual(keys);
      expect(await stepsNow(page)).toEqual(steps);
      // It is the focus that keeps the dropped box's tools shown, not the hover: they stay with the pointer off the box.
      await expect(gripOf(page, 0)).toBeFocused();
      await page.mouse.move(5, 5);
      expect(await box(page, 0).locator(".xe-flow-tools").evaluate((e) => `${getComputedStyle(e).opacity}/${getComputedStyle(e).pointerEvents}`)).toBe("1/auto");

      // Let go off to the side of the flowchart, it goes back where it was.
      await pickUp(page, 1);
      const side = (await list(page).boundingBox())!;
      if (axis === "row") await page.mouse.move(side.x + side.width / 2, side.y + side.height + 200, { steps: 10 });
      else await page.mouse.move(side.x + side.width + 200, side.y + side.height / 2, { steps: 10 });
      await expect(said(page)).toHaveText("The box isn't over a place.");
      await expect(line(page)).toHaveCount(0);
      await page.mouse.up();
      await expect(said(page)).toHaveText("Box dropped where it was.");
      expect(await keysNow(page)).toEqual(keys);
    });

    test("the keyboard moves a box from its grip, each step read out; Escape puts it back; the grip keeps the focus", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, DRAG_BOXES[f]);
      const keys = await keysNow(page);
      const n = keys.length;
      const style = await list(page).getAttribute("data-flow-style");
      await page.mouse.move(5, 5);
      const still = await drawn(page);
      await gripOf(page, 1).focus();
      await expect(gripOf(page, 1)).toHaveAccessibleName("Drag box 2 to move it");
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(`Picked up box 2 of ${n}.`);
      await expect(list(page)).toHaveAttribute("data-flow-drag", "keys");
      // From the keyboard the box itself is lifted (no copy), and nothing moves as it does.
      await expect(copy(page)).toHaveCount(0);
      expect(near(await drawn(page), still)).toBe(true);
      // Right and down both go on, left and up go back, whichever way the flowchart runs.
      await page.keyboard.press("ArrowRight");
      await expect(said(page)).toHaveText(`The box would go to place 3 of ${n}.`);
      if (style === "line") await expect(line(page)).toBeVisible();
      await page.keyboard.press("ArrowDown");
      await expect(said(page)).toHaveText(`The box would go to place 4 of ${n}.`);
      await page.keyboard.press("ArrowUp");
      await expect(said(page)).toHaveText(`The box would go to place 3 of ${n}.`);
      if (style === "line") expect(near(await drawn(page), still)).toBe(true);
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(`Box dropped in place 3 of ${n}.`);
      expect(await keysNow(page)).toEqual(moved(keys, 1, 2));
      // The moved box's grip still has the focus.
      await expect.poll(() => page.evaluate(() => (document.activeElement?.hasAttribute("data-flow-grip") ? document.activeElement.closest("[data-flow-step]")?.getAttribute("data-flow-step") : null))).toBe(keys[1]);
      await settled(page);

      // Escape: back where it was.
      await page.keyboard.press("Enter");
      await expect(said(page)).toHaveText(`Picked up box 3 of ${n}.`);
      await page.keyboard.press("ArrowLeft");
      await expect(said(page)).toHaveText(`The box would go to place 2 of ${n}.`);
      await page.keyboard.press("Escape");
      await expect(said(page)).toHaveText("Moving the box cancelled. It's back where it was.");
      await expect(list(page)).not.toHaveAttribute("data-flow-drag", /./);
      expect(await keysNow(page)).toEqual(moved(keys, 1, 2));
    });

    test("adding, removing and moving a box are each undone by Undo, the focus lands in the flowchart at once, and typing done in between is kept", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, 4);
      const keys = await keysNow(page);
      const steps = await stepsNow(page);
      // Undo by Ctrl+Z (from the heading, out of any field) or by the top bar's button. The focus is where it belongs
      // as soon as the key or the click has been handled, with no frame to wait for: `lands` is its path (a box's
      // words, or "flow", the flowchart itself, when the undo took the box out).
      const undo = async (label: string, lands: string, by: "keys" | "button" = "keys") => {
        expect(await undoLabel(page)).toBe(label);
        if (by === "button") await page.getByRole("button", { name: `Undo: ${label}`, exact: true }).click();
        else {
          await page.locator(`${READY} h1`).focus();
          await page.keyboard.press("ControlOrMeta+z");
        }
        expect(await focusedPath(page), `the focus after undoing ${label}`).toBe(lands);
      };

      // Add, then type in another box.
      await box(page, 0).hover();
      await page.getByRole("button", { name: "Add a box after box 1", exact: true }).click();
      await expect.poll(() => focusedPath(page)).toBe("flow.1.step");
      await page.keyboard.type("Added");
      await field(page, "flow.4.step").click();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type(" (typed)");
      await undo("add box 2", "flow");
      expect(await keysNow(page)).toEqual(keys);
      expect(await stepsNow(page)).toEqual([...steps.slice(0, 3), `${steps[3]} (typed)`]);

      // Remove, then type.
      await box(page, 1).hover();
      await removeOf(page, 1).click();
      await expect(said(page)).toHaveText("Box 2 removed.");
      await field(page, "flow.0.step").click();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type(" (typed)");
      await undo("remove box 2", "flow.1.step", "button");
      expect(await keysNow(page)).toEqual(keys);
      expect(await stepsNow(page)).toEqual([`${steps[0]} (typed)`, steps[1], steps[2], `${steps[3]} (typed)`]);

      // Move, then type.
      await gripOf(page, 0).focus();
      await expect(gripOf(page, 0)).toBeFocused();
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText("Picked up box 1 of 4.");
      await page.keyboard.press("ArrowRight");
      await expect(said(page)).toHaveText("The box would go to place 2 of 4.");
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText("Box dropped in place 2 of 4.");
      expect(await keysNow(page)).toEqual(moved(keys, 0, 1));
      await field(page, "flow.2.step").click();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type(" (typed)");
      await undo("move box 1", "flow.0.step");
      expect(await keysNow(page)).toEqual(keys);
      expect(await stepsNow(page)).toEqual([`${steps[0]} (typed)`, steps[1], `${steps[2]} (typed)`, `${steps[3]} (typed)`]);
      // Nothing moves the focus a frame later: a grip focused straight after an Undo keeps it.
      await gripOf(page, 1).focus();
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-flow-grip") ?? null)).toBe("2");
    });

    test("the dark box is always the last: after a move, an add at the end and a remove", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, 4);
      const darkIsLast = async () => {
        const marks = await page.locator(`${BOX} > .xp-flow-box`).evaluateAll((els) => els.map((e) => e.hasAttribute("data-last")));
        expect(marks).toEqual(marks.map((_, i) => i === marks.length - 1));
        const [bg, end] = await page.locator(`${BOX} > .xp-flow-box[data-last]`).evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--xp-flow-end)";
          el.appendChild(probe);
          const want = getComputedStyle(probe).color;
          probe.remove();
          return [getComputedStyle(el).backgroundColor, want];
        });
        expect(bg).toBe(end);
      };
      await darkIsLast();
      const keys = await keysNow(page);
      // The last box moved to the start: the box now last is the dark one.
      await gripOf(page, 3).focus();
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText("Picked up box 4 of 4.");
      for (const place of [3, 2, 1]) {
        await page.keyboard.press("ArrowLeft");
        await expect(said(page)).toHaveText(`The box would go to place ${place} of 4.`);
      }
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText("Box dropped in place 1 of 4.");
      expect(await keysNow(page)).toEqual(moved(keys, 3, 0));
      await settled(page);
      await darkIsLast();
      // A box added at the end is the result.
      await box(page, 3).hover();
      await page.getByRole("button", { name: "Add a box at the end", exact: true }).click();
      await expect.poll(() => focusedPath(page)).toBe("flow.4.step");
      await darkIsLast();
      await expect(field(page, "flow.4.step")).toHaveAttribute("placeholder", "The result");
      // Removing the last box makes the one before it the result.
      await box(page, 4).hover();
      await removeOf(page, 4).click();
      await expect(said(page)).toHaveText("Box 5 removed.");
      await darkIsLast();
    });

    test("with reduced motion nothing animates: picked up, carried, dropped, from the keyboard, added and removed", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize(TALL);
      await open(page, f, DRAG_BOXES[f]);
      const motion = () => page.evaluate((root) => document.getAnimations().filter((a) => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest(root)).length, READY);
      const axis = (await list(page).getAttribute("data-axis")) as "row" | "column";
      const keys = await keysNow(page);
      await page.mouse.move(5, 5);
      const before = await client(page);
      await pickUp(page, 0);
      expect(await motion()).toBe(0);
      const to = along(before[2]!, axis, 0.7);
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await expect(said(page)).toHaveText(`The box would go to place 3 of ${keys.length}.`);
      expect(await page.locator(BOX).evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration))).toEqual(keys.map(() => "0s"));
      expect(await motion()).toBe(0);
      await page.mouse.up();
      expect(await motion()).toBe(0);
      expect(await keysNow(page)).toEqual(moved(keys, 0, 2));
      // Dropped straight into its place.
      expect(await placed(page)).toBe(true);
      await gripOf(page, 2).focus();
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(`Picked up box 3 of ${keys.length}.`);
      await page.keyboard.press("ArrowLeft");
      expect(await motion()).toBe(0);
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(`Box dropped in place 2 of ${keys.length}.`);
      expect(await motion()).toBe(0);
      await box(page, 0).hover();
      await page.getByRole("button", { name: "Add a box after box 1", exact: true }).click();
      expect(await motion()).toBe(0);
      await box(page, 1).hover();
      await removeOf(page, 1).click();
      expect(await motion()).toBe(0);
    });

    test("beside the drag board: nothing of the flowchart's sits on a section's + or toolbar, and all of it hides while a section is carried", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, DRAG_BOXES[f]);
      // With the first box's tools showing, then the last's (the gaps above and below the flowchart hold the sections' own controls).
      for (const i of [0, (await keysNow(page)).length - 1]) {
        await box(page, i).hover();
        await expect(gripOf(page, i)).toBeVisible();
        expect(await overlaps(page, ".xe-plus, .xe-tools > *"), `box ${i + 1}`).toEqual([]);
      }
      // The drag board carries another section: the flowchart offers nothing, even under the pointer.
      const other = (await page.locator(`${READY} article [data-section-id]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section-id")!))).find((id) => id !== "flow")!;
      const frameOf = page.locator(`${READY} [data-section-id="${other}"]`);
      await frameOf.hover();
      const g = (await frameOf.locator("[data-grip]").boundingBox())!;
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + g.width / 2 + 4, g.y + g.height / 2 + 8, { steps: 4 });
      await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "pointer");
      const b = (await box(page, 1).locator(".xp-flow-box").boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      expect(await page.locator(`${LIST} :is(.xe-flow-tools, .xe-flow-add)`).evaluateAll((els) => els.length > 0 && els.every((e) => getComputedStyle(e).opacity === "0" && getComputedStyle(e).pointerEvents === "none"))).toBe(true);
      expect(await page.locator(`${LIST} .xe-flow-chip`).evaluateAll((els) => els.every((e) => getComputedStyle(e).pointerEvents === "none"))).toBe(true);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
    });

    test("the drop's motion is 180ms of transforms, and only the boxes that moved get it", async ({ page }) => {
      await page.setViewportSize(TALL);
      await open(page, f, DRAG_BOXES[f]);
      const style = await list(page).getAttribute("data-flow-style");
      const axis = (await list(page).getAttribute("data-axis")) as "row" | "column";
      // Every animation the page's boxes (and the copy) are given from now on, as it starts.
      await page.evaluate(() => {
        const w = window as unknown as { __motion: { on: string; ms: unknown; props: string[] }[]; __animate?: typeof Element.prototype.animate };
        w.__motion = [];
        w.__animate = Element.prototype.animate;
        Element.prototype.animate = function (this: Element, keyframes, options) {
          if (Array.isArray(keyframes)) {
            const props = [...new Set(keyframes.flatMap((k) => Object.keys(k)))].filter((k) => !["offset", "easing", "composite"].includes(k));
            w.__motion.push({ on: this.getAttribute("data-flow-step") ?? (this.querySelector("[data-flow-copy]") ? "copy" : this.tagName), ms: typeof options === "number" ? options : options?.duration, props });
          }
          return w.__animate!.call(this, keyframes, options);
        };
      });
      const keys = await keysNow(page);
      await page.mouse.move(5, 5);
      const before = await client(page);
      await pickUp(page, 0);
      const to = along(before[2]!, axis, 0.7);
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await expect(said(page)).toHaveText(`The box would go to place 3 of ${keys.length}.`);
      if (style === "slide") {
        // While carried: the boxes that make room slide by the editor's own 180ms transform, not dnd-kit's default; nothing else moves.
        const moving = await page.locator(BOX).evaluateAll((els) => els.map((e) => ({ property: getComputedStyle(e).transitionProperty, ms: getComputedStyle(e).transitionDuration, ease: getComputedStyle(e).transitionTimingFunction })));
        for (const i of [1, 2]) expect(moving[i], `box ${i + 1} making room`).toEqual({ property: "transform", ms: "0.18s", ease: "cubic-bezier(0.2, 0, 0, 1)" });
        expect(await page.evaluate(() => (window as unknown as { __motion: unknown[] }).__motion.length)).toBe(0);
      }
      await page.mouse.up();
      await settled(page);
      const motion = await page.evaluate(() => (window as unknown as { __motion: { on: string; ms: unknown; props: string[] }[] }).__motion);
      if (style === "slide") {
        // Box 1 settles from where it was let go; boxes 2 and 3 only if their slide aside was still on its way; boxes 4 on stay still.
        const on = motion.map((m) => m.on);
        expect(on, JSON.stringify({ motion, keys })).toContain(keys[0]);
        expect(on.every((k) => [keys[0], keys[1], keys[2]].includes(k)), JSON.stringify({ motion, keys })).toBe(true);
      } else {
        // Boxes 2 and 3 move back a place, the copy takes box 1 to its new place; boxes 4 on stay still.
        expect(motion.filter((m) => m.on !== "copy").map((m) => m.on).sort()).toEqual([keys[1], keys[2]].sort());
        expect(motion.some((m) => m.on === "copy")).toBe(true);
      }
      for (const m of motion) {
        expect(m.ms).toBe(180);
        expect(m.props).toEqual(["transform"]);
      }
      // Once settled, no box is left with a transform or a transition: the drop is the editor's motion, not dnd-kit's.
      expect(await placed(page)).toBe(true);
      expect(await page.locator(BOX).evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration))).toEqual(keys.map(() => "0s"));
    });
  });
}

test.describe("an empty flowchart", () => {
  test.skip(({ isMobile }) => isMobile, "a desktop's check");

  test("with no boxes, the one button is its placeholder: Add a box puts the cursor in box 1", async ({ page }) => {
    await openDoc(page, freshName("flowempty"), { ...sampleDoc("case-study"), flow: [] });
    await settle(page);
    await expect(page.locator(BOX)).toHaveCount(0);
    const first = page.locator(`${LIST} [data-flow-add]`);
    await expect(first).toHaveCount(1);
    await expect(first).toHaveAccessibleName("Add a box");
    await expect(first).toBeVisible();
    await first.click();
    await expect(said(page)).toHaveText("Box added in place 1 of 1.");
    await expect.poll(() => focusedPath(page)).toBe("flow.0.step");
    await page.keyboard.type("The only step");
    expect(await stepsNow(page)).toEqual(["The only step"]);
    await expect(page.getByRole("button", { name: "Add a box", exact: true })).toHaveCount(0);
    // One box is nothing to fix: since decision 0032 the fewest boxes is a suggestion, and the list carries no issue for it.
    await expect(list(page)).not.toHaveAttribute("data-invalid", "");
  });

  for (const f of offered()) {
    test(`${FORMAT_RULES[f].name.toLowerCase()}: with no boxes, the page is the visitor's box for box once what EDIT_ONLY_IN_FLOW allows is taken out`, async ({ page }) => {
      await openDoc(page, freshName("flowemptyparity"), { ...sampleDoc(f), flow: [] });
      await waitLive(page);
      const taken = await allowEditOnly(page, "all");
      expect(taken.some((t) => t.startsWith("the empty flowchart's row (")), taken.join("; ")).toBe(true);
      await settle(page);
      const editing = await boxes(page);
      await seeAsVisitor(page, true);
      await settle(page);
      expect(differences(await boxes(page), editing), `with these taken out: ${taken.join("; ")}`).toEqual([]);
    });
  }

  test("only the first Add a box moves the rows: typing in a blank box moves nothing round the flowchart", async ({ page }) => {
    // A gallery pairs "What I did" with "What happened". With no boxes the flowchart has a row of its own and the findings
    // are the visitor's, the width of the page; the first box puts the flowchart back in its pair (a press, as adding a section is).
    await page.setViewportSize(TALL);
    await openDoc(page, freshName("flowemptyrows"), { ...sampleDoc("gallery"), flow: [] });
    await settle(page);
    const findings = page.locator(`${READY} article [data-section-id="findings"]`);
    const alone = (await findings.boundingBox())!;
    await page.locator(`${LIST} [data-flow-add]`).click();
    await expect.poll(() => focusedPath(page)).toBe("flow.0.step");
    await settle(page);
    const paired = (await findings.boundingBox())!;
    expect(paired.width).toBeLessThan(alone.width - 100);
    // From here the flowchart has a box, blank: it keeps its place in the rows whatever is typed in it.
    const round = async () => (await boxes(page)).filter((b) => !b.key.startsWith("flowchart box"));
    const before = await round();
    await page.keyboard.type("T");
    await settle(page);
    expect(differences(before, await round())).toEqual([]);
    await page.keyboard.press("Backspace");
    await settle(page);
    expect(differences(before, await round())).toEqual([]);
    expect(await stepsNow(page)).toEqual([""]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Looks: axe, and the contrast of what sits on the dark last box
 * ---------------------------------------------------------------------------------------------- */

test.describe("in the looks", () => {
  test.skip(({ isMobile }) => isMobile, "a desktop's checks");

  for (const look of ["exhbt", "night"]) {
    for (const f of offered()) {
      test(`axe in the ${look} look, ${FORMAT_RULES[f].name.toLowerCase()}: at rest, with a box's tools showing, and with a box lifted`, async ({ page }) => {
        const user = freshName(`flowaxe${look}`);
        await page.goto(`/dev/portfolio?username=${user}&plan=max&count=0&with=${SAMPLES[f].with}&look=${look}`);
        await page.goto(`/auth/dev?email=${user}@example.com&next=/exhbts`);
        const href = await page.locator('a[href$="/edit"]').first().getAttribute("href");
        await page.goto(href!);
        await waitReady(page);
        await settle(page);
        await expect(page.locator(`${READY} [data-theme="${look}"]`)).toHaveCount(1);
        await axe(page, `${look} ${f} at rest`);
        await box(page, 1).hover();
        await gripOf(page, 1).focus();
        await axe(page, `${look} ${f} tools`);
        await page.keyboard.press("Space");
        // The keyboard sensor listens for the arrows from the next task on: wait for the pick-up to be said.
        await expect(said(page)).toHaveText(/^Picked up box 2 of/);
        await page.keyboard.press("ArrowDown");
        await expect(said(page)).toHaveText(/^The box would go to place 3 of/);
        await axe(page, `${look} ${f} lifted`);
        await page.keyboard.press("Escape");
      });
    }
  }

  // One test per look (all eight), so a cold server can't run one test out of time.
  for (const theme of PORTFOLIO_THEMES) {
    test(`in the ${theme.name || theme.id} look, a placeholder and the tools on the dark last box, and the line, pass contrast`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await openTiming(page, "gallery", { look: theme.id });
      await settle(page);
      const last = (await keysNow(page)).length - 1;
      // An empty last box shows its placeholder in the box's soft colour.
      await page.evaluate((i) => window.__exhbtEditor!.setAt(`flow.${i}.step`, ""), last);
      const ph = field(page, `flow.${last}.step`);
      await expect(ph).toHaveAttribute("data-empty", "");
      const [placeholder, ground, soft] = await ph.evaluate((el) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--xp-flow-end-soft)";
        el.closest(".xp-flow-box")!.appendChild(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return [getComputedStyle(el, "::placeholder").color, getComputedStyle(el.closest(".xp-flow-box")!).backgroundColor, want];
      });
      // It is the box's soft colour (G's rule in core.css), read from the placeholder itself.
      expect(placeholder, theme.id).toBe(soft);
      expect(contrast(placeholder!, ground!), `${theme.id}: the placeholder on the dark box`).toBeGreaterThanOrEqual(4.5);
      // Each tool is its own chip, on the look's card, in its ink.
      await box(page, last).hover();
      for (const tool of [gripOf(page, last), removeOf(page, last)]) {
        const [ink, chip] = await tool.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
        expect(contrast(ink!, chip!), `${theme.id}: a tool's icon on its chip`).toBeGreaterThanOrEqual(3);
      }
      // The line (line style only), in the look's link colour, against the page's ground.
      if ((await list(page).getAttribute("data-flow-style")) !== "line") return;
      await gripOf(page, 0).focus();
      await page.keyboard.press("Space");
      await expect(said(page)).toHaveText(/^Picked up box 1 of/);
      await page.keyboard.press("ArrowDown");
      await expect(line(page)).toBeVisible();
      const [link, page0] = await line(page).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(document.querySelector('[data-editor="page"] article')!).backgroundColor]);
      expect(contrast(link!, page0!), `${theme.id}: the line on the ground`).toBeGreaterThanOrEqual(3);
      await page.keyboard.press("Escape");
    });
  }
});

/* ------------------------------------------------------------------------------------------------
 * By touch (the touch project: a Pixel 7)
 * ---------------------------------------------------------------------------------------------- */

test.describe("by touch", () => {
  test.skip(({ isMobile }) => !isMobile, "runs in the touch project");

  const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

  for (const f of offered()) {
    test(`${FORMAT_RULES[f].name}: the flowchart is a column; a swipe on a box scrolls; a quick swipe from a grip does nothing; a short press on a grip carries a box down it`, async ({ page }) => {
      await open(page, f, 4);
      await expect(list(page)).toHaveAttribute("data-axis", "column");
      // On a touch screen the grips and the "+" are always there, with a 44px target.
      await expect(gripOf(page, 0)).toBeVisible();
      expect(await gripOf(page, 0).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      expect(await gripOf(page, 0).evaluate((el) => {
        const s = getComputedStyle(el, "::before");
        const r = el.getBoundingClientRect();
        return Math.min(r.width - parseFloat(s.left) - parseFloat(s.right), r.height - parseFloat(s.top) - parseFloat(s.bottom));
      })).toBeGreaterThanOrEqual(44);
      // The grip on a box's right edge, Remove on its left, and the "+" between boxes clear of the drag board's "+" at the left of each gap.
      // (The sections' toolbars on a phone are L's phone.css, which keeps only their grip at the right.)
      expect(await overlaps(page, ".xe-plus")).toEqual([]);
      const touch = await finger(page);
      const keys = await keysNow(page);
      const steps = await stepsNow(page);

      // A swipe up on a box's words scrolls the page and moves nothing.
      await box(page, 2).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(200);
      const w = (await box(page, 2).locator(".xp-flow-box").boundingBox())!;
      const y0 = await scrollY(page);
      await touch.down(w.x + 40, w.y + w.height / 2);
      await touch.slide({ x: w.x + 40, y: w.y + w.height / 2 }, { x: w.x + 40, y: w.y + w.height / 2 - 220 });
      await touch.up();
      // Touches made in the page (WebKit: finger, page-editor.ts) can't scroll it, so the scroll is checked only under real ones.
      if (touch.native) await expect.poll(() => scrollY(page)).toBeGreaterThan(y0 + 100);
      expect(await keysNow(page)).toEqual(keys);
      await expect(list(page)).not.toHaveAttribute("data-flow-drag", /./);

      // A quick swipe that starts on a grip picks nothing up.
      await box(page, 1).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(300);
      let g = (await gripOf(page, 0).boundingBox())!;
      let at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
      await touch.down(at.x, at.y);
      await touch.slide(at, { x: at.x, y: at.y + 120 }, 4);
      await touch.up();
      await expect(list(page)).not.toHaveAttribute("data-flow-drag", /./);
      expect(await keysNow(page)).toEqual(keys);

      // A short press picks up; nothing moves as it does; carried over the far half of box 3, it lands in place 3.
      g = (await gripOf(page, 0).boundingBox())!;
      at = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
      const still = await drawn(page);
      const layout = await laidOut(page);
      const sliding = (await list(page).getAttribute("data-flow-style")) === "slide";
      await touch.down(at.x, at.y);
      await page.waitForTimeout(220);
      await touch.move(at.x, at.y + 2);
      await expect(list(page)).toHaveAttribute("data-flow-drag", "pointer");
      // No layout box changes, and no other box is drawn anywhere else (sliding, the lifted box is under the finger, by transform).
      expect(near(await laidOut(page), layout)).toBe(true);
      expect(near((await drawn(page)).slice(sliding ? 1 : 0), still.slice(sliding ? 1 : 0))).toBe(true);
      const third = (await box(page, 2).locator(".xp-flow-box").boundingBox())!;
      await touch.slide(at, { x: third.x + third.width / 2, y: third.y + third.height * 0.7 }, 14);
      await expect(said(page)).toHaveText("The box would go to place 3 of 4.");
      await touch.up();
      expect(await keysNow(page)).toEqual(moved(keys, 0, 2));
      expect(await stepsNow(page)).toEqual(moved(steps, 0, 2));
      await settled(page);
      await expect(list(page)).not.toHaveAttribute("data-flow-drag", /./);
    });
  }
});

test.describe("blank boxes as a visitor sees them", () => {
  const visitorList = (page: Page) => page.locator(`${READY} section[aria-label="Preview"]`).getByRole("list", { name: "Methodology" });

  test("a blank last box is left out of 'See as a visitor', so the last filled step keeps the result box; the editing page still shows it; typing brings it in; all blank shows no flowchart", async ({ page }) => {
    const base = sampleDoc("case-study");
    const filled = base.flow.slice(0, 3);
    await openDoc(page, freshName("blankflow"), { ...base, flow: [...filled, { step: "" }] });
    await settle(page);
    // Editing: every box, the blank one too, so there is somewhere to type.
    expect(await keysNow(page)).toHaveLength(4);
    await seeAsVisitor(page, true);
    const items = visitorList(page).getByRole("listitem");
    await expect(items).toHaveCount(3);
    await expect(items.last()).toContainText(filled[2]!.step);
    await expect(visitorList(page).locator("[data-last]")).toHaveCount(1);
    await expect(items.last().locator("[data-last]")).toBeVisible();
    // Typing in the blank box brings it in as the last step.
    await seeAsVisitor(page, false);
    expect(await keysNow(page)).toHaveLength(4);
    await page.evaluate(() => window.__exhbtEditor!.setAt("flow.3.step", "Wrote it up"));
    await seeAsVisitor(page, true);
    await expect(items).toHaveCount(4);
    await expect(items.last()).toContainText("Wrote it up");
    // Every box blank (a new exhbt): a visitor is shown no flowchart at all (decision 0032: a flowchart with no box
    // filled in is not drawn), and the editing page still has every box to type in.
    await seeAsVisitor(page, false);
    await page.evaluate(() =>
      [0, 1, 2, 3].forEach((n) => {
        window.__exhbtEditor!.setAt(`flow.${n}.step`, "");
        window.__exhbtEditor!.setAt(`flow.${n}.detail`, "");
      }),
    );
    await seeAsVisitor(page, true);
    await expect(visitorList(page)).toHaveCount(0);
    await seeAsVisitor(page, false);
    expect(await keysNow(page)).toHaveLength(4);
  });
});
