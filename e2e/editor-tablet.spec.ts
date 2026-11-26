import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "./editor-test";
import { FORMAT_RULES } from "../lib/exhbt/formats";
import { labelOf } from "../components/exhbt-editor/labels";
import { coveredControls, docNow, field, finger, flowChipsNearWords, frame, grip, offered, openTiming, pageOrder, plusClashes, READY, smallPresses, textbox, toolbarClashes, typeIn, undoLabel, waitLive } from "./page-editor";

/*
 * The editor on a tablet (decision 0026, "The chrome"; docs/briefs/edit-on-page/r3-l-phone.md), on the
 * tablet project (820 by 1180 with touch) and WebKit's ipad: wider than 48rem, so there is no phone bar. Each section's
 * toolbar is shown without hovering and every button in it is 44px (G's rule for a coarse pointer); a
 * 260ms press on a grip picks a section up and a drag moves it (F's); "Reorder sections" is in the top
 * bar's menu (H's) and works (L's sheet).
 */

test.skip(({ isMobile }) => !isMobile, "on the tablet project");

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const sheet = (page: Page) => page.locator(`${READY} dialog[data-sheet="reorder"]`);

// The development build's badge sits at the foot of the screen.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(s);
    });
  });
});

const middle = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const orderWith = (order: string[], id: string, place: number) => {
  const rest = order.filter((x) => x !== id);
  rest.splice(place, 0, id);
  return rest;
};

/**
 * Each section's toolbar as drawn now: shown, with each button 44px. One that is not in the gap above
 * its section (inside a picture's corner, a tile's in the gallery's grid among them; on a section's top
 * edge, in the gutter beside it or on its right edge) shows only its grip at rest (`tiles` "grip");
 * with the focus in it ("all"), every button, and a tile's all inside the tile's own box. Every other
 * section shows its grip, Move up and the rest.
 */
const toolbarsNow = (page: Page, tiles: "grip" | "all") =>
  page.evaluate((tiles) => {
    const bad: string[] = [];
    const frames = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] article [data-section-id]')];
    for (const fr of frames) {
      const id = fr.dataset.sectionId!;
      const tools = fr.querySelector<HTMLElement>(":scope > .xe-tools");
      if (!tools || getComputedStyle(tools).opacity !== "1" || getComputedStyle(tools).pointerEvents === "none") {
        bad.push(`${id}: toolbar not shown`);
        continue;
      }
      const buttons = [...tools.querySelectorAll<HTMLElement>("button")].filter((b) => b.getClientRects().length > 0);
      if (!buttons.some((b) => b.hasAttribute("data-grip"))) bad.push(`${id}: no grip`);
      const tile = fr.dataset.as === "tile";
      const over = fr.dataset.kind === "image" || tools.hasAttribute("data-place");
      if (over && tiles === "grip" && buttons.length !== 1) bad.push(`${id}: over its own section, it shows ${buttons.map((b) => b.getAttribute("aria-label")).join(", ")}`);
      if ((!over || tiles === "all") && !buttons.some((b) => b.getAttribute("data-tool") === "up")) bad.push(`${id}: no move up`);
      const box = fr.getBoundingClientRect();
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        if (Math.round(r.width) < 44 || Math.round(r.height) < 44) bad.push(`${id}: ${b.getAttribute("aria-label")} is ${r.width}x${r.height}`);
        if (tile && (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5)) bad.push(`${id}: ${b.getAttribute("aria-label")} is outside its tile`);
      }
    }
    return { bad, frames: frames.length, tiles: frames.filter((fr) => fr.dataset.as === "tile").length };
  }, tiles);

for (const f of offered()) {
  test(`${FORMAT_RULES[f].name.toLowerCase()}: every section's toolbar is shown without hovering, each button 44px, one over its own section only its grip until it has the focus; none covers another section; no phone bar`, async ({ page }) => {
    await openTiming(page, f, { full: true });
    await waitLive(page);
    await expect(page.locator(`${READY} .xe-phonebar`)).toHaveCount(0);
    const found = await toolbarsNow(page, "grip");
    expect(found.frames).toBeGreaterThan(3);
    expect(found.bad).toEqual([]);
    // Shown all the time on a tablet, so none may lie over another section's words, pictures or controls, nor a chip (the review's vision-1).
    expect(await toolbarClashes(page)).toEqual([]);
    // Nor may a "+" (design round 2, item 4: research's first gap held a 44px "+" over the H of "Hypothesis").
    expect(await plusClashes(page)).toEqual([]);
    // A flowchart box's chips, on its top corners, keep clear of its words, and each takes a 44px press (design round 2, item 5).
    // Four boxes or fewer make a row at this width (all four new samples'): there a box shows its chips, on its top corners
    // as in a column, only while it has the focus (flow.css), so each box's are checked with the focus in it.
    if ((await page.locator(`${READY} .xe-flow`).evaluateAll((els) => els[0]?.getAttribute("data-axis") ?? null)) === "row") {
      for (const step of await page.locator(`${READY} .xp-flow-box [data-path$=".step"]`).all()) {
        await step.focus();
        expect(await flowChipsNearWords(page, 4)).toEqual([]);
        expect(await smallPresses(page, `${READY} .xp-flow-box:focus-within .xe-flow-chip`)).toEqual([]);
      }
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    } else {
      expect(await flowChipsNearWords(page, 4)).toEqual([]);
      expect(await smallPresses(page, `${READY} .xp-flow-box .xe-flow-chip`)).toEqual([]);
    }
    // Touched, each toolbar that shows its grip alone at rest opens where it is, still clear of every word, its own section's included (23 Nov).
    for (const id of await page.locator(`${READY} article [data-section-id]:not([data-kind="image"]) > .xe-tools[data-place]`).evaluateAll((ts) => ts.map((t) => t.parentElement!.dataset.sectionId!))) {
      await grip(page, id).focus();
      expect(await toolbarClashes(page), `${id} opened`).toEqual([]);
    }
    if (!found.tiles) return;
    // With the focus in a tile (its grip, from a keyboard), its other buttons show too, inside the tile, still covering nothing of another's.
    const tile = page.locator(`${READY} article [data-as="tile"]`).last();
    const id = await tile.getAttribute("data-section-id");
    await tile.locator("[data-grip]").focus();
    const focused = await toolbarsNow(page, "all");
    expect(focused.bad.filter((b) => b.startsWith(`${id}:`))).toEqual([]);
    expect(await toolbarClashes(page)).toEqual([]);
  });
}

/**
 * The controls decision 0026 draws over another on purpose, as [what is under, what lies over it], for coveredControls.
 * None: on these pages every control that lay over another was a fault (an open menu, which 0026 does draw over the
 * page, is never open here).
 */
const ON_PURPOSE: [string, string][] = [];

/** The paths of the findings on the page, in order. */
const findingPaths = (page: Page) => page.locator(`${READY} article [data-path*=".items."][data-field]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-path")!));

for (const f of offered()) {
  test(`${FORMAT_RULES[f].name.toLowerCase()}: nothing covers a control: at the middle of every button and field shown, a finger lands on that control, at rest, with each section touched and with the cursor in each finding`, async ({ page }) => {
    await openTiming(page, f, { full: true });
    await waitLive(page);
    // The main session saw a section's grip over "Remove finding 1" on a tablet; the review saw chips over fields.
    expect(await coveredControls(page, { allow: ON_PURPOSE }), "at rest").toEqual([]);
    // Touched, a section's toolbar shows all its buttons (on its top edge, in a gutter or on its right edge, only its grip at rest).
    for (const id of await pageOrder(page)) {
      await grip(page, id).focus();
      expect(await coveredControls(page, { allow: ON_PURPOSE }), `${id} touched`).toEqual([]);
    }
    // With the cursor in a finding, its own Move up, Move down and Remove show, on the rule above it, and its section's toolbar shows whole.
    const findings = await findingPaths(page);
    expect(findings.length).toBeGreaterThan(0);
    for (const path of findings) {
      await textbox(page, path).focus();
      expect(await coveredControls(page, { allow: ON_PURPOSE }), `in ${path}`).toEqual([]);
    }
  });

  test(`${FORMAT_RULES[f].name.toLowerCase()}: the findings moved to the top of the page: their toolbar, now on their top edge, lies over none of a finding's controls`, async ({ page }) => {
    await openTiming(page, f, { full: true });
    await waitLive(page);
    // First under the context line, the gap above is too short for a row of 44px buttons: the toolbar goes onto the
    // findings' top edge, by the first finding's own controls (research's, with no heading over its findings, sat under it).
    await page.evaluate(() => window.__exhbtEditor!.move("findings", 0));
    await expect.poll(async () => (await pageOrder(page))[0]).toBe("findings");
    for (const path of await findingPaths(page)) {
      await textbox(page, path).focus();
      expect(await toolbarClashes(page), `in ${path}`).toEqual([]);
      expect(await coveredControls(page, { allow: ON_PURPOSE, by: ".xe-tools" }), `in ${path}`).toEqual([]);
    }
  });
}

test("research's hypothesis: the compact pair, its grip and More actions, on its top edge clear of its words; More actions holds the rest, from the keyboard and by touch, and the grip still carries it", async ({ page }) => {
  await openTiming(page, "research", { full: true });
  await waitLive(page);
  const id = "aim-1";
  const tools = frame(page, id).locator(":scope > .xe-tools");
  const more = tools.locator('[data-tool="menu"]');
  const name = labelOf(await docNow(page), id);
  const drawn = () =>
    tools.locator("button").evaluateAll((bs) =>
      bs
        .filter((b) => b.getClientRects().length > 0)
        .map((b) => ({ name: b.getAttribute("aria-label")!, r: b.getBoundingClientRect() }))
        .sort((p, q) => (Math.abs(p.r.top - q.r.top) > 4 ? p.r.top - q.r.top : p.r.left - q.r.left))
        .map((b) => b.name),
    );
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  // Beside the graph, too narrow for its row beside the switch and its gutter too narrow for a 44px column (23 Nov).
  await expect(tools).toHaveAttribute("data-place", "compact");
  // At rest, the grip alone, at the corner, clear of words; touched, the pair.
  expect(await drawn()).toEqual([`Drag ${name} to move it`]);
  expect(await toolbarClashes(page)).toEqual([]);
  await grip(page, id).focus();
  expect(await drawn()).toEqual([`More actions for ${name}`, `Drag ${name} to move it`]);
  expect(await toolbarClashes(page)).toEqual([]);
  // From the keyboard: along to More actions; Enter opens it and its first button (Move up is off: the first section) takes the focus.
  await page.keyboard.press("ArrowLeft");
  expect(await focused()).toBe(`More actions for ${name}`);
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  expect(await focused()).toBe(`Move ${name} down`);
  await expect(tools.getByText(`Remove ${name}`, { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  expect(await focused()).toBe(`Remove ${name}`);
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  expect(await focused()).toBe(`More actions for ${name}`);
  // The grip carries the section from the keyboard, as everywhere; Escape puts it back.
  const order = await pageOrder(page);
  await grip(page, id).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "keys");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
  expect(await pageOrder(page)).toEqual(order);
  // By touch: More actions, then Move down: the section moves, and the menu closes.
  await grip(page, id).focus();
  await more.tap();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await tools.locator('[data-tool="down"]').tap();
  await expect.poll(() => pageOrder(page)).not.toEqual(order);
  await expect(more).toHaveAttribute("aria-expanded", "false");
});

test("a long first line in the aim and a long graph title: no toolbar covers either, at rest or touched", async ({ page }) => {
  await openTiming(page, "research", { full: true });
  await waitLive(page);
  const at = (await docNow(page)).sections.findIndex((s) => s.id === "aim-1");
  // Long words, within the aim's 20, so its first line runs to its right edge.
  await typeIn(page, `sections.${at}.text`, "Undergraduates walking briskly beforehand remember considerably more vocabulary afterwards than comparable undergraduates remaining seated");
  await page.evaluate(() =>
    window.__exhbtEditor!.patch("graph-1", (s) => (s.kind === "graph" ? { ...s, chart: { ...s.chart, title: "Words recalled out of forty, a mean for each group, after the walk" } } : s)),
  );
  await expect(frame(page, "graph-1")).toContainText("a mean for each group, after the walk");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(() => toolbarClashes(page)).toEqual([]);
  for (const id of ["aim-1", "graph-1"]) {
    await grip(page, id).focus();
    expect(await toolbarClashes(page), `${id} touched`).toEqual([]);
  }
});

test("a skill's remove badge is quiet, as a flowchart box's chips are: the look's card ground and ink, its outline edge", async ({ page }) => {
  await openTiming(page, "research", { full: true });
  const looks = await page.evaluate(() => {
    const style = (el: Element) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.color, s.borderTopColor].join(" ");
    };
    const chip = document.querySelector('[data-editor="page"] .xp-flow-box .xe-flow-chip')!;
    return { chip: style(chip), badges: [...document.querySelectorAll('[data-editor="page"] .xe-pill-remove')].map(style), shown: [...document.querySelectorAll('[data-editor="page"] .xe-pill-remove')].map((b) => getComputedStyle(b).opacity) };
  });
  // Design round 2, item 7: it was a solid black dot on every pill.
  expect(looks.badges.length).toBeGreaterThan(1);
  for (const b of looks.badges) expect(b).toBe(looks.chip);
  for (const o of looks.shown) expect(o).toBe("1");
});

test("Review and publish is one line, inside its pill, at 820 and at 768 wide; the row never scrolls sideways", async ({ page }) => {
  for (const width of [820, 768]) {
    await page.setViewportSize({ width, height: 1024 });
    for (const f of offered()) {
      await openTiming(page, f, { full: true });
      // Design round 2, item 3: at 820 its words ran over the pill, three lines high.
      const fit = await page.getByRole("button", { name: "Review and publish" }).evaluate((b) => {
        const r = b.getBoundingClientRect();
        const range = document.createRange();
        const lines: DOMRect[] = [];
        const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          if (!t.textContent?.trim()) continue;
          range.selectNodeContents(t);
          lines.push(...[...range.getClientRects()].filter((q) => q.width > 0));
        }
        return {
          inside: lines.length > 0 && lines.every((q) => q.left >= r.left - 0.5 && q.right <= r.right + 0.5 && q.top >= r.top - 0.5 && q.bottom <= r.bottom + 0.5),
          lines: new Set(lines.map((q) => Math.round(q.top))).size,
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(fit, `${width}px, ${f}`).toEqual({ inside: true, lines: 1, sideways: 0 });
    }
  }
});

test("research with two reference lines, one under the other: no toolbar covers the line above, the References heading or a Web address chip", async ({ page }) => {
  await openTiming(page, "research", { full: true });
  await waitLive(page);
  const n = (await pageOrder(page)).length;
  expect(await page.evaluate((at) => window.__exhbtEditor!.insert("link", at), n)).toBeTruthy();
  await expect.poll(async () => (await pageOrder(page)).length).toBe(n + 1);
  expect(await toolbarClashes(page)).toEqual([]);
});

test("in a finding: its Move up, Move down and Remove, and the formatting buttons, each take a 44px press, and no press overlaps another", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const n = (await docNow(page)).sections.findIndex((s) => s.kind === "findings");
  const words = field(page, `sections.${n}.items.1`);
  await words.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await words.tap();
  const own = frame(page, "findings").locator("li:focus-within > .xe-list-tools button");
  await expect(own).toHaveCount(3);
  await expect(own.first()).toBeVisible();
  // L's measure (editor-phone): from each control's middle, how far each way a finger still lands on it, with nothing over it.
  const small = await page.evaluate(() => {
    // The focused finding's own controls, and the formatting buttons shown now (the other fields' are there but hidden).
    const controls = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] li:focus-within > .xe-list-tools button, [data-editor="page"] .xe-format button')].filter(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el.parentElement!).opacity) > 0,
    );
    const mine = (el: Element, x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && (hit === el || el.contains(hit)));
    };
    const bad: string[] = [];
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const reach = (dx: number, dy: number) => {
        let s = 0;
        while (s < 40 && mine(el, cx + dx * (s + 1), cy + dy * (s + 1))) s++;
        return s;
      };
      const w = reach(-1, 0) + reach(1, 0) + 1;
      const h = reach(0, -1) + reach(0, 1) + 1;
      if (!mine(el, cx, cy) || w < 42 || h < 42) bad.push(`${el.getAttribute("aria-label")} (${Math.round(r.width)}x${Math.round(r.height)}, takes ${w}x${h})`);
    }
    return { bad, n: controls.length };
  });
  expect(small.n).toBeGreaterThanOrEqual(3);
  expect(small.bad).toEqual([]);
  // And no press lies over the words: a tap at the right end of this finding's first line, or of the one above's last line, is the words'.
  const taps = await page.evaluate((path) => {
    // The lines of the words themselves (not a hidden message or a field's own furniture).
    const lines = (p: string) => {
      const box = document.querySelector(`[data-editor="page"] [data-path="${p}"]`)!;
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const rects: DOMRect[] = [];
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent?.trim() || t.parentElement!.closest(".sr-only, [hidden], .xe-issue, [aria-hidden=true]")) continue;
        range.selectNodeContents(t);
        rects.push(...[...range.getClientRects()].filter((r) => r.width > 0));
      }
      rects.sort((a, b) => a.top - b.top || a.left - b.left);
      return { box, rects };
    };
    const [at, k] = path.match(/^sections\.(\d+)\.items\.(\d+)$/)!.slice(1).map(Number) as [number, number];
    const out: string[] = [];
    for (const [p, which] of [[path, 0], [`sections.${at}.items.${k - 1}`, -1]] as const) {
      const { box, rects } = lines(p);
      // The line's right end: of the rects on that line (the first or the last), the one furthest right.
      const top = which === 0 ? rects[0]!.top : rects[rects.length - 1]!.top;
      const r = rects.filter((q) => Math.abs(q.top - top) < 2).sort((a, b) => b.right - a.right)[0]!;
      const hit = document.elementFromPoint(r.right - 2, r.top + r.height / 2);
      if (!hit || !box.contains(hit)) out.push(`${p} (${which === 0 ? "first" : "last"} line) is under ${hit?.getAttribute("aria-label") ?? hit?.className}`);
    }
    return out;
  }, `sections.${n}.items.1`);
  expect(taps).toEqual([]);
});

test("a 260ms press on a tile's grip, in its corner, picks the picture up where it is: the place shown is its own", async ({ page }) => {
  await openTiming(page, "gallery", { full: true });
  await waitLive(page);
  const order = await pageOrder(page);
  const tiles = await page.locator(`${READY} article [data-as="tile"]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section-id")!));
  const touch = await finger(page);
  for (const id of [tiles[0]!, tiles[tiles.length - 1]!]) {
    await grip(page, id).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    // The grip is in the tile's own top right corner.
    const g = (await grip(page, id).boundingBox())!;
    const t = (await frame(page, id).boundingBox())!;
    expect(g.y).toBeGreaterThanOrEqual(t.y);
    expect(g.x + g.width).toBeLessThanOrEqual(t.x + t.width);
    const at = await middle(grip(page, id));
    await touch.down(at.x, at.y);
    await page.waitForTimeout(260);
    await touch.move(at.x, at.y + 2);
    await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "pointer");
    expect(await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null), id).toBe(order.indexOf(id));
    await touch.move(at.x + 3, at.y + 5);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null), id).toBe(order.indexOf(id));
    await touch.up();
    await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
    expect(await pageOrder(page)).toEqual(order);
  }
});

test("a 260ms press on a grip picks the section up, and a drag moves it", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const order = await pageOrder(page);
  const touch = await finger(page);
  await grip(page, "quote-1").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const at = await middle(grip(page, "quote-1"));
  await touch.down(at.x, at.y);
  await page.waitForTimeout(260);
  await touch.move(at.x, at.y + 2);
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "pointer");
  // Carried down past the section after it.
  const next = order[order.indexOf("quote-1") + 1]!;
  const b = (await frame(page, next).boundingBox())!;
  await touch.slide(at, { x: at.x, y: b.y + b.height * 0.85 }, 14);
  await page.waitForTimeout(250);
  const shown = (await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null))!;
  expect(shown).toBe(order.indexOf("quote-1") + 1);
  await touch.up();
  await expect.poll(() => pageOrder(page)).toEqual(orderWith(order, "quote-1", shown));
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
  expect(await undoLabel(page)).toBe("move quote");
});

test("Reorder sections is in the top bar's menu, and its sheet moves sections by button and by a drag", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const order = await pageOrder(page);
  await page.getByRole("button", { name: "Menu" }).tap();
  await page.getByRole("button", { name: "Reorder sections" }).tap();
  await expect(sheet(page)).toBeVisible();
  expect(await sheet(page).locator("[data-row]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-row")))).toEqual(order);
  expect(await new AxeBuilder({ page }).include('[data-editor="page"]').withTags(WCAG).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);

  // Every control in the sheet takes a thumb.
  const small = await sheet(page)
    .locator("button")
    .evaluateAll((bs) =>
      bs
        .filter((b) => b.getClientRects().length)
        .map((b) => ({ name: b.getAttribute("aria-label") ?? b.textContent?.trim(), r: b.getBoundingClientRect() }))
        .filter(({ r }) => Math.round(r.width) < 44 || Math.round(r.height) < 44)
        .map(({ name, r }) => `${name} ${r.width}x${r.height}`),
    );
  expect(small).toEqual([]);

  await sheet(page).getByRole("button", { name: "Move Flowchart down" }).tap();
  const one = [order[1]!, order[0]!, ...order.slice(2)];
  await expect.poll(() => pageOrder(page)).toEqual(one);
  await expect(sheet(page).getByRole("button", { name: "Move Flowchart down" })).toBeFocused();

  const touch = await finger(page);
  const from = await middle(sheet(page).locator('[data-row="reflection-1"] .xe-reorder-grip'));
  const row = (await sheet(page).locator('[data-row="reflection-1"]').boundingBox())!.height + 8;
  await touch.down(from.x, from.y);
  await page.waitForTimeout(260);
  await touch.move(from.x, from.y - 2);
  await touch.slide(from, { x: from.x, y: from.y - row * 3 }, 14);
  await page.waitForTimeout(250);
  await touch.up();
  const r = one.indexOf("reflection-1");
  await expect.poll(() => pageOrder(page)).toEqual(orderWith(one, "reflection-1", r - 3));
  expect(await undoLabel(page)).toBe("move what i'd do next");

  await sheet(page).getByRole("button", { name: "Done" }).tap();
  await expect(sheet(page)).toBeHidden();
  await expect(grip(page, "reflection-1")).toBeFocused();
  const box = (await frame(page, "reflection-1").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
