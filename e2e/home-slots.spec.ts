import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { joinYear, normaliseLayout, SECTION_KEYS, sectionsOf, splitYear, type SectionKey, type Tiles } from "../lib/portfolio-layout";
import { themeById } from "../lib/portfolio-themes";
import { BASE_LOOKS, fullFixture, sparseFixture, type PortfolioFixture } from "./fixtures/portfolio-pages";

/*
 * The portfolio page's editing slots (decision 0031, "The adapter"; brief D of docs/briefs/portfolio-first),
 * through the slot harness (app/dev/home-slots), whose stand-in adapter marks every slot and adds no box:
 *  - every text and paragraph path in 0031's table is there exactly once (a line's two halves once
 *    each), with its name, and none is inside anything inert;
 *  - one section frame per section and one tile frame per exhbt, in order, with their places;
 *  - the owner's places where 0031 says and nowhere else: the band with no exhbt, the end of the work
 *    (inside its list), the end of the page when More of my work is off it;
 *  - box for box, at 1440 and 412 wide, the editing page is the visitor's page (the same harness with
 *    no adapter, ?read=1) to half a pixel, every element in it, but for what 0031 lists as taking room
 *    in the editor only, each named: placeholders, empty sections drawn whole, the vision, an empty
 *    More of my work, and Studio's name as one field (its <h1> may differ; nothing else moves). While
 *    editing, a list of lines and its controls sit in a wrapper that takes the list's place (0031, "What
 *    the editing page adds that takes room"): the list in it is compared with the visitor's list;
 *  - the harness's visitor page is the public page (/p/<username>), so the comparison is with what
 *    visitors get.
 *
 * In all eight looks, with brief A's full fixture and its sparse one (e2e/fixtures/portfolio-pages.ts,
 * seeded through /dev/portfolio-parity), and the full one drawn four more ways by the harness: no
 * exhbt yet, one exhbt, More of my work off the page, and every word section empty.
 *
 * joinYear, with no browser: a line of education or experience is typed as two fields, the words and
 * the year, and written back as one line that splitYear reads.
 */

const HOME = "[data-portfolio-home]";
const FIXTURES = { full: fullFixture("pp-hs-full", null), sparse: sparseFixture("pp-hs-sparse", null) };
type FixtureName = keyof typeof FIXTURES;
/** The harness's ways of drawing a seeded page (app/dev/home-slots/stand-in.tsx, `CASES`). */
type CaseName = "full" | "none" | "one" | "no-work" | "empty";
const RUNS: { name: string; fixture: FixtureName; case: CaseName }[] = [
  { name: "full", fixture: "full", case: "full" },
  { name: "sparse", fixture: "sparse", case: "full" },
  { name: "no exhbt", fixture: "full", case: "none" },
  { name: "one exhbt", fixture: "full", case: "one" },
  { name: "work off the page", fixture: "full", case: "no-work" },
  { name: "every word section empty", fixture: "full", case: "empty" },
];

/* ---------------- Seeding and opening ---------------- */

const seeded = new Map<string, Record<string, string>>();
/** Seeds a fixture once per worker (a second seed draws the same page); gives its exhbts' ids by key. */
async function seed(request: APIRequestContext, f: PortfolioFixture): Promise<Record<string, string>> {
  const done = seeded.get(f.username);
  if (done) return done;
  // A 500 while the dev server compiles is tried again, as the parity gate does.
  for (let tries = 1; ; tries++) {
    const res = await request.post("/dev/portfolio-parity", { data: f });
    if (res.status() >= 500 && tries < 3) continue;
    expect(res.status(), await res.text()).toBe(200);
    const ids = ((await res.json()) as { ids: Record<string, string> }).ids;
    seeded.set(f.username, ids);
    return ids;
  }
}

async function go(page: Page, url: string) {
  for (let tries = 1; ; tries++) {
    const res = await page.goto(url);
    const status = res?.status() ?? 200;
    if (status < 500 || tries === 3) {
      expect(status, url).toBeLessThan(400);
      return;
    }
  }
}

const harness = (u: string, look: string, c: CaseName, read = false) => `/dev/home-slots?u=${u}&look=${look}&case=${c}${read ? "&read=1" : ""}`;

/** Fonts in, every picture loaded, laid out. */
async function settle(page: Page) {
  await expect(page.locator(HOME)).toHaveCount(1);
  await expect(page.locator(HOME)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.addEventListener("load", done, { once: true }), img.addEventListener("error", done, { once: true }))))));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/* ---------------- What each page should have ---------------- */

type Want = {
  sections: SectionKey[];
  tiles: Tiles;
  /** The exhbt in the band, or null. */
  band: string | null;
  /** The rest, as cards or rows, in order. */
  cards: string[];
};

/** What the harness draws for this fixture and case: the sections, the words and the exhbts, as loadPortfolio and the case give them. */
function want(f: PortfolioFixture, c: CaseName, ids: Record<string, string>): Want {
  const layout = normaliseLayout(f.layout ?? null);
  let sections = sectionsOf(layout);
  let tiles = layout.tiles;
  let shown = f.exhbts.filter((e) => !e.draft && !e.hidden).map((e) => ids[e.key]!);
  const starred = f.featured ? ids[f.featured]! : null;
  if (starred && shown.includes(starred)) shown = [starred, ...shown.filter((id) => id !== starred)];
  if (c === "none") shown = [];
  if (c === "one") shown = shown.slice(0, 1);
  if (c === "no-work") sections = sections.filter((k) => k !== "work");
  if (c === "empty") {
    sections = [...SECTION_KEYS];
    tiles = {};
  }
  const band = sections.includes("featured") ? (shown[0] ?? null) : null;
  return { sections, tiles, band, cards: sections.includes("work") ? shown.filter((id) => id !== band) : [] };
}

type Field = { path: string; part?: string; label: string };

/** Every text and paragraph field 0031's table puts on this page (the links are the "Your links" popover's, not fields). */
function fieldsOf(w: Want): Field[] {
  const out: Field[] = [
    { path: "profile.name", label: "Your name" },
    { path: "profile.headline", label: "One line about you" },
    { path: "profile.bio", label: "Your intro" },
    { path: "profile.location", label: "Where you're based" },
    { path: "profile.lookingFor", label: "What you're looking for" },
  ];
  const lines = (kind: "education" | "experience", label: (n: number) => string, year: string) =>
    (w.tiles[kind]?.lines ?? []).forEach((_, i) => out.push({ path: `arrangement.tiles.${kind}.lines.${i}`, part: "label", label: label(i + 1) }, { path: `arrangement.tiles.${kind}.lines.${i}`, part: "year", label: year }));
  if (w.sections.includes("about")) {
    out.push({ path: "arrangement.tiles.about.text", label: "About you" });
    lines("education", (n) => `Course or qualification ${n}`, "Year");
    out.push({ path: "arrangement.tiles.education.tools", label: "Tools you use" });
  }
  if (w.sections.includes("experience")) lines("experience", (n) => `Role ${n}`, "Years");
  if (w.sections.includes("quote"))
    out.push(
      { path: "arrangement.tiles.quote.text", label: "The quote, word for word" },
      { path: "arrangement.tiles.quote.name", label: "Who said it" },
      { path: "arrangement.tiles.quote.role", label: "Their role (optional)" },
    );
  return out;
}

const fieldKey = (f: { path: string; part?: string | null }) => (f.part ? `${f.path} (${f.part})` : f.path);

/** Every slot on the editing page, with where it sits. */
function readSlots(page: Page) {
  return page.locator(HOME).evaluate((root) => {
    const all = [...root.querySelectorAll<HTMLElement>("[data-slot]")];
    const of = (slot: string) => all.filter((e) => e.dataset.slot === slot);
    const sectionOf = (e: Element) => (e.parentElement?.closest<HTMLElement>("[data-slot=section]")?.dataset.key ?? null) as string | null;
    return {
      fields: [...of("text"), ...of("paras")].map((e) => ({ path: e.dataset.path!, part: e.dataset.part ?? null, label: e.dataset.label!, inert: Boolean(e.closest("[inert]")) })),
      sections: of("section").map((e) => ({ key: e.dataset.key!, index: Number(e.dataset.index), count: Number(e.dataset.count), drawn: Boolean(e.querySelector(`[data-section="${e.dataset.key}"]`)) })),
      tiles: of("tile").map((e) => ({ id: e.dataset.id!, where: e.dataset.where!, index: Number(e.dataset.index), count: Number(e.dataset.count), section: sectionOf(e), inCard: e.parentElement?.getAttribute("data-card") ?? null })),
      owner: of("owner").map((e) => ({
        where: e.dataset.where!,
        section: sectionOf(e),
        tag: e.tagName.toLowerCase(),
        // The end of the work: the last item of the work's list.
        lastOfList: Boolean(e.parentElement?.matches("ul, ol") && e.parentElement.closest("[data-section=work]") && e === e.parentElement.lastElementChild),
        // The end of the page: after the last section, before the footer.
        afterSections: e.parentElement === root && !e.nextElementSibling?.matches("[data-slot=section]") && e.nextElementSibling?.tagName === "FOOTER" && e.previousElementSibling?.matches("[data-slot=section], header, div") === true,
      })),
      tools: of("tools").map((e) => ({ where: e.dataset.where!, place: e.parentElement?.hasAttribute("data-intro") ? "intro" : e.parentElement?.getAttribute("data-section") })),
      lineTools: of("line-tools").map((e) => ({ path: e.dataset.path!, kind: e.dataset.kind!, count: Number(e.dataset.count), max: Number(e.dataset.max), afterList: Boolean(e.parentElement?.matches(`[data-lines-box="${e.dataset.kind}"]`) && e.previousElementSibling?.tagName === "DL" && !e.nextElementSibling) })),
      photos: of("photo").map((e) => e.querySelectorAll("[data-avatar]").length),
      // Every link on the page (the top bar's, the cards' and rows', the band's button, Get in touch's, the footer's): none may be followed while editing.
      liveLinks: [...root.querySelectorAll("a[href]")].filter((a) => !a.closest("[inert]")).map((a) => a.getAttribute("href")),
      links: root.querySelectorAll("a[href]").length,
    };
  });
}

/* ---------------- Box for box ---------------- */

type Box = [key: string, x?: number, y?: number, w?: number, h?: number];

/**
 * The box of every element in the page, relative to its root, to the half pixel, keyed by its place in
 * the page with the stand-in's marks taken out: a `display: contents` mark is replaced by what it holds,
 * and a mark that takes no room (`hidden`) is left out. The wrapper the editing page draws round a list of
 * lines and its controls (`[data-lines-box]`, LinesEditing in PortfolioHome; 0031) is replaced by what it
 * holds too, so the list in it is compared with the visitor's list, which has no wrapper. `inside` is an
 * element whose own box is compared and whose insides are not.
 */
function measure(page: Page, inside: string | null): Promise<{ boxes: Box[]; widthFree: string[] }> {
  return page.locator(HOME).evaluate((root, inside) => {
    const r0 = root.getBoundingClientRect();
    const half = (v: number) => Math.round(v * 2) / 2;
    const out: [string, number?, number?, number?, number?][] = [];
    const widthFree: string[] = [];
    const notInside = inside ? root.querySelector(inside) : null;
    const kids = (el: Element): Element[] =>
      [...el.children].flatMap((c) => (c.hasAttribute("data-slot") ? ((c as HTMLElement).hidden ? [] : kids(c)) : c.hasAttribute("data-lines-box") ? kids(c) : [c]));
    const walk = (el: Element, key: string) =>
      kids(el).forEach((c, i) => {
        const k = `${key} > ${c.tagName.toLowerCase()}:${i}`;
        if (c.hasAttribute("data-width-free")) widthFree.push(k);
        if (c.getClientRects().length === 0) out.push([k]);
        else {
          const r = c.getBoundingClientRect();
          out.push([k, half(r.x - r0.x), half(r.y - r0.y), half(r.width), half(r.height)]);
        }
        if (c !== notInside) walk(c, k);
      });
    walk(root, "home");
    return { boxes: out, widthFree };
  }, inside);
}

/** Each box that differs by more than half a pixel; for a key in `widthFree`, its width is not compared. */
function differences(want: Box[], got: Box[], widthFree: string[] = []): string[] {
  const off: string[] = [];
  const at = new Map(got.map((b) => [b[0], b]));
  for (const b of want) {
    const g = at.get(b[0]);
    const free = widthFree.includes(b[0]);
    if (!g) off.push(`${b[0]} is missing`);
    else if (g.length !== b.length || b.slice(1).some((v, i) => !(free && i === 2) && Math.abs((v as number) - (g[i + 1] as number)) > 0.5)) off.push(`${b[0]} ${JSON.stringify(b.slice(1))} is ${JSON.stringify(g.slice(1))}`);
  }
  for (const g of got) if (!want.some((b) => b[0] === g[0])) off.push(`${g[0]} is extra`);
  return off;
}

/**
 * On the editing page, takes out each part on 0031's list of what takes room in the editor only, and says
 * which: an empty word section drawn whole, the vision, an empty More of my work (each a section the
 * visitor's page leaves out), and each placeholder with the part it sits in. Taken out of the document,
 * not hidden, so the rules that read a part's neighbours (the hairline between rows, `* + *`) read what
 * the visitor's page has. Anything else drawn only in the editor is returned as unknown.
 */
function takeOutNamed(page: Page, visitorSections: string[]) {
  return page.locator(HOME).evaluate((root, visitorSections) => {
    const named: string[] = [];
    const unknown: string[] = [];
    const out: Element[] = [];
    const hide = (el: Element, why: string) => {
      el.setAttribute("data-hide", "");
      out.push(el);
      named.push(why);
    };
    for (const m of root.querySelectorAll<HTMLElement>("[data-slot=section]")) {
      const key = m.dataset.key!;
      if (visitorSections.includes(key)) continue;
      if (key === "featured" && m.querySelector("[data-slot=owner][data-where=band]")) hide(m, "the vision");
      else if (key === "work" && !m.querySelector("[data-slot=tile]")) hide(m, "an empty More of my work");
      else if (["about", "experience", "quote", "contact"].includes(key)) hide(m, `an empty ${key} drawn whole`);
      else unknown.push(`the ${key} section`);
    }
    for (const f of root.querySelectorAll<HTMLElement>("[data-slot=text][data-empty], [data-slot=paras][data-empty]")) {
      if (f.closest("[data-hide]")) continue;
      const path = f.dataset.path!;
      const part = f.dataset.part;
      const parent = f.parentElement!;
      const where = `${path}${part ? ` (${part})` : ""}`;
      // The part each placeholder sits in, which the visitor's page leaves out while it has no words.
      const target =
        path === "profile.headline" || path === "profile.bio"
          ? parent // the headline's <p>; the intro
          : path === "profile.location" || path === "profile.lookingFor"
            ? parent.matches("dt, dd")
              ? parent.parentElement // a row of Notebook's facts or Ledger's rows
              : parent // its half of the line under the intro
            : path === "arrangement.tiles.about.text"
              ? f // About's paragraph
              : path === "arrangement.tiles.education.tools"
                ? parent.parentElement // the Tools row
                : /\.lines\.\d+$/.test(path) && part === "label"
                  ? parent.parentElement // an empty line: the visitor's page leaves it out
                  : /\.lines\.\d+$/.test(path) && part === "year"
                    ? f // a line with no year: the visitor's page draws its year cell empty
                    : null;
      if (target) hide(target, `the placeholder of ${where}`);
      else unknown.push(`the placeholder of ${where}`);
    }
    // What they're looking for, as stored: the visitor's page prints it after "Looking for" with its first
    // letter lowered (and any "Looking for" of its own taken off), so the part it sits in may be a letter's
    // width wider or narrower. Its width alone is let go, where the words differ; its height and place are not.
    for (const f of root.querySelectorAll<HTMLElement>('[data-slot=text][data-path="profile.lookingFor"]:not([data-empty])')) {
      const stored = f.textContent ?? "";
      const t = stored.trim().replace(/^looking for\s+/i, "");
      const printed = /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
      const inLine = f.parentElement!.matches("[data-looking-for], dt");
      if (inLine && printed !== stored) {
        f.parentElement!.setAttribute("data-width-free", "");
        named.push("the width of Looking for's words, as stored");
      }
    }
    // The line under the intro, when both of its halves are placeholders, is left out whole; so is a
    // list of facts whose every row is a placeholder.
    for (const p of root.querySelectorAll("header p, header dl")) {
      const kids = [...p.children];
      if (kids.length > 0 && kids.every((k) => k.hasAttribute("data-hide"))) hide(p, p.tagName === "P" ? "the line under the intro, both halves empty" : "the facts, every row empty");
    }
    for (const el of out) el.remove();
    return { named, unknown };
  }, visitorSections);
}

/* ---------------- The tests ---------------- */

const SIZES = [
  [1440, 900],
  [412, 915],
] as const;

/** The page's boxes at each width: measured at 1440, then the window narrowed (the page lays itself out by its width alone, with container queries). */
async function measureBoth(page: Page, inside: string | null) {
  const out: Record<number, { boxes: Box[]; widthFree: string[] }> = {};
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await settle(page);
    out[width] = await measure(page, inside);
  }
  return out;
}

for (const look of BASE_LOOKS) {
  const theme = themeById(look)!;
  const studio = theme.treatment.hero === "block";
  const rows = theme.treatment.work !== "cards";

  test.describe(look, () => {
    for (const run of RUNS) {
      test(`${run.name}: every slot where 0031 puts it, and box for box at 1440 and 412 but for what 0031 lists`, async ({ page, request }) => {
        const f = FIXTURES[run.fixture];
        const w = want(f, run.case, await seed(request, f));
        // Studio's name is one field while it is typed (0031's sixth difference): what is inside its <h1>
        // differs (one field, not a <span> per word); the <h1>'s own box, and everything round it, may not.
        const inside = studio ? "header h1" : null;

        // The visitor's page: the same harness, the same data, no adapter.
        await page.setViewportSize({ width: 1440, height: 900 });
        await go(page, harness(f.username, look, run.case, true));
        await settle(page);
        const visitorSections = await page.locator(`${HOME} [data-section]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section")!));
        const visitor = await measureBoth(page, inside);

        await page.setViewportSize({ width: 1440, height: 900 });
        await go(page, harness(f.username, look, run.case));
        await settle(page);
        const got = await readSlots(page);

        // The fields, each once (a line's two halves once each), with its name, none inside anything inert.
        const fields = fieldsOf(w);
        expect.soft(got.fields.map(fieldKey).sort(), "the fields, each once").toEqual(fields.map(fieldKey).sort());
        for (const x of fields) expect.soft(got.fields.find((g) => fieldKey(g) === fieldKey(x))?.label, `${fieldKey(x)}: its name`).toBe(x.label);
        expect.soft(got.fields.filter((g) => g.inert).map(fieldKey), "fields inside something inert").toEqual([]);
        expect.soft(got.photos, "the photo, once, round the face").toEqual([1]);
        // The top bar, the footer and every link inside the sections are inert, so a click reaches the editor.
        expect.soft(got.links, "the page's links").toBeGreaterThan(0);
        expect.soft(got.liveLinks, "links that are not inert while editing").toEqual([]);

        // A frame per section, in order, each holding its section: every one is drawn, empty or not.
        expect.soft(got.sections, "a frame per section").toEqual(w.sections.map((key, index) => ({ key, index, count: w.sections.length, drawn: true })));

        // A frame per exhbt: the band's, then each card or row in order, inside its <li>.
        const where = rows ? "row" : "card";
        expect.soft(got.tiles, "a frame per exhbt").toEqual([
          ...(w.band ? [{ id: w.band, where: "band", index: 0, count: 1, section: "featured", inCard: null }] : []),
          ...w.cards.map((id, index) => ({ id, where, index, count: w.cards.length, section: "work", inCard: id })),
        ]);

        // The owner's places, and nowhere else.
        const owner = [
          ...(w.sections.includes("featured") && w.band === null ? [{ where: "band", section: "featured", tag: "div", lastOfList: false, afterSections: false }] : []),
          ...(w.sections.includes("work") ? [{ where: "work-end", section: "work", tag: "li", lastOfList: true, afterSections: false }] : []),
          ...(!w.sections.includes("work") ? [{ where: "page-end", section: null, tag: "div", lastOfList: false, afterSections: true }] : []),
        ];
        expect.soft(got.owner, "the owner's places").toEqual(owner);

        // The corner tools: the intro's always, Get in touch's with it. The lines' controls right after each
        // list's </dl>, last in the wrapper round the two: a <dl> holds only its lines (0031).
        expect.soft(got.tools, "the corner tools").toEqual([{ where: "intro", place: "intro" }, ...(w.sections.includes("contact") ? [{ where: "contact", place: "contact" }] : [])]);
        const lists = (["education", "experience"] as const)
          .filter((k) => w.sections.includes(k === "education" ? "about" : "experience"))
          .sort((a, b) => w.sections.indexOf(a === "education" ? "about" : "experience") - w.sections.indexOf(b === "education" ? "about" : "experience"))
          .map((kind) => ({ path: `arrangement.tiles.${kind}.lines`, kind, count: w.tiles[kind]?.lines.length ?? 0, max: 3, afterList: true }));
        expect.soft(got.lineTools, "the lines' controls").toEqual(lists);

        // Box for box: with each part on 0031's list taken out by name, nothing else differs at either width.
        const { named, unknown } = await takeOutNamed(page, visitorSections);
        expect(unknown, "drawn only in the editor and not on 0031's list").toEqual([]);
        const editing = await measureBoth(page, inside);
        for (const [width] of SIZES)
          expect.soft(differences(visitor[width]!.boxes, editing[width]!.boxes, editing[width]!.widthFree), `at ${width}, with ${named.length ? named.join("; ") : "nothing"} taken out`).toEqual([]);
      });
    }
  });
}

/* ---------------- The harness's visitor page is the public page ---------------- */

/** The ids React makes (useId), by order of first appearance, so two pages with a different tree above can be compared. */
function normaliseIds(html: string): string {
  const seen: string[] = [];
  for (const m of html.matchAll(/«[^»"\s]+»|(?<=["\s]):[rR][0-9a-zA-Z]*:(?=["\s])|(?<=["\s])_[rR]_[0-9a-zA-Z]+_(?=["\s])/g)) if (!seen.includes(m[0])) seen.push(m[0]);
  return seen.reduce((out, v, i) => out.split(v).join(`useid-${i + 1}`), html);
}

test("the harness's visitor page is the public page, markup for markup", async ({ page, request }) => {
  for (const f of Object.values(FIXTURES)) {
    await seed(request, f);
    await go(page, `/p/${f.username}`);
    await settle(page);
    const visitor = normaliseIds(await page.locator(HOME).evaluate((el) => el.outerHTML));
    await go(page, `/dev/home-slots?u=${f.username}&read=1`);
    await settle(page);
    expect(normaliseIds(await page.locator(HOME).evaluate((el) => el.outerHTML)), f.username).toBe(visitor);
  }
});

/* ---------------- joinYear ---------------- */

test.describe("joinYear", () => {
  const YEARS = ["2024", "2021–2024", "2021-2024", "2023 to now", "2023 to present"];
  const LABELS = ["BSc Business Analytics, University of Sheffield", "Shift supervisor", "A levels: Maths, Economics, Geography", "Summer analyst intern — Sheffield City Council"];

  test("splitYear reads back the words and the year it was given", () => {
    for (const label of LABELS) for (const year of YEARS) expect(splitYear(joinYear(label, year)), `${label} + ${year}`).toEqual({ label, year });
  });

  test("with no year, the words alone, and splitYear reads no year", () => {
    for (const label of LABELS) {
      expect(joinYear(label, null)).toBe(label);
      expect(joinYear(label, "")).toBe(label);
      expect(joinYear(`  ${label}  `, "   ")).toBe(label);
      expect(splitYear(joinYear(label, null))).toEqual({ label, year: null });
    }
  });

  test("the words and the year are trimmed", () => {
    expect(joinYear("  Shift supervisor ", " 2024 ")).toBe("Shift supervisor, 2024");
  });

  test("a stored line written as label, year comes back as it was", () => {
    for (const line of ["BSc Business Analytics, University of Sheffield, 2023 to now", "Foundation year, Sheffield College, 2022–2023", "Weekend retail assistant, 2021–2023"]) {
      const { label, year } = splitYear(line);
      expect(joinYear(label, year)).toBe(line);
    }
  });

  test("a year with no words is the year alone, which splitYear reads as words", () => {
    // splitYear needs words before a year to read it as one; the editor's year field never stands alone on a stored line.
    expect(joinYear("", "2024")).toBe("2024");
    expect(splitYear("2024")).toEqual({ label: "2024", year: null });
  });
});
