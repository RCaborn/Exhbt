import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  chartsOf,
  emptyDoc,
  ExhbtDocSchema,
  imagesOf,
  LIMITS,
  normaliseDoc,
  plain,
  publicDoc,
  text,
  validateForPublish,
  wordCount,
  words,
  type Chart,
  type ContentSection,
  type ExhbtDoc,
  type ExhbtDocV1,
  type Section,
} from "../lib/exhbt/blocks";
import { chartTexts } from "../lib/exhbt/charts";
import { legacyGpDoc } from "../lib/exhbt/sample";
import { moveSection, nextSectionId, sectionLabel } from "../lib/exhbt/sections";
import { slugify } from "../lib/exhbt/slug";
import { unverifiedNumbers } from "../lib/exhbt/verify";
import {
  addSection,
  card,
  closeSheet,
  fillContext,
  fillBox,
  fillFinding,
  fillFindings,
  fillPlain,
  fillRich,
  finding,
  graph as graphIn,
  listOrder,
  menuItem,
  openAddSectionMenu,
  openThingsToFix,
  openWebAddress,
  openPublishSheet,
  pageOrder,
  publish,
  publishSheet,
  SEL,
  seeAsVisitor,
  signInAs,
  startFromScratch,
  startWithCore,
  visitorRegion,
  waitEditor,
  waitForSave,
  wordsIn,
  wordsOnBar,
} from "./editor";
import { READY } from "./page-editor";
import { uniqueBytes } from "./unique-bytes";

// Sections (decision 0015): the core (header, the question, the flowchart) is on every exhbt;
// below it, findings, graphs, images, a quote, what I'd do next and a link can be added, removed
// and reordered, all inside the 200-word cap. Old docs read as sections in their old order.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PNG = uniqueBytes(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const nWords = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/* ---------------- The model ---------------- */

const F: Section = { id: "findings", kind: "findings", items: [text("Waits fell."), text("Sales held.")] };
const bar: Chart = { kind: "bar", title: "Waits", unit: "min", rows: [{ label: "Before", value: 11 }, { label: "After", value: 4 }] };
const graph = (n = 1, chart: Chart = bar): Section => ({ id: `graph-${n}`, kind: "graph", chart });
const image = (n = 1): Section => ({ id: `image-${n}`, kind: "image", fileId: `f${n}`, alt: "A queue at the till", caption: [] });
const quote = (t = "Lunch is calmer now.", name = "Priya Shah", role = "Cafe manager"): ContentSection => ({ id: "quote-1", kind: "quote", text: t, name, role });
const next = (t = "Next time I'd time the evening queue too."): ContentSection => ({ id: "reflection-1", kind: "reflection", text: text(t) });
const link = (href = "https://example.com/code", label = "Model code", description = ""): ContentSection => ({ id: "link-1", kind: "link", href, label, description });
/** A complete core, with these sections below the flowchart. */
const core = (sections: Section[]): ExhbtDoc => ({
  ...emptyDoc(),
  title: "Shorter queues",
  gap: text("Would a second till help?"),
  flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
  sections,
});
const paths = (d: ExhbtDoc) => validateForPublish(d).map((i) => i.path);

test.describe("Sections: the model", () => {
  test("a doc saved before sections reads as sections, in the order its page always had", () => {
    const old: ExhbtDocV1 = {
      schemaVersion: 1,
      title: "An old exhbt",
      context: "Year 2 module",
      skills: ["Excel"],
      gap: text("Would a second till help?"),
      flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
      findings: [text("Waits fell."), text("Sales held.")],
      // The first graph is from before graph kinds, too.
      charts: [legacyGpDoc.charts[0]!, bar],
      images: [
        { fileId: "f1", alt: "A queue", caption: text("Lunch, week one") },
        { fileId: "f2", alt: "A till", caption: [] },
      ],
      evidence: { kind: "link", href: "https://example.com/report", label: "The report" },
    };
    const d = normaliseDoc(old);
    expect(d.schemaVersion).toBe(2);
    expect(d.sections.map((s) => `${s.kind}:${s.id}`)).toEqual(["findings:findings", "graph:graph-1", "graph:graph-2", "image:image-1", "image:image-2"]);
    expect(chartsOf(d).map((c) => c.kind)).toEqual(["beforeAfter", "bar"]);
    expect(imagesOf(d).map((im) => im.fileId)).toEqual(["f1", "f2"]);
    // The work stays in the footer, and the old fields are gone.
    expect(d.evidence).toEqual(old.evidence);
    expect(Object.keys(d)).not.toContain("findings");
    expect(Object.keys(d)).not.toContain("charts");
    // Reading it again changes nothing, and the schema reads it the same way.
    expect(normaliseDoc(d)).toEqual(d);
    expect(ExhbtDocSchema.parse(old)).toEqual(d);
    // The same words as the old layout counted.
    const before = [old.title, old.context, ...old.skills, plain(old.gap), ...old.flow.map((s) => s.step), ...old.findings.map(plain), ...old.charts.flatMap(chartTexts), ...old.images.map((im) => plain(im.caption)), old.evidence!.label];
    expect(wordCount(d)).toBe(before.reduce((n, s) => n + words(s), 0));

    // Sections without an id, or with one twice, get their own.
    const odd = normaliseDoc({ ...core([]), sections: [{ kind: "quote", text: "a", name: "b", role: "" }, link(), { ...next(), id: "link-1" }] });
    expect(odd.sections.map((s) => s.id)).toEqual(["quote-1", "link-1", "reflection-1"]);
  });

  test("publishing needs the core and findings or a graph; each kind has its cap", () => {
    expect(paths(core([F]))).toEqual([]);
    expect(paths(core([graph()]))).toEqual([]);
    expect(paths(core([F, graph(), image(), quote(), next(), link()]))).toEqual([]);
    // Neither findings nor a graph.
    expect(paths(core([quote(), next(), link()]))).toEqual(["sections"]);
    expect(paths(core([]))).toEqual(["sections"]);
    // One of each, except graphs and images: two each.
    expect(paths(core([F, { ...F, id: "findings-2" }]))).toEqual(["sections"]);
    expect(paths(core([F, quote(), { ...quote(), id: "quote-2" }]))).toEqual(["sections"]);
    expect(paths(core([F, next(), { ...next(), id: "reflection-2" }]))).toEqual(["sections"]);
    expect(paths(core([F, link(), { ...link(), id: "link-2" }]))).toEqual(["sections"]);
    expect(paths(core([F, graph(1), graph(2)]))).toEqual([]);
    expect(paths(core([F, graph(1), graph(2), graph(3)]))).toEqual(["sections"]);
    expect(paths(core([F, image(1), image(2), image(3)]))).toEqual(["sections"]);
    // Each field of each kind.
    expect(paths(core([F, quote(nWords(LIMITS.quote.words + 1))]))).toEqual(["sections.1.text"]);
    expect(paths(core([F, quote("", "")]))).toEqual(["sections.1.text", "sections.1.name"]);
    expect(paths(core([F, quote(undefined, "x".repeat(LIMITS.quote.nameChars + 1))]))).toEqual(["sections.1.name"]);
    expect(paths(core([F, next(nWords(LIMITS.reflection.words + 1))]))).toEqual(["sections.1.text"]);
    expect(paths(core([F, next("")]))).toEqual(["sections.1.text"]);
    expect(paths(core([F, { ...next(), text: [{ t: "notes", href: "http://example.com" }] } as Section]))).toEqual(["sections.1.text"]);
    for (const bad of ["http://example.com/code", "javascript:alert(1)", "not a link", ""]) expect(paths(core([F, link(bad)])), bad).toEqual(["sections.1.href"]);
    expect(paths(core([F, link(undefined, nWords(LIMITS.link.labelWords + 1))]))).toEqual(["sections.1.label"]);
    expect(paths(core([F, link(undefined, " ")]))).toEqual(["sections.1.label"]);
    expect(paths(core([F, link(undefined, "Code", nWords(LIMITS.link.descriptionWords + 1))]))).toEqual(["sections.1.description"]);
    expect(paths(core([F, { ...image(), alt: " " } as Section]))).toEqual(["sections.1.alt"]);
    expect(paths(core([{ ...F, items: [text("Only one.")] } as Section]))).toEqual(["sections.0.items"]);
    // The core is still checked: the flowchart needs its boxes.
    expect(paths({ ...core([F]), flow: [{ step: "Only one box" }] })).toEqual(["flow"]);
  });

  test("every word in every section counts; alt text and link addresses don't", () => {
    const n = wordCount(core([F]));
    expect(wordCount(core([F, quote("one two three", "Priya Shah", "Cafe manager")])) - n).toBe(3 + 2 + 2);
    expect(wordCount(core([F, next("one two three four")])) - n).toBe(4);
    expect(wordCount(core([F, link("https://example.com/a/long/address/with/parts", "Model code", "The notebook and data")])) - n).toBe(2 + 4);
    expect(wordCount(core([F, { ...image(), alt: "lots of words that are not counted", caption: text("two words") } as Section])) - n).toBe(2);

    // At the cap a quote fits; one word more and it can't be published.
    const full = {
      ...core([{ ...F, items: Array.from({ length: LIMITS.findings.max }, () => text(nWords(LIMITS.findings.wordsEach))) } as Section]),
      gap: text(nWords(LIMITS.gapWords)),
      flow: Array.from({ length: LIMITS.flow.min }, () => ({ step: nWords(LIMITS.flow.stepWords), detail: nWords(LIMITS.flow.detailWords) })),
    };
    const withQuote = { ...full, sections: [...full.sections, quote(nWords(LIMITS.quote.words), "Priya Shah", "")] };
    const room = LIMITS.totalWords - wordCount(withQuote);
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThanOrEqual(LIMITS.reflection.words);
    expect(paths({ ...withQuote, sections: [...withQuote.sections, next(nWords(room))] })).toEqual([]);
    expect(paths({ ...withQuote, sections: [...withQuote.sections, next(nWords(room + 1))] })).toEqual([""]);
  });

  test("the number check covers every section", () => {
    const source = "Waits fell from 11 to 4 minutes. Priya Shah, Cafe manager, said lunch is calmer.";
    expect(unverifiedNumbers(core([F, graph()]), source)).toEqual([]);
    expect(unverifiedNumbers(core([F, quote("Lunch is 20% calmer.")]), source)).toEqual(["20%"]);
    expect(unverifiedNumbers(core([F, next("Next time I'd run it for 6 weeks.")]), source)).toEqual(["6"]);
    expect(unverifiedNumbers(core([F, link(undefined, "Code for 3 models", "Covers 12 runs")]), source)).toEqual(["3", "12"]);
    expect(unverifiedNumbers(core([F, { ...image(), caption: text("Week 9 at lunch") } as Section]), source)).toEqual(["9"]);
  });

  test("publishing keeps only a protected graph's index, wherever its section sits", () => {
    const revenue: Chart = { kind: "line", title: "Weekly revenue", unit: "£", protect: "change", series: ["Shop"], rows: [{ label: "A", values: [48317] }, { label: "B", values: [52904] }] };
    const pub = publicDoc(core([quote(), graph(1, revenue), F]));
    for (const raw of ["48317", "52904", "£"]) expect(JSON.stringify(pub)).not.toContain(raw);
    expect(pub.sections.map((s) => s.kind)).toEqual(["quote", "graph", "findings"]);
  });

  test("sections are named, numbered and moved", () => {
    const ss = [F, graph(1), quote(), graph(2)];
    expect(ss.map((_, i) => sectionLabel(ss, i))).toEqual(["Findings", "Graph 1", "Quote", "Graph 2"]);
    expect(moveSection(ss, 3, 0).map((s) => s.id)).toEqual(["graph-2", "findings", "graph-1", "quote-1"]);
    expect(moveSection(ss, 0, 2).map((s) => s.id)).toEqual(["graph-1", "quote-1", "findings", "graph-2"]);
    expect(nextSectionId("graph", ss)).toBe("graph-3");
    expect(nextSectionId("link", ss)).toBe("link-1");
  });
});

/* ---------------- In the browser ---------------- */

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

const QUOTE = "The second till made lunchtimes calmer for staff and students.";
const NEXT = "Next time I'd time the evening queue too.";

/** A field of the first section of `kind` on the editing page, by the end of its path ("text", "name", "href"). */
const inSection = (page: Page, kind: string, tail: string) => page.locator(`${READY} [data-kind="${kind}"] [data-path$=".${tail}"]`).first();
/** An entry of the open "+" menu, by the kind it adds. */
const choice = (page: Page, kind: string) => page.locator(`${READY} [data-xe-menu] [data-block="${kind}"]`);
/** A section's tools show while it has the pointer (decision 0026): move onto it first. */
const onSection = (page: Page, id: string) => page.locator(`${READY} [data-section-id="${id}"]`).hover();
/** The flowchart's "+" after its last box shows while the flowchart has the pointer: move onto it, then press it. */
async function addBox(page: Page) {
  await onSection(page, "flow");
  await page.getByRole("button", { name: "Add a box at the end" }).click();
}
/** The words the page last said aloud. */
const said = (page: Page) => page.locator(`${READY} [data-said]`);
/** Every item of the page in order, the flowchart included (the places a move counts). */
const items = (page: Page) => page.locator(`${READY} article [data-section-id]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section-id")!));

/** Types a link's address: its "Web address" popover opens from the button over the link. */
async function setLinkAddress(page: Page, href: string) {
  // A new link opens its popover with the cursor in it; pressing the button again would close it.
  const input = inSection(page, "link", "href");
  const opened = await input.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
  if (!opened) await openWebAddress(page);
  await input.fill(href);
  await page.keyboard.press("Enter");
}

/** The words of the flowchart's steps as a visitor sees them. */
const methodology = (page: Page) => visitorRegion(page).getByRole("list", { name: "Methodology" });

test.describe("Sections in the editor", () => {
  test("add each kind of section, with the words left in the menu; remove and undo; publish; no accessibility violations", async ({ page }) => {
    // Every kind, the visitor's view, a publish and three pages on a cold dev server.
    test.setTimeout(240_000);
    const title = "Sections: every kind";
    await signInAs(page, "sasha");
    await startWithCore(page, title);

    // A new exhbt starts with findings; the menu says how many words are left, and findings are taken.
    await openAddSectionMenu(page);
    const left = LIMITS.totalWords - (await wordsOnBar(page));
    await expect(page.getByTestId("words-left")).toHaveText(`${left} words left of ${LIMITS.totalWords}.`);
    await expect(choice(page, "findings")).toBeDisabled();
    await expect(choice(page, "graph")).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.locator(`${READY} [data-xe-menu]`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a section", exact: true })).toBeFocused();
    await fillFindings(page);

    // A graph: it opens its figures sheet.
    await addSection(page, "Add a graph");
    const g = graphIn(page, 1);
    await g.getByLabel("Title", { exact: true }).fill("Average wait (minutes)");
    await g.getByLabel("Graph 1, row 1 group").fill("Lunch");
    await g.getByLabel("Graph 1, row 1 Before").fill("11");
    await g.getByLabel("Graph 1, row 1 After").fill("4");
    await closeSheet(page);

    // An image, through the file picker.
    await openAddSectionMenu(page);
    const chooser = page.waitForEvent("filechooser");
    await menuItem(page, "Add an image").click();
    await (await chooser).setFiles({ name: "queue.png", mimeType: "image/png", buffer: PNG });
    await fillPlain(page, page.getByLabel(/Image 1: describe it/), "A queue at the cafe till");

    // A quote, what I'd do next and a link.
    await addSection(page, "Add a quote");
    await expect(page.getByLabel("The quote, word for word")).toBeFocused();
    await page.keyboard.type(QUOTE);
    await fillPlain(page, page.getByLabel("Who said it"), "Priya Shah");
    await fillPlain(page, page.getByLabel("Their role (optional)"), "Cafe manager");
    await addSection(page, "Add what I'd do next");
    await fillRich(page, inSection(page, "reflection", "text"), NEXT);
    await addSection(page, "Add a link");
    await setLinkAddress(page, "https://example.com/queue-model");
    await fillPlain(page, page.getByLabel("What the link is"), "Queue model notebook");
    await fillPlain(page, page.getByLabel("One line about it (optional)"), "The timings and the code");

    expect(await listOrder(page)).toEqual(["findings", "graph", "image", "quote", "reflection", "link"]);
    // The page a visitor sees follows, in the same order.
    await seeAsVisitor(page);
    const pv = visitorRegion(page);
    await expect(pv.getByText(`“${QUOTE}”`)).toBeVisible();
    await expect(pv.getByText("Priya Shah, Cafe manager")).toBeVisible();
    await expect(pv.getByText(NEXT)).toBeVisible();
    await expect(pv.getByRole("link", { name: "Queue model notebook" })).toHaveAttribute("href", "https://example.com/queue-model");
    expect(await pageOrder(pv)).toEqual(["process", "findings", "graph", "image", "quote", "reflection", "link"]);
    await seeAsVisitor(page, false);

    // The menu now offers only what there's room for, and the words left went down.
    await openAddSectionMenu(page);
    for (const taken of ["findings", "quote", "reflection", "link"]) await expect(choice(page, taken)).toBeDisabled();
    await expect(choice(page, "graph")).toBeEnabled();
    await expect(page.getByTestId("words-left")).toHaveText(`${LIMITS.totalWords - (await wordsOnBar(page))} words left of ${LIMITS.totalWords}.`);
    await axe(page, "editor with every kind and the menu open");
    await page.keyboard.press("Escape");

    // Remove the quote, then put it back.
    await onSection(page, "quote-1");
    await page.getByRole("button", { name: "Remove quote" }).click();
    await expect(card(page, "Quote")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Undo: / })).toBeVisible();
    await page.getByRole("button", { name: /^Undo: / }).click();
    await expect(card(page, "Quote")).toBeVisible();
    await expect(page.getByLabel("The quote, word for word")).toHaveText(QUOTE);
    expect(await listOrder(page)).toEqual(["findings", "graph", "image", "quote", "reflection", "link"]);

    // Published, the project page has every section in order.
    await publish(page, { changes: true });
    await page.goto(`/p/sasha/${slugify(title)}`);
    const article = page.locator("article");
    expect(await pageOrder(page.locator("main"))).toEqual(["process", "findings", "graph", "image", "quote", "reflection", "link"]);
    await expect(page.getByRole("region", { name: "Feedback" })).toContainText(`“${QUOTE}”`);
    await expect(page.getByRole("region", { name: "Feedback" })).toContainText("Priya Shah, Cafe manager");
    await expect(page.getByRole("region", { name: "What I'd do next" })).toContainText(NEXT);
    await expect(article.getByRole("link", { name: "Queue model notebook" })).toHaveAttribute("href", "https://example.com/queue-model");
    await expect(article.getByRole("link", { name: "Queue model notebook" })).toHaveAttribute("target", "_blank");
    await expect(article.getByRole("img", { name: "A queue at the cafe till" })).toBeVisible();
    await axe(page, "project page");

    // On the home page it is the best piece of work, with its first graph as the key figure (decision 0016).
    await page.goto("/p/sasha");
    const band = page.locator("[data-section=featured]");
    await expect(band.getByRole("heading", { level: 2 })).toHaveText(title);
    await expect(band.locator("[data-key-figure=chart]")).toBeVisible();
    await expect(band.getByRole("link", { name: "See how I did it" })).toHaveAttribute("href", `/p/sasha/${slugify(title)}`);
  });

  test("reorder with the buttons, the drag handle's keys and a pointer drag; the order is saved", async ({ page }) => {
    await signInAs(page, "otto");
    await startWithCore(page, "Sections: reordering");
    await fillFindings(page);
    await addSection(page, "Add a quote");
    await page.keyboard.type(QUOTE);
    await fillPlain(page, page.getByLabel("Who said it"), "Priya Shah");
    await addSection(page, "Add what I'd do next");
    await fillRich(page, inSection(page, "reflection", "text"), NEXT);
    expect(await listOrder(page)).toEqual(["findings", "quote", "reflection"]);

    // The move buttons: focus stays on the button, and the move is read out.
    await onSection(page, "reflection-1");
    const up = page.getByRole("button", { name: "Move what I'd do next up" });
    await up.focus();
    await page.keyboard.press("Enter");
    expect(await listOrder(page)).toEqual(["findings", "reflection", "quote"]);
    await expect(up).toBeFocused();
    let order = await items(page);
    await expect(said(page)).toHaveText(`What I'd do next moved up, to place ${order.indexOf("reflection-1") + 1} of ${order.length}.`);
    await page.keyboard.press("Enter");
    expect(await listOrder(page)).toEqual(["reflection", "findings", "quote"]);
    // Every layout is drawn in the doc's order (decision 0027): one more move and it is above the flowchart, at the top, where the up button is off and focus moves to the down one.
    await page.keyboard.press("Enter");
    order = await items(page);
    expect(order[0]).toBe("reflection-1");
    await expect(up).toBeDisabled();
    await expect(page.getByRole("button", { name: "Move what I'd do next down" })).toBeFocused();
    // And back below it: the sections are in the same order again.
    await page.keyboard.press("Enter");
    await expect(up).toBeEnabled();
    expect(await listOrder(page)).toEqual(["reflection", "findings", "quote"]);
    // The page a visitor sees is in the doc's order.
    const parts = (await items(page)).map((id) => (id === "flow" ? "process" : id.replace(/-\d+$/, "")));
    await seeAsVisitor(page);
    expect(await pageOrder(visitorRegion(page))).toEqual(parts);
    await seeAsVisitor(page, false);

    // The drag handle from the keyboard (dnd-kit): Space, an arrow, Space.
    await onSection(page, "quote-1");
    const quoteHandle = page.getByRole("button", { name: "Drag quote to move it" });
    await quoteHandle.focus();
    order = await items(page);
    const at = order.indexOf("quote-1") + 1;
    await page.keyboard.press("Space");
    await expect(said(page)).toHaveText(`Picked up quote, place ${at} of ${order.length}.`);
    await page.keyboard.press("ArrowUp");
    await expect(said(page)).toHaveText(`Quote would go to place ${at - 1} of ${order.length}.`);
    await page.keyboard.press("Space");
    await expect(said(page)).toHaveText(`Quote dropped in place ${at - 1} of ${order.length}.`);
    await expect.poll(() => listOrder(page)).toEqual(["reflection", "quote", "findings"]);

    // A pointer drag on the handle: what I'd do next goes below the quote. A tall window, with
    // the sections in its middle, keeps the pointer away from the edges, where the page scrolls itself.
    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.locator('[data-section-id="reflection-1"]').evaluate((li) => window.scrollBy(0, li.getBoundingClientRect().top - 400));
    await onSection(page, "reflection-1");
    const handle = (await page.getByRole("button", { name: "Drag what I'd do next to move it" }).boundingBox())!;
    const onto = (await page.locator('[data-section-id="quote-1"]').boundingBox())!;
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 12, { steps: 4 });
    await expect(page.locator(`${READY} [data-xe-drag]`)).toBeAttached();
    // Carry the pointer into the lower half of the quote: the place follows the pointer, so the section lands after it.
    await page.mouse.move(x, onto.y + onto.height * 0.75, { steps: 20 });
    await page.mouse.up();
    await expect.poll(() => listOrder(page)).toEqual(["quote", "reflection", "findings"]);
    const finalParts = (await items(page)).map((id) => (id === "flow" ? "process" : id.replace(/-\d+$/, "")));
    await seeAsVisitor(page);
    expect(await pageOrder(visitorRegion(page))).toEqual(finalParts);
    await seeAsVisitor(page, false);

    // The order is saved with the exhbt.
    await waitForSave(page);
    await page.reload();
    await waitEditor(page);
    expect(await listOrder(page)).toEqual(["quote", "reflection", "findings"]);
  });

  test("a quote that takes the exhbt over 200 words blocks publishing, and the bar turns red", async ({ page }) => {
    await signInAs(page, "wanda");
    await startWithCore(page, "Cutting lunch queues at the student union cafe");
    await fillContext(page, nWords(LIMITS.gapWords));
    for (let i = 1; i <= LIMITS.flow.min; i++) {
      await fillBox(page, i, nWords(LIMITS.flow.stepWords));
      await fillPlain(page, page.getByLabel(`Box ${i} detail`), nWords(LIMITS.flow.detailWords));
    }
    for (let i = 3; i <= LIMITS.findings.max; i++) {
      await onSection(page, "findings");
      await page.getByRole("button", { name: "Add a finding" }).click();
    }
    for (let i = 1; i <= LIMITS.findings.max; i++) await fillFinding(page, i, nWords(LIMITS.findings.wordsEach));

    // Under the cap, with room left: the menu says how much.
    const total = await wordsOnBar(page);
    const room = LIMITS.totalWords - total;
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThan(LIMITS.quote.words + 2);
    await openAddSectionMenu(page);
    await expect(page.getByTestId("words-left")).toHaveText(`${room} words left of ${LIMITS.totalWords}.`);
    await expect(page.locator("[data-word-bar]")).not.toHaveAttribute("data-over");

    // A full-length quote and a name: over.
    await menuItem(page, "Add a quote").click();
    // The cursor reaches the new quote two frames after the add (drag/engine.ts afterAdd), with the "+" focused meanwhile:
    // typing before it lands sends the first word to the "+" (its space presses it), as on a slow runner. Wait, as a person does.
    await expect(page.getByLabel("The quote, word for word")).toBeFocused();
    await page.keyboard.type(nWords(LIMITS.quote.words));
    await fillPlain(page, page.getByLabel("Who said it"), "Priya Shah");
    const over = total + LIMITS.quote.words + 2 - LIMITS.totalWords;
    await expect(page.locator("[data-word-bar]")).toHaveAttribute("data-over", "true");
    await expect(page.locator("[data-word-bar]").locator(".text-error")).toHaveText(String(total + LIMITS.quote.words + 2));
    await openAddSectionMenu(page);
    await expect(page.getByTestId("words-left")).toHaveText(`${over} ${over === 1 ? "word" : "words"} over the ${LIMITS.totalWords}-word limit. Trim something before you publish.`);
    await page.keyboard.press("Escape");

    await openPublishSheet(page);
    await publishSheet(page).getByLabel(SEL.publishConfirm).check();
    await publishSheet(page).getByRole("button", { name: "Publish", exact: true }).click();
    await expect(await openThingsToFix(page)).toContainText(`Keep the whole exhbt to ${LIMITS.totalWords} words (it's ${total + LIMITS.quote.words + 2}).`);
    await expect(page.getByText("It's live.")).toHaveCount(0);
  });

  test("the flowchart stays on every exhbt, with 3 to 6 boxes", async ({ page }) => {
    await signInAs(page, "flo");
    await startWithCore(page, "Sections: the flowchart stays");
    // Not a section: nothing removes it, and the menu doesn't offer it while it is on the page.
    await onSection(page, "flow");
    await expect(page.locator(`${READY} [data-section-id="flow"]`).getByRole("button", { name: /^Remove process/i })).toHaveCount(0);
    await openAddSectionMenu(page);
    expect(await page.locator(`${READY} [data-xe-menu] [data-block]`).evaluateAll((bs) => bs.map((b) => b.getAttribute("data-block")))).toEqual(["findings", "graph", "image", "quote", "reflection", "link"]);
    await page.keyboard.press("Escape");

    // 3 to 6 boxes.
    await expect(page.getByRole("button", { name: "Remove box 1" })).toBeDisabled();
    for (let n = 4; n <= LIMITS.flow.max; n++) await addBox(page);
    await expect(page.getByLabel(/^Box \d$/)).toHaveCount(LIMITS.flow.max);
    await expect(page.getByRole("button", { name: "Add a box at the end" })).toHaveCount(0);

    // With every section taken away, the flowchart is still drawn, and publishing asks for findings or a graph.
    await onSection(page, "findings");
    await page.getByRole("button", { name: "Remove findings" }).click();
    expect(await listOrder(page)).toEqual([]);
    await expect(page.getByRole("list", { name: "Methodology" })).toBeVisible();
    for (let n = 4; n <= LIMITS.flow.max; n++) await fillBox(page, n, `Step ${n}`);
    await openPublishSheet(page);
    await publishSheet(page).getByLabel(SEL.publishConfirm).check();
    await publishSheet(page).getByRole("button", { name: "Publish", exact: true }).click();
    const problems = await openThingsToFix(page);
    await problems.getByRole("button", { name: "Sections: Add findings or a graph, so the exhbt shows what came of the work." }).click();
    await expect(page.getByRole("button", { name: "Add a section", exact: true })).toBeFocused();
  });

  test("an exhbt saved before sections shows the same page as the same exhbt in sections", async ({ page }) => {
    // The GP sample is stored in the old layout (lib/exhbt/sample.ts); layout=sections stores it already converted.
    await page.goto("/dev/portfolio?username=olden&plan=premium&count=1");
    await page.goto("/dev/portfolio?username=newer&plan=premium&count=1&layout=sections");

    const articleOf = async (username: string) => {
      await page.goto(`/p/${username}/gp-reminders`);
      await expect(page.getByRole("heading", { level: 1, name: legacyGpDoc.title })).toBeVisible();
      return (await page.locator("article").innerHTML()).replaceAll(username, "USER");
    };
    const old = await articleOf("olden");
    // The order the page always had: the process, findings, the graph (beside them since decision 0022); the work in the sidebar.
    expect(await pageOrder(page.locator("main"))).toEqual(["process", "findings", "graph"]);
    await expect(page.getByRole("region", { name: "What I found" }).getByRole("listitem")).toHaveCount(legacyGpDoc.findings.length);
    await expect(page.getByRole("table", { name: legacyGpDoc.charts[0]!.title })).toBeAttached();
    await expect(page.getByRole("complementary", { name: /and this work$/ }).getByRole("link", { name: /See the work: Final report \(PDF\)/ })).toBeVisible();
    expect(await articleOf("newer")).toBe(old);

    // In the editor it opens as sections, and nothing about its page changes until it's published again.
    await page.goto("/auth/dev?email=olden@example.com&next=/exhbts");
    await page.getByRole("link", { name: `Edit ${legacyGpDoc.title}` }).click();
    await waitEditor(page);
    expect(await listOrder(page)).toEqual(["findings", "graph"]);
    expect(await items(page)).toContain("flow");
    await expect(finding(page, 3)).toContainText("Same-day bookings were unaffected");
  });

  test("the stand-in AI drafts a quote and what I'd do next only from the material", async ({ page }) => {
    await signInAs(page, "dora");
    const material = [
      "Lunch queue study at the student union cafe. Average waits fell from 11 to 4 minutes after a second till opened.",
      `Feedback from the cafe: "${QUOTE}" Priya Shah, Cafe manager.`,
      "Next time I would time the evening queue too.",
    ].join("\n");
    const res = await page.request.post("/api/exhbts/draft", { data: { text: material } });
    expect(res.status()).toBe(200);
    const { id, unverified } = (await res.json()) as { id: string; unverified: string[] };
    expect(unverified).toEqual([]);
    await page.goto(`/exhbts/${id}/edit`);
    await waitEditor(page);
    expect(await listOrder(page)).toEqual(["findings", "graph", "quote", "reflection"]);
    expect(await wordsIn(page.getByLabel("The quote, word for word"))).toBe(QUOTE);
    expect(await wordsIn(page.getByLabel("Who said it"))).toBe("Priya Shah");
    expect(await wordsIn(page.getByLabel("Their role (optional)"))).toBe("Cafe manager");
    await expect(inSection(page, "reflection", "text")).toContainText("Next time I would time the evening queue too.");

    // Words in quotes with nobody named aren't a quote, and nothing is made up instead.
    const unnamed = await page.request.post("/api/exhbts/draft", { data: { text: 'Lunch queue study at the student union cafe. Someone wrote "the second till is great" on the board by the tills during the second week of the trial.' } });
    expect(unnamed.status()).toBe(200);
    await page.goto(`/exhbts/${((await unnamed.json()) as { id: string }).id}/edit`);
    await waitEditor(page);
    expect(await listOrder(page)).toEqual(["findings"]);
  });

  test("an exhbt with findings, a graph, a quote, what I'd do next and a link prints on one A4 page", async ({ page }) => {
    const title = "Sections: one printed page";
    await signInAs(page, "pia");
    await startWithCore(page, title);
    await fillFindings(page);
    await addSection(page, "Add a graph");
    const g = graphIn(page, 1);
    await g.getByLabel("Title", { exact: true }).fill("Average wait (minutes)");
    await g.getByLabel("Graph 1, row 1 group").fill("Lunch");
    await g.getByLabel("Graph 1, row 1 Before").fill("11");
    await g.getByLabel("Graph 1, row 1 After").fill("4");
    await closeSheet(page);
    await addSection(page, "Add a quote");
    await page.keyboard.type(QUOTE);
    await fillPlain(page, page.getByLabel("Who said it"), "Priya Shah");
    await fillPlain(page, page.getByLabel("Their role (optional)"), "Cafe manager");
    await addSection(page, "Add what I'd do next");
    await fillRich(page, inSection(page, "reflection", "text"), NEXT);
    await addSection(page, "Add a link");
    await setLinkAddress(page, "https://example.com/queue-model");
    await fillPlain(page, page.getByLabel("What the link is"), "Queue model notebook");
    await fillPlain(page, page.getByLabel("One line about it (optional)"), "The timings and the code");
    await publish(page, { changes: true });

    await page.goto(`/p/pia/${slugify(title)}`);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("region", { name: "Feedback" })).toBeVisible();
    await expect(page.locator("article").getByRole("link", { name: "Queue model notebook" })).toBeVisible();
    const pdf = (await page.pdf({ format: "A4" })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  });
});

test.describe("Sections in the editor: blank boxes as a visitor sees them", () => {
  test("a blank last box is left out of the page, so the last filled step keeps the result box", async ({ page }) => {
    await signInAs(page, "blanky");
    await startWithCore(page, "Blank boxes stay out of the preview");
    await seeAsVisitor(page);
    const list = methodology(page);
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await seeAsVisitor(page, false);
    await addBox(page);
    await expect(page.getByLabel(/^Box \d$/)).toHaveCount(4);
    await seeAsVisitor(page);
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list.getByRole("listitem").last()).toContainText("Timed it again");
    await expect(list.locator("[data-last]")).toHaveCount(1);
    await expect(list.getByRole("listitem").last().locator("[data-last]")).toBeVisible();
    // Typing in it brings it in as the last step.
    await seeAsVisitor(page, false);
    await fillBox(page, 4, "Wrote it up");
    await seeAsVisitor(page);
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(list.getByRole("listitem").last()).toContainText("Wrote it up");
  });

  test("with every box blank (a new exhbt) the page still lists them", async ({ page }) => {
    await signInAs(page, "blankall");
    await startFromScratch(page, { waitForContext: false });
    await expect(page.getByRole("list", { name: "Methodology" }).getByRole("listitem")).toHaveCount(3);
    await seeAsVisitor(page);
    await expect(methodology(page).getByRole("listitem")).toHaveCount(3);
  });
});
