import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
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
  type ExhbtDoc,
  type ExhbtDocV1,
  type Section,
} from "../lib/exhbt/blocks";
import { chartTexts } from "../lib/exhbt/charts";
import { legacyGpDoc } from "../lib/exhbt/sample";
import { moveSection, nextSectionId, sectionLabel } from "../lib/exhbt/sections";
import { slugify } from "../lib/exhbt/slug";
import { unverifiedNumbers } from "../lib/exhbt/verify";

// Sections (decision 0015): the core (header, the question, the flowchart) is on every exhbt;
// below it, findings, graphs, images, a quote, what I'd do next and a link can be added, removed
// and reordered, all inside the 200-word cap. Old docs read as sections in their old order.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const nWords = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/* ---------------- The model ---------------- */

const F: Section = { id: "findings", kind: "findings", items: [text("Waits fell."), text("Sales held.")] };
const bar: Chart = { kind: "bar", title: "Waits", unit: "min", rows: [{ label: "Before", value: 11 }, { label: "After", value: 4 }] };
const graph = (n = 1, chart: Chart = bar): Section => ({ id: `graph-${n}`, kind: "graph", chart });
const image = (n = 1): Section => ({ id: `image-${n}`, kind: "image", fileId: `f${n}`, alt: "A queue at the till", caption: [] });
const quote = (t = "Lunch is calmer now.", name = "Priya Shah", role = "Cafe manager"): Section => ({ id: "quote-1", kind: "quote", text: t, name, role });
const next = (t = "Next time I'd time the evening queue too."): Section => ({ id: "reflection-1", kind: "reflection", text: text(t) });
const link = (href = "https://example.com/code", label = "Model code", description = ""): Section => ({ id: "link-1", kind: "link", href, label, description });
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

async function signInAs(page: Page, username: string) {
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
}

/** Starts from scratch and fills the core: title, the question and three process boxes. */
async function startWithCore(page: Page, title: string) {
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  await expect(page.locator("[data-ready=true]")).toBeAttached();
  await expect(page.getByRole("textbox", { name: "The question" })).toBeVisible();
  await page.locator("#title").fill(title);
  await page.getByRole("textbox", { name: "The question" }).fill("Lunch queues ran long. Would a second till help?");
  for (const [i, box] of ["Timed the queue", "Opened a second till", "Timed it again"].entries()) await page.getByLabel(`Box ${i + 1}`, { exact: true }).fill(box);
}

async function fillFindings(page: Page) {
  await page.getByRole("textbox", { name: "Finding 1" }).fill("Average wait fell from 11 to 4 minutes.");
  await page.getByRole("textbox", { name: "Finding 2" }).fill("Sales held steady, so the till paid for itself.");
}

const sectionsArea = (page: Page) => page.getByRole("region", { name: "Sections", exact: true });
const card = (page: Page, name: string) => sectionsArea(page).getByRole("region", { name, exact: true });
const preview = (page: Page) => page.getByRole("region", { name: "Preview" });
const openMenu = (page: Page) => page.getByRole("button", { name: "Add a section" }).click();

async function addSection(page: Page, name: string) {
  await openMenu(page);
  await page.getByRole("button", { name, exact: true }).click();
}

/** The kinds in the editor's list, in order. */
const listOrder = (page: Page) => page.locator('ol[aria-label="Sections, in page order"] > li').evaluateAll((lis) => lis.map((li) => li.getAttribute("data-kind")));

/** The parts of a drawn exhbt, in order, by their heading or label. */
const pageOrder = (scope: Locator) =>
  scope.locator("article > section").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.querySelector("h2, h3")?.textContent?.trim() ?? ""));

/** The figure on the word bar. */
async function wordsOnBar(page: Page): Promise<number> {
  const t = await page.locator("[data-word-bar]").innerText();
  return Number(t.match(/^(\d+) words/)?.[1]);
}

async function waitForSave(page: Page) {
  await expect(page.getByText("Saving…")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

async function publish(page: Page) {
  await page.getByLabel("This is my work, and the numbers are true").check();
  await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
  await expect(page.getByText(/^(It's live\.|Your changes are live\.)$/)).toBeVisible();
}

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

const QUOTE = "The second till made lunchtimes calmer for staff and students.";
const NEXT = "Next time I'd time the evening queue too.";

test.describe("Sections in the editor", () => {
  test("add each kind of section, with the words left in the menu; remove and undo; publish; no accessibility violations", async ({ page }) => {
    const title = "Sections: every kind";
    await signInAs(page, "sasha");
    await startWithCore(page, title);

    // A new exhbt starts with findings; the menu says how many words are left, and findings are taken.
    await openMenu(page);
    const left = LIMITS.totalWords - (await wordsOnBar(page));
    await expect(page.getByTestId("words-left")).toHaveText(`${left} words left of ${LIMITS.totalWords}. Every word in a section counts.`);
    await expect(page.getByRole("button", { name: "Add findings" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add a graph" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Add findings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a section" })).toBeFocused();
    await fillFindings(page);

    // A graph.
    await addSection(page, "Add a graph");
    const g = page.getByRole("group", { name: "Graph 1", exact: true });
    await g.getByLabel("Title", { exact: true }).fill("Average wait (minutes)");
    await g.getByLabel("Graph 1, row 1 group").fill("Lunch");
    await g.getByLabel("Graph 1, row 1 Before").fill("11");
    await g.getByLabel("Graph 1, row 1 After").fill("4");

    // An image, through the file picker.
    await openMenu(page);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add an image" }).click();
    await (await chooser).setFiles({ name: "queue.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel(/Image 1: describe it/).fill("A queue at the cafe till");

    // A quote, what I'd do next and a link.
    await addSection(page, "Add a quote");
    await expect(page.getByLabel("The quote, word for word")).toBeFocused();
    await page.getByLabel("The quote, word for word").fill(QUOTE);
    await page.getByLabel("Who said it").fill("Priya Shah");
    await page.getByLabel("Their role (optional)").fill("Cafe manager");
    await addSection(page, "Add what I'd do next");
    await page.getByRole("textbox", { name: "What you'd do next, or do differently" }).fill(NEXT);
    await addSection(page, "Add a link");
    await page.getByLabel("Web address").fill("https://example.com/queue-model");
    await page.getByLabel("What the link is").fill("Queue model notebook");
    await page.getByLabel("One line about it (optional)").fill("The timings and the code");

    expect(await listOrder(page)).toEqual(["findings", "graph", "image", "quote", "reflection", "link"]);
    // The preview follows as you type, in the same order.
    const pv = preview(page);
    await expect(pv.getByText(`“${QUOTE}”`)).toBeVisible();
    await expect(pv.getByText("Priya Shah, Cafe manager")).toBeVisible();
    await expect(pv.getByText(NEXT)).toBeVisible();
    await expect(pv.getByRole("link", { name: "Queue model notebook" })).toHaveAttribute("href", "https://example.com/queue-model");
    expect(await pageOrder(pv)).toEqual(["The question", "Process", "Findings", "Graphs", "Images", "Feedback", "What I'd do next", "Link"]);

    // The menu now offers only what there's room for, and the words left went down.
    await openMenu(page);
    for (const taken of ["Add findings", "Add a quote", "Add what I'd do next", "Add a link"]) await expect(page.getByRole("button", { name: taken })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add a graph" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Add a graph" })).toHaveAccessibleDescription(/1 of 2 left\./);
    await expect(page.getByTestId("words-left")).toHaveText(`${LIMITS.totalWords - (await wordsOnBar(page))} words left of ${LIMITS.totalWords}. Every word in a section counts.`);
    await axe(page, "editor with every kind and the menu open");
    await page.keyboard.press("Escape");

    // Remove the quote, then put it back.
    await page.getByRole("button", { name: "Remove quote" }).click();
    await expect(card(page, "Quote")).toHaveCount(0);
    await expect(pv.getByText("Priya Shah, Cafe manager")).toHaveCount(0);
    await expect(page.getByText("Quote removed.")).toBeVisible();
    await page.getByRole("button", { name: "Undo: put quote back" }).click();
    await expect(card(page, "Quote")).toBeVisible();
    await expect(page.getByLabel("The quote, word for word")).toHaveValue(QUOTE);
    expect(await listOrder(page)).toEqual(["findings", "graph", "image", "quote", "reflection", "link"]);

    // Published, the project page has every section in order.
    await publish(page);
    await page.goto(`/p/sasha/${slugify(title)}`);
    const article = page.locator("article");
    expect(await pageOrder(page.locator("main"))).toEqual(["The question", "Process", "Findings", "Graphs", "Images", "Feedback", "What I'd do next", "Link"]);
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
    await page.getByLabel("The quote, word for word").fill(QUOTE);
    await page.getByLabel("Who said it").fill("Priya Shah");
    await addSection(page, "Add what I'd do next");
    await page.getByRole("textbox", { name: "What you'd do next, or do differently" }).fill(NEXT);
    expect(await listOrder(page)).toEqual(["findings", "quote", "reflection"]);

    // The move buttons: focus stays on the button, and the move is read out.
    const up = page.getByRole("button", { name: "Move what I'd do next up" });
    await up.focus();
    await page.keyboard.press("Enter");
    expect(await listOrder(page)).toEqual(["findings", "reflection", "quote"]);
    await expect(up).toBeFocused();
    await expect(page.getByText("What I'd do next moved up: now 2 of 3.")).toBeVisible();
    await page.keyboard.press("Enter");
    expect(await listOrder(page)).toEqual(["reflection", "findings", "quote"]);
    // At the top the up button is off, so focus moves to the down one.
    await expect(up).toBeDisabled();
    await expect(page.getByRole("button", { name: "Move what I'd do next down" })).toBeFocused();
    expect(await pageOrder(preview(page))).toEqual(["The question", "Process", "What I'd do next", "Findings", "Feedback"]);

    // The drag handle from the keyboard (dnd-kit): Space, an arrow, Space.
    const quoteHandle = page.getByRole("button", { name: "Drag quote to move it" });
    await quoteHandle.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("Picked up quote, place 3 of 3.")).toBeAttached();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("Quote would go to place 2 of 3.")).toBeAttached();
    await page.keyboard.press("Space");
    await expect(page.getByText("Quote dropped in place 2 of 3.")).toBeAttached();
    await expect.poll(() => listOrder(page)).toEqual(["reflection", "quote", "findings"]);

    // A pointer drag on the handle: what I'd do next goes below the quote. A tall window, with
    // the cards in its middle, keeps the pointer away from the edges, where dnd-kit scrolls the page.
    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.locator('[data-section-id="reflection-1"]').evaluate((li) => window.scrollBy(0, li.getBoundingClientRect().top - 400));
    const handle = (await page.getByRole("button", { name: "Drag what I'd do next to move it" }).boundingBox())!;
    const from = (await page.locator('[data-section-id="reflection-1"]').boundingBox())!;
    const onto = (await page.locator('[data-section-id="quote-1"]').boundingBox())!;
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 12, { steps: 4 });
    await expect(page.locator('[data-section-id="reflection-1"]')).toHaveAttribute("data-dragging", "true");
    // Carry the card until its middle is on the quote's middle.
    await page.mouse.move(x, y + (onto.y + onto.height / 2) - (from.y + from.height / 2), { steps: 20 });
    await page.mouse.up();
    await expect.poll(() => listOrder(page)).toEqual(["quote", "reflection", "findings"]);
    expect(await pageOrder(preview(page))).toEqual(["The question", "Process", "Feedback", "What I'd do next", "Findings"]);

    // The order is saved with the exhbt.
    await waitForSave(page);
    await page.reload();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    expect(await listOrder(page)).toEqual(["quote", "reflection", "findings"]);
  });

  test("a quote that takes the exhbt over 200 words blocks publishing, and the bar turns red", async ({ page }) => {
    await signInAs(page, "wanda");
    await startWithCore(page, "Cutting lunch queues at the student union cafe");
    await page.getByRole("textbox", { name: "The question" }).fill(nWords(LIMITS.gapWords));
    for (let i = 1; i <= LIMITS.flow.min; i++) {
      await page.getByLabel(`Box ${i}`, { exact: true }).fill(nWords(LIMITS.flow.stepWords));
      await page.getByLabel(`Box ${i} detail`).fill(nWords(LIMITS.flow.detailWords));
    }
    for (let i = 3; i <= LIMITS.findings.max; i++) await page.getByRole("button", { name: "Add a finding" }).click();
    for (let i = 1; i <= LIMITS.findings.max; i++) await page.getByRole("textbox", { name: `Finding ${i}` }).fill(nWords(LIMITS.findings.wordsEach));

    // Under the cap, with room left: the menu says how much.
    const total = await wordsOnBar(page);
    const room = LIMITS.totalWords - total;
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThan(LIMITS.quote.words + 2);
    await openMenu(page);
    await expect(page.getByTestId("words-left")).toHaveText(`${room} words left of ${LIMITS.totalWords}. Every word in a section counts.`);
    await expect(page.locator("[data-word-bar]")).not.toHaveAttribute("data-over");

    // A full-length quote and a name: over.
    await page.getByRole("button", { name: "Add a quote" }).click();
    await page.getByLabel("The quote, word for word").fill(nWords(LIMITS.quote.words));
    await page.getByLabel("Who said it").fill("Priya Shah");
    const over = total + LIMITS.quote.words + 2 - LIMITS.totalWords;
    await expect(page.locator("[data-word-bar]")).toHaveAttribute("data-over", "true");
    await expect(page.locator("[data-word-bar]").locator(".text-error")).toHaveText(String(total + LIMITS.quote.words + 2));
    await openMenu(page);
    await expect(page.getByTestId("words-left")).toHaveText(`${over} ${over === 1 ? "word" : "words"} over the ${LIMITS.totalWords}-word limit. Trim something before you publish.`);
    await page.keyboard.press("Escape");

    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("region", { name: "Things to fix before publishing" })).toContainText(`Keep the whole exhbt to ${LIMITS.totalWords} words (it's ${total + LIMITS.quote.words + 2}).`);
    await expect(page.getByText("It's live.")).toHaveCount(0);
  });

  test("the flowchart stays on every exhbt, with 3 to 6 boxes", async ({ page }) => {
    await signInAs(page, "flo");
    await startWithCore(page, "Sections: the flowchart stays");
    // Not a section: nothing removes it, and the menu doesn't offer it.
    const processCard = page.getByRole("region", { name: "Process", exact: true });
    await expect(processCard.getByRole("button", { name: /^Remove process/ })).toHaveCount(0);
    await expect(sectionsArea(page).getByRole("region", { name: "Process" })).toHaveCount(0);
    await openMenu(page);
    const menu = page.getByTestId("words-left").locator("xpath=..");
    expect(await menu.getByRole("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")))).toEqual([
      "Add findings",
      "Add a graph",
      "Add an image",
      "Add a quote",
      "Add what I'd do next",
      "Add a link",
    ]);
    await page.keyboard.press("Escape");

    // 3 to 6 boxes.
    await expect(page.getByRole("button", { name: "Remove box 1" })).toBeDisabled();
    for (let n = 4; n <= LIMITS.flow.max; n++) await page.getByRole("button", { name: "Add a box at the end" }).click();
    await expect(page.getByLabel(/^Box \d$/)).toHaveCount(LIMITS.flow.max);
    await expect(page.getByRole("button", { name: "Add a box at the end" })).toHaveCount(0);

    // With every section taken away, the flowchart is still drawn, and publishing asks for findings or a graph.
    await page.getByRole("button", { name: "Remove findings" }).click();
    await expect(page.locator('ol[aria-label="Sections, in page order"]')).toHaveCount(0);
    await expect(preview(page).getByRole("list", { name: "Methodology" })).toBeVisible();
    for (let n = 4; n <= LIMITS.flow.max; n++) await page.getByLabel(`Box ${n}`, { exact: true }).fill(`Step ${n}`);
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const problems = page.getByRole("region", { name: "Things to fix before publishing" });
    await expect(problems.getByRole("link", { name: "Sections: Add findings or a graph, so the exhbt shows what came of the work." })).toBeVisible();
    await problems.getByRole("link", { name: /^Sections:/ }).click();
    await expect(page.getByRole("button", { name: "Add a section" })).toBeFocused();
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
    // The order the page always had: the question, the process, findings, the graph; the work in the footer.
    expect(await pageOrder(page.locator("main"))).toEqual(["The question", "Process", "Findings", "Graphs"]);
    await expect(page.getByRole("region", { name: "findings" }).getByRole("listitem")).toHaveCount(legacyGpDoc.findings.length);
    await expect(page.getByRole("table", { name: legacyGpDoc.charts[0]!.title })).toBeAttached();
    await expect(page.locator("article footer").getByRole("link", { name: /See the work: Final report \(PDF\)/ })).toBeVisible();
    expect(await articleOf("newer")).toBe(old);

    // In the editor it opens as sections, and nothing about its page changes until it's published again.
    await page.goto("/auth/dev?email=olden@example.com&next=/exhbts");
    await page.getByRole("link", { name: `Edit ${legacyGpDoc.title}` }).click();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    expect(await listOrder(page)).toEqual(["findings", "graph"]);
    await expect(page.getByRole("textbox", { name: "Finding 3" })).toContainText("Same-day bookings were unaffected");
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
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    expect(await listOrder(page)).toEqual(["findings", "graph", "quote", "reflection"]);
    await expect(page.getByLabel("The quote, word for word")).toHaveValue(QUOTE);
    await expect(page.getByLabel("Who said it")).toHaveValue("Priya Shah");
    await expect(page.getByLabel("Their role (optional)")).toHaveValue("Cafe manager");
    await expect(page.getByRole("textbox", { name: "What you'd do next, or do differently" })).toContainText("Next time I would time the evening queue too.");

    // Words in quotes with nobody named aren't a quote, and nothing is made up instead.
    const unnamed = await page.request.post("/api/exhbts/draft", { data: { text: 'Lunch queue study at the student union cafe. Someone wrote "the second till is great" on the board by the tills during the second week of the trial.' } });
    expect(unnamed.status()).toBe(200);
    await page.goto(`/exhbts/${((await unnamed.json()) as { id: string }).id}/edit`);
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    expect(await listOrder(page)).toEqual(["findings"]);
  });

  test("an exhbt with findings, a graph, a quote, what I'd do next and a link prints on one A4 page", async ({ page }) => {
    const title = "Sections: one printed page";
    await signInAs(page, "pia");
    await startWithCore(page, title);
    await fillFindings(page);
    await addSection(page, "Add a graph");
    const g = page.getByRole("group", { name: "Graph 1", exact: true });
    await g.getByLabel("Title", { exact: true }).fill("Average wait (minutes)");
    await g.getByLabel("Graph 1, row 1 group").fill("Lunch");
    await g.getByLabel("Graph 1, row 1 Before").fill("11");
    await g.getByLabel("Graph 1, row 1 After").fill("4");
    await addSection(page, "Add a quote");
    await page.getByLabel("The quote, word for word").fill(QUOTE);
    await page.getByLabel("Who said it").fill("Priya Shah");
    await page.getByLabel("Their role (optional)").fill("Cafe manager");
    await addSection(page, "Add what I'd do next");
    await page.getByRole("textbox", { name: "What you'd do next, or do differently" }).fill(NEXT);
    await addSection(page, "Add a link");
    await page.getByLabel("Web address").fill("https://example.com/queue-model");
    await page.getByLabel("What the link is").fill("Queue model notebook");
    await page.getByLabel("One line about it (optional)").fill("The timings and the code");
    await publish(page);

    await page.goto(`/p/pia/${slugify(title)}`);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("region", { name: "Feedback" })).toBeVisible();
    await expect(page.locator("article").getByRole("link", { name: "Queue model notebook" })).toBeVisible();
    const pdf = (await page.pdf({ format: "A4" })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  });
});
