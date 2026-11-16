import { expect, test, type Page } from "@playwright/test";
import { emptyDoc, publicDoc, text, validateForPublish, type ExhbtDoc } from "../lib/exhbt/blocks";
import { withKeyFigure } from "../lib/exhbt/sections";
import { FIGURE, clampBox, fitCaption, mayHoldFigure, withMargin } from "../lib/figures/rules";
import { uniqueEmail } from "./helpers";

// The figure picked from an upload (decision 0017): the PDF's pages drawn in the browser, the
// stand-in AI's pick (the first page that draws shapes, with a box that covers the chart in the
// fixture), the figure cut out and placed beside What I found, the share tick that publishing
// waits for, cropping again, another page, removing it, and drafts that end up with no figure.
// The PDFs are e2e/fixtures/*.pdf, made by e2e/fixtures/make-figure-pdfs.mjs.

const CHART_PDF = "e2e/fixtures/report-with-chart.pdf";
const TEXT_PDF = "e2e/fixtures/report-text-only.pdf";
const WARNING = "Picked from your report. Check you're allowed to share it.";
const TICK = "I may share this figure on my portfolio";
const NEEDS_TICK = "Tick that you may share this figure, or remove it.";

test.describe("Picked figure rules", () => {
  const base = (): ExhbtDoc => ({
    ...emptyDoc(),
    sections: [
      { id: "findings", kind: "findings", items: [text("One"), text("Two")] },
      { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "x", rows: [] } as never },
    ],
  });
  const picked = { from: "report.pdf", sourceFileId: "src", page: 3, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, shareOk: false };

  test("goes straight after the findings, and publishing waits for the tick", () => {
    const doc = withKeyFigure(base(), { fileId: "f1", alt: "A bar chart", caption: "Missed appointments", picked });
    expect(doc.sections.map((s) => s.kind)).toEqual(["findings", "image", "graph"]);
    const issue = validateForPublish(doc).find((i) => i.path === "sections.1.picked.shareOk");
    expect(issue?.message).toBe(NEEDS_TICK);
    const ticked = { ...doc, sections: doc.sections.map((s) => (s.kind === "image" ? { ...s, picked: { ...picked, shareOk: true } } : s)) };
    expect(validateForPublish(ticked).some((i) => i.path.endsWith("picked.shareOk"))).toBe(false);
    // Employers never see where it came from.
    expect(JSON.stringify(publicDoc(ticked))).not.toContain("report.pdf");
    expect(publicDoc(ticked).sections[1]).toMatchObject({ kind: "image", fileId: "f1", alt: "A bar chart" });
  });

  test("boxes stay on the page, captions within the limit, plain text pages are never sent", () => {
    expect(clampBox({ x: -1, y: 0.2, w: 3, h: 0.5 })).toEqual({ x: 0, y: 0.2, w: 1, h: 0.5 });
    expect(clampBox({ x: 0.5, y: 0.5, w: 0.01, h: 0.5 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(withMargin({ x: 0.01, y: 0.5, w: 0.98, h: 0.2 })).toEqual({ x: 0, y: 0.48, w: 1, h: expect.closeTo(0.24, 5) });
    expect(fitCaption("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen").split(" ")).toHaveLength(15);
    expect(mayHoldFigure({ shapes: 0, pictures: 0 })).toBe(false);
    expect(mayHoldFigure({ shapes: FIGURE.minShapes - 1, pictures: 0 })).toBe(false);
    expect(mayHoldFigure({ shapes: FIGURE.minShapes, pictures: 0 })).toBe(true);
    expect(mayHoldFigure({ shapes: 0, pictures: 1 })).toBe(true);
  });
});

/** A dev user with a username on Premium (so they can publish), signed in on the draft page. */
async function signInPremium(page: Page, username: string) {
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft an exhbt" })).toBeVisible();
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** Adds a file on the draft page and waits until it is read and uploaded. */
async function addFile(page: Page, path: string) {
  await page.locator("#files").setInputFiles(path);
  await expect(page.getByTestId("file-status")).toContainText("uploaded");
}

/** Drafts and waits for the editor. */
async function draft(page: Page) {
  await page.getByRole("button", { name: "Draft my exhbt" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 60_000 });
  await expect(page.locator("[data-ready=true]")).toBeAttached();
}

const sectionKinds = (page: Page) => page.locator("li[data-section-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));

test.describe("Draft from a PDF with a chart", () => {
  test("the chart is picked and placed beside the findings; publishing waits for the share tick", async ({ page }) => {
    const username = `fig${Date.now().toString(36)}`;
    await signInPremium(page, username);
    await addFile(page, CHART_PDF);

    const picked = page.waitForResponse((r) => r.url().includes("/api/exhbts/figure-pick"));
    const placed = page.waitForResponse((r) => /\/api\/exhbts\/[0-9a-f-]{36}\/figure$/.test(r.url()));
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    // Beside the draft, its own step.
    await expect(page.getByTestId("drafting").getByText("Picking a figure from your report")).toBeVisible();
    const pick = await picked;
    expect(pick.status()).toBe(200);
    // Only the chart page was sent: the text pages draw nothing besides text.
    const sent = pick.request().postDataBuffer()?.toString("latin1") ?? "";
    expect(sent).toContain("report-with-chart.pdf, page 3");
    expect(sent).not.toContain("page 1");
    expect((await pick.json()).pick).toMatchObject({ image: 1 });
    expect((await placed).status()).toBe(204);
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator("[data-ready=true]")).toBeAttached();

    // In the editor: an image section straight after the findings, with the warning and the tick.
    expect(await sectionKinds(page)).toEqual(["findings", "image", "graph"]);
    const note = page.locator("[data-picked]");
    await expect(note.getByText(WARNING)).toBeVisible();
    await expect(note.getByText("From report-with-chart.pdf, page 3.", { exact: false })).toBeVisible();
    await expect(note.getByLabel(TICK)).not.toBeChecked();
    await expect(page.getByLabel("Image 1: describe it for people who can't see it")).toHaveValue(/Development preview/);

    // In the preview, the figure shares a row with the findings, cut out of the page (wider than tall).
    const figure = page.getByRole("region", { name: "Preview" }).locator("[data-found] [data-part=image] img");
    await expect(figure).toBeVisible();
    const size = await figure.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    expect(size.w).toBeGreaterThan(1000);
    expect(size.w).toBeGreaterThan(size.h);

    // Publishing is blocked until the tick, and the problem links to the card.
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const problem = page.getByRole("link", { name: `Image 1: ${NEEDS_TICK}` });
    await expect(problem).toBeVisible();
    await expect(problem).toHaveAttribute("href", "#card-section-1");
    await expect(page.getByText("It's live.")).toHaveCount(0);

    await note.getByLabel(TICK).check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toBeVisible();

    // The live page shows the figure beside the findings, and nothing about where it came from.
    const href = await page.getByRole("link", { name: new RegExp(`^/p/${username}/`) }).getAttribute("href");
    await page.goto(href!);
    await expect(page.locator("[data-found] [data-part=image] img")).toBeVisible();
    await expect(page.getByText(WARNING)).toHaveCount(0);
  });

  test("another page, a new crop, and removing it; no AI call for any of them", async ({ page }) => {
    await signInPremium(page, `fig${Date.now().toString(36)}b`);
    await addFile(page, CHART_PDF);
    await draft(page);
    const note = page.locator("[data-picked]");
    await expect(note.getByText(WARNING)).toBeVisible();
    let picks = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/exhbts/figure-pick")) picks++;
    });
    const imageSrc = () => page.locator("li[data-kind=image] img").first().getAttribute("src");
    const first = await imageSrc();

    // The page picker: every page of the report, the one in use marked.
    await note.getByRole("button", { name: "Choose another page" }).click();
    const picker = page.getByTestId("page-picker");
    await expect(picker.getByRole("button", { name: /^Page \d/ })).toHaveCount(4);
    await expect(picker.getByRole("button", { name: "Page 3, in use now" })).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Page 1", exact: true }).click();
    await expect(note.getByText("Page 1 is in. Crop it to the figure, then describe it.")).toBeVisible();
    await expect(note.getByText("From report-with-chart.pdf, page 1.", { exact: false })).toBeVisible();
    // Another figure: the tick and the description start again.
    await expect(note.getByLabel(TICK)).not.toBeChecked();
    await expect(page.getByLabel("Image 1: describe it for people who can't see it")).toHaveValue("");
    const swapped = await imageSrc();
    expect(swapped).not.toBe(first);

    // Crop: the bottom edge moved up to half way.
    await note.getByRole("button", { name: "Crop", exact: true }).click();
    const cropper = page.getByTestId("cropper");
    await expect(cropper.getByRole("img", { name: "Page 1 of report-with-chart.pdf" })).toBeVisible();
    await cropper.getByLabel("Bottom edge").fill("50");
    await cropper.getByRole("button", { name: "Use this crop" }).click();
    await expect(note.getByText("Cropped.")).toBeVisible();
    await expect.poll(imageSrc).not.toBe(swapped);
    const cropped = page.locator("li[data-kind=image] img").first();
    const size = await cropped.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    expect(size.w).toBeGreaterThan(size.h);

    // The saved doc keeps the new page and box.
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-picked]").getByText("page 1.", { exact: false })).toBeVisible();

    // Remove: the card's own button.
    await page.getByRole("button", { name: "Remove image 1" }).click();
    await expect(page.locator("[data-picked]")).toHaveCount(0);
    expect(await sectionKinds(page)).toEqual(["findings", "graph"]);
    expect(picks).toBe(0);
  });
});

test.describe("Drafts with no figure", () => {
  test("a PDF of plain text: no pick, no figure, no error", async ({ page }) => {
    await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail("nofig"))}&next=/exhbts/new`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    let picks = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/exhbts/figure-pick")) picks++;
    });
    await addFile(page, TEXT_PDF);
    await draft(page);
    expect(picks).toBe(0);
    expect(await sectionKinds(page)).not.toContain("image");
    await expect(page.locator("[data-picked]")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("a pick that fails leaves the draft as it is, with nothing shown", async ({ page }) => {
    await page.route("**/api/exhbts/figure-pick", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "We couldn't pick a figure just now." }) }));
    await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail("figfail"))}&next=/exhbts/new`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await addFile(page, CHART_PDF);
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 60_000 });
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    expect(await sectionKinds(page)).not.toContain("image");
    await expect(page.getByText("We couldn't pick a figure just now.")).toHaveCount(0);
  });
});
