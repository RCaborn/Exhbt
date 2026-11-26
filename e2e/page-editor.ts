import { deflateSync } from "node:zlib";
import { expect, type ElementHandle, type Locator, type Page } from "@playwright/test";
import { text, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { OFFERED_FORMATS, type Format } from "../lib/exhbt/formats";
import { startBlank } from "./add-exhbt";
import { BEFORE_AFTER_IMAGES, beforeAfterDoc, BUILD_IMAGES, buildDoc, essayDoc, EVENT_IMAGES, eventDoc, fullDoc, GALLERY_IMAGES, galleryDoc, researchDoc } from "../lib/exhbt/sample";

/*
 * Everything the browser tests know about the edit-on-page editor (decision 0026,
 * components/exhbt-editor/): how to get to it, how to find a field, a frame and a grip, how to wait
 * for a save, and how to measure the page box for box. Every editor spec imports from here; the
 * classic editor's helpers are e2e/editor.ts.
 */

/** The editor's root, once it is up (the loading view has no data-ready). */
export const READY = '[data-editor="page"][data-ready="true"]';

export type Plan = "free" | "premium" | "max";

/* ------------------------------------------------------------------------------------------------
 * Getting to the editor
 * ---------------------------------------------------------------------------------------------- */

/** A fresh username for a test (letters and digits, as usernames are). */
export const freshName = (tag: string) => `${tag.replace(/[^a-z0-9]/gi, "").toLowerCase()}${Math.random().toString(36).slice(2, 8)}`;

/** Waits for the editor to be up. */
export async function waitReady(page: Page) {
  await expect(page.locator(READY)).toBeAttached();
}

/** Signs in as a development user with no exhbts, starts an empty case study (e2e/add-exhbt.ts) and waits for the editor; returns the new exhbt's id. */
export async function openNew(page: Page, username: string, plan: Plan = "premium"): Promise<string> {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await startBlank(page);
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  await waitReady(page);
  return page.url().match(/\/exhbts\/([0-9a-f-]{36})\/edit$/)![1]!;
}

/**
 * Opens the editor on a sample published by /dev/portfolio (`withParam`, e.g. "gallery"), found on the
 * list by its slug's title; returns its id. The user is cleared and made again on the max plan.
 */
export async function openSeeded(page: Page, username: string, withParam: string, slug: string): Promise<string> {
  await page.goto(`/dev/portfolio?username=${username}&plan=max&count=0&with=${withParam}`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  const title = SAMPLE_TITLES[slug];
  const link = title ? page.getByRole("link", { name: `Edit ${title}` }) : page.locator('a[href$="/edit"]').first();
  const href = await link.getAttribute("href");
  await page.goto(href!);
  await waitReady(page);
  return href!.match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
}

/**
 * Stores `doc` as a published exhbt of a fresh development user with POST /dev/parity (each image gets a
 * placeholder picture of its size), signs in with /auth/dev and opens its editor. Never signInAs or
 * /dev/portfolio after seeding: both clear that user's exhbts. `files` maps each image section's id to its file.
 */
export async function openDoc(page: Page, username: string, doc: ExhbtDoc, opts: { slug?: string; working?: ExhbtDoc; plan?: Plan; aiVersion?: unknown; query?: string } = {}): Promise<{ id: string; url: string; files: Record<string, string> }> {
  const res = await page.request.post("/dev/parity", { data: { username, slug: opts.slug ?? "page-editor", doc, working: opts.working, plan: opts.plan, aiVersion: opts.aiVersion } });
  expect(res.status(), await res.text()).toBe(200);
  const out = (await res.json()) as { id: string; url: string; files: Record<string, string> };
  await page.goto(`/auth/dev?email=${username}@example.com&next=${encodeURIComponent(`/exhbts/${out.id}/edit${opts.query ?? ""}`)}`);
  await waitReady(page);
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Finding things on the editing page
 * ---------------------------------------------------------------------------------------------- */

/** The element carrying a field path (decision 0026's table): the field itself, or a formatted field's box. */
export const field = (page: Page, path: string): Locator => page.locator(`${READY} [data-path="${path}"]`);

/**
 * The field itself, whatever it is now: a plain field's textarea or inline span, a formatted field's
 * words as the page drew them, or, once its editor has started, its editor (not the buttons beside it).
 */
export const textbox = (page: Page, path: string): Locator =>
  page.locator(`${READY} [data-path="${path}"]:is(textarea, [role=textbox]), ${READY} [data-path="${path}"] > .xe-rest, ${READY} [data-path="${path}"] .ProseMirror`).first();

/**
 * Holds back the formatted fields' editor chunk (fields/RichEditor.tsx) until the returned function is
 * called, so the resting fields stay as they are: what a slow connection does to the first click.
 */
export async function holdRichEditor(page: Page): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/RichEditor/, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

/**
 * The path of the field that has the cursor: the closest `[data-path]` of the focused element. Check this
 * rather than `data-path` on `:focus` itself: once a formatted field's editor has started (in an idle
 * moment, or on a click), the focus is on the editor inside the `[data-path]` box, not on the box.
 */
export const focusedPath = (page: Page): Promise<string | null> => page.evaluate(() => document.activeElement?.closest("[data-path]")?.getAttribute("data-path") ?? null);

/** The page item's frame. */
export const frame = (page: Page, id: string): Locator => page.locator(`${READY} [data-section-id="${id}"]`);

/** A page item's grip. */
export const grip = (page: Page, id: string): Locator => frame(page, id).locator("[data-grip]");

/**
 * Chooses every word of the field that has the cursor. With a keyboard that is Control+A, or Command+A on
 * a Mac. The editor reads an iPhone's browser, and a Mac's, as one where Control+A goes to the start of
 * the line and Command+A chooses everything (Tiptap's keymap goes by the user agent, ProseMirror's by the
 * platform). Driven from a machine that is not a Mac, a page that says it is an iPhone or a Mac has no key
 * that does it, so there the words are chosen as a finger chooses them: through the page's own selection.
 */
export async function chooseAll(page: Page) {
  const apple = await page.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document));
  if (!apple || process.platform === "darwin") return page.keyboard.press("ControlOrMeta+A");
  await page.evaluate(async () => {
    const el = document.activeElement;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.select();
    else if (el) getSelection()?.selectAllChildren(el);
    // The editor hears of a selection a moment after it is made.
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/**
 * Puts the cursor in a field and types `words`, replacing what is there (`append` keeps it). A
 * formatted field becomes its editor when it takes the focus; this waits for that before typing.
 */
export async function typeIn(page: Page, path: string, words: string, opts: { append?: boolean } = {}) {
  const f = field(page, path);
  await f.scrollIntoViewIfNeeded();
  const rich = (await f.getAttribute("data-field")) === "rich";
  await f.click();
  const box = rich ? f.locator(".ProseMirror") : f;
  if (rich) await expect(box).toBeFocused();
  if (!opts.append) await chooseAll(page);
  if (!opts.append) await page.keyboard.press("Backspace");
  else await page.keyboard.press("End");
  await page.keyboard.type(words);
}

/** A finger on the screen: `native` says whether the browser itself takes the touches. */
export type Finger = {
  native: boolean;
  down(x: number, y: number): Promise<void>;
  move(x: number, y: number): Promise<void>;
  up(): Promise<void>;
  slide(from: { x: number; y: number }, to: { x: number; y: number }, steps?: number): Promise<void>;
};

/**
 * A finger. On Chromium the touches are real ones, sent through the browser, so scrolling and the press
 * delay behave as they do under a finger (`native`). Playwright's WebKit takes a tap and nothing more, so
 * there the touches are events made in the page, sent to the element under the first touch as a real
 * finger's are: they reach the editor's sensors, but the browser does not scroll for them. A test checks
 * that a swipe scrolls only where `native` is true. E2E_TOUCH=page makes Chromium use the made events too,
 * to check them against the real ones.
 */
export async function finger(page: Page): Promise<Finger> {
  const slider = (move: Finger["move"]): Finger["slide"] => async (from, to, steps = 12) => {
    for (let i = 1; i <= steps; i++) {
      await move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      await page.waitForTimeout(16);
    }
  };
  if (page.context().browser()?.browserType().name() === "chromium" && process.env.E2E_TOUCH !== "page") {
    const cdp = await page.context().newCDPSession(page);
    const send = async (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) => {
      await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    };
    const move = (x: number, y: number) => send("touchMove", x, y);
    return { native: true, down: (x, y) => send("touchStart", x, y), move, up: () => send("touchEnd"), slide: slider(move) };
  }
  let under: ElementHandle<Element> | null = null;
  let last = { x: 0, y: 0 };
  const send = async (type: "touchstart" | "touchmove" | "touchend", x: number, y: number) => {
    const touch = [{ identifier: 1, clientX: x, clientY: y }];
    const on = type === "touchend" ? [] : touch;
    await under!.dispatchEvent(type, { touches: on, targetTouches: on, changedTouches: touch });
    last = { x, y };
  };
  const move = (x: number, y: number) => send("touchmove", x, y);
  return {
    native: false,
    async down(x, y) {
      under = (await page.evaluateHandle(([px, py]) => document.elementFromPoint(px!, py!), [x, y])).asElement();
      expect(under, `something is drawn at ${x}, ${y}`).not.toBeNull();
      await send("touchstart", x, y);
    },
    move,
    async up() {
      await send("touchend", last.x, last.y);
      await under?.dispose();
      under = null;
    },
    slide: slider(move),
  };
}

/** The editor's doc as it is now, in the page (development only). */
export const docNow = (page: Page): Promise<ExhbtDoc> => page.evaluate(() => window.__exhbtEditor!.get());

/** What Undo would undo ("remove graph 1"), or null. */
export const undoLabel = (page: Page): Promise<string | null> => page.evaluate(() => window.__exhbtEditor!.undoLabel());

/** A value as JSON with every object's keys sorted, so two docs compare by content (the server reads a doc into the schema's key order). */
export function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x));
}

/** Waits until the server holds the editor's doc as it is now, and the save status says "Saved". */
export async function waitSaved(page: Page, id?: string) {
  await expect(page.locator(`${READY} .xe-save`, { hasText: /^Saved$/ })).toBeVisible();
  if (!id) return;
  await expect
    .poll(async () => {
      const [now, stored] = await Promise.all([docNow(page), readStored(page, id)]);
      return canon(stored.working) === canon(now);
    })
    .toBe(true);
}

/** The frames' ids in page order. */
export const pageOrder = (page: Page): Promise<string[]> => page.locator(`${READY} article [data-section-id]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section-id")!));

export type Box = { key: string; x: number; y: number; w: number; h: number };

/**
 * The place and size, relative to the drawn exhbt, of every [data-part], the title, the context line,
 * each pill, each flowchart box, each finding and each figure: what a box-for-box test compares. It
 * measures the one article drawn (the editing page, "See as a visitor", or the loading view).
 */
export function boxes(page: Page, opts: { frames?: boolean } = {}): Promise<Box[]> {
  return page.evaluate((withFrames) => {
    const article = [...document.querySelectorAll("article[data-exhbt-page]")].find((a) => (a as HTMLElement).offsetParent !== null || a.getClientRects().length > 0)!;
    const root = article.getBoundingClientRect();
    const out: Box[] = [];
    const seen = new Map<string, number>();
    const nth = (k: string) => {
      const n = (seen.get(k) ?? 0) + 1;
      seen.set(k, n);
      return `${k}#${n}`;
    };
    const add = (key: string, el: Element) => {
      const r = el.getBoundingClientRect();
      out.push({ key, x: r.x - root.x, y: r.y - root.y, w: r.width, h: r.height });
    };
    article.querySelectorAll("[data-part]").forEach((el) => add(nth(`part ${el.getAttribute("data-part")}`), el));
    const title = article.querySelector(".xp-title");
    if (title) add("title", title);
    const context = article.querySelector(".xp-context");
    if (context) add("context line", context);
    article.querySelectorAll('.xp-pill:not(#skill-new):not([data-edit-only="add-skill"])').forEach((el) => add(`pill ${el.textContent?.trim()}`, el));
    // The "Add a skill" box (the stand-in's inert copy, or the editor's field): on EDIT_ONLY_IN_FLOW.
    const addSkill = article.querySelector('[data-edit-only="add-skill"]');
    if (addSkill) add("the Add a skill box", addSkill);
    // Its Add button on a touch screen (the stand-in's inert copy, or the editor's): on EDIT_ONLY_IN_FLOW too.
    const addButton = article.querySelector('[data-edit-only="add-skill-button"]');
    if (addButton && addButton.getClientRects().length > 0) add("the Add a skill box's Add button", addButton);
    // The sidebar's own parts besides the facts, which the editing page draws as the visitor's page does.
    for (const [key, sel] of [["Save as PDF", "[data-save-pdf]"], ["the checks", "[data-checks]"], ["the team byline", "[data-team]"]] as const) {
      const el = article.querySelector(sel);
      if (el) add(key, el);
    }
    article.querySelectorAll(".xp-flow-box").forEach((el, i) => add(`flowchart box ${i + 1}`, el));
    article.querySelectorAll("[data-part] li.xp-finding").forEach((el) => add(nth("finding"), el));
    // The editing page's frames, by id (the "nothing moves" checks).
    if (withFrames) article.querySelectorAll("[data-section-id]").forEach((el) => add(`frame ${el.getAttribute("data-section-id")}`, el));
    return out;
  }, Boolean(opts.frames));
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

/** How many times each unit has rendered ("shell", "flow", each section's id). */
export const renders = (page: Page): Promise<Record<string, number>> => page.evaluate(() => ({ ...(window.__exhbtRenders ?? {}) }));

/** The stored copies of an exhbt: { working, published, aiVersion } (GET /dev/parity). */
export async function readStored(page: Page, id: string): Promise<{ working: ExhbtDoc; published: ExhbtDoc | null; aiVersion: unknown }> {
  const res = await page.request.get(`/dev/parity?id=${id}`);
  expect(res.status()).toBe(200);
  return res.json();
}

/** Fonts in, every picture loaded, laid out. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.addEventListener("load", done, { once: true }), img.addEventListener("error", done, { once: true }))))));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/* ------------------------------------------------------------------------------------------------
 * The samples, and the docs the tests make from them
 * ---------------------------------------------------------------------------------------------- */

/** Each layout's sample as /dev/portfolio publishes it: its `with` and its slug (lib/exhbt/sample.ts; the four of decision 0028 are D's). */
export const SAMPLES: Record<Format, { with: string; slug: string }> = {
  "case-study": { with: "open-banking", slug: "open-banking" },
  gallery: { with: "gallery", slug: "freshers-campaign" },
  research: { with: "research", slug: "walk-and-recall" },
  build: { with: "build", slug: "shift-swap" },
  essay: { with: "essay", slug: "reform-act" },
  "before-after": { with: "before-after", slug: "cafe-checkout" },
  event: { with: "event", slug: "the-crucible" },
};

/** Each sample's title, to find it on the list. */
const SAMPLE_TITLES: Record<string, string> = {
  "open-banking": "Will banks and fintechs cooperate under open banking?",
  "freshers-campaign": "Freshers' Week campaign for the Law Society",
  "walk-and-recall": "Does a 10-minute walk before a test improve recall in first-year students?",
  "shift-swap": "Shift Swap: a web app for the Students' Union bar rota",
  "reform-act": "Did the 1832 Reform Act protect the old order or end it?",
  "cafe-checkout": "Redesigning the checkout of a campus cafe's order app",
  "the-crucible": "The Crucible: the Drama Society's spring show",
};

/** The layouts the editor offers (OFFERED_FORMATS). Every spec that runs "on each layout" loops over these, so release 4 covers seven with no change. */
export const offered = (): readonly Format[] => OFFERED_FORMATS;

const fileIds = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}-${i + 1}`);

/**
 * Each layout's sample as a doc, built by the same functions /dev/portfolio publishes them with, for
 * openDoc (POST /dev/parity gives each picture a placeholder of its size). The case study's is the full
 * one (fullDoc: every section but an image, a quote among them), so a case study has a quote to type in.
 */
export function sampleDoc(f: Format): ExhbtDoc {
  switch (f) {
    case "case-study":
      return fullDoc;
    case "gallery":
      return galleryDoc(fileIds(GALLERY_IMAGES.length, "gallery"));
    case "research":
      return researchDoc("research-1");
    case "build":
      return buildDoc(fileIds(BUILD_IMAGES.length, "build"));
    case "essay":
      return essayDoc("essay-1");
    case "before-after":
      return beforeAfterDoc(fileIds(BEFORE_AFTER_IMAGES.length, "before-after"));
    case "event":
      return eventDoc(fileIds(EVENT_IMAGES.length, "event"));
  }
}

/**
 * Opens the editor's timing harness (/dev/editor-timing: no sign-in, a save that does nothing) on a
 * layout's sample: `full` gives every empty optional part words, `look` is a portfolio look's id,
 * `grow` "mirror" makes the plain fields grow by their mirror.
 */
export async function openTiming(page: Page, f: Format | "new", opts: { full?: boolean; look?: string; grow?: "mirror" } = {}) {
  const q = new URLSearchParams({ sample: f, ...(opts.full ? { full: "1" } : {}), ...(opts.look ? { look: opts.look } : {}), ...(opts.grow ? { grow: opts.grow } : {}) });
  await page.goto(`/dev/editor-timing?${q}`);
  await waitReady(page);
}

/** Waits until every formatted field's editor has started (they start one at a time in idle moments). */
export async function waitLive(page: Page) {
  await expect(page.locator(`${READY} article [data-field="rich"]:not([data-live])`)).toHaveCount(0);
}

/** "See as a visitor" on or off (through the view's development hook, until H's top bar has the button). */
export async function seeAsVisitor(page: Page, on: boolean) {
  await page.evaluate((v) => window.__exhbtUi!.setVisitor(v), on);
  if (on) await expect(page.locator(`${READY} section[aria-label="Preview"] article`)).toBeVisible();
  else await expect(page.locator(`${READY} section[aria-label="Preview"]`)).toHaveCount(0);
}

/** Jumps to an issue path, as "Things to fix" does. */
export const jump = (page: Page, path: string) => page.evaluate((p) => window.__exhbtUi!.jumpTo(p), path);

/** A PNG of one colour, `w` by `h`, for uploads whose size the test can tell apart. */
export function png(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x9c)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const words = (t: string | undefined) => (t ?? "").trim().length > 0;
const hasWords = (rt: { t: string }[]) => rt.some((r) => words(r.t));

/**
 * The doc with every empty optional part given words, so the visitor's page draws everything the
 * editing page does: a context line, What it is, Where and when, My role, a work link, every box's
 * detail, every caption, a quote's role, every link's description, and words in an empty aim or conclusion.
 */
export function full(doc: ExhbtDoc): ExhbtDoc {
  const section = (s: Section): Section => {
    switch (s.kind) {
      case "image":
        return hasWords(s.caption) ? s : { ...s, caption: text("A caption under the picture") };
      case "quote":
        return words(s.role) ? s : { ...s, role: "Course leader" };
      case "link":
        return words(s.description) ? s : { ...s, description: "One line about the link" };
      case "aim":
      case "conclusion":
        return hasWords(s.text) ? s : { ...s, text: text("A sentence of its own.") };
      default:
        return s;
    }
  };
  return {
    ...doc,
    context: words(doc.context) ? doc.context : "Year 2 module",
    whereWhen: words(doc.whereWhen) ? doc.whereWhen : "University of Leeds, May 2026",
    myRole: words(doc.myRole) ? doc.myRole : "Lead analyst",
    gap: hasWords(doc.gap) ? doc.gap : [{ t: "Queues ran long at lunch. " }, { t: "Would a second till help?", b: true }],
    evidence: doc.evidence ?? { kind: "link", href: "https://example.com/the-work", label: "The report (PDF)" },
    flow: doc.flow.map((b) => (words(b.detail) ? b : { ...b, detail: "two weeks" })),
    sections: doc.sections.map(section),
  };
}

/**
 * What decision 0026 puts in the flow in the editor only, the whole list, as data: each entry's name,
 * the selector of what it adds to the editing page (taken out, the editing page is the visitor's
 * there), and whether it is always there (the two edit-only fields) or only while its part is empty
 * (the placeholders). Every box-for-box test reads this, and allows its entries as 0026 says under
 * "How a box-for-box test allows them": a part on the list may be in one page and not the other; the
 * box that holds it may grow by its height, and whatever sits below moves down by as much; on the
 * pills' line, the pills may move aside for the "Add a skill" box. `allowEditOnly` applies it by
 * taking each entry out of the editing page, after which nothing may differ. Nobody writes the list
 * anywhere else.
 *
 * The last three placeholders (an empty title, an empty flowchart box and an empty finding) are not on
 * 0026's list, but a new exhbt has all three: the visitor's page draws them with no words and no
 * height, the editing page with their placeholders.
 */
export const EDIT_ONLY_IN_FLOW: { name: string; selector: string; always: boolean }[] = [
  // The two edit-only fields, always there while editing.
  { name: "an image's description field", selector: '[data-edit-only="image-description"]', always: true },
  // With its Add button on a touch screen (hidden with a mouse), after it on the pills' line: its width there, no height.
  { name: "the Add a skill box, with its Add button on touch screens", selector: '[data-edit-only="add-skill"], [data-edit-only="add-skill-button"]', always: true },
  // The placeholders, each there only while its part is empty.
  { name: "the context line", selector: '[data-path="gap"][data-empty]', always: false },
  { name: "What it is", selector: '.xp-fact:has([data-path="context"][data-empty])', always: false },
  { name: "Where and when", selector: '.xp-fact:has([data-path="whereWhen"][data-empty])', always: false },
  { name: "My role", selector: '.xp-fact:has([data-path="myRole"][data-empty])', always: false },
  // The work's box goes with it: the visitor's page draws no box at all when there is no work.
  { name: "Add the work", selector: 'aside div:has(> [data-edit-only="placeholder"] .xp-work-button)', always: false },
  { name: "a flowchart box's detail", selector: ".xp-flow-detail:has([data-empty])", always: false },
  { name: "an image's caption", selector: 'figcaption:has([data-path$=".caption"][data-empty])', always: false },
  { name: "a quote's role", selector: '[data-part="quote"] [data-path$=".role"][data-empty]', always: false },
  // A formatted field since decision 0032 (it takes bold and italic): the field's own box takes the place of the page's <p>.
  { name: "a link's description", selector: '[data-field="rich"][data-path$=".description"][data-empty]', always: false },
  // A part's title the person has cleared (decision 0032): a visitor sees no heading, and the editor keeps "Add a title" in its place.
  { name: "a cleared title", selector: ':is(h2, h3):has(> .xe-field > :is([data-path$=".title"], [data-path="flowTitle"], [data-path="refsTitle"])[data-empty])', always: false },
  { name: "an aim or a conclusion with no words", selector: ':is([data-kind="aim"], [data-kind="conclusion"])[data-section-id]:has([data-path$=".text"][data-empty])', always: false },
  { name: "an empty title", selector: '[data-path="title"][data-empty]', always: false },
  { name: "an empty flowchart box", selector: '[data-path$=".step"][data-empty]', always: false },
  // A flowchart with no boxes: its one button, "Add a box", is its placeholder (FlowBox.tsx); the "+" over each arrow takes
  // no room. Since decision 0032 a flowchart with no boxes is not drawn for a visitor at all ("a flowchart with no box left is not
  // drawn at all"), in every layout: so its whole part goes, the editor's frame round it with its heading and margins.
  { name: "the empty flowchart", selector: '[data-section-id="flow"]:has(.xe-flow-first[data-flow-add])', always: false },
  { name: "an empty finding", selector: '[data-path*=".items."][data-empty]', always: false },
];

/**
 * Takes out of the editing page what EDIT_ONLY_IN_FLOW allows (`which`: the two fields that are
 * always there, or every entry), so that what is left must be the visitor's page box for box.
 * Returns the names of what it took out, with how many of each.
 */
export function allowEditOnly(page: Page, which: "always" | "all"): Promise<string[]> {
  const list = EDIT_ONLY_IN_FLOW.filter((e) => which === "all" || e.always);
  return page.evaluate((entries) => {
    const named: string[] = [];
    const root = document.querySelector('[data-editor="page"] article[data-exhbt-page]');
    if (!root) return named;
    for (const e of entries) {
      const els = [...root.querySelectorAll(e.selector)];
      if (els.length) named.push(`${e.name} (${els.length})`);
      els.forEach((el) => el.remove());
    }
    return named;
  }, list);
}

/**
 * Every section toolbar's button that is drawn now (display, not opacity: on a desktop a toolbar shows
 * on hover in the place it already has), hit-tested against what it must never cover (decision 0026,
 * "The chrome"; the release 3 review's vision-1 and visual-fidelity-3): the words of any other part
 * of the page, the person's own judged by the whole box of each field or element in one that holds
 * them (so a short last line passing by luck doesn't count, and a placeholder does), a label the
 * layout draws itself ("References") by its words; the pictures, links and buttons of any
 * other section; another toolbar's buttons; and the edit-only chips and labels on the page, its own
 * section's included (the aim's switch, a picked figure's label, "Edit figures", "Web address", a
 * flowchart box's chips). Its own section's words count too, every kind's (23 Nov: a toolbar never
 * sits on its own section's words), by where the words are: a text box's by its words where they are
 * on one line, as the toolbar measures them (Toolbar.tsx). Only a picture's toolbar lies over its own
 * section, over the picture. Returns each clash in words; [] when there are none.
 */
export function toolbarClashes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-editor="page"] article[data-exhbt-page]');
    if (!root) return ["no editing page"];
    const drawnNow = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const over = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const r = (b: DOMRect) => [b.x, b.y, b.width, b.height].map(Math.round).join(",");
    const frames = [...root.querySelectorAll<HTMLElement>("[data-section-id]")];
    const toolButtons = (fr: Element) => [...fr.querySelectorAll(":scope > .xe-tools button")].filter(drawnNow);
    const sectionOf = (el: Element) => el.closest("[data-section-id]")?.getAttribute("data-section-id") ?? "the page";
    // What holds words, and where they count: the person's own words (a field, or words inside one) by the element's whole box,
    // so a short last line passing by luck doesn't count; a label the layout draws itself ("References") by its words alone.
    // In a toolbar's own section, every one by its words (`glyphs`): it sits by them, never on them.
    const worded: { el: Element; boxes: DOMRect[]; glyphs: DOMRect[] }[] = [];
    const pen = document.createElement("canvas").getContext("2d")!;
    const px = (v: string) => parseFloat(v) || 0;
    /** A text box's words: on one line, as wide as they are (its placeholder's where it is empty); on more, the whole box. */
    const boxWords = (el: HTMLTextAreaElement | HTMLInputElement): DOMRect[] => {
      const text = (el.value || el.placeholder).trimEnd();
      if (!text.trim()) return [];
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      const line = px(s.lineHeight) || px(s.fontSize) * 1.2;
      if (el.clientHeight - px(s.paddingTop) - px(s.paddingBottom) > line * 1.5) return [b];
      pen.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const inner = el.clientWidth - px(s.paddingLeft) - px(s.paddingRight);
      const w = Math.min(pen.measureText(text).width + px(s.letterSpacing) * text.length, inner);
      const x = px(s.paddingLeft) + (s.textAlign === "center" ? (inner - w) / 2 : s.textAlign === "right" || s.textAlign === "end" ? inner - w : 0);
      return [new DOMRect(b.x + x, b.y, w, b.height)];
    };
    // A text node's words, each by itself: a space at the end of a wrapped line hangs past the edge of its box, and is no word.
    const range = document.createRange();
    const wordsOf = (n: Node) =>
      [...n.textContent!.matchAll(/\S+/g)].flatMap((w) => {
        range.setStart(n, w.index);
        range.setEnd(n, w.index + w[0].length);
        return [...range.getClientRects()];
      });
    for (const el of root.querySelectorAll("*")) {
      if (el.closest(".xe-tools, .sr-only, [hidden]") || !drawnNow(el)) continue;
      const field = el.matches("textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [contenteditable]:not([contenteditable=false]), [role=textbox]");
      const texts = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      const glyphs = el.matches("textarea, input") ? boxWords(el as HTMLTextAreaElement) : texts.flatMap(wordsOf);
      if (field || (texts.length && el.closest("[data-path]"))) worded.push({ el, boxes: [el.getBoundingClientRect()], glyphs });
      else if (texts.length) worded.push({ el, boxes: texts.flatMap((n) => (range.selectNodeContents(n), [...range.getClientRects()])), glyphs });
    }
    const CHIPS = ".xe-chip, .xe-above, .xe-fig-chip, .xe-fig-picked, .xe-over > *, .xe-flow-chip, .xe-add-finding, .xe-list-tools > *";
    const out: string[] = [];
    for (const fr of frames) {
      for (const b of toolButtons(fr)) {
        const box = b.getBoundingClientRect();
        const name = `${b.getAttribute("aria-label") ?? "a tool"} (${r(box)})`;
        for (const { el: w, boxes, glyphs } of worded) {
          if (!(fr.contains(w) ? glyphs : boxes).some((q) => over(box, q))) continue;
          out.push(`${name} covers "${(w.matches("textarea, input") ? (w as HTMLTextAreaElement).value : (w.textContent ?? "")).trim().slice(0, 30)}" in ${sectionOf(w)}`);
        }
        for (const other of frames) {
          if (other === fr) continue;
          for (const el of other.querySelectorAll("img, a[href], button")) {
            if (drawnNow(el) && over(box, el.getBoundingClientRect())) out.push(`${name} covers a ${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? ""} in ${other.dataset.sectionId}`);
          }
        }
        for (const el of root.querySelectorAll(CHIPS)) {
          if (el.closest(".xe-tools") || !drawnNow(el) || !over(box, el.getBoundingClientRect())) continue;
          out.push(`${name} covers ${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30)} in ${sectionOf(el)}`);
        }
      }
    }
    return [...new Set(out)];
  });
}

/**
 * Every "+" between sections, as drawn now, hit-tested the same way (design round 2, item 4): it lies
 * in its own gap, wherever the gap is at least as deep as the small "+" (32px); and it covers no words
 * (a field or words in one by the element's whole box, a label by its words), and no link, button or
 * chip. Returns each clash in words; [] when there are none.
 */
export function plusClashes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-editor="page"] article[data-exhbt-page]');
    if (!root) return ["no editing page"];
    const drawnNow = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const over = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const sectionOf = (el: Element) => el.closest("[data-section-id]")?.getAttribute("data-section-id") ?? "the page";
    const out: string[] = [];
    const worded: { el: Element; boxes: DOMRect[] }[] = [];
    for (const el of root.querySelectorAll("*")) {
      if (el.closest(".xe-insert, .sr-only, [hidden]") || !drawnNow(el)) continue;
      const field = el.matches("textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [contenteditable]:not([contenteditable=false]), [role=textbox]");
      const texts = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (field || (texts.length && el.closest("[data-path]"))) worded.push({ el, boxes: [el.getBoundingClientRect()] });
      else if (texts.length) {
        const range = document.createRange();
        worded.push({ el, boxes: texts.flatMap((n) => (range.selectNodeContents(n), [...range.getClientRects()])) });
      }
    }
    // Controls, not pictures: under a gap too small even for the small "+" (12px over a gallery's lead picture on a phone), it sits over the picture's top edge, where there are no words.
    const controls = [...root.querySelectorAll("a[href], button, .xe-chip, .xe-above, .xe-fig-picked")].filter((el) => !el.closest(".xe-insert") && drawnNow(el));
    for (const insert of root.querySelectorAll<HTMLElement>(".xe-insert")) {
      const plus = insert.querySelector(".xe-plus");
      if (!plus || !drawnNow(plus)) continue;
      const box = plus.getBoundingClientRect();
      const name = `${plus.getAttribute("aria-label")} (${[box.x, box.y, box.width, box.height].map(Math.round).join(",")})`;
      const next = insert.nextElementSibling;
      if (next && !insert.hasAttribute("data-end")) {
        const top = insert.getBoundingClientRect().top;
        const foot = next.getBoundingClientRect().top;
        if (foot - top >= 32 && (box.top < top - 0.5 || box.bottom > foot + 0.5)) out.push(`${name} is out of its ${Math.round(foot - top)}px gap`);
      }
      for (const { el: w, boxes } of worded) {
        if (boxes.some((q) => over(box, q))) out.push(`${name} covers "${(w.matches("textarea, input") ? (w as HTMLTextAreaElement).value : (w.textContent ?? "")).trim().slice(0, 30)}" in ${sectionOf(w)}`);
      }
      for (const el of controls) {
        if (over(box, el.getBoundingClientRect())) out.push(`${name} covers a ${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? ""} in ${sectionOf(el)}`);
      }
    }
    return [...new Set(out)];
  });
}

/**
 * Each flowchart chip shown now (a box's grip and Remove) that comes within `clear` px of a letter in
 * its own box (design round 2, item 5): the chip's drawn circle against where the box's words are
 * drawn, the first line of each of its fields (its step, its detail), measured in the field's own type.
 * Returns each offender in words; [] when there are none.
 */
export function flowChipsNearWords(page: Page, clear = 4): Promise<string[]> {
  return page.evaluate((clear) => {
    const out: string[] = [];
    const ctx = document.createElement("canvas").getContext("2d")!;
    for (const chip of document.querySelectorAll<HTMLElement>('[data-editor="page"] .xp-flow-box .xe-flow-chip')) {
      if (!chip.getClientRects().length || Number(getComputedStyle(chip.closest(".xe-flow-tools")!).opacity) === 0) continue;
      const c = chip.getBoundingClientRect();
      const cx = c.left + c.width / 2;
      const cy = c.top + c.height / 2;
      const radius = c.width / 2;
      for (const field of chip.closest(".xp-flow-box")!.querySelectorAll<HTMLTextAreaElement>("textarea")) {
        if (!field.value.trim()) continue;
        const s = getComputedStyle(field);
        const size = parseFloat(s.fontSize);
        const line = s.lineHeight === "normal" ? size * 1.2 : parseFloat(s.lineHeight);
        ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        const f = field.getBoundingClientRect();
        const left = f.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth);
        const width = Math.min(f.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), ctx.measureText(field.value.trim()).width);
        const top = f.top + parseFloat(s.paddingTop) + parseFloat(s.borderTopWidth) + (line - size) / 2;
        // The nearest point of the first line's letters to the chip's centre.
        const nx = Math.max(left, Math.min(cx, left + width));
        const ny = Math.max(top, Math.min(cy, top + size));
        const gap = Math.hypot(cx - nx, cy - ny) - radius;
        if (gap < clear) out.push(`${chip.getAttribute("aria-label")}: ${gap.toFixed(1)}px from "${field.value.trim().slice(0, 20)}"`);
      }
    }
    return out;
  }, clear);
}

/**
 * Every button and field shown on the editing page, hit-tested at its middle: what a finger lands on there must be the
 * control itself or something inside it (a press on the label round a tick box is the tick box's). A control counts as
 * shown when it has a box, is not hidden, faded out or closed away, and takes a press (`pointer-events`). Each one is
 * scrolled to the middle of the screen first, clear of the top bar. `allow` names the controls that may lie under
 * another on purpose: [what is under (a selector), what lies over it (a selector)]. `by`, a selector, counts only what
 * lies under a match of it (".xe-tools": a section's grip or toolbar). Returns each covered control in words; [] when
 * there are none.
 */
export function coveredControls(page: Page, opts: { allow?: [under: string, over: string][]; by?: string } = {}): Promise<string[]> {
  return page.evaluate(({ allow = [], by }) => {
    const root = document.querySelector('[data-editor="page"] article[data-exhbt-page]');
    if (!root) return ["no editing page"];
    const CONTROLS = 'button, [role="button"], input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"], [data-path][data-field]';
    const shown = (el: Element) => {
      if (!el.getClientRects().length || el.closest("[hidden], [inert], .sr-only, dialog:not([open]), [popover]:not(:popover-open)")) return false;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.pointerEvents === "none") return false;
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) if (Number(getComputedStyle(a).opacity) === 0) return false;
      return true;
    };
    const name = (el: Element | null) => (el ? el.getAttribute("aria-label") ?? el.getAttribute("data-path") ?? (el.textContent?.trim().slice(0, 30) || el.className.toString().slice(0, 40) || el.tagName.toLowerCase()) : "nothing");
    const sectionOf = (el: Element) => el.closest("[data-section-id]")?.getAttribute("data-section-id") ?? "the page";
    // A field holds its own controls (a rich field's editor): only the outermost of a field and what it holds is tried.
    const controls = [...root.querySelectorAll(CONTROLS)].filter((el) => shown(el) && !el.parentElement?.closest('[data-path][data-field], [contenteditable="true"]'));
    const out: string[] = [];
    for (const el of controls) {
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === el || el.contains(hit)) continue;
      // A tick box's label takes its press.
      if (el.matches("input") && hit.closest("label")?.contains(el)) continue;
      if (allow.some(([under, over]) => el.matches(under) && hit.closest(over))) continue;
      if (by && !hit.closest(by)) continue;
      out.push(`${name(el)} in ${sectionOf(el)} (${Math.round(x)},${Math.round(y)}) is under ${name(hit.closest(CONTROLS) ?? hit)} in ${sectionOf(hit)}`);
    }
    return out;
  }, opts);
}

/**
 * The controls matching `selector` whose press is under 44px either way: from each one's middle, how
 * far a finger still lands on it, with nothing over it (L's measure in editor-phone). Hit testing is in
 * whole pixels, so a 44px press measures 42 or 43.
 */
export function smallPresses(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const mine = (el: Element, x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && (hit === el || el.contains(hit)));
    };
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
      el.scrollIntoView({ block: "center", inline: "center" });
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
      if (!mine(el, cx, cy) || w < 42 || h < 42) bad.push(`${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30)} (${Math.round(r.width)}x${Math.round(r.height)}, takes ${w}x${h})`);
    }
    return bad;
  }, selector);
}
