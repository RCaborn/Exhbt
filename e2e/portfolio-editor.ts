import { expect, type Locator, type Page } from "@playwright/test";
import type { BuilderState } from "../app/(app)/portfolio/steps";
import type { PortfolioFixture } from "./fixtures/portfolio-pages";

export * from "./editor-test";

/*
 * Everything the browser tests know about the one-page portfolio editor (decision 0031,
 * components/portfolio-editor/): how to get to it, how to find a field, how to type in one, how to wait
 * for a save, and how to measure the page box for box. Every portfolio spec imports from here, and takes
 * `test` from here too (e2e/editor-test.ts's, with what a run on Safari's engine needs).
 *
 * The switch is at "steps" for everyone (lib/portfolio-kind.ts), so each test opts its own browser in
 * with the development cookie (/dev/portfolio-kind), which a failed test cannot leave behind for the next.
 */

/** The editor's root, once it is up (the loading view has no data-ready). */
export const READY = '[data-editor="portfolio"][data-ready="true"]';
/** The page being edited, or the visitor's page: what `PortfolioHome` draws. */
export const HOME = "[data-portfolio-home]";

/* ------------------------------------------------------------------------------------------------
 * Getting to the editor
 * ---------------------------------------------------------------------------------------------- */

/** The fixture as a person of its own (a fresh address), so no two tests share a portfolio. */
export function fresh(fixture: PortfolioFixture, tag: string): PortfolioFixture {
  const name = `pe-${tag.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
  return { ...structuredClone(fixture), username: name };
}

export type Seeded = { userId: string; username: string; url: string; ids: Record<string, string>; files: Record<string, string> };

/** Stores a whole portfolio exactly as given (POST /dev/portfolio-parity, brief A's): its person is the dev sign-in user for `<username>@example.com`. */
export async function seed(page: Page, fixture: PortfolioFixture): Promise<Seeded> {
  const res = await page.request.post("/dev/portfolio-parity", { data: fixture });
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

/** Sets which builder this browser gets: "page" (the editor), "steps", or "default" for what everyone gets. */
export async function setKind(page: Page, kind: "page" | "steps" | "default") {
  const res = await page.request.get(`/dev/portfolio-kind?kind=${kind}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
}

/** Signs in as the fixture's person and goes to `next`. Never signInAs or /dev/portfolio after seeding: both clear that person's exhbts. */
export async function signIn(page: Page, username: string, next = "/portfolio") {
  await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=${encodeURIComponent(next)}`);
}

/** Waits for the editor to be up. */
export async function waitReady(page: Page) {
  await expect(page.locator(READY)).toBeAttached();
}

/**
 * Seeds `fixture`, switches this browser to the editor, signs in as its person and opens `/portfolio`
 * (with `query`, e.g. "?open=look" or "#job-links"). Waits for the editor unless `wait` is false (a
 * test of what comes before it, or of a crash).
 */
export async function openEditor(page: Page, fixture: PortfolioFixture, opts: { query?: string; wait?: boolean } = {}): Promise<Seeded> {
  const seeded = await seed(page, fixture);
  await setKind(page, "page");
  await signIn(page, fixture.username, `/portfolio${opts.query ?? ""}`);
  if (opts.wait !== false) await waitReady(page);
  return seeded;
}

/* ------------------------------------------------------------------------------------------------
 * Finding things on the editing page
 * ---------------------------------------------------------------------------------------------- */

/**
 * The element carrying a field's path (decision 0031's table): the field itself, or, for paragraphs (the
 * intro, About me's words), the group that holds one field per paragraph. A line of education or
 * experience has two fields at one path: `part` says which half ("label", its words, or "year").
 */
export const field = (page: Page, path: string, part?: "label" | "year"): Locator =>
  page.locator(part ? `${READY} [data-part="${part}"] [data-path="${path}"]` : `${READY} [data-path="${path}"]`).first();

/** The control a person types in at a path: the field itself, or a paragraph of it (the first unless `para` says which). */
export function textbox(page: Page, path: string, opts: { part?: "label" | "year"; para?: number } = {}): Locator {
  const within = opts.part ? `${READY} [data-part="${opts.part}"]` : READY;
  return page.locator(`${within} [data-path="${path}"]:is(textarea, [role=textbox]), ${READY} [data-path="${path}"][data-field="paras"] textarea[data-para="${opts.para ?? 0}"]`).first();
}

/** The path of the field that has the cursor: the closest `[data-path]` of the focused element. */
export const focusedPath = (page: Page): Promise<string | null> => page.evaluate(() => document.activeElement?.closest("[data-path]")?.getAttribute("data-path") ?? null);

/** Chooses every word of the field that has the cursor (e2e/page-editor.ts says why a page that says it is a Mac or an iPhone needs its own way). */
export async function chooseAll(page: Page) {
  const apple = await page.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document));
  if (!apple || process.platform === "darwin") return page.keyboard.press("ControlOrMeta+A");
  await page.evaluate(async () => {
    const el = document.activeElement;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.select();
    else if (el) getSelection()?.selectAllChildren(el);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/**
 * Puts the cursor in a field and types `words`, replacing what is there (`append` keeps it), as a person
 * does: key by key. In a field of paragraphs, a blank line in `words` is Enter (a new paragraph), and
 * what is there is cleared a paragraph at a time, from the last one back.
 */
export async function typeIn(page: Page, path: string, words: string, opts: { append?: boolean; part?: "label" | "year" } = {}) {
  const f = field(page, path, opts.part);
  await f.scrollIntoViewIfNeeded();
  if ((await f.getAttribute("data-field")) === "paras") {
    const paras = f.locator("textarea[data-para]");
    await paras.last().click();
    if (!opts.append) {
      const n = await paras.count();
      for (let i = 0; i < n; i++) {
        await chooseAll(page);
        await page.keyboard.press("Backspace");
        // At the start of an emptied paragraph, Backspace joins it to the one before.
        await page.keyboard.press("Backspace");
      }
      await expect(paras).toHaveCount(1);
    } else await page.keyboard.press("End");
    const pieces = words.split(/\n{2,}/);
    for (const [i, piece] of pieces.entries()) {
      if (i > 0) await page.keyboard.press("Enter");
      await page.keyboard.type(piece);
    }
    return;
  }
  await f.click();
  if (!opts.append) {
    await chooseAll(page);
    await page.keyboard.press("Backspace");
  } else await page.keyboard.press("End");
  await page.keyboard.type(words);
}

/* ------------------------------------------------------------------------------------------------
 * The editor's state, and saving
 * ---------------------------------------------------------------------------------------------- */

/** The editor's state as it is now, in the page (development only). */
export const stateNow = (page: Page): Promise<BuilderState> => page.evaluate(() => window.__portfolioEditor!.state());

/** The value at a path of the editor's state ("profile.name", "arrangement.tiles.education.lines.0"). */
export async function valueAt(page: Page, path: string): Promise<unknown> {
  let v: unknown = await stateNow(page);
  for (const k of path.split(".")) v = v === null || typeof v !== "object" ? undefined : (v as Record<string, unknown>)[k];
  return v;
}

/** The editor's view as it is now: the open sheet, "See as a visitor", the marked tile, the team's note (development only). */
export const uiNow = (page: Page) => page.evaluate(() => window.__portfolioEditor!.ui());

/** What Undo would undo ("removed Experience"), or null. */
export const undoLabel = (page: Page): Promise<string | null> => page.evaluate(() => window.__portfolioEditor!.undoLabel());

/** The save status's state: "saved", "pending", "saving", "invalid", "error" or "stale". */
export const saveState = (page: Page): Locator => page.locator(`${READY} [data-save]`);

/**
 * Waits until the server has the editor's state as it is now, and the status says "Saved". The first is
 * asked of the editor itself (whether any change is still waiting), so a call made straight after a key
 * never sees the "Saved" of the save before it.
 */
export async function waitSaved(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__portfolioEditor!.waiting())).toBe(false);
  await expect(saveState(page)).toHaveAttribute("data-save", "saved");
}

/** How many times each unit of the editing page has rendered: "page", "hero", "section:<key>", "tile:<id>". */
export const renders = (page: Page): Promise<Record<string, number>> => page.evaluate(() => ({ ...(window.__portfolioRenders ?? {}) }));

/** Calls one of the editor's own actions by name (development only): what a part of the bar does, before the bar has it. */
export function call(page: Page, name: "open" | "close" | "say" | "jumpTo" | "previewLook" | "seeAsVisitor" | "setAt", ...args: unknown[]): Promise<void> {
  return page.evaluate(
    ([n, a]) => {
      const api = window.__portfolioEditor!.api as unknown as Record<string, (...x: unknown[]) => void>;
      api[n as string]!(...(a as unknown[]));
    },
    [name, args] as const,
  );
}

/** A change the bar or a section's tools would make, named for Undo (development only). */
export type LabelledChange = { removeSection: string } | { moveSection: { from: number; to: number } };

/**
 * Makes a labelled change through the editor's own `change` (an Undo step), as F's and G's parts do: the
 * update is written inside the page, since a function cannot be handed over from the test.
 */
export function changeWith(page: Page, what: LabelledChange, label: string): Promise<void> {
  return page.evaluate(
    ([w, l]) => {
      const api = window.__portfolioEditor!.api;
      api.change((s) => {
        const sections = [...s.arrangement.sections];
        if ("removeSection" in w) sections.splice(sections.indexOf(w.removeSection as never), 1);
        else sections.splice(w.moveSection.to, 0, ...sections.splice(w.moveSection.from, 1));
        return { ...s, arrangement: { ...s.arrangement, sections } };
      }, l);
    },
    [what, label] as const,
  );
}

/* ------------------------------------------------------------------------------------------------
 * Measuring the page
 * ---------------------------------------------------------------------------------------------- */

/** Fonts in, every picture loaded, laid out. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.addEventListener("load", done, { once: true }), img.addEventListener("error", done, { once: true }))))));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

export type Box = { key: string; x: number; y: number; w: number; h: number };

/** What a box-for-box test of the portfolio compares, unless it says otherwise: the page's landmarks, name to selector. */
export const HOME_BOXES: Record<string, string> = {
  "the top bar": "nav[aria-label=Portfolio]",
  "the hero": `${HOME} > div > header, ${HOME} > header`,
  "the name": "h1",
  "the face": "[data-avatar]",
  "the intro": "[data-intro]",
  section: "[data-section]",
  "a section's heading": "[data-section] h2",
  card: "[data-card]",
  "a key figure": "[data-key-figure]",
  "a row": "[data-section] dl > div",
  "the footer": `${HOME} > footer`,
};

/**
 * The place and size, relative to the page drawn (`[data-portfolio-home]`: the editing page, "See as a
 * visitor", the loading view or a visitor's own page), of everything each selector matches, named
 * "<name>#<n>" in page order. `selectors` maps a name to a selector; HOME_BOXES by default.
 */
export function boxes(page: Page, selectors: Record<string, string> = HOME_BOXES): Promise<Box[]> {
  return page.evaluate(
    ([sel, home]) => {
      const page = [...document.querySelectorAll(home!)].find((a) => a.getClientRects().length > 0)!;
      const root = page.getBoundingClientRect();
      const out: Box[] = [];
      for (const [name, selector] of Object.entries(sel as Record<string, string>)) {
        const found = name.startsWith("the ") && selector.includes(home!) ? [...document.querySelectorAll(selector)].filter((el) => page.contains(el)) : [...page.querySelectorAll(selector)];
        found.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          out.push({ key: `${name}#${i + 1}`, x: r.x - root.x, y: r.y - root.y, w: r.width, h: r.height });
        });
      }
      return out;
    },
    [selectors, HOME] as const,
  );
}

/** Each box that differs by more than half a pixel, in words. */
export function differences(want: Box[], got: Box[]): string[] {
  const off: string[] = [];
  const at = new Map(got.map((b) => [b.key, b]));
  for (const b of want) {
    const g = at.get(b.key);
    if (!g) off.push(`${b.key} is missing`);
    else if (Math.abs(b.x - g.x) > 0.5 || Math.abs(b.y - g.y) > 0.5 || Math.abs(b.w - g.w) > 0.5 || Math.abs(b.h - g.h) > 0.5)
      off.push(`${b.key} ${[b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(",")} is ${[g.x, g.y, g.w, g.h].map((v) => v.toFixed(1)).join(",")}`);
  }
  for (const g of got) if (!want.some((b) => b.key === g.key)) off.push(`${g.key} is extra`);
  return off;
}

/**
 * What decision 0031 puts in the flow of the editing page only ("What the editing page adds that takes
 * room"), the whole list, as data: the portfolio's twin of EDIT_ONLY_IN_FLOW in e2e/page-editor.ts. Each
 * entry has its name, the selector of what it adds to the editing page (taken out, the editing page is
 * the visitor's there) and how a box-for-box test is to allow it:
 *  - "remove": the part is on the editing page and not on the visitor's; take it out and nothing may differ;
 *  - "box": the part is on both, and only its own box may differ (nothing else on the page moves);
 *  - "width": the part is on both, and only its width may differ, and only when the words printed differ.
 * Nobody writes the list anywhere else. Everything else the editor adds is drawn over the page and takes
 * no room.
 */
export const HOME_EDIT_ONLY_IN_FLOW: { name: string; selector: string; allow: "remove" | "box" | "width" }[] = [
  // 1. Placeholders: an empty field shows its placeholder, one line of the type it sits in.
  { name: "an empty headline", selector: 'p:has([data-path="profile.headline"][data-empty])', allow: "remove" },
  { name: "an empty intro", selector: '[data-intro]:has([data-path="profile.bio"][data-empty])', allow: "remove" },
  { name: "where you're based, empty", selector: ':is(span, dl > div):has(> * [data-path="profile.location"][data-empty], > [data-path="profile.location"][data-empty])', allow: "remove" },
  { name: "what you're looking for, empty", selector: ':is([data-looking-for], dl > div):has([data-path="profile.lookingFor"][data-empty])', allow: "remove" },
  { name: "About me's words, empty", selector: '[data-path="arrangement.tiles.about.text"][data-empty] [data-para-box]', allow: "remove" },
  { name: "a line of education or experience with no words", selector: "dl > div:has([data-part=label] [data-empty]):has([data-part=year] [data-empty])", allow: "remove" },
  { name: "a line's year, empty", selector: "[data-part=year]:has([data-empty])", allow: "remove" },
  { name: "the tools line, empty", selector: 'dl > div:has([data-path="arrangement.tiles.education.tools"][data-empty])', allow: "remove" },
  { name: "who said the quote and their role, empty", selector: 'figcaption:has([data-path="arrangement.tiles.quote.name"][data-empty]):has([data-path="arrangement.tiles.quote.role"][data-empty])', allow: "remove" },
  // 2. Empty sections drawn whole: an empty About, Experience, Quote or Get in touch draws its heading and its empty fields.
  { name: "an empty About me", selector: '[data-section="about"]:has([data-path="arrangement.tiles.about.text"][data-empty]):not(:has(dl [data-path]:not([data-empty])))', allow: "remove" },
  { name: "an empty Experience", selector: '[data-section="experience"]:not(:has([data-path]:not([data-empty])))', allow: "remove" },
  { name: "an empty Quote", selector: '[data-section="quote"]:has([data-path="arrangement.tiles.quote.text"][data-empty])', allow: "remove" },
  { name: "an empty Get in touch", selector: '[data-section="contact"]:not(:has(dl > div))', allow: "remove" },
  // 3. The vision: with no exhbt yet and the band on the page, the band is drawn full size.
  { name: "the vision", selector: '[data-section="featured"]:has([data-vision])', allow: "remove" },
  // 4. The end of the work: owner-only tiles, the Add tile and the hidden row (F marks what it draws with data-owner).
  { name: "the owner's parts after the work", selector: "[data-owner]", allow: "remove" },
  // 5. An empty More of my work: when the only exhbt is in the band, the work draws its heading to hold the Add tile.
  { name: "an empty More of my work", selector: '[data-section="work"]:not(:has([data-card]))', allow: "remove" },
  // 6. Studio's name: one field while it is typed, where the visitor's page sets one word per line.
  { name: "Studio's name", selector: '[data-hero="block"] h1', allow: "box" },
  // 7. "Looking for": the field shows the words as stored; the visitor's page lowers their first letter (and Notebook raises it).
  { name: "what you're looking for, as stored", selector: "[data-looking-for], [data-ledger] dt:has([data-path=\"profile.lookingFor\"])", allow: "width" },
];
