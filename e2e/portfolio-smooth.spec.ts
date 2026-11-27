import { devices, type Page } from "@playwright/test";
import { FULL } from "./fixtures/portfolio-pages";
import { HOME_BOXES, READY, boxes, changeWith, differences, expect, fresh, openEditor, renders, settle, test, textbox } from "./portfolio-editor";

// Typing stays cheap and nothing jumps (decision 0031; brief J of docs/briefs/portfolio-first). The editor counts
// its own units' renders on window.__portfolioRenders (components/portfolio-editor/renders.ts: "page", "hero",
// "section:<key>", "tile:<id>"). The cards, figures and charts are drawn by the visitors' component, which
// cannot count itself, so a stand-in for React's devtools hook, put in before the page's scripts, counts them
// by name from each commit: COUNT_FIBERS below.

type Counts = Record<string, number> & { fibers: Record<string, number> };

/**
 * The components counted from React's commits, by name: the cards, their figures and the charts in them; and the
 * editor's own frames inside the memoised slots (F's SectionFrame, TileFrame and WorkTile, I's ItemMore), which
 * the slots' counts cannot see: drag sensors rebuilt on every render once redrew all of them on every key.
 */
const NAMES = ["ProjectCard", "Figure", "KeyFigureView", "Chart", "SectionFrame", "TileFrame", "WorkTile", "ItemMore"];

/**
 * A stand-in for React's devtools hook. A fiber of a named component rendered in a commit is one React did
 * work on (PerformedWork, flag 1) that is not the very fiber that root's last commit had: a subtree React
 * skipped keeps its old fibers, flags and all. Kept per root, since Next's development overlay commits a root
 * of its own.
 */
function COUNT_FIBERS(names: string[]) {
  const seenBy = new WeakMap<object, WeakSet<object>>();
  type Fiber = { type?: unknown; flags: number; child: Fiber | null; sibling: Fiber | null };
  const w = window as unknown as { __fiberRenders: Record<string, number>; __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown };
  w.__fiberRenders = {};
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
      const seen = seenBy.get(root) ?? new WeakSet<object>();
      const now = new WeakSet<object>();
      const stack: Fiber[] = [root.current];
      while (stack.length) {
        const f = stack.pop()!;
        const name = typeof f.type === "function" ? (f.type as { name?: string }).name : undefined;
        if (name && names.includes(name)) {
          now.add(f);
          if (!seen.has(f) && (f.flags & 1) === 1) w.__fiberRenders[name] = (w.__fiberRenders[name] ?? 0) + 1;
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
      seenBy.set(root, now);
    },
  };
}

const reset = (page: Page) =>
  page.evaluate(() => {
    window.__portfolioRenders = {};
    (window as unknown as { __fiberRenders: Record<string, number> }).__fiberRenders = {};
  });

async function read(page: Page): Promise<Counts> {
  await settle(page);
  return { ...(await renders(page)), fibers: await page.evaluate(() => ({ ...(window as unknown as { __fiberRenders: Record<string, number> }).__fiberRenders })) } as Counts;
}

/** The editor's units that drew, by name, with a count above 0. */
const drew = (c: Counts, prefix: string) => Object.keys(c).filter((k) => k.startsWith(prefix) && c[k]! > 0);

async function openCounted(page: Page, tag: string) {
  await page.addInitScript(COUNT_FIBERS, NAMES);
  const f = fresh(FULL, tag);
  const seeded = await openEditor(page, f);
  await settle(page);
  // The counter sees the page's cards, charts and frames as they mount: it is working.
  const mounted = (await read(page)).fibers;
  for (const name of ["Chart", "SectionFrame", "TileFrame"]) expect(mounted[name] ?? 0, `${name} counted as it mounts`).toBeGreaterThan(0);
  return seeded;
}

test("a key in the headline draws the page and the hero again, and no section, tile, card, figure or chart", async ({ page }) => {
  await openCounted(page, "smoothhead");
  await textbox(page, "profile.headline").click();
  await page.keyboard.press("End");
  for (let i = 0; i < 2; i++) {
    await reset(page);
    await page.keyboard.type("s");
    const c = await read(page);
    test.info().annotations.push({ type: `a key in the headline (${i + 1})`, description: JSON.stringify(c) });
    expect(c.hero, "the hero").toBe(1);
    expect(drew(c, "section:"), "sections").toEqual([]);
    expect(drew(c, "tile:"), "tiles").toEqual([]);
    expect(c.fibers, "cards, figures and charts").toEqual({});
  }
});

test("a key in About's words draws About and nothing below it: no other section, tile, card, figure or chart", async ({ page }) => {
  await openCounted(page, "smoothabout");
  const about = textbox(page, "arrangement.tiles.about.text");
  await about.click();
  await page.keyboard.press("End");
  await reset(page);
  await page.keyboard.type("s");
  const c = await read(page);
  test.info().annotations.push({ type: "a key in About's words", description: JSON.stringify(c) });
  expect(drew(c, "section:"), "sections").toEqual(["section:about"]);
  expect(drew(c, "tile:"), "tiles").toEqual([]);
  // About's own frame draws with it; no other frame, card, figure or chart.
  const { SectionFrame = 0, ...rest } = c.fibers;
  expect(SectionFrame, "About's own frame, and no other").toBeLessThanOrEqual(1);
  expect(rest, "tiles' frames, cards, figures and charts").toEqual({});
});

test("a section move draws the two sections that changed places, and no tile, card, figure or chart", async ({ page }) => {
  await openCounted(page, "smoothmove");
  await reset(page);
  // About (third) and Experience (fourth) change places.
  await changeWith(page, { moveSection: { from: 2, to: 3 } }, "moved About me");
  const c = await read(page);
  test.info().annotations.push({ type: "a section move", description: JSON.stringify(c) });
  expect(drew(c, "section:").sort(), "sections").toEqual(["section:about", "section:experience"]);
  expect(drew(c, "tile:"), "tiles").toEqual([]);
  // No tile's frame, card, figure or chart. (The section frames are the next test's.)
  const { SectionFrame: _frames, ItemMore: _more, ...rest } = c.fibers;
  void _frames;
  void _more;
  expect(rest, "tiles' frames, cards, figures and charts").toEqual({});
});

test("a section move draws the frames of the two sections that changed places, and no other section's frame", async ({ page }) => {
  // FAULT (F, components/portfolio-editor/sections/SectionFrame.tsx), reported 27 Nov: on one move (About and
  // Experience swap), all six SectionFrames draw, in two commits each (12 renders), though only those two slots
  // draw. Each frame reads something every move changes (the whole sections list, or the drag board's context).
  // This test turns green when it is fixed; then take this line out.
  test.fail();
  await openCounted(page, "smoothframes");
  await reset(page);
  await changeWith(page, { moveSection: { from: 2, to: 3 } }, "moved About me");
  const c = await read(page);
  test.info().annotations.push({ type: "a section move, frames", description: JSON.stringify(c.fibers) });
  expect(c.fibers.SectionFrame ?? 0, "section frames drawn").toBeLessThanOrEqual(2);
});

test("nothing on the page moves when a field takes the cursor", async ({ page }) => {
  const f = fresh(FULL, "smoothfocus");
  await openEditor(page, f);
  await settle(page);
  const marks = { ...HOME_BOXES, "a field": `${READY} [data-path]` };
  const paths = await page.locator(`${READY} [data-path]:is(textarea, [role=textbox]), ${READY} [data-path][data-field="paras"] textarea`).evaluateAll((els) =>
    els.map((el) => el.closest("[data-path]")!.getAttribute("data-path")!).filter((p, i, all) => all.indexOf(p) === i),
  );
  expect(paths.length, "fields on the page").toBeGreaterThan(10);
  for (const path of paths) {
    // Each from the same place: the top of the page, nothing focused.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await settle(page);
    const before = await boxes(page, marks);
    await textbox(page, path).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    expect(differences(before, await boxes(page, marks)), `focus in ${path}`).toEqual([]);
  }
});

// On a phone, where each section and tile also carries I's More (ItemMore): a key draws none of them again.
const { defaultBrowserType: _browser, ...PHONE } = devices["Pixel 7"];
void _browser;

test.describe("On a phone", () => {
  test.use(PHONE);

  test("a key in the headline draws no section frame, tile frame, More, card, figure or chart", async ({ page }) => {
    await openCounted(page, "smoothphone");
    // Nothing has been reset yet: the counts are the page's mount, and each More was counted as it mounted.
    expect((await read(page)).fibers.ItemMore ?? 0, "ItemMore counted as it mounts").toBeGreaterThan(0);
    await textbox(page, "profile.headline").click();
    await page.keyboard.press("End");
    await reset(page);
    await page.keyboard.type("s");
    const c = await read(page);
    test.info().annotations.push({ type: "a key in the headline, on a phone", description: JSON.stringify(c) });
    expect(c.hero, "the hero").toBe(1);
    expect(drew(c, "section:"), "sections").toEqual([]);
    expect(drew(c, "tile:"), "tiles").toEqual([]);
    expect(c.fibers, "frames, More, cards, figures and charts").toEqual({});
  });
});
