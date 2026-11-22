import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { exhbtSummary, plain, text, wordCount, LIMITS, validateForPublish, withHighlight, type ExhbtDoc } from "../lib/exhbt/blocks";
import { fullDoc, openBankingDoc, sampleDocs } from "../lib/exhbt/sample";
import { withKeyFigure } from "../lib/exhbt/sections";
import { applyBlock, blockValue } from "../lib/exhbt/draft-blocks";
import { addSection, closeSheet, fillPlain, listOrder, menuItem, openAddSectionMenu, pageOrder, publish, seeAsVisitor, visitorRegion, waitEditor } from "./editor";
import { READY } from "./page-editor";
import { uniqueBytes } from "./unique-bytes";

// The exhbt page in the layout Rory drew on 16 Nov 2026 (decision 0022): a sidebar with the person,
// what it is, where and when, the checks, the work and Save as PDF; the title as the question, the
// context line with its gap highlighted, the flowchart, and What I found beside a neighbouring graph.
// Seeded with fictional work by app/dev/portfolio (`with=open-banking` adds the sample in this layout).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const [GP] = sampleDocs as [ExhbtDoc, ExhbtDoc];
const PIXEL_7 = { viewport: devices["Pixel 7"].viewport, deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor, isMobile: true, hasTouch: true };
/** A 1x1 PNG, for an image section. */
const PNG = uniqueBytes(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function seed(page: Page, username: string) {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=premium&with=open-banking`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
}

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("The exhbt's fields", () => {
  test("the summary falls back to the first finding; the new fields count and are checked", () => {
    expect(exhbtSummary(openBankingDoc)).toBe(openBankingDoc.summary);
    // An old exhbt has no summary: the first finding stands in, as plain text.
    expect(GP.summary).toBeUndefined();
    expect(exhbtSummary(GP)).toBe("3-hour reminders cut missed appointments from 7.9% to 6.5%.");
    expect(exhbtSummary({ ...GP, summary: "   " })).toBe(exhbtSummary(GP));
    expect(exhbtSummary({ sections: [], summary: "" })).toBe("");

    // Both count towards the 200 words, and both have limits on publish.
    expect(wordCount({ ...GP, whereWhen: "Leeds, May 2026", summary: "One two three." })).toBe(wordCount(GP) + 3 + 3);
    expect(validateForPublish(openBankingDoc)).toEqual([]);
    expect(validateForPublish({ ...GP, whereWhen: "x".repeat(LIMITS.whereWhenChars + 1) }).map((i) => i.path)).toEqual(["whereWhen"]);
    expect(validateForPublish({ ...GP, summary: Array.from({ length: LIMITS.summaryWords + 1 }, () => "w").join(" ") }).map((i) => i.path)).toEqual(["summary"]);
  });

  test("the highlight is the gap's words as written, or nothing", () => {
    const line = "Queues ran long. Nobody had timed a second till.";
    expect(withHighlight(line, "Nobody had timed a second till.")).toEqual([{ t: "Queues ran long. " }, { t: "Nobody had timed a second till.", b: true }]);
    expect(withHighlight(line, "not in the line")).toEqual(text(line));
    expect(withHighlight(line, "")).toEqual(text(line));
    expect(plain(withHighlight(line, "Queues ran long."))).toBe(line);
  });

  test("the AI's header carries where and when and the summary, so going back to it restores them", () => {
    const ai = blockValue({ ...openBankingDoc, whereWhen: "", summary: "" }, "header");
    expect(ai).toMatchObject({ whereWhen: "", summary: "" });
    const edited = { ...openBankingDoc, whereWhen: "Typed by the person", summary: "Also typed." };
    expect(applyBlock(edited, "header", ai)).toMatchObject({ whereWhen: "", summary: "" });
    // An AI version kept before these fields existed leaves the person's own alone.
    expect(applyBlock(edited, "header", { title: "T?", context: "C" })).toMatchObject({ title: "T?", whereWhen: "Typed by the person", summary: "Also typed." });
  });

  test("a key figure from an upload goes beside What I found", () => {
    const d = withKeyFigure(openBankingDoc, { fileId: "f-key", alt: "The phase diagram", caption: "Where the market ends up" });
    expect(d.sections.map((s) => s.kind)).toEqual(["findings", "image", "graph", "reflection"]);
    // Once only, and not past the image limit.
    expect(withKeyFigure(d, { fileId: "f-key", alt: "Again" })).toBe(d);
  });
});

test.describe("The exhbt page", () => {
  test("has the sidebar, the question, the highlighted gap, the flowchart and What I found beside the graph; no catalogue number or headline", async ({ page }) => {
    const name = unique("ob");
    await seed(page, name);
    await page.goto(`/p/${name}/open-banking`);
    await expect(page.getByRole("heading", { level: 1, name: openBankingDoc.title })).toBeVisible();

    const aside = page.getByRole("complementary", { name: "About Amara and this work" });
    await expect(aside.getByText("Amara Okafor", { exact: true })).toBeVisible();
    await expect(aside.getByText("Data analyst, health and public services")).toBeVisible();
    await expect(aside.getByRole("link", { name: "All of Amara's work" })).toHaveAttribute("href", `/p/${name}`);
    await expect(aside.getByRole("definition").filter({ hasText: openBankingDoc.context })).toBeVisible();
    await expect(aside.getByRole("definition").filter({ hasText: openBankingDoc.whereWhen! })).toBeVisible();
    const checks = aside.getByRole("list", { name: "Can you trust it?" }).getByRole("listitem");
    await expect(checks).toHaveText(["Confirmed by Amara", "Source attached", /^Checked by exhbt, \d{1,2} \w{3} \d{4}$/]);
    const work = aside.getByRole("link", { name: `See the work: ${openBankingDoc.evidence!.label}` });
    await expect(work).toHaveAttribute("href", "https://example.com/open-banking-dissertation.pdf");
    await expect(work).toHaveAttribute("target", "_blank");
    await expect(aside.getByRole("button", { name: "Save as PDF" })).toBeVisible();

    // The main column: skills, the question, the context with its gap highlighted, the flowchart.
    await expect(page.getByRole("list", { name: "Skills used" }).getByRole("listitem")).toHaveCount(openBankingDoc.skills.length);
    await expect(page.locator("article mark")).toHaveText("Nobody knows whether banks and fintechs will then cooperate or compete.");
    const steps = page.getByRole("list", { name: "Methodology" }).getByRole("listitem");
    await expect(steps).toHaveCount(openBankingDoc.flow.length);
    await expect(steps.last().locator("[data-last]")).toHaveCSS("background-color", "rgb(14, 15, 18)");
    expect(await page.getByRole("list", { name: "Methodology" }).evaluate((el) => getComputedStyle(el).flexDirection)).toBe("row");

    // What I found and the graph share a row, findings on the left.
    const found = page.locator("[data-found]");
    await expect(found.getByRole("heading", { name: "What I found" })).toBeVisible();
    await expect(found.locator('[data-part="findings"] li')).toHaveCount(3);
    const f = await box(page, '[data-found] [data-part="findings"]');
    const g = await box(page, '[data-found] [data-part="graph"]');
    expect(g.x).toBeGreaterThan(f.x + f.width - 1);
    expect(Math.abs(g.y + g.height / 2 - (f.y + f.height / 2))).toBeLessThan(80);
    // The sidebar is left of the main column.
    expect((await aside.boundingBox())!.x + (await aside.boundingBox())!.width).toBeLessThanOrEqual((await box(page, "article h1")).x);
    await expect(page.getByRole("region", { name: "What I'd do next" })).toContainText("Test the model against real partnership data");

    await expect(page.locator("article [data-catalogue]")).toHaveCount(0);
    await expect(page.locator("article [data-headline]")).toHaveCount(0);
    // The page sits on white, not the layout's mist.
    expect(await page.locator("main#main").evaluate((m) => getComputedStyle(m.parentElement!).backgroundColor)).toBe("rgb(255, 255, 255)");
    // The summary is the page's description.
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", new RegExp(`^${openBankingDoc.summary}`));
    await axe(page, "open-banking");
  });

  test("an exhbt saved before this layout still renders: the old bold run is the highlight, the first finding is the summary", async ({ page }) => {
    const name = unique("old");
    await seed(page, name);
    await page.goto(`/p/${name}/gp-reminders`);
    await expect(page.getByRole("heading", { level: 1, name: GP.title })).toBeVisible();
    await expect(page.locator("article mark")).toHaveText("Did the timing");
    const aside = page.getByRole("complementary", { name: /and this work$/ });
    await expect(aside.getByRole("definition").filter({ hasText: GP.context })).toBeVisible();
    // No where and when stored, so none is shown.
    await expect(aside.getByText("Where and when")).toHaveCount(0);
    await expect(page.locator("[data-found]").getByRole("heading", { name: "What I found" })).toBeVisible();
    await expect(page.locator('[data-found] [data-part="graph"]')).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", new RegExp(`^${exhbtSummary(GP).replace(/[.%]/g, "\\$&")}`));
    await axe(page, "gp-reminders");
  });

  test("Save as PDF opens the print dialog, and the page prints on one A4 page with the sidebar as a band above the work", async ({ page }) => {
    const name = unique("pdf");
    await seed(page, name);
    await page.addInitScript(() => {
      (window as unknown as { printed: number }).printed = 0;
      window.print = () => {
        (window as unknown as { printed: number }).printed++;
      };
    });
    await page.goto(`/p/${name}/open-banking`);
    await page.getByRole("button", { name: "Save as PDF" }).click();
    expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Save as PDF" })).toBeHidden();
    const band = (await page.getByRole("complementary", { name: /and this work$/ }).boundingBox())!;
    expect(band.y + band.height).toBeLessThanOrEqual((await box(page, "article h1")).y);
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
  });

  test("a full exhbt near the word cap (two graphs, a quote, a link, six boxes) still prints on one A4 page", async ({ page }) => {
    expect(wordCount(fullDoc)).toBeGreaterThan(LIMITS.totalWords - 10);
    expect(validateForPublish(fullDoc)).toEqual([]);
    const name = unique("full");
    const res = await page.request.get(`/dev/portfolio?username=${name}&plan=premium&with=full`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    await page.goto(`/p/${name}/open-banking-full`);
    await expect(page.getByRole("region", { name: "Feedback" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
  });

  test("a portfolio look restyles the page through the --xp-* variables", async ({ page }) => {
    const name = unique("look");
    await seed(page, name);
    await page.goto(`/p/${name}/open-banking`);
    // The --xp-* names still restyle the page directly (a look sets them through --pf-*, decision 0018).
    await page.addStyleTag({ content: "[data-exhbt-route] { --xp-flow-end: rgb(1, 2, 3); --xp-accent: rgb(4, 5, 6); --xp-radius-box: 0px; }" });
    await expect(page.locator("article [data-last]")).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(page.locator("article [data-last]")).toHaveCSS("border-top-left-radius", "0px");
    await expect(page.getByRole("link", { name: /^See the work/ })).toHaveCSS("background-color", "rgb(4, 5, 6)");
    // The frame round the page carries the look, so the ground behind it is the look's (white in Exhbt).
    expect(await page.locator("main#main").evaluate((m) => getComputedStyle(m.parentElement!).backgroundColor)).toBe("rgb(255, 255, 255)");
    await expect(page.locator("main#main").locator("..")).toHaveAttribute("data-look", "exhbt");
  });

  test("Night (PDF page 3) restyles every part, its graphs included, and keeps its text readable", async ({ page }) => {
    const name = unique("night");
    const res = await page.request.get(`/dev/portfolio?username=${name}&plan=max&look=night&with=open-banking`, { maxRedirects: 0 });
    expect(res.status(), await res.text()).toBe(307);
    await page.goto(`/p/${name}/open-banking`);
    await expect(page.locator("article")).toHaveCSS("background-color", "rgb(14, 15, 18)");
    await expect(page.locator("article h1")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator("article mark")).toHaveCSS("color", "rgb(255, 255, 255)");
    // The graph sits on Night's own dark card, not a white one.
    await expect(page.locator('[data-part="graph"]').first()).toHaveCSS("background-color", "rgb(23, 25, 29)");
    // The whole page, the sign-off and the pager included (they sit on the look's ground too).
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("The exhbt page on a phone", () => {
  test.use(PIXEL_7);

  test("the sidebar stacks above the work, the flowchart runs down, What I found sits over the graph, nothing scrolls sideways", async ({ page }) => {
    const name = unique("ph");
    await seed(page, name);
    await page.goto(`/p/${name}/open-banking`);
    await expect(page.getByRole("heading", { level: 1, name: openBankingDoc.title })).toBeVisible();
    const aside = (await page.getByRole("complementary", { name: /and this work$/ }).boundingBox())!;
    expect(aside.y + aside.height).toBeLessThanOrEqual((await box(page, "article h1")).y);
    await expect(page.getByRole("link", { name: "All of Amara's work" })).toBeVisible();
    expect(await page.getByRole("list", { name: "Methodology" }).evaluate((el) => getComputedStyle(el).flexDirection)).toBe("column");
    const f = await box(page, '[data-found] [data-part="findings"]');
    expect((await box(page, '[data-found] [data-part="graph"]')).y).toBeGreaterThanOrEqual(f.y + f.height - 1);
    expect(await noSideScroll(page)).toBe(true);
    await axe(page, "open-banking on a phone");
  });
});

/** A section's tools show while it has the pointer (decision 0026): move onto it first. */
const onSection = (page: Page, id: string) => page.locator(`${READY} [data-section-id="${id}"]`).hover();
/** Every item of the page in order, the flowchart included (the places a move counts). */
const items = (page: Page) => page.locator(`${READY} article [data-section-id]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section-id")!));
const said = (page: Page) => page.locator(`${READY} [data-said]`);

test.describe("The page in the editor", () => {
  test("the new fields, the Highlight button, and moving sections on the page", async ({ page }) => {
    const name = unique("ed");
    await seed(page, name);
    await page.goto(`/auth/dev?email=${name}@example.com&next=/exhbts`);
    await page.getByRole("link", { name: openBankingDoc.title, exact: true }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await waitEditor(page);

    await expect(page.locator("#title")).toHaveValue(openBankingDoc.title);
    await expect(page.locator("#context")).toHaveValue(openBankingDoc.context);
    await expect(page.locator("#whereWhen")).toHaveValue(openBankingDoc.whereWhen!);
    // The one-sentence summary is in the card's sheet.
    await page.getByRole("button", { name: "Card and link details" }).click();
    await expect(page.locator("#summary")).toHaveValue(openBankingDoc.summary!);
    await closeSheet(page);
    await fillPlain(page, page.locator("#whereWhen"), "University of St Andrews, 2026");
    await seeAsVisitor(page);
    await expect(visitorRegion(page).getByRole("complementary", { name: /and this work$/ })).toContainText("University of St Andrews, 2026");
    await seeAsVisitor(page, false);

    // The context field: its bold is the highlight (drawn as the page's mark), and the button says so once the cursor is in it.
    const context = page.locator(`${READY} [data-path="gap"]`);
    await context.scrollIntoViewIfNeeded();
    await context.click();
    await expect(context.locator("mark")).toHaveText("Nobody knows whether banks and fintechs will then cooperate or compete.");
    const highlight = page.getByRole("button", { name: "Highlight", exact: true });
    await expect(highlight).toHaveAttribute("aria-pressed", "false");
    await context.locator("mark").click();
    await expect(highlight).toHaveAttribute("aria-pressed", "true");

    // Move What I'd do next to the top of the sections with its buttons.
    expect(await listOrder(page)).toEqual(["findings", "graph", "reflection"]);
    await onSection(page, "reflection-1");
    const up = page.getByRole("button", { name: "Move what I'd do next up" });
    await up.click();
    await up.click();
    await expect(page.getByRole("button", { name: "Move what I'd do next down" })).toBeVisible();
    expect(await listOrder(page)).toEqual(["reflection", "findings", "graph"]);

    // The grip, from the keyboard (dnd-kit): Space, an arrow, Space.
    await onSection(page, "findings");
    await page.getByRole("button", { name: "Drag findings to move it" }).focus();
    const order = await items(page);
    const at = order.indexOf("findings") + 1;
    await page.keyboard.press("Space");
    await expect(said(page)).toHaveText(`Picked up findings, place ${at} of ${order.length}.`);
    await page.keyboard.press("ArrowUp");
    await expect(said(page)).toHaveText(`Findings would go to place ${at - 1} of ${order.length}.`);
    await page.keyboard.press("Space");
    await expect(said(page)).toHaveText(`Findings dropped in place ${at - 1} of ${order.length}.`);
    await expect.poll(() => listOrder(page)).toEqual(["findings", "reflection", "graph"]);
    await axe(page, "editor with the new fields");

    // The page a visitor sees is in the new order.
    await seeAsVisitor(page);
    expect(await pageOrder(visitorRegion(page))).toEqual(["process", "findings", "reflection", "graph"]);
  });

  test("an image moved next to What I found sits beside it on the published page; a new graph can be added and removed too", async ({ page }) => {
    const name = unique("img");
    await seed(page, name);
    await page.goto(`/auth/dev?email=${name}@example.com&next=/exhbts`);
    await page.getByRole("link", { name: openBankingDoc.title, exact: true }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await waitEditor(page);

    // An image (it lands last), with its description.
    await openAddSectionMenu(page);
    const chooser = page.waitForEvent("filechooser");
    await menuItem(page, "Add an image").click();
    await (await chooser).setFiles({ name: "phase-diagram.png", mimeType: "image/png", buffer: PNG });
    await fillPlain(page, page.getByLabel(/Image 1: describe it/), "Arrows towards cooperation and competition");
    // And a new graph, still blank: it opens its figures sheet.
    await addSection(page, "Add a graph");
    await closeSheet(page);

    expect(await listOrder(page)).toEqual(["findings", "graph", "reflection", "image", "graph"]);
    // Image 1 from place 4 to place 2, straight after What I found.
    await onSection(page, "image-1");
    await page.getByRole("button", { name: "Move image 1 up" }).click();
    await page.getByRole("button", { name: "Move image 1 up" }).click();
    await expect.poll(() => listOrder(page)).toEqual(["findings", "image", "graph", "reflection", "graph"]);
    await onSection(page, "graph-2");
    await page.getByRole("button", { name: "Remove graph 2" }).click();
    await expect(page.locator(`${READY} .xe-save`, { hasText: /^Saved$/ })).toBeVisible();

    await publish(page, { changes: true });
    await page.goto(`/p/${name}/open-banking`);
    const found = page.locator("[data-found]");
    await expect(found.locator('[data-part="image"] img')).toHaveAttribute("alt", "Arrows towards cooperation and competition");
    const f = await box(page, '[data-found] [data-part="findings"]');
    const im = await box(page, '[data-found] [data-part="image"]');
    expect(im.x).toBeGreaterThan(f.x + f.width - 1);
    // The graph, no longer next to the findings, takes the full width below.
    expect(await page.locator("article [data-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-part")))).toEqual(["process", "findings", "image", "graph", "reflection"]);
    expect((await box(page, '[data-part="graph"]')).width).toBeGreaterThan(f.width + im.width);
  });

  test("the AI draft (stand-in) writes the question, what it is, where and when, a summary and a highlighted gap", async ({ page }) => {
    const email = `${unique("draft")}@example.com`;
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/exhbts/new`);
    const res = await page.request.post("/api/exhbts/draft", { data: { text: "We timed lunchtime queues at the union cafe for two weeks, then tried a second till at the busiest hour. The queue fell, and staff said the rush felt calmer." } });
    expect(res.status()).toBe(200);
    const { id } = (await res.json()) as { id: string };
    await page.goto(`/exhbts/${id}/edit`);
    await waitEditor(page);
    await expect(page.locator("#title")).toHaveValue(/\?$/);
    await expect(page.locator("#context")).not.toHaveValue("");
    await expect(page.locator("#whereWhen")).not.toHaveValue("");
    await page.getByRole("button", { name: "Card and link details" }).click();
    await expect(page.locator("#summary")).not.toHaveValue("");
    await closeSheet(page);
    await seeAsVisitor(page);
    await expect(visitorRegion(page).locator("article mark")).toHaveText("this draft is placeholder text");
  });
});

/** The words of every step label that are split across lines (a Range over a word with more than one rect). */
const splitWords = (page: Page, scope: string) =>
  page.evaluate((sel) => {
    const split: string[] = [];
    for (const label of document.querySelectorAll(`${sel} ol[aria-label="Methodology"] li > div > span:first-child`)) {
      const node = label.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(node, m.index!);
        r.setEnd(node, m.index! + m[0].length);
        if (r.getClientRects().length !== 1) split.push(m[0]);
      }
    }
    return split;
  }, scope);

test.describe("The flowchart's row breakpoint follows its number of boxes", () => {
  test("a six-box case study at 1440 breaks no word, and is a column", async ({ page }) => {
    const name = unique("six");
    await page.request.get(`/dev/portfolio?username=${name}&plan=premium&with=flow`, { maxRedirects: 0 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/p/${name}/flow-six`);
    await expect(page.getByRole("list", { name: "Methodology" }).getByRole("listitem")).toHaveCount(6);
    expect(await splitWords(page, "article")).toEqual([]);
    // The main column is about 708px, under the 48rem a six-box row needs.
    expect(await page.locator('ol[aria-label="Methodology"]').evaluate((el) => getComputedStyle(el).flexDirection)).toBe("column");
  });

  test("a five-box case study at 1440 is a row and breaks no word", async ({ page }) => {
    const name = unique("five");
    await page.request.get(`/dev/portfolio?username=${name}&plan=premium&with=flow`, { maxRedirects: 0 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/p/${name}/flow-five`);
    await expect(page.getByRole("list", { name: "Methodology" }).getByRole("listitem")).toHaveCount(5);
    expect(await page.locator('ol[aria-label="Methodology"]').evaluate((el) => getComputedStyle(el).flexDirection)).toBe("row");
    expect(await splitWords(page, "article")).toEqual([]);
  });
});
