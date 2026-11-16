import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { exhbtSummary, plain, text, wordCount, LIMITS, validateForPublish, withHighlight, type ExhbtDoc } from "../lib/exhbt/blocks";
import { openBankingDoc, sampleDocs } from "../lib/exhbt/sample";
import { withKeyFigure } from "../lib/exhbt/sections";

// The exhbt page in the layout Rory drew on 16 Nov 2026 (decision 0022): a sidebar with the person,
// what it is, where and when, the checks, the work and Save as PDF; the title as the question, the
// context line with its gap highlighted, the flowchart, and What I found beside a neighbouring graph.
// Seeded with fictional work by app/dev/portfolio (`with=open-banking` adds the sample in this layout).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const [GP] = sampleDocs as [ExhbtDoc, ExhbtDoc];
const PIXEL_7 = { viewport: devices["Pixel 7"].viewport, deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor, isMobile: true, hasTouch: true };
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

  test("Save as PDF opens the print dialog, and the page prints on one A4 page with the sidebar beside the work", async ({ page }) => {
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
    expect((await page.getByRole("complementary", { name: /and this work$/ }).boundingBox())!.x).toBeLessThan((await box(page, "article h1")).x);
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
  });

  test("a portfolio look restyles the page through the --xp-* variables", async ({ page }) => {
    const name = unique("look");
    await seed(page, name);
    await page.goto(`/p/${name}/open-banking`);
    await page.addStyleTag({ content: "[data-exhbt-route] { --xp-flow-end: rgb(1, 2, 3); --xp-accent: rgb(4, 5, 6); --xp-radius-box: 0px; } :root { --xp-page-ground: rgb(7, 8, 9); }" });
    await expect(page.locator("article [data-last]")).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(page.locator("article [data-last]")).toHaveCSS("border-top-left-radius", "0px");
    await expect(page.getByRole("link", { name: /^See the work/ })).toHaveCSS("background-color", "rgb(4, 5, 6)");
    expect(await page.locator("main#main").evaluate((m) => getComputedStyle(m.parentElement!).backgroundColor)).toBe("rgb(7, 8, 9)");
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

test.describe("The page in the editor", () => {
  test("the new fields, the Highlight button, and arranging sections in the preview", async ({ page }) => {
    const name = unique("ed");
    await seed(page, name);
    await page.goto(`/auth/dev?email=${name}@example.com&next=/exhbts`);
    await page.getByRole("link", { name: openBankingDoc.title, exact: true }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();

    await expect(page.getByLabel("Your question (the title)")).toHaveValue(openBankingDoc.title);
    await expect(page.getByLabel("What it is")).toHaveValue(openBankingDoc.context);
    await expect(page.getByLabel("Where and when")).toHaveValue(openBankingDoc.whereWhen!);
    await expect(page.getByLabel("One-sentence summary")).toHaveValue(openBankingDoc.summary!);
    await page.getByLabel("Where and when").fill("University of St Andrews, 2026");
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview.getByRole("complementary")).toContainText("University of St Andrews, 2026");

    // The context field: its bold is the highlight, and the button says so.
    const context = page.getByRole("textbox", { name: "Context", exact: true });
    await expect(context.locator("strong")).toHaveText("Nobody knows whether banks and fintechs will then cooperate or compete.");
    await expect(page.locator("#card-gap").locator("xpath=ancestor::section[1]").getByRole("button", { name: "Highlight, on" })).toHaveCount(0);
    await context.locator("strong").click();
    await expect(page.locator("#card-gap").locator("xpath=ancestor::section[1]").getByRole("button", { name: "Highlight, on" })).toBeVisible();

    // Arrange in the preview: move What I'd do next to the top; the cards on the left follow.
    await page.getByRole("button", { name: "Arrange sections" }).click();
    const arranged = preview.getByRole("list", { name: "Sections in the preview, in page order" });
    await expect(arranged.locator(":scope > li")).toHaveCount(3);
    await arranged.getByRole("button", { name: "Move what I'd do next up" }).click();
    await arranged.getByRole("button", { name: "Move what I'd do next up" }).click();
    await expect(arranged.getByRole("button", { name: "Move what I'd do next down" })).toBeFocused();
    await expect(page.locator('ol[aria-label="Sections, in page order"] > li')).toHaveCount(3);
    expect(await page.locator('ol[aria-label="Sections, in page order"] > li').evaluateAll((lis) => lis.map((li) => li.getAttribute("data-kind")))).toEqual(["reflection", "findings", "graph"]);
    await page.getByRole("button", { name: "Done arranging" }).click();
    expect(await preview.locator("article [data-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-part")))).toEqual(["process", "reflection", "findings", "graph"]);
    await axe(page, "editor with the new fields");
  });

  test("the AI draft (stand-in) writes the question, what it is, where and when, a summary and a highlighted gap", async ({ page }) => {
    const email = `${unique("draft")}@example.com`;
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/exhbts/new`);
    const res = await page.request.post("/api/exhbts/draft", { data: { text: "We timed lunchtime queues at the union cafe for two weeks, then tried a second till at the busiest hour. The queue fell, and staff said the rush felt calmer." } });
    expect(res.status()).toBe(200);
    const { id } = (await res.json()) as { id: string };
    await page.goto(`/exhbts/${id}/edit`);
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    await expect(page.getByLabel("Your question (the title)")).toHaveValue(/\?$/);
    await expect(page.getByLabel("What it is")).not.toHaveValue("");
    await expect(page.getByLabel("Where and when")).not.toHaveValue("");
    await expect(page.getByLabel("One-sentence summary")).not.toHaveValue("");
    await expect(page.getByRole("region", { name: "Preview" }).locator("article mark")).toHaveText("this draft is placeholder text");
  });
});
