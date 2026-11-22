import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { text, validateForPublish, type ExhbtDoc, type Section, type SectionOf } from "../lib/exhbt/blocks";
import { normaliseNumber } from "../lib/exhbt/verify";
import { fullDoc, openBankingDoc } from "../lib/exhbt/sample";
import {
  allowEditOnly,
  boxes,
  differences,
  docNow,
  focusedPath,
  frame,
  freshName,
  full,
  jump,
  openDoc,
  openNew,
  READY,
  readStored,
  seeAsVisitor,
  settle,
  waitLive,
  waitReady,
  waitSaved,
} from "./page-editor";

/*
 * Graphs, pictures, links and the figure from the person's report, edited on the page (decisions
 * 0025 and 0026, agent J's): a graph's figures in a side sheet with the graph redrawing behind it; a
 * picture's description under it; the picked figure's label, its tick and its strip; a link's "Web
 * address"; "Take a figure from my report" when nothing was picked; and the drafted chart put back
 * once the report's own graph has gone. Drafts use the placeholder AI and e2e/fixtures/report-with-chart.pdf
 * (three pages of text and a bar chart on page 3), as e2e/auto-figure.spec.ts does.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const CHART_PDF = "e2e/fixtures/report-with-chart.pdf";
const TICK = "I may share this figure on my portfolio";

const bar = (page: Page) => page.locator(`${READY} [data-topbar]`);
const sheet = (page: Page, name: string) => page.locator(`dialog[data-sheet="${name}"]`);
const MENU = `${READY} [data-xe-menu]`;
const fileExists = async (page: Page, fileId: string) => (await page.request.get(`/dev/files/${fileId}`)).status() === 200;
const pressUndo = async (page: Page) => {
  // The cursor out of any field: Ctrl or Cmd and Z is the editor's Undo there.
  await page.locator(`${READY} h1`).focus();
  await page.keyboard.press("ControlOrMeta+z");
};
/** Requests to the AI's figure pick, from now on. */
const countPicks = (page: Page) => {
  const seen = { picks: 0 };
  page.on("request", (r) => {
    if (r.url().includes("/api/exhbts/figure-pick")) seen.picks++;
  });
  return seen;
};
/** axe on a part of the page, WCAG 2.1 A and AA. */
const scan = async (page: Page, selector: string) => (await new AxeBuilder({ page }).include(selector).withTags(WCAG).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);

/** Opens the "+" at the end of the page. */
async function openEndPlus(page: Page) {
  await page.locator(`${READY} #add-section`).click();
  await expect(page.locator(MENU)).toBeVisible();
}

/**
 * Drafts from the chart report on the draft page, as a person does, and waits for the editor; returns
 * the exhbt's id. `failPick` makes the AI's figure pick fail; `notes` go in the notes box.
 */
async function draftFromReport(page: Page, tag: string, opts: { failPick?: boolean; notes?: string } = {}): Promise<string> {
  if (opts.failPick) await page.route("**/api/exhbts/figure-pick", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "We couldn't pick a figure just now." }) }));
  const username = freshName(tag);
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
  await page.locator("#files").setInputFiles(CHART_PDF);
  await expect(page.getByTestId("file-status")).toContainText("uploaded");
  if (opts.notes) await page.locator("#notes").fill(opts.notes);
  await page.getByRole("button", { name: "Draft my exhbt" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit/, { timeout: 120_000 });
  await waitReady(page);
  return page.url().match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
}

/** The rect of each element inside `root` that shows words of its own, but those inside `skip`. */
function wordBoxes(root: Locator, skip: string) {
  return root.evaluate((el, skipSel) => {
    const out: { text: string; x: number; y: number; w: number; h: number }[] = [];
    for (const e of el.querySelectorAll("*")) {
      // What isn't seen: the controls being checked, and the hidden data table (an sr-only wrapper clips it, though its cells keep their size).
      if (e.closest(skipSel) || e.closest(".sr-only")) continue;
      const own = [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (!own) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      out.push({ text: e.textContent!.trim().slice(0, 40), x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  }, skip);
}
const rectOf = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x, y: b.y, w: b.width, h: b.height });
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test.describe("a graph's figures", () => {
  test("a new graph opens its sheet; typing redraws the graph behind it; the kind changes; a chart issue jumps to its field; the chip covers no words", async ({ page }) => {
    const id = await openNew(page, freshName("graph"));
    await openEndPlus(page);
    await page.locator(`${MENU} [data-block="graph"]`).click();
    const s = sheet(page, "chart");
    await expect(s).toBeVisible();
    await expect(s.getByRole("group", { name: "Graph 1", exact: true })).toBeVisible();
    const graphId = (await docNow(page)).sections.find((x) => x.kind === "graph")!.id;
    const card = frame(page, graphId).locator('[data-part="graph"]');
    // No numbers yet: "Add your numbers" over it, not an empty axis.
    await expect(card.getByText("Add your numbers")).toBeAttached();

    // Typed in the sheet, drawn on the page behind it.
    await s.getByLabel("Title", { exact: true }).fill("Missed appointments by reminder time, in a title long enough to reach the corner");
    await s.getByLabel("Graph 1, row 1 group").fill("Week 1");
    await s.getByLabel("Graph 1, row 1 Before").fill("12");
    await s.getByLabel("Graph 1, row 1 After").fill("8");
    await expect(s).toBeVisible();
    await expect(card).toContainText("Missed appointments by reminder time");
    await expect(card).toContainText("12");
    await expect(card.getByText("Add your numbers")).toHaveCount(0);
    expect(await page.evaluate(() => window.__exhbtEditor!.undoLabel())).toBe("add graph 1");

    // Another kind: the page follows.
    await s.getByRole("radio", { name: "Bars", exact: true }).check({ force: true });
    await expect.poll(async () => ((await docNow(page)).sections.find((x) => x.id === graphId) as SectionOf<"graph">).chart.kind).toBe("bar");
    expect(await scan(page, 'dialog[data-sheet="chart"]')).toEqual([]);

    // An issue in the chart lands on its field in the sheet: the first bar's name, emptied.
    await s.getByLabel("Graph 1, bar 1 label").fill("");
    await page.keyboard.press("Escape");
    await expect(s).toBeHidden();
    const n = (await docNow(page)).sections.findIndex((x) => x.id === graphId);
    const path = `sections.${n}.chart.rows.0.label`;
    expect(validateForPublish(await docNow(page)).some((i) => i.path === path)).toBe(true);
    await page.evaluate(() => window.__exhbtUi!.setTried(true));
    await bar(page).getByRole("button", { name: /things? to fix$/ }).click();
    await page.getByRole("region", { name: "Things to fix before publishing" }).locator(`[data-issue-path="${path}"]`).click();
    await expect(s).toBeVisible();
    await expect(s.getByLabel("Graph 1, bar 1 label")).toBeFocused();
    await expect.poll(() => focusedPath(page)).toBe(path);
    await page.keyboard.press("Escape");

    // A press on the graph itself opens the sheet too.
    await card.click({ position: { x: 60, y: 60 } });
    await expect(s).toBeVisible();
    await s.getByRole("button", { name: "Done" }).click();
    await expect(s).toBeHidden();

    // "Edit figures" over the graph's corner, named for it, covers none of its words, nor the toolbar shown on hover.
    await frame(page, graphId).hover();
    const chip = frame(page, graphId).getByRole("button", { name: "Edit figures: Graph 1" });
    await expect(chip).toBeVisible();
    const c = rectOf((await chip.boundingBox())!);
    const words = await wordBoxes(card, ".xe-fig-graph");
    expect(words.length).toBeGreaterThan(2);
    expect(words.filter((w) => overlaps(c, w)).map((w) => `${w.text} at ${[w.x, w.y, w.w, w.h].map(Math.round).join(",")}`), `the chip at ${[c.x, c.y, c.w, c.h].map(Math.round).join(",")}`).toEqual([]);
    const tools = rectOf((await frame(page, graphId).locator(".xe-tools").boundingBox())!);
    expect(overlaps(c, tools)).toBe(false);
    await waitSaved(page, id);
  });
});

test.describe("a picture's description", () => {
  test("typed under the picture, saved at sections.N.alt; Needs a description goes; publishing waits for it and Things to fix lands in it", async ({ page }) => {
    const doc: ExhbtDoc = { ...openBankingDoc, sections: [...openBankingDoc.sections, { id: "image-1", kind: "image", fileId: "x", alt: "", caption: [], w: 1200, h: 800 }] } as ExhbtDoc;
    const n = doc.sections.findIndex((x) => x.id === "image-1");
    expect(validateForPublish(doc).map((i) => i.path)).toEqual([`sections.${n}.alt`]);
    const { id } = await openDoc(page, freshName("alt"), doc);
    const fig = frame(page, "image-1");
    const description = page.locator(`${READY} #image-0-alt`);
    await expect(description).toHaveAttribute("data-path", `sections.${n}.alt`);
    await expect(description).toHaveAccessibleName("Image 1: describe it for people who can't see it");
    // The figure's last child, and the mark at its end.
    expect(await fig.locator("figure").evaluate((f) => f.lastElementChild?.getAttribute("data-edit-only"))).toBe("image-description");
    await expect(fig.getByText("Needs a description")).toBeVisible();

    // Publishing is blocked, and Things to fix puts the cursor in the description.
    await bar(page).getByRole("button", { name: "Review and publish" }).click();
    const publish = sheet(page, "publish");
    await publish.getByLabel("This is my work, and the numbers are true").check();
    // Seeded as a published exhbt, so its button is "Publish changes".
    await publish.getByRole("button", { name: /^Publish( changes)?$/ }).click();
    await expect(publish.getByText("1 thing to fix before this can go live.")).toBeVisible();
    await page.keyboard.press("Escape");
    await bar(page).getByRole("button", { name: /thing to fix$/ }).click();
    await page.getByRole("region", { name: "Things to fix before publishing" }).locator(`[data-issue-path="sections.${n}.alt"]`).click();
    await expect(description).toBeFocused();

    await page.keyboard.type("A bar chart of missed appointments by reminder time");
    await expect(fig.getByText("Needs a description")).toHaveCount(0);
    await waitSaved(page, id);
    expect(((await readStored(page, id)).working.sections[n] as SectionOf<"image">).alt).toBe("A bar chart of missed appointments by reminder time");
    await bar(page).getByRole("button", { name: "Review and publish" }).click();
    await publish.getByRole("button", { name: /^Publish( changes)?$/ }).click();
    await expect(publish.getByText(/^(It's live\.|Your changes are live\.)$/)).toBeVisible();
  });

  test("in a gallery's narrow tiles the empty description wraps in its caption's type, and its mark stays inside the tile, a dot where the words don't fit", async ({ page }) => {
    const pictures: Section[] = Array.from({ length: 5 }, (_, i) => ({ id: `image-${i + 1}`, kind: "image", fileId: `x${i + 1}`, alt: "", caption: text(i % 2 ? "A caption" : ""), w: i % 2 ? 800 : 1200, h: 1000 }));
    const doc: ExhbtDoc = { ...openBankingDoc, format: "gallery", sections: [...openBankingDoc.sections.filter((s) => s.kind !== "graph"), ...pictures] } as ExhbtDoc;
    await openDoc(page, freshName("tiles"), doc);
    await settle(page);
    for (const p of pictures.slice(1)) {
      const tile = frame(page, p.id);
      // The words are there for screen readers whatever the room.
      await expect(tile.getByText("Needs a description")).toBeAttached();
      const mark = tile.locator(".xe-fig-needs");
      await expect(mark).toBeVisible();
      const t = (await tile.boundingBox())!;
      const m = (await mark.boundingBox())!;
      expect(m.x).toBeGreaterThanOrEqual(t.x - 0.5);
      expect(m.x + m.width).toBeLessThanOrEqual(t.x + t.width + 0.5);
      // On the description's own lines: never hanging under the tile into the next row.
      expect(m.y + m.height).toBeLessThanOrEqual(t.y + t.height + 0.5);
      // In the caption's type: 0.8125rem in a tile.
      expect(await tile.locator('[data-edit-only="image-description"]').evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
    }
    await page.locator(`${READY} article`).screenshot({ path: test.info().outputPath("gallery-descriptions.png") });
  });
});

test.describe("the figure picked from the report", () => {
  test("the label holds the unticked tick; ticking it there clears the issue; Crop and Choose another page work from its popover with no AI call", async ({ page }) => {
    // Drafts and draws pages from the PDF: several routes compiled for the first time in dev.
    test.setTimeout(180_000);
    const id = await draftFromReport(page, "picked");
    const doc = await docNow(page);
    const n = doc.sections.findIndex((s) => s.kind === "image");
    const image = doc.sections[n] as SectionOf<"image">;
    expect(image.picked).toMatchObject({ page: 3, shareOk: false, kind: "graph" });
    const fig = frame(page, image.id);
    const label = fig.locator(".xe-fig-picked");
    await expect(label).toBeVisible();
    await expect(label.getByRole("button", { name: /^From your report, page 3/ })).toBeVisible();
    const tick = label.getByRole("checkbox", { name: TICK });
    await expect(tick).not.toBeChecked();
    await expect(label).toContainText("I may share this");

    // The issue is on the tick in the label, where the jump lands.
    const tickPath = `sections.${n}.picked.shareOk`;
    await page.evaluate(() => window.__exhbtUi!.setTried(true));
    await expect(tick).toHaveAttribute("aria-invalid", "true");
    await jump(page, tickPath);
    await expect(tick).toBeFocused();
    const seen = countPicks(page);
    // Ticked, it leaves the label (so check() can't see it stay ticked): the focus goes to where the figure came from.
    await tick.click();
    await expect(label.getByRole("checkbox")).toHaveCount(0);
    await expect(label.getByRole("button", { name: /^From your report, page 3/ })).toBeFocused();
    await expect(label.getByRole("button", { name: /^From your report, page 3/ })).toBeVisible();
    expect(validateForPublish(await docNow(page)).some((i) => i.path === tickPath)).toBe(false);

    // The strip, in the label's popover: crop it again.
    const img = fig.locator("img").first();
    const first = await img.getAttribute("src");
    await label.getByRole("button", { name: /^From your report/ }).click();
    const pop = label.locator("[popover]");
    await expect(pop).toBeVisible();
    await expect(pop.getByRole("checkbox", { name: TICK })).toBeChecked();
    await pop.getByRole("button", { name: "Crop", exact: true }).click();
    const cropper = pop.getByTestId("cropper");
    // The first page drawn from the PDF on this page loads pdf.js, compiled on first use in development.
    await expect(cropper.getByRole("img", { name: "Page 3 of report-with-chart.pdf" })).toBeVisible({ timeout: 60_000 });
    await cropper.getByLabel("Bottom edge").fill("40");
    await cropper.getByRole("button", { name: "Use this crop" }).click();
    await expect(pop.getByText("Cropped.")).toBeVisible();
    await expect.poll(() => img.getAttribute("src")).not.toBe(first);
    expect(((await docNow(page)).sections[n] as SectionOf<"image">).picked?.box?.h).toBeLessThan(0.45);

    // Another page: another figure, so the tick starts again, on the label.
    await pop.getByRole("button", { name: "Choose another page" }).click();
    await pop.getByTestId("page-picker").getByRole("button", { name: "Page 1", exact: true }).click();
    await expect(pop.getByText("Page 1 is in. Crop it to the figure, then describe it.")).toBeVisible();
    await expect(label.getByRole("button", { name: /^From your report, page 1/ })).toBeVisible();
    await expect(label.getByRole("checkbox", { name: TICK })).not.toBeChecked();
    expect(seen.picks).toBe(0);
    await waitSaved(page, id);
  });
});

test.describe("a link's web address", () => {
  test("a new link opens its popover with the cursor in it; the address is stored; the button shows without hovering and is marked while missing or wrong", async ({ page }) => {
    const id = await openNew(page, freshName("link"));
    await openEndPlus(page);
    await page.locator(`${MENU} [data-block="link"]`).click();
    const doc = await docNow(page);
    const n = doc.sections.findIndex((s) => s.kind === "link");
    const linkId = doc.sections[n]!.id;
    const input = page.locator(`${READY} [data-path="sections.${n}.href"]`);
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    expect(await input.evaluate((el) => el.closest("[popover]")!.matches(":popover-open"))).toBe(true);
    await expect(page.locator(`${READY} label[for="${await input.getAttribute("id")}"]`)).toHaveText("Web address");

    await page.keyboard.type("https://github.com/someone/model");
    await expect.poll(async () => ((await docNow(page)).sections[n] as SectionOf<"link">).href).toBe("https://github.com/someone/model");
    await page.keyboard.press("Enter");
    await expect(input).toBeHidden();

    // Shown with the pointer elsewhere, and marked only while the address is missing or wrong.
    await page.mouse.move(5, 5);
    const button = frame(page, linkId).getByRole("button", { name: "Web address: Link" });
    await expect(button).toBeVisible();
    expect(await button.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await expect(button).not.toHaveAttribute("data-missing");
    await button.click();
    await expect(input).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await expect(button).toHaveAttribute("data-missing", "");
    // A bad address: its issue, in the popover.
    await page.keyboard.type("http://github.com/someone/model");
    await expect(page.locator(`${READY} [popover]:popover-open`)).toContainText("Use a full https:// link.");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(button).toHaveAttribute("data-missing", "");
    await page.keyboard.press("Escape");
    await waitSaved(page, id);
    expect(((await readStored(page, id)).working.sections[n] as SectionOf<"link">).href).toBe("http://github.com/someone/model");
  });
});

test.describe("take a figure from my report", () => {
  test("after a pick that failed: the + offers it; page 3 and a crop put the figure where the layout wants it, unticked, with no AI call; Undo takes it off and its file goes once nothing can bring it back", async ({ page }) => {
    test.setTimeout(180_000);
    const id = await draftFromReport(page, "take", { failPick: true });
    const before = await docNow(page);
    expect(before.sections.some((s) => s.kind === "image")).toBe(false);
    expect(before.sections.some((s) => s.kind === "graph")).toBe(true);
    const seen = countPicks(page);

    await openEndPlus(page);
    const item = page.locator(`${MENU} [data-block="figure"]`);
    await expect(item).toBeEnabled();
    await expect(item).toContainText("Take a figure from my report");
    await item.click();
    const s = sheet(page, "figure");
    await expect(s).toBeVisible();
    const picker = s.getByTestId("page-picker");
    await expect(picker.getByRole("button", { name: /^Page \d/ })).toHaveCount(4);
    expect(await scan(page, 'dialog[data-sheet="figure"]')).toEqual([]);
    await picker.getByRole("button", { name: "Page 3", exact: true }).click();
    const cropper = s.getByTestId("cropper");
    await expect(cropper.getByRole("img", { name: "Page 3 of report-with-chart.pdf" })).toBeVisible();
    await cropper.getByLabel("Bottom edge").fill("55");
    await cropper.getByRole("button", { name: "Use this crop" }).click();
    await expect(s).toBeHidden();

    // Straight after the findings (a case study), from the report, not ticked, and the cursor in its description.
    const doc = await docNow(page);
    const at = doc.sections.findIndex((x) => x.kind === "image");
    expect(doc.sections[at - 1]!.kind).toBe("findings");
    const image = doc.sections[at] as SectionOf<"image">;
    expect(image.picked).toMatchObject({ from: "report-with-chart.pdf", page: 3, shareOk: false });
    expect(image.picked?.kind).toBeUndefined();
    expect(image.picked?.box?.h).toBeCloseTo(0.55, 2);
    expect(image.w).toBeGreaterThan(image.h!);
    // It removed no graph: the person chose it by hand.
    expect(doc.sections.some((x) => x.kind === "graph")).toBe(true);
    await expect(page.locator(`${READY} #image-0-alt`)).toBeFocused();
    await expect(frame(page, image.id).locator("img")).toBeVisible();
    await expect(frame(page, image.id).getByRole("checkbox", { name: TICK })).not.toBeChecked();
    expect(await page.evaluate(() => window.__exhbtEditor!.undoLabel())).toBe("take a figure");
    expect(seen.picks).toBe(0);

    // Saved with it: the file is kept. Undo: the figure goes, and once the save without it lands nothing can bring it back.
    await waitSaved(page, id);
    expect(await fileExists(page, image.fileId)).toBe(true);
    await pressUndo(page);
    await expect(frame(page, image.id)).toHaveCount(0);
    expect((await docNow(page)).sections.map((x) => x.id)).toEqual(before.sections.map((x) => x.id));
    await waitSaved(page, id);
    await expect.poll(() => fileExists(page, image.fileId)).toBe(false);
    // The report itself stays.
    expect(await fileExists(page, image.picked!.sourceFileId!)).toBe(true);
    // Nothing picked now, so the + offers it again.
    await openEndPlus(page);
    await expect(page.locator(`${MENU} [data-block="figure"]`)).toBeEnabled();
  });
});

test.describe("the drafted chart, put back", () => {
  test("not while the report's graph is on the page; after it is removed and the findings rewritten, Put it back returns it with its numbers to check, and the stored doc never held it meanwhile", async ({ page }) => {
    test.setTimeout(180_000);
    // The placeholder AI adds a worked-out total to its graph: a number the report doesn't have.
    const id = await draftFromReport(page, "putback", { notes: "stand-in: add a figure to check" });
    const offer = page.getByTestId("drafted-graph");
    const doc = await docNow(page);
    const image = doc.sections.find((s) => s.kind === "image") as SectionOf<"image">;
    expect(image.picked?.kind).toBe("graph");
    expect(doc.sections.some((s) => s.kind === "graph")).toBe(false);
    const kept = (await readStored(page, id)).aiVersion as { graphs?: { rows: { label: string; value: number }[] }[] };
    expect(kept.graphs?.length).toBe(1);
    const total = kept.graphs![0]!.rows.find((r) => r.label === "Worked-out total")!.value;
    await settle(page);
    await expect(offer).toHaveCount(0);

    // The report's graph removed: the offer appears.
    await frame(page, image.id).hover();
    await frame(page, image.id).locator('[data-tool="remove"]').click();
    await expect(offer).toBeVisible();
    await expect(offer).toContainText("The chart drafted from your numbers is kept.");
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.sections.some((s) => s.kind === "graph")).toBe(false);

    // A rewrite of the findings in between keeps the kept graphs.
    const findingsId = (await docNow(page)).sections.find((s) => s.kind === "findings")!.id;
    await frame(page, findingsId).hover();
    await frame(page, findingsId).getByRole("button", { name: /^More actions for/ }).click();
    await frame(page, findingsId).getByRole("button", { name: "Rewrite this block" }).click();
    await frame(page, findingsId).getByRole("button", { name: /^Rewrite the .* now$/ }).click();
    await expect(frame(page, findingsId).getByText(/^Rewritten\./)).toBeVisible({ timeout: 60_000 });
    await waitSaved(page, id);
    const stored = await readStored(page, id);
    expect(stored.working.sections.some((s) => s.kind === "graph")).toBe(false);
    expect((stored.aiVersion as { graphs?: unknown[] }).graphs?.length).toBe(1);

    await offer.getByRole("button", { name: "Put it back" }).click();
    await expect(offer).toHaveCount(0);
    const now = await docNow(page);
    const g = now.sections.find((s) => s.kind === "graph") as SectionOf<"graph">;
    expect(g.chart).toEqual(kept.graphs![0]);
    // Where the layout wants it: straight after the findings.
    expect(now.sections[now.sections.indexOf(g) - 1]!.kind).toBe("findings");
    // The worked-out total is in the numbers to check again.
    expect((now.unverified ?? []).map(normaliseNumber)).toContain(normaliseNumber(String(total)));
    expect(await page.evaluate(() => window.__exhbtEditor!.undoLabel())).toBe("put the drafted chart back");
    await expect(frame(page, g.id).getByRole("button", { name: /^Edit figures: / })).toBeFocused();
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.sections.some((s) => s.kind === "graph")).toBe(true);
  });
});

test.describe("nothing moves", () => {
  test("the picked-figure label, Edit figures and Web address take no room: a full page is the visitor's box for box but for the description field and the Add a skill box", async ({ page }) => {
    const picked: Section = { id: "image-1", kind: "image", fileId: "x", alt: "", caption: text("Missed appointments by reminder time"), w: 1200, h: 700, picked: { from: "report.pdf", page: 3, box: { x: 0, y: 0, w: 1, h: 0.5 }, shareOk: false } };
    const sections = fullDoc.sections.map((s) => (s.kind === "link" ? { ...s, href: "" } : s));
    const doc = full({ ...fullDoc, sections: [...sections, picked] } as ExhbtDoc);
    await openDoc(page, freshName("nomove"), doc);
    await waitLive(page);
    await settle(page);
    // They are there, drawn over their parts.
    await expect(frame(page, "image-1").locator(".xe-fig-picked")).toBeVisible();
    await expect(frame(page, "image-1").getByRole("checkbox", { name: TICK })).toBeVisible();
    const link = (await docNow(page)).sections.find((s) => s.kind === "link")!;
    await expect(frame(page, link.id).getByRole("button", { name: /^Web address: / })).toHaveAttribute("data-missing", "");
    const graph = (await docNow(page)).sections.find((s) => s.kind === "graph")!;
    await expect(frame(page, graph.id).getByRole("button", { name: /^Edit figures: / })).toBeVisible();
    const taken = await allowEditOnly(page, "always");
    expect(taken.join("; ")).toContain("an image's description field (1)");
    await settle(page);
    const editing = await boxes(page);
    await seeAsVisitor(page, true);
    await settle(page);
    expect(differences(await boxes(page), editing)).toEqual([]);
  });
});
