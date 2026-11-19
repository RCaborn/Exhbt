import { expect, type Locator, type Page } from "@playwright/test";
import { text, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { OFFERED_FORMATS, type Format } from "../lib/exhbt/formats";

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

/** Signs in as a development user with no exhbts, presses "Start from scratch" and waits for the editor; returns the new exhbt's id. */
export async function openNew(page: Page, username: string, plan: Plan = "premium"): Promise<string> {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await page.getByRole("button", { name: "Start from scratch" }).click();
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

/** The page item's frame. */
export const frame = (page: Page, id: string): Locator => page.locator(`${READY} [data-section-id="${id}"]`);

/** A page item's grip. */
export const grip = (page: Page, id: string): Locator => frame(page, id).locator("[data-grip]");

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
  if (!opts.append) await page.keyboard.press("ControlOrMeta+A");
  if (!opts.append) await page.keyboard.press("Backspace");
  else await page.keyboard.press("End");
  await page.keyboard.type(words);
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
  await expect(page.locator(`${READY} [role=status]`, { hasText: /^Saved$/ })).toBeVisible();
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
export function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
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
    article.querySelectorAll(".xp-pill:not(#skill-new)").forEach((el) => add(`pill ${el.textContent?.trim()}`, el));
    article.querySelectorAll(".xp-flow-box").forEach((el, i) => add(`flowchart box ${i + 1}`, el));
    article.querySelectorAll("[data-part] li.xp-finding").forEach((el) => add(nth("finding"), el));
    return out;
  });
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
 * a selector for the part it adds or grows (on the editing page), and whether it is always there (the
 * two edit-only fields) or only while its part is empty (the placeholders). Every box-for-box test
 * reads this, and allows its entries as 0026 says under "How a box-for-box test allows them": a part
 * on the list may be in one page and not the other; the box that holds it may grow by its height, and
 * whatever sits below moves down by as much; on the pills' line, the pills may move aside for the
 * "Add a skill" box. Nobody writes the list anywhere else.
 */
export const EDIT_ONLY_IN_FLOW: { name: string; selector: string; always: boolean }[] = [
  // The two edit-only fields, always there while editing.
  { name: "an image's description field", selector: '[data-edit-only="image-description"]', always: true },
  { name: "the Add a skill box", selector: "#skill-new", always: true },
  // The placeholders, each there only while its part is empty.
  { name: "the context line", selector: '[data-path="gap"][data-empty]', always: false },
  { name: "What it is", selector: '.xp-fact:has([data-path="context"][data-empty])', always: false },
  { name: "Where and when", selector: '.xp-fact:has([data-path="whereWhen"][data-empty])', always: false },
  { name: "My role", selector: '.xp-fact:has([data-path="myRole"][data-empty])', always: false },
  { name: "Add the work", selector: '[data-edit-only="placeholder"]:has(.xp-work-button)', always: false },
  { name: "a flowchart box's detail", selector: ".xp-flow-detail:has([data-empty])", always: false },
  { name: "an image's caption", selector: 'figcaption:has([data-path$=".caption"][data-empty])', always: false },
  { name: "a quote's role", selector: '[data-part="quote"] [data-path$=".role"][data-empty]', always: false },
  { name: "a link's description", selector: ':is(p, span.block):has(> [data-path$=".description"][data-empty])', always: false },
  { name: "an aim or a conclusion with no words", selector: ':is([data-kind="aim"], [data-kind="conclusion"])[data-section-id]:has([data-path$=".text"][data-empty])', always: false },
];
