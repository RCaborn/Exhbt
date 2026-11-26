import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./editor-test";
import { LIMITS, SCHEMA_VERSION, suggestionsFor, text, validateForPublish, type ContentSection, type ExhbtDoc, type RichText, type Section } from "../lib/exhbt/blocks";
import { FORMAT_COPY, type Format } from "../lib/exhbt/formats";
import { fullDoc } from "../lib/exhbt/sample";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { chooseLayout, openAddSectionMenu, publish, publishSheet, removeSection, reviewButton, thingsButton } from "./editor";
import { READY, boxes, chooseAll, differences, docNow, field, frame, freshName, holdRichEditor, offered, openDoc, openTiming, readStored, sampleDoc, seeAsVisitor, settle, typeIn, waitLive, waitReady, waitSaved } from "./page-editor";

/*
 * "Write it your way" (decision 0032; Rory, 26 Nov 2026): bold and italic in a quote, a pull quote and a link's
 * description, with the buttons at the words selected; a title typed over each part; and nothing that has to be
 * filled in. The rules themselves are tested in-process (your-way-model.spec.ts), and a doc this code saves is read
 * by the live build's reader in step-back.spec.ts. This is the browser's side: the editor, the visitor's page, print.
 *
 * Each test seeds its own exhbt with POST /dev/parity (openDoc), for a fresh user.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const FLOW = { id: "flow", kind: "flow" } as const;
const QUOTE = "Lunch is calmer now, and the queue is out of the doorway.";
const findings = (): ContentSection => ({ id: "findings", kind: "findings", items: [text("Waits fell from 11 minutes to 4."), text("Sales at lunch rose by 9%.")] });
const quote = (extra: Partial<Extract<ContentSection, { kind: "quote" }>> = {}): ContentSection => ({ id: "quote-1", kind: "quote", text: QUOTE, name: "Priya Shah", role: "Cafe manager", ...extra });
const next = (): ContentSection => ({ id: "reflection-1", kind: "reflection", text: text("Time the evening queue too, to see if a second till pays off then.") });
const link = (extra: Partial<Extract<ContentSection, { kind: "link" }>> = {}): ContentSection => ({ id: "link-1", kind: "link", href: "https://example.com/queue-data", label: "The timings, as a spreadsheet", description: "Two weeks of lunchtimes, a row a minute", ...extra });
const pull = (extra: Partial<Extract<ContentSection, { kind: "pullquote" }>> = {}): ContentSection => ({ id: "pullquote-1", kind: "pullquote", text: "A queue is a price nobody set.", ...extra });

const doc = (sections: Section[], format?: Format, extra: Partial<ExhbtDoc> = {}): ExhbtDoc => ({
  schemaVersion: SCHEMA_VERSION,
  ...(format && format !== "case-study" ? { format } : {}),
  title: "Will a second till cut the lunchtime queue?",
  context: "BSc Business, Year 2 module",
  skills: ["Excel"],
  gap: text("Queues ran to eleven minutes at lunch."),
  flow: [{ step: "Timed the queue" }, { step: "Added a second till" }, { step: "Timed it again" }],
  sections,
  ...extra,
});
const caseStudy = () => doc([FLOW, findings(), quote(), next(), link()]);
const essay = () => doc([FLOW, findings(), pull(), quote(), next(), link()], "essay");

const at = async (page: Page, kind: Section["kind"]) => (await docNow(page)).sections.findIndex((s) => s.kind === kind);
const section = async <K extends ContentSection["kind"]>(page: Page, kind: K) => (await docNow(page)).sections.find((s) => s.kind === kind) as Extract<ContentSection, { kind: K }>;
const scan = async (page: Page) => (await new AxeBuilder({ page }).include('[data-editor="page"]').withTags(WCAG).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
const pagesOf = async (page: Page) => {
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  return pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
};

/** Puts the cursor in a formatted field and selects `count` characters from the `from`th, with the keyboard. */
async function select(page: Page, path: string, from: number, count: number) {
  // Every formatted field's editor has started (they start one at a time in idle moments), so the keys below meet the editor itself.
  await waitLive(page);
  const f = field(page, path);
  await f.scrollIntoViewIfNeeded();
  await f.click();
  await expect(f.locator(".ProseMirror")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+Home");
  for (let i = 0; i < from; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < count; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => page.evaluate(() => getSelection()?.toString().length ?? 0)).toBe(count);
  // The editor hears of a selection a moment after the browser makes it: by two frames on, it has.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/** The bar that comes to the words selected in a formatted field (fields/SelectionBar.tsx). */
const barOf = (page: Page, path: string) => field(page, path).locator(".xe-selbar");
/** How far the bar is from the words selected, and whether it is over or under them. */
const barGap = (page: Page) =>
  page.evaluate(() => {
    const words = getSelection()!.getRangeAt(0).getBoundingClientRect();
    const bar = document.querySelector(".xe-selbar")!.getBoundingClientRect();
    return { over: words.top - bar.bottom, under: bar.top - words.bottom, across: Math.min(words.right, bar.right) - Math.max(words.left, bar.left) };
  });

test.describe("Bold and italic at the words selected", () => {
  test("in a quote: Bold and Italic come to the words, no Link; Bold is stored beside the plain words, and the same button takes it off", async ({ page }) => {
    await openDoc(page, freshName("ywq"), caseStudy());
    const path = `sections.${await at(page, "quote")}.text`;
    await select(page, path, "Lunch is ".length, "calmer now".length);
    const bar = barOf(page, path);
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Bold", exact: true })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Italic", exact: true })).toBeVisible();
    // A quote's neighbours (who said it, their role) take no links, so neither does the quote.
    await expect(bar.getByRole("button", { name: /link/i })).toHaveCount(0);
    // It is the one set of formatting buttons while it is up: the field's own, at the end of its line, are not shown.
    await expect(field(page, path).getByRole("button", { name: "Bold", exact: true })).toHaveCount(1);
    // Close to the words: just over them, or just under where there is no room over them, and across them.
    const gap = await barGap(page);
    expect(Math.max(gap.over, gap.under)).toBeGreaterThanOrEqual(0);
    expect(Math.max(gap.over, gap.under)).toBeLessThanOrEqual(12);
    expect(gap.across).toBeGreaterThan(0);

    await bar.getByRole("button", { name: "Bold", exact: true }).click();
    await expect(bar.getByRole("button", { name: "Bold", exact: true })).toHaveAttribute("aria-pressed", "true");
    // The plain words are what they were (the word count, the number check and an older build read them); the runs sit beside them.
    expect(await section(page, "quote")).toMatchObject({ text: QUOTE, textRuns: [{ t: "Lunch is " }, { t: "calmer now", b: true }, { t: ", and the queue is out of the doorway." }] });
    // The cursor never left the words, and the bar is still at them.
    await expect(field(page, path).locator(".ProseMirror")).toBeFocused();
    await expect(bar).toBeVisible();

    await bar.getByRole("button", { name: "Bold", exact: true }).click();
    await expect(bar.getByRole("button", { name: "Bold", exact: true })).toHaveAttribute("aria-pressed", "false");
    const plainAgain = await section(page, "quote");
    expect(plainAgain.text).toBe(QUOTE);
    expect(plainAgain).not.toHaveProperty("textRuns");
    // Escape gives the bar up and keeps the cursor in the words; with nothing selected there is no bar.
    await page.keyboard.press("ArrowRight");
    await expect(bar).toHaveCount(0);
  });

  test("Control or Command with B and I work in a quote, a pull quote, a link's description and a field that had them already", async ({ page }) => {
    await openDoc(page, freshName("ywk"), essay());
    const cases: [kind: "quote" | "pullquote" | "link" | "reflection", key: "text" | "description", runs: "textRuns" | "descriptionRuns" | "text"][] = [
      ["quote", "text", "textRuns"],
      ["pullquote", "text", "textRuns"],
      ["link", "description", "descriptionRuns"],
      ["reflection", "text", "text"],
    ];
    for (const [kind, key, runs] of cases) {
      const path = `sections.${await at(page, kind)}.${key}`;
      const stored = async () => ((await section(page, kind)) as unknown as Record<string, RichText | string | undefined>)[runs];
      await select(page, path, 0, 4);
      await page.keyboard.press("ControlOrMeta+b");
      await expect.poll(stored, `${kind}: bold`).toMatchObject([{ b: true }, {}]);
      await page.keyboard.press("ControlOrMeta+i");
      await expect.poll(stored, `${kind}: bold and italic`).toMatchObject([{ b: true, i: true }, {}]);
      const first = ((await stored()) as RichText)[0]!;
      expect(first.t, kind).toHaveLength(4);
      // The same keys take them off again.
      await page.keyboard.press("ControlOrMeta+b");
      await page.keyboard.press("ControlOrMeta+i");
      if (runs === "text") await expect.poll(async () => ((await stored()) as RichText).some((r) => r.b || r.i), kind).toBe(false);
      else await expect.poll(stored, `${kind}: plain again`).toBeUndefined();
    }
    // Only the link's description: its label stays plain, and the description takes no link (its section is the link).
    const li = await at(page, "link");
    await select(page, `sections.${li}.description`, 0, 4);
    await expect(barOf(page, `sections.${li}.description`).getByRole("button", { name: "Bold", exact: true })).toBeVisible();
    await expect(barOf(page, `sections.${li}.description`).getByRole("button", { name: /link/i })).toHaveCount(0);
  });

  test("the bar comes for words chosen with the mouse too, and nothing on the page moves when it comes or goes", async ({ page }) => {
    await openDoc(page, freshName("ywm"), caseStudy());
    await settle(page);
    const path = `sections.${await at(page, "quote")}.text`;
    const rest = await boxes(page, { frames: true });
    const f = field(page, path);
    await f.scrollIntoViewIfNeeded();
    const here = (await f.boundingBox())!;
    // A double press on a word in the middle of the line chooses it.
    await page.mouse.dblclick(here.x + here.width / 3, here.y + here.height / 2);
    await expect(barOf(page, path)).toBeVisible();
    expect(await page.evaluate(() => getSelection()!.toString().trim().length)).toBeGreaterThan(0);
    expect(differences(rest, await boxes(page, { frames: true }))).toEqual([]);
    // It takes no room in the page: it is in the browser's top layer, placed by its own corner.
    expect(await barOf(page, path).evaluate((el) => getComputedStyle(el.parentElement!).position)).toBe("fixed");
    await barOf(page, path).getByRole("button", { name: "Italic", exact: true }).click();
    expect((await section(page, "quote")).textRuns?.some((r) => r.i)).toBe(true);
    expect(differences(rest, await boxes(page, { frames: true }))).toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowLeft");
    await expect(barOf(page, path)).toHaveCount(0);
    expect(differences(rest, await boxes(page, { frames: true }))).toEqual([]);
  });

  test("a field that takes no formatting shows nothing: the title, a section's title, who said a quote, a link's label", async ({ page }) => {
    await openDoc(page, freshName("ywp"), caseStudy());
    const qi = await at(page, "quote");
    const li = await at(page, "link");
    for (const path of ["title", `sections.${qi}.title`, `sections.${qi}.name`, `sections.${li}.label`]) {
      const f = field(page, path);
      await f.scrollIntoViewIfNeeded();
      await f.click();
      await chooseAll(page);
      expect(await page.evaluate(() => (document.activeElement as HTMLTextAreaElement).selectionEnd ?? getSelection()!.toString().length), path).toBeGreaterThan(0);
      await expect(page.locator(`${READY} .xe-selbar`), path).toHaveCount(0);
      await expect(page.locator(`${READY}`).getByRole("toolbar", { name: "Formatting" }), path).toHaveCount(0);
      // The keys do nothing there either.
      const before = JSON.stringify(await docNow(page));
      await page.keyboard.press("ControlOrMeta+b");
      expect(JSON.stringify(await docNow(page)), path).toBe(before);
    }
  });

  test("in a finding the bar has Link: the address is typed at the words, only https is taken, and the same place takes the link off", async ({ page }) => {
    await openDoc(page, freshName("ywl"), caseStudy());
    const fi = await at(page, "findings");
    const path = `sections.${fi}.items.1`;
    const item = async () => (await section(page, "findings")).items[1]!;
    await select(page, path, 0, 5);
    const bar = barOf(page, path);
    await bar.getByRole("button", { name: "Link", exact: true }).click();
    const address = bar.getByRole("textbox", { name: "Link address (starting https://)" });
    await expect(address).toBeFocused();
    await page.keyboard.type("example.com/sales");
    await page.keyboard.press("Enter");
    await expect(bar.getByRole("alert")).toHaveText("Links must start with https://.");
    expect((await item()).some((r) => r.href)).toBe(false);
    await address.fill("https://example.com/sales");
    await page.keyboard.press("Enter");
    await expect.poll(item).toMatchObject([{ t: "Sales", href: "https://example.com/sales" }, {}]);
    // The cursor is back in the words, with the bar at them, and the link can be taken off there.
    await expect(field(page, path).locator(".ProseMirror")).toBeFocused();
    await bar.getByRole("button", { name: "Remove link", exact: true }).click();
    await expect.poll(async () => (await item()).some((r) => r.href)).toBe(false);
    // Escape leaves the address field without making a link.
    await bar.getByRole("button", { name: "Link", exact: true }).click();
    await expect(address).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(field(page, path).locator(".ProseMirror")).toBeFocused();
    expect((await item()).some((r) => r.href)).toBe(false);
  });

  test("the bar keeps off the editor's own controls: at the end of a finding's line it goes under the words", async ({ page }) => {
    // A long last word at the right end of the first finding's line, under the section's own buttons.
    const d = caseStudy();
    await openDoc(page, freshName("ywc"), d);
    const fi = await at(page, "findings");
    const path = `sections.${fi}.items.0`;
    await field(page, path).click();
    await expect(field(page, path).locator(".ProseMirror")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+End");
    for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowLeft");
    await expect(barOf(page, path)).toBeVisible();
    const clash = await page.evaluate(() => {
      const bar = document.querySelector(".xe-selbar")!.getBoundingClientRect();
      const controls = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] :is(.xe-tools > *, .xe-list-tools > *, .xe-above > *, .xe-insert button)')].filter((el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
      return controls.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.left < bar.right && r.right > bar.left && r.top < bar.bottom && r.bottom > bar.top;
      }).length;
    });
    expect(clash).toBe(0);
  });

  test("a pull quote's and a quote's lines break where a visitor's do, before and after their editors take over", async ({ page }) => {
    // A pull quote's lines are balanced. A paragraph anywhere else on the site wraps another way, and the editor's own
    // paragraph took that: the lines broke again when the editor took over from the resting words, and ran under the
    // section's toolbar, which had been placed clear of them (seen on a tablet, where the toolbar is always shown).
    const long = doc([FLOW, findings(), pull({ text: "A reform meant to close a door became the first step through it, and nobody who wrote it saw that coming." }), quote({ text: `${QUOTE} Nobody stands in the corridor any more, and the staff take their breaks when they are due.` }), next()], "essay");
    const release = await holdRichEditor(page);
    await openDoc(page, freshName("yww"), long);
    await settle(page);
    /** The words of each line of the part's quote, as drawn now (the marks round a quote left out). */
    const lines = (part: string) =>
      page.evaluate((name) => {
        const article = [...document.querySelectorAll("article[data-exhbt-page]")].find((a) => a.getClientRects().length > 0)!;
        const quote = article.querySelector(`[data-part="${name}"] blockquote`)!;
        const walker = document.createTreeWalker(quote, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        const byTop = new Map<number, string[]>();
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          const el = t.parentElement!;
          if (el.closest("[data-edit-only], .xe-rich-pending") || getComputedStyle(el).visibility === "hidden") continue;
          for (const word of (t.textContent ?? "").matchAll(/[^\s“”]+/g)) {
            range.setStart(t, word.index);
            range.setEnd(t, word.index + word[0].length);
            const top = Math.round(range.getClientRects()[0]?.top ?? -1);
            byTop.set(top, [...(byTop.get(top) ?? []), word[0]]);
          }
        }
        return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, words]) => words.join(" "));
      }, part);
    const rest = { pullquote: await lines("pullquote"), quote: await lines("quote") };
    expect(rest.pullquote.length, "the pull quote runs to more than one line").toBeGreaterThan(1);
    expect(rest.quote.length, "the quote runs to more than one line").toBeGreaterThan(1);
    release();
    await waitLive(page);
    expect({ pullquote: await lines("pullquote"), quote: await lines("quote") }, "once the editors are live").toEqual(rest);
    await seeAsVisitor(page, true);
    await settle(page);
    expect({ pullquote: await lines("pullquote"), quote: await lines("quote") }, "for a visitor").toEqual(rest);
  });

  test("with the new controls up, the editing page passes axe", async ({ page }) => {
    await openDoc(page, freshName("ywa"), caseStudy());
    const qi = await at(page, "quote");
    await select(page, `sections.${qi}.text`, 0, 5);
    await expect(barOf(page, `sections.${qi}.text`)).toBeVisible();
    expect(await scan(page)).toEqual([]);
    // A link being asked for.
    const fi = await at(page, "findings");
    await select(page, `sections.${fi}.items.0`, 0, 5);
    await barOf(page, `sections.${fi}.items.0`).getByRole("button", { name: "Link", exact: true }).click();
    await page.keyboard.type("nope");
    await page.keyboard.press("Enter");
    await expect(barOf(page, `sections.${fi}.items.0`).getByRole("alert")).toBeVisible();
    expect(await scan(page)).toEqual([]);
    await page.keyboard.press("Escape");
    // A cleared title, and the way in to a flowchart's.
    await typeIn(page, `sections.${qi}.title`, "");
    await frame(page, "flow").hover();
    await expect(page.getByRole("button", { name: "Flowchart: add a title" })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
});

test.describe("What a visitor sees of the formatting, on the page and in print", () => {
  const BOLD: RichText = [{ t: "Lunch is " }, { t: "calmer now", b: true }, { t: ", and the queue is out of the doorway." }];
  const SLANTED: RichText = [{ t: "A queue is a price " }, { t: "nobody set", i: true, b: true }, { t: "." }];
  const LINE: RichText = [{ t: "Two weeks", b: true }, { t: " of lunchtimes, a row a minute" }];
  const formatted = () => doc([FLOW, findings(), pull({ textRuns: SLANTED }), quote({ textRuns: BOLD }), next(), link({ descriptionRuns: LINE })], "essay");

  test("bold and italic are drawn in the quote, the pull quote and the link's description, and print keeps them", async ({ page }) => {
    const out = await openDoc(page, freshName("ywv"), formatted());
    await page.goto(out.url);
    const art = page.locator("article[data-exhbt-page]");
    for (const media of ["screen", "print"] as const) {
      await page.emulateMedia({ media });
      await expect(art.locator('[data-part="quote"] strong'), media).toHaveText("calmer now");
      await expect(art.locator('[data-part="quote"] blockquote'), media).toHaveText(`“${QUOTE}”`);
      await expect(art.locator('[data-part="pullquote"] strong em'), media).toHaveText("nobody set");
      await expect(art.locator('[data-part="pullquote"] blockquote'), media).toHaveText("“A queue is a price nobody set.”");
      await expect(art.locator('[data-part="references"] strong, [data-part="link"] strong').first(), media).toHaveText("Two weeks");
      // Bold is heavier than the words round it: in the pull quote too, which is set in the look's heavy display face already.
      for (const part of ["quote", "pullquote"]) {
        const [bold, round] = await art.locator(`[data-part="${part}"] strong`).evaluate((el) => [Number(getComputedStyle(el).fontWeight), Number(getComputedStyle(el.closest("blockquote")!).fontWeight)]);
        expect(bold, `${media} ${part}`).toBeGreaterThan(round!);
      }
      expect(await art.locator('[data-part="pullquote"] em').evaluate((el) => getComputedStyle(el).fontStyle), media).toBe("italic");
    }
    await page.emulateMedia({ media: "screen" });
    expect(await pagesOf(page)).toBe(1);
  });
});

test.describe("A part's title, typed in place", () => {
  test("a title is typed over a section, kept through a reload and a layout switch; one left alone follows the layout", async ({ page }) => {
    const { id } = await openDoc(page, freshName("ywt"), caseStudy());
    const fi = await at(page, "findings");
    const qi = await at(page, "quote");
    // Until it is changed the layout's own heading shows, as words in the field.
    await expect(field(page, `sections.${fi}.title`)).toHaveValue(FORMAT_COPY["case-study"].findings);
    await expect(field(page, `sections.${qi}.title`)).toHaveValue(FORMAT_COPY["case-study"].quote);
    expect(await section(page, "findings")).not.toHaveProperty("title");

    await typeIn(page, `sections.${fi}.title`, "Results, in short");
    expect((await section(page, "findings")).title).toBe("Results, in short");
    // It is the section's heading, in the heading's own element, for the editor and for a visitor.
    await expect(page.locator(`${READY} article`).getByRole("heading", { name: "Results, in short: title" }).or(page.locator(`${READY} article [data-title] [data-path="sections.${fi}.title"]`))).toHaveCount(1);
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.sections[fi]).toMatchObject({ title: "Results, in short" });

    await page.reload();
    await waitReady(page);
    await expect(field(page, `sections.${fi}.title`)).toHaveValue("Results, in short");

    // Another layout: the typed title stays, and the quote's, never touched, takes the new layout's words where they differ.
    await chooseLayout(page, "Research");
    await expect.poll(async () => (await docNow(page)).format).toBe("research");
    const fr = await at(page, "findings");
    await expect(field(page, `sections.${fr}.title`)).toHaveValue("Results, in short");
    const nr = await at(page, "reflection");
    await expect(field(page, `sections.${nr}.title`)).toHaveValue(FORMAT_COPY.research.reflection);
    expect(FORMAT_COPY.research.reflection).not.toBe(FORMAT_COPY["case-study"].reflection);
    expect(await section(page, "reflection")).not.toHaveProperty("title");
    // A visitor's page draws both.
    await seeAsVisitor(page, true);
    const preview = page.locator(`${READY} section[aria-label="Preview"] article`);
    await expect(preview.getByRole("heading", { name: "Results, in short", exact: true })).toBeVisible();
    await expect(preview.getByRole("heading", { name: FORMAT_COPY.research.reflection, exact: true })).toBeVisible();
  });

  test("cleared, a title is not drawn for a visitor and the editor keeps a faint Add a title; the layout's own words bring the layout's heading back", async ({ page }) => {
    await openDoc(page, freshName("ywx"), caseStudy());
    const qi = await at(page, "quote");
    const path = `sections.${qi}.title`;
    await typeIn(page, path, "");
    expect((await section(page, "quote")).title).toBe("");
    await expect(field(page, path)).toHaveValue("");
    await expect(field(page, path)).toHaveAttribute("placeholder", "Add a title");
    // Fainter than a title: most titles are set in the page's muted colour, and the placeholder must not pass for one.
    const [faint, label] = await field(page, path).evaluate((el) => [getComputedStyle(el, "::placeholder").color, getComputedStyle(el).color]);
    expect(faint).not.toBe(label);

    await page.locator(`${READY} .xp-title`).click();
    await seeAsVisitor(page, true);
    const preview = page.locator(`${READY} section[aria-label="Preview"] article`);
    await expect(preview.locator('[data-part="quote"]')).toBeVisible();
    await expect(preview.locator('[data-part="quote"]').getByRole("heading")).toHaveCount(0);
    // With no heading to name it, the part keeps a name for a screen reader.
    await expect(preview.locator('[data-part="quote"]')).toHaveAttribute("aria-label", FORMAT_COPY["case-study"].quote);
    await seeAsVisitor(page, false);

    // The layout's own words again: nothing is stored, so the heading follows the layout once more.
    await typeIn(page, path, FORMAT_COPY["case-study"].quote);
    expect(await section(page, "quote")).not.toHaveProperty("title");
  });

  test("the aim's switch puts the layout's heading back over a typed title, as one step Undo takes back; the one already on changes nothing", async ({ page }) => {
    await openDoc(page, freshName("ywaim"), sampleDoc("research"));
    const i = await at(page, "aim");
    const id = (await docNow(page)).sections[i]!.id;
    await typeIn(page, `sections.${i}.title`, "What I set out to test");
    expect((await section(page, "aim")).title).toBe("What I set out to test");
    const chip = (name: string) => frame(page, id).getByRole("group", { name: "Aim or hypothesis" }).getByRole("button", { name, exact: true });
    await frame(page, id).hover();
    // The sample's is a hypothesis. The one already on: nothing changes, and there is nothing new to undo.
    expect(await section(page, "aim")).toMatchObject({ heading: "hypothesis" });
    const label = await page.evaluate(() => window.__exhbtEditor!.undoLabel());
    await chip("Hypothesis").click();
    expect((await section(page, "aim")).title).toBe("What I set out to test");
    expect(await page.evaluate(() => window.__exhbtEditor!.undoLabel())).toBe(label);
    // The other: the layout's heading again, the typed title gone, and Undo brings it back.
    await chip("Aim").click();
    expect(await section(page, "aim")).toMatchObject({ heading: "aim" });
    expect((await section(page, "aim")).title).toBeUndefined();
    expect(await page.evaluate(() => window.__exhbtEditor!.undoLabel())).toBe("switch to Aim");
    await page.evaluate(() => window.__exhbtEditor!.undo());
    expect((await section(page, "aim")).title).toBe("What I set out to test");
    expect(await section(page, "aim")).toMatchObject({ heading: "hypothesis" });
  });

  test("a case study's flowchart has no heading until one is added: a chip adds it, and an empty one goes again", async ({ page }) => {
    await openDoc(page, freshName("ywf"), caseStudy());
    await settle(page);
    const chip = page.getByRole("button", { name: "Flowchart: add a title" });
    await frame(page, "flow").hover();
    await expect(chip).toBeVisible();
    // The chip takes no room: the page is where it was before the pointer came.
    await expect(field(page, "flowTitle")).toHaveCount(0);
    await chip.click();
    await expect(field(page, "flowTitle")).toBeFocused();
    await page.keyboard.type("How I ran it");
    expect((await docNow(page)).flowTitle).toBe("How I ran it");
    await seeAsVisitor(page, true);
    await expect(page.locator(`${READY} section[aria-label="Preview"] article [data-part="process"]`).getByRole("heading", { name: "How I ran it", exact: true })).toBeVisible();
    await seeAsVisitor(page, false);
    // Emptied and left, it is no title at all, and the chip is the way back in.
    await typeIn(page, "flowTitle", "");
    await page.locator(`${READY} .xp-title`).click();
    await expect(field(page, "flowTitle")).toHaveCount(0);
    expect(await docNow(page)).not.toHaveProperty("flowTitle");
    await frame(page, "flow").hover();
    await expect(chip).toBeVisible();
  });

  test(`a title holds ${LIMITS.sectionTitleChars} characters and no more, on one line`, async ({ page }) => {
    await openDoc(page, freshName("ywn"), caseStudy());
    const fi = await at(page, "findings");
    const path = `sections.${fi}.title`;
    await typeIn(page, path, "x".repeat(LIMITS.sectionTitleChars + 10));
    await expect(field(page, path)).toHaveValue("x".repeat(LIMITS.sectionTitleChars));
    expect((await section(page, "findings")).title).toHaveLength(LIMITS.sectionTitleChars);
    // Enter adds no line.
    await page.keyboard.press("Enter");
    expect((await section(page, "findings")).title).not.toContain("\n");
    expect(validateForPublish(await docNow(page)).filter((i) => i.path.endsWith("title"))).toEqual([]);
  });

  // The limit is the most that stays on one line for a visitor on a phone (390px), in every layout and every look,
  // with words of more than usual width (m and w are a font's widest letters).
  const WIDE = "Summary of what we measured most months".slice(0, LIMITS.sectionTitleChars).trimEnd();
  for (const f of offered()) {
    test(`${f}: a title of the limit's length stays on one line at 390px, in every look`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(WIDE.length).toBeGreaterThanOrEqual(LIMITS.sectionTitleChars - 1);
      for (const look of PORTFOLIO_THEMES) {
        await openTiming(page, f, { full: true, look: look.id });
        await page.evaluate((title) => {
          window.__exhbtEditor!.patchDoc((d) => ({ ...d, flowTitle: title, refsTitle: title, sections: d.sections.map((s) => (s.kind === "findings" || s.kind === "quote" || s.kind === "reflection" || s.kind === "aim" || s.kind === "conclusion" ? { ...s, title } : s)) }));
        }, WIDE);
        await seeAsVisitor(page, true);
        await settle(page);
        const lines = await page.locator(`${READY} section[aria-label="Preview"] article`).evaluate((art, title) => {
          const out: string[] = [];
          let seen = 0;
          for (const h of art.querySelectorAll("h1, h2, h3, h4, h5")) {
            if (h.textContent !== title) continue;
            seen++;
            const range = document.createRange();
            range.selectNodeContents(h);
            const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
            if (tops.size > 1) out.push(`${h.id || h.className} wraps to ${tops.size} lines at ${Math.round(h.getBoundingClientRect().width)}px`);
          }
          return { seen, out };
        }, WIDE);
        expect(lines.seen, `${f} in ${look.id}: titles drawn`).toBeGreaterThan(0);
        expect(lines.out, `${f} in ${look.id}`).toEqual([]);
      }
    });
  }

  test("a title that is one long word breaks inside the page at 390px, on the editing page and the visitor's", async ({ page }) => {
    // From the review of 26 Nov: a hashtag or a name in capitals has no space to break at, and ran off a phone's screen.
    const WORD = "MENTALHEALTHAWARENESSWEEK".slice(0, LIMITS.sectionTitleChars);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTiming(page, "gallery", { full: true });
    await page.evaluate((title) => {
      window.__exhbtEditor!.patchDoc((d) => ({ ...d, flowTitle: title, refsTitle: title, sections: d.sections.map((s) => (s.kind === "findings" || s.kind === "quote" || s.kind === "reflection" ? { ...s, title } : s)) }));
    }, WORD);
    await settle(page);
    const outside = (where: string) =>
      page.evaluate(
        ({ where, word }) => {
          const width = document.documentElement.clientWidth;
          const out: string[] = [];
          const root = document.querySelector(where)!;
          for (const el of root.querySelectorAll<HTMLElement>("[data-title], h1, h2, h3, h4, h5")) {
            const words = el.querySelector<HTMLTextAreaElement>("textarea")?.value ?? el.textContent ?? "";
            if (words !== word) continue;
            const range = document.createRange();
            range.selectNodeContents(el.querySelector("textarea") ?? el);
            const right = Math.max(el.getBoundingClientRect().right, ...[...range.getClientRects()].map((r) => r.right));
            if (right > width + 0.5) out.push(`${el.id || el.tagName} reaches ${Math.round(right)}px of ${width}`);
          }
          if (document.documentElement.scrollWidth > width) out.push(`the page is ${document.documentElement.scrollWidth}px wide`);
          return out;
        },
        { where, word: WORD },
      );
    expect(await outside(`${READY} article`)).toEqual([]);
    await seeAsVisitor(page, true);
    await settle(page);
    expect(await outside(`${READY} section[aria-label="Preview"] article`)).toEqual([]);
  });

  test("a full page with a long title over every part still prints on one A4 page", async ({ page }) => {
    const title = "Summary of what we measured most months".slice(0, LIMITS.sectionTitleChars).trimEnd();
    const long: ExhbtDoc = { ...fullDoc, flowTitle: title, sections: fullDoc.sections.map((s) => (s.kind === "findings" || s.kind === "quote" || s.kind === "reflection" ? { ...s, title } : s)) };
    expect(validateForPublish(long)).toEqual([]);
    const out = await openDoc(page, freshName("ywg"), long);
    await page.goto(out.url);
    await expect(page.locator("article[data-exhbt-page]").getByRole("heading", { name: title, exact: true })).toHaveCount(4);
    expect(await pagesOf(page)).toBe(1);
  });
});

test.describe("Nothing has to be filled in", () => {
  /** A layout's sample, published, with a working copy that lacks one thing the layout usually has. */
  const lacking: Record<Format, (d: ExhbtDoc) => ExhbtDoc> = {
    "case-study": (d) => ({ ...d, sections: d.sections.filter((s) => s.kind !== "findings" && s.kind !== "graph") }),
    gallery: (d) => ({ ...d, sections: d.sections.filter((s, i, all) => s.kind !== "image" || all.findIndex((x) => x.kind === "image") === i) }),
    research: (d) => ({ ...d, sections: d.sections.filter((s) => s.kind !== "aim") }),
    build: (d) => ({ ...d, sections: d.sections.filter((s) => s.kind !== "image" && s.kind !== "link") }),
    essay: (d) => ({ ...d, sections: d.sections.filter((s) => s.kind !== "findings") }),
    "before-after": (d) => ({ ...d, sections: d.sections.filter((s) => s.kind !== "findings") }),
    event: (d) => ({ ...d, myRole: "" }),
  };
  for (const f of offered()) {
    test(`${f}: published with something its layout usually has left out; the suggestion is shown and stops nothing`, async ({ page }) => {
      const whole = sampleDoc(f);
      const working = lacking[f](whole);
      const expected = suggestionsFor(working).map((i) => i.message);
      expect(expected.length, "the working copy lacks something the layout usually has").toBeGreaterThan(0);
      expect(validateForPublish(working)).toEqual([]);
      const { id, url } = await openDoc(page, freshName("yws"), whole, { working, plan: "max" });

      // Suggestions are not things to fix: the top bar counts none, and its quiet button says how many suggestions there are.
      await expect(thingsButton(page)).toHaveCount(0);
      const button = page.getByRole("button", { name: new RegExp(`^${expected.length} suggestions?$`) });
      await expect(button).toBeVisible();
      await button.click();
      const list = page.getByRole("region", { name: "Suggestions" });
      await expect(list).toBeVisible();
      for (const message of expected) await expect(list.getByText(message, { exact: true })).toBeVisible();
      await expect(list.getByText("Up to you. None of these stops you publishing.")).toBeVisible();
      // No field carries an error for it.
      await expect(page.locator(`${READY} article [aria-invalid="true"]`)).toHaveCount(0);
      await page.keyboard.press("Escape");

      // "Review and publish" is not held back: the sheet lists the same suggestions and publishes.
      await reviewButton(page).click();
      await expect(publishSheet(page)).toBeVisible();
      for (const message of expected) await expect(publishSheet(page).getByText(message, { exact: true })).toBeVisible();
      await publish(page, { changes: true });
      const live = (await readStored(page, id)).published!;
      expect(suggestionsFor(live).map((i) => i.message)).toEqual(expected);
      const res = await page.request.get(url);
      expect(res.status()).toBe(200);
    });
  }

  test("a quote with nobody named is published and drawn cleanly: no dash, no comma, no role on its own", async ({ page }) => {
    const whole = caseStudy();
    // Nobody named, and a role left behind from before the name was taken out.
    const working = doc([FLOW, findings(), quote({ name: "", role: "Cafe manager" }), next(), link()]);
    expect(validateForPublish(working)).toEqual([]);
    const { id, url } = await openDoc(page, freshName("ywo"), whole, { working });
    const qi = await at(page, "quote");
    // The editor says the name is up to the person, and nothing marks it as missing.
    await expect(field(page, `sections.${qi}.name`)).toHaveAttribute("data-placeholder", "Who said it (optional)");
    await expect(thingsButton(page)).toHaveCount(0);
    await publish(page, { changes: true });
    const live = (await readStored(page, id)).published!;
    expect(live.sections.find((s) => s.kind === "quote")).toMatchObject({ text: QUOTE, name: "", role: "" });

    await page.goto(url);
    const part = page.locator('article[data-exhbt-page] [data-part="quote"]');
    await expect(part.locator("blockquote")).toHaveText(`“${QUOTE}”`);
    await expect(part.locator("figcaption")).toHaveCount(0);
    // The heading and the quote, and nothing else: no line for a name, no dash, no stray comma.
    expect((await part.innerText()).split("\n").map((s) => s.trim()).filter(Boolean)).toEqual([FORMAT_COPY["case-study"].quote, `“${QUOTE}”`]);
    await expect(part).not.toContainText("Cafe manager");
  });

  test("the flowchart is taken off a case study, published without it, and added back from the + menu", async ({ page }) => {
    const { id, url } = await openDoc(page, freshName("ywr"), caseStudy());
    await expect(frame(page, "flow")).toBeVisible();
    await removeSection(page, "Flowchart");
    await expect(frame(page, "flow")).toHaveCount(0);
    expect(await docNow(page)).toMatchObject({ flowOff: true });
    // Its boxes are kept, and nothing asks for it back.
    expect((await docNow(page)).flow).toHaveLength(3);
    await expect(thingsButton(page)).toHaveCount(0);
    await publish(page, { changes: true });
    expect((await readStored(page, id)).published).toMatchObject({ flowOff: true, flow: [] });
    await page.goto(url);
    await expect(page.locator("article[data-exhbt-page] [data-part]").first()).toBeVisible();
    await expect(page.locator('article[data-exhbt-page] [data-part="process"]')).toHaveCount(0);

    // Back in the editor, the + menu offers it, and it comes back with its boxes.
    await page.goto(`/exhbts/${id}/edit`);
    await waitReady(page);
    await openAddSectionMenu(page);
    await page.locator(`${READY} [data-xe-menu] [data-block="flow"]`).click();
    await expect(frame(page, "flow")).toBeVisible();
    expect((await docNow(page)).flowOff).not.toBe(true);
    expect((await docNow(page)).flow.map((b) => b.step)).toEqual(["Timed the queue", "Added a second till", "Timed it again"]);
  });

  test("what is empty is not drawn for a visitor: a section, a finding, a flowchart box, a title that was cleared", async ({ page }) => {
    const empty = doc(
      [
        FLOW,
        { id: "findings", kind: "findings", items: [text("Waits fell from 11 minutes to 4."), [], text("")] },
        quote({ text: "", name: "Priya Shah" }),
        { id: "reflection-1", kind: "reflection", text: [] },
        link({ href: "", label: "", description: "" }),
        { ...next(), id: "reflection-2", title: "" } as ContentSection,
      ],
      undefined,
      { flow: [{ step: "Timed the queue" }, { step: "" }, { step: "Timed it again" }], skills: ["Excel", ""] },
    );
    // The working copy keeps every part of it; only the page leaves them out.
    const out = await openDoc(page, freshName("ywe"), empty);
    await expect(frame(page, "quote-1")).toBeVisible();
    await expect(frame(page, "reflection-1")).toBeVisible();
    await page.goto(out.url);
    const art = page.locator("article[data-exhbt-page]");
    await expect(art.locator('[data-part="quote"]')).toHaveCount(0);
    await expect(art.locator('[data-part="link"]')).toHaveCount(0);
    // One "what I'd do next" is drawn, the one with words, and with no heading: its title was cleared.
    await expect(art.locator('[data-part="reflection"]')).toHaveCount(1);
    await expect(art.locator('[data-part="reflection"]').getByRole("heading")).toHaveCount(0);
    await expect(art.locator("li.xp-finding")).toHaveCount(1);
    await expect(art.locator(".xp-flow-box")).toHaveCount(2);
    await expect(art.locator(".xp-pill")).toHaveCount(1);
    await page.emulateMedia({ media: "print" });
    await expect(art.locator('[data-part="quote"]')).toHaveCount(0);
    await expect(art.locator(".xp-flow-box")).toHaveCount(2);
  });

  test("an empty quote can be published: it is nothing to fix, and it is not on the page", async ({ page }) => {
    const working = doc([FLOW, findings(), quote({ text: "", name: "", role: "" }), next()]);
    const { id, url } = await openDoc(page, freshName("ywz"), caseStudy(), { working });
    await expect(thingsButton(page)).toHaveCount(0);
    await publish(page, { changes: true });
    // The published copy holds only what a visitor is shown; the working copy keeps the empty quote to come back to.
    const stored = await readStored(page, id);
    expect(stored.published!.sections.map((s) => s.kind)).toEqual(["flow", "findings", "reflection"]);
    expect(stored.working.sections.map((s) => s.kind)).toEqual(["flow", "findings", "quote", "reflection"]);
    await page.goto(url);
    await expect(page.locator('article[data-exhbt-page] [data-part="quote"]')).toHaveCount(0);
  });
});
