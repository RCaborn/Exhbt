import type { Page } from "@playwright/test";
import { FULL } from "./fixtures/portfolio-pages";
import { HOME_BOXES, READY, boxes, changeWith, differences, expect, fresh, openEditor, renders, settle, test, textbox } from "./portfolio-editor";

// Typing stays cheap and nothing jumps (decision 0031; brief J of docs/briefs/portfolio-first). The editor counts
// its own units' renders on window.__portfolioRenders (components/portfolio-editor/renders.ts: "page", "hero",
// "section:<key>", "tile:<id>"). The cards, figures and charts are drawn by the visitors' component, which
// cannot count itself, so a stand-in for React's devtools hook, put in before the page's scripts, counts them
// by name from each commit: COUNT_FIBERS below.

type Counts = Record<string, number> & { fibers: Record<string, number> };

/** The components counted from React's commits, by name: the cards, their figures and the charts in them. */
const NAMES = ["ProjectCard", "Figure", "KeyFigureView", "Chart"];

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
  // The counter sees the page's cards and charts as they mount: it is working.
  expect((await read(page)).fibers.Chart ?? 0).toBeGreaterThan(0);
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
  expect(c.fibers, "cards, figures and charts").toEqual({});
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
  expect(c.fibers, "cards, figures and charts").toEqual({});
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
