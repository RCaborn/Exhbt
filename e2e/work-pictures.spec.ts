import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { detectKind, slideXmlToText } from "../lib/doc-readers";
import { emptyDoc, formatLimits, text, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { FORMAT_LIMITS, FORMAT_RULES, type Format } from "../lib/exhbt/formats";
import { withMoreImages, withWorkVisual } from "../lib/exhbt/sections";
import { readOfficePictures } from "../lib/figures/office";
import { openLayoutMenu, waitEditor } from "./editor";
import { uniqueEmail } from "./helpers";
import { freshName, png, READY } from "./page-editor";
import { uniqueBytes } from "./unique-bytes";

// The key visual from Word, PowerPoint and uploaded pictures (decision 0025, "Pictures from Word,
// PowerPoint and uploads"), with the stand-in AI (it picks the first image it is sent, and reads a
// kind from the label it is sent). The files are the figure eval's own
// (evals/figure-pick/fixtures/build-office.mjs). The editor is the edit-on-page one (decision 0026),
// as the test server sets it, and the layout is named in the notes wherever the test is about one.
// "Read it for me" sends a picture to /api/files/transcribe, which reads at most 12 a day from one
// address, and a CI shard shares that with the other specs: the tests here send 8 between them.

const FIX = "evals/figure-pick/fixtures";
const WORD_CHART = `${FIX}/15-word-chart-picture.docx`;
const PPTX = `${FIX}/16-pptx-chart-and-photo.pptx`;
const NATIVE = `${FIX}/18-word-native-chart.docx`;
const POSTER = `${FIX}/17-uploaded-pictures-poster.png`;
const SKETCH = `${FIX}/17-uploaded-pictures-sketch.png`;
const DESK = `${FIX}/17-uploaded-pictures-desk.png`;
const NOTES = "Final-year project on GP appointment reminders at two practices in Leeds. Missed appointments fell from 7.9% to 6.5% across all patients after the reminder moved.";
const inLayout = (layout: string) => `${NOTES} stand-in: layout ${layout}`;
const GALLERY_NOTES = inLayout("gallery");
const CHART_LINE = "We couldn't lift the chart from this file. Save it as a PDF and we'll take it from that.";
const TICK = "I may share this figure on my portfolio";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
/** Every sentence the editor's line may say about a figure (lib/exhbt/drafted.ts): a layout that takes nothing says none of them. */
const FIGURE_WORDS = /The figure is from|No figure was found|couldn't look for a figure|We take a figure from|couldn't lift the chart/;

/**
 * A fixture as a file for the input, with this run's own bytes (e2e/unique-bytes.ts): the server matches files by content
 * across accounts, and the same fixture uploaded by two accounts would bring up the file-match prompt.
 */
const fixture = (path: string) => ({
  name: path.split("/").pop()!,
  mimeType: path.endsWith(".png") ? "image/png" : path.endsWith(".pptx") ? PPTX_TYPE : DOCX_TYPE,
  buffer: uniqueBytes(readFileSync(path)),
});
/** A picture made here, one colour, with its own bytes. */
const madePicture = (name: string) => ({ name, mimeType: "image/png", buffer: uniqueBytes(png(900, 600)) });

/* ---------------- Pure ---------------- */

test.describe("The made fixtures read as intended", () => {
  test("the Word report offers its chart and the crest in the body, not the crest in the header", async () => {
    const read = (await readOfficePictures(new Uint8Array(readFileSync(WORD_CHART)), "docx"))!;
    expect(read.pictures.map((p) => p.path)).toEqual(["word/media/image2.png", "word/media/image3.png"]);
    expect(read.nativeChart).toBe(false);
  });
  test("the PowerPoint offers the chart on slide 2 and the photo on slide 3, not the logo or the master's crest", async () => {
    const read = (await readOfficePictures(new Uint8Array(readFileSync(PPTX)), "pptx"))!;
    expect(read.pictures.map((p) => [p.path, p.slide])).toEqual([
      ["ppt/media/image7.png", 2],
      ["ppt/media/image2.png", 3],
    ]);
  });
  test("a chart drawn in Word has no picture and is noticed", async () => {
    expect(await readOfficePictures(new Uint8Array(readFileSync(NATIVE)), "docx")).toEqual({ pictures: [], nativeChart: true, skipped: 0 });
  });
  test("a .pptx is read as PowerPoint, and its slides' text comes out in order", () => {
    expect(detectKind(new Uint8Array([0x50, 0x4b, 3, 4]), "deck.pptx", "")).toBe("pptx");
    expect(detectKind(new Uint8Array([0x50, 0x4b, 3, 4]), "report.docx", "")).toBe("docx");
    const xml = '<p:sld><a:p><a:r><a:t>Sign-ups doubled</a:t></a:r></a:p><a:p><a:r><a:t>on Wednesday &amp; Friday</a:t></a:r></a:p></p:sld>';
    expect(slideXmlToText(xml)).toBe("Sign-ups doubled\non Wednesday & Friday");
  });
  test("what each layout takes from the work, and how many pictures it shows", () => {
    // The pictures rule the tests below drive (lib/exhbt/formats.ts): three layouts take the person's pictures, an essay nothing.
    expect(Object.entries(FORMAT_RULES).map(([f, r]) => [f, r.fromWork])).toEqual([
      ["case-study", "figure"],
      ["gallery", "pictures"],
      ["research", "figure"],
      ["build", "figure"],
      ["essay", "none"],
      ["before-after", "pictures"],
      ["event", "pictures"],
    ]);
    expect([FORMAT_LIMITS.gallery.images.max, FORMAT_LIMITS["before-after"].images.max, FORMAT_LIMITS.event.images.max]).toEqual([8, 6, 6]);
  });
});

test.describe("Where the lead and the other pictures go (lib/exhbt/sections.ts)", () => {
  const findings: Section = { id: "findings", kind: "findings", items: [text("Missed appointments fell from 7.9% to 6.5%.")] };
  const graph: Section = { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "Missed appointments", rows: [{ label: "Before", value: 7.9 }, { label: "After", value: 6.5 }] } as never };
  const mine: Section = { id: "image-1", kind: "image", fileId: "mine", alt: "A picture they added", caption: [] };
  const docIn = (format: Format, sections: Section[]): ExhbtDoc => ({ ...emptyDoc(), ...(format === "case-study" ? {} : { format }), sections });
  const lead = { fileId: "lead", kind: "other" as const, alt: "", caption: "" };
  const imageIds = (d: ExhbtDoc) => d.sections.flatMap((s) => (s.kind === "image" ? [s.fileId] : []));

  test("a layout that takes pictures puts the lead before any picture already there; a build and a case study put it after the findings", () => {
    // The person's picture is first in the doc, so where the lead goes shows which rule placed it.
    for (const f of ["gallery", "before-after", "event"] as const) {
      expect(imageIds(withWorkVisual(docIn(f, [mine, findings, graph]), lead).doc), f).toEqual(["lead", "mine"]);
    }
    // Decision 0028: a build's figure is "placed as a case study places it".
    for (const f of ["case-study", "build"] as const) {
      expect(withWorkVisual(docIn(f, [mine, findings, graph]), lead).doc.sections.map((s) => s.id), f).toEqual(["image-1", "findings", "image-2", "graph-1"]);
    }
    // An essay takes nothing from the work.
    expect(withWorkVisual(docIn("essay", [findings, graph]), lead)).toMatchObject({ placed: false, why: "not-wanted", removed: [] });
  });

  test("the other pictures follow the lead in the order given, with no description and no mark, up to the layout's cap", () => {
    for (const f of ["gallery", "before-after", "event"] as const) {
      const placed = withWorkVisual(docIn(f, [findings, graph]), lead).doc;
      const all = withMoreImages(placed, Array.from({ length: 10 }, (_, i) => `p${i + 1}`));
      const cap = formatLimits(f).sections.image;
      expect(imageIds(all), f).toEqual(["lead", ...Array.from({ length: cap - 1 }, (_, i) => `p${i + 1}`)]);
      expect(all.sections.filter((s) => s.kind === "image").slice(1).every((s) => s.kind === "image" && s.alt === "" && !s.picked && !s.stage)).toBe(true);
      // The same picture twice goes on once.
      expect(imageIds(withMoreImages(placed, ["p1", "p1", "lead"]))).toEqual(["lead", "p1"]);
    }
  });
});

/* ---------------- The draft page ---------------- */

async function signInFree(page: Page, name: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(name))}&next=/exhbts/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}
/** A new development user on Premium (eight drafts), signed in on the draft page: for a test that drafts twice. */
async function signInPremium(page: Page, name: string) {
  const username = freshName(name);
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** The kinds of the page's sections, in the order the page draws them, leaving out the flowchart. */
const sectionKinds = async (page: Page) => (await page.locator(`${READY} article [data-section-id]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")))).filter((k) => k !== "flow");
/** The line the draft leaves, in the layout menu: opens the menu so it can be read. Escape closes it. */
async function draftedLine(page: Page) {
  await openLayoutMenu(page);
  return page.locator("[data-drafted]");
}
/** The label over a picked picture: "A picture from your report" for one taken whole out of a Word or PowerPoint file. */
const pickedLabel = (page: Page) => page.locator(READY).getByRole("button", { name: /^A picture from your report/ });
/** The picked figure's strip (where it came from, the tick), in the popover from the label over the picture: opens it. */
async function openPicked(page: Page) {
  const note = page.locator(`${READY} [data-picked]`).first();
  if (!(await note.isVisible())) await pickedLabel(page).first().click();
  await expect(note).toBeVisible();
  return note;
}

/** Counts the pick requests, and keeps the labels the model was told (the route says them outside production). */
function watchPicks(page: Page) {
  const seen = { picks: 0, places: 0, labels: [] as string[][], answered: [] as Promise<void>[] };
  page.on("request", (r) => {
    if (r.url().includes("/api/exhbts/figure-pick")) seen.picks++;
    // The route that puts the figure and the pictures on the exhbt.
    if (/\/api\/exhbts\/[^/]+\/figure$/.test(new URL(r.url()).pathname)) seen.places++;
  });
  page.on("response", (res) => {
    if (!res.url().includes("/api/exhbts/figure-pick")) return;
    seen.answered.push(
      res
        .json()
        .then((d: { debug?: { labels?: string[] } }) => void seen.labels.push(d.debug?.labels ?? []))
        .catch(() => undefined),
    );
  });
  return seen;
}
/** The file id each of the draft page's uploads was given, by the file's name. */
function watchUploads(page: Page) {
  const ids = new Map<string, string>();
  page.on("response", async (res) => {
    if (!res.url().endsWith("/api/files/upload-url") || res.request().method() !== "POST") return;
    const name = (res.request().postDataJSON() as { name?: string } | null)?.name;
    const data = (await res.json().catch(() => null)) as { fileId?: string } | null;
    if (name && data?.fileId) ids.set(name, data.fileId);
  });
  return ids;
}

async function waitUploaded(page: Page, n: number) {
  await expect(page.getByTestId("file-status").filter({ hasText: "uploaded" })).toHaveCount(n, { timeout: 30_000 });
}
/** Drafts and waits for the editor. The editor takes what the draft page passed on off the address once it has read it. */
async function draft(page: Page) {
  await page.getByRole("button", { name: "Draft my exhbt" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 90_000 });
  await waitEditor(page);
}
/** Agrees to send a picture to be read (and so to be looked at for the key figure). */
const agree = (page: Page, name: string) => page.getByRole("group", { name: `Read ${name}?` }).getByRole("button", { name: "Read it for me" }).click();
const keep = (page: Page, name: string) => page.getByRole("group", { name: `Read ${name}?` }).getByRole("button", { name: "Keep it as a picture" }).click();
const idOf = (page: Page) => new URL(page.url()).pathname.split("/")[2]!;
type StoredSection = { id: string; kind: string; fileId?: string; alt?: string; stage?: string; picked?: { from: string; media?: string; shareOk: boolean } };
type Stored = { working: { format?: string; sections: StoredSection[] } };
const stored = async (page: Page) => (await (await page.request.get(`/dev/parity?id=${idOf(page)}`)).json()) as Stored;
const imagesIn = (s: Stored) => s.working.sections.filter((x) => x.kind === "image");
/** The id of the first picture the page draws: the lead in a layout that has one. */
const firstDrawnImage = (page: Page) => page.locator(`${READY} article [data-section-id][data-kind=image]`).first().getAttribute("data-section-id");

const PICTURES = ["17-uploaded-pictures-poster.png", "17-uploaded-pictures-sketch.png", "17-uploaded-pictures-desk.png"];

test.describe("A Word file", () => {
  test("its chart, pasted in as a picture, is offered with the crest, picked, and takes the place of the drafted graph", async ({ page }) => {
    test.setTimeout(180_000);
    await signInFree(page, "wordpic");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles(fixture(WORD_CHART));
    await waitUploaded(page, 1);
    await draft(page);
    // Two pictures sent, labelled without the file's name; the chart is first, so the stand-in picks it.
    expect(seen.picks).toBe(1);
    await Promise.all(seen.answered);
    expect(seen.labels[0]).toEqual(["File 1, picture 1", "File 1, picture 2"]);
    expect(seen.labels[0]!.join(" ")).not.toContain("docx");
    const kinds = await sectionKinds(page);
    expect(kinds.slice(0, 2)).toEqual(["findings", "image"]);
    expect(kinds).not.toContain("graph");
    // From a Word file, so it carries the tick, as one from a PDF does: the label over the picture holds it until it is ticked.
    await expect(page.locator(`${READY} input[data-path$=".picked.shareOk"]`)).not.toBeChecked();
    // The label says it is a picture from the file, and offers only what can be done with one taken whole: no page to crop or swap.
    await expect(pickedLabel(page)).toHaveAccessibleName("A picture from your report: say you may share it");
    const note = await openPicked(page);
    await expect(note.getByText("From 15-word-chart-picture.docx, a picture in it.", { exact: false })).toBeVisible();
    await expect(note.getByLabel(TICK)).not.toBeChecked();
    await expect(note.getByRole("button", { name: "Crop", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(await draftedLine(page)).toContainText("The figure is from a picture in 15-word-chart-picture.docx. Tick that you may share it before you publish.");
    await page.keyboard.press("Escape");
    const picked = imagesIn(await stored(page))[0]!.picked!;
    expect(picked).toMatchObject({ from: "15-word-chart-picture.docx", media: "word/media/image2.png", shareOk: false });
    // The picture on the page was cut out of the file at full size.
    const img = page.locator(`${READY} article [data-kind=image] img`).first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(400);
  });

  test("a chart drawn in Word itself can't be lifted: nothing is sent and the line says to save it as a PDF", async ({ page }) => {
    await signInFree(page, "wordnative");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles(fixture(NATIVE));
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(0);
    const kinds = await sectionKinds(page);
    expect(kinds).not.toContain("image");
    expect(kinds).toContain("graph");
    const line = await draftedLine(page);
    await expect(line).toContainText(CHART_LINE);
    await expect(line).not.toContainText("only be taken from a PDF");
  });
});

test.describe("A PowerPoint file", () => {
  test("is read as material, and its chart picture is picked ahead of the photo on the next slide", async ({ page }) => {
    test.setTimeout(180_000);
    await signInFree(page, "pptxpic");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(NOTES);
    await page.locator("#files").setInputFiles(fixture(PPTX));
    await waitUploaded(page, 1);
    // The slides' text counts as words: the file was accepted and read.
    await expect(page.getByTestId("file-status")).toContainText("words");
    await draft(page);
    expect(seen.picks).toBe(1);
    await Promise.all(seen.answered);
    // The logo on every slide and the master's crest are not sent: two pictures, the slide 2 chart and the slide 3 photo.
    expect(seen.labels[0]).toEqual(["File 1, slide 2", "File 1, slide 3"]);
    expect((await sectionKinds(page)).slice(0, 2)).toEqual(["findings", "image"]);
    expect(imagesIn(await stored(page))[0]!.picked).toMatchObject({ from: "16-pptx-chart-and-photo.pptx", media: "ppt/media/image7.png", shareOk: false });
    await expect(page.locator(`${READY} input[data-path$=".picked.shareOk"]`)).not.toBeChecked();
    await expect((await openPicked(page)).getByLabel(TICK)).not.toBeChecked();
  });
});

test.describe("Pictures uploaded with the work", () => {
  test("a gallery gets the lead the AI chose, then the others in the order they were uploaded; no tick, no description but the lead's", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "gallerypics");
    const seen = watchPicks(page);
    const ids = watchUploads(page);
    await page.locator("#notes").fill(GALLERY_NOTES);
    // Uploaded poster first, so the stand-in (which picks the first picture sent) leads with it.
    await page.locator("#files").setInputFiles([fixture(POSTER), fixture(SKETCH), fixture(DESK)]);
    for (const n of PICTURES) await agree(page, n);
    await waitUploaded(page, 3);
    await draft(page);
    expect(seen.picks).toBe(1);
    await Promise.all(seen.answered);
    expect(seen.labels[0]).toEqual(["File 1, picture", "File 2, picture", "File 3, picture"]);
    const s = await stored(page);
    expect(s.working.format).toBe("gallery");
    const images = imagesIn(s);
    // The lead first, then the sketch, then the desk: the order they were uploaded.
    expect(images.map((x) => x.fileId)).toEqual(PICTURES.map((n) => ids.get(n)));
    // The lead has the AI's description; the others are empty for the person to write. None carries the share tick.
    expect(images[0]!.alt).toContain("Development preview");
    expect(images[1]!.alt).toBe("");
    expect(images[2]!.alt).toBe("");
    expect(images.every((x) => !x.picked)).toBe(true);
    await expect(page.locator(`${READY} [data-picked]`)).toHaveCount(0);
    await expect(page.locator(`${READY} input[data-path$=".picked.shareOk"]`)).toHaveCount(0);
    // The page draws the poster as the lead.
    expect((await sectionKinds(page))[0]).toBe("image");
    expect(await firstDrawnImage(page)).toBe(images[0]!.id);
  });

  test("pictures kept without reading are never sent, and still go on a gallery in the order uploaded, the first as the lead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "gallerykeep");
    const seen = watchPicks(page);
    const ids = watchUploads(page);
    await page.locator("#notes").fill(GALLERY_NOTES);
    await page.locator("#files").setInputFiles([fixture(SKETCH), fixture(DESK)]);
    for (const n of PICTURES.slice(1)) await keep(page, n);
    await waitUploaded(page, 2);
    await draft(page);
    expect(seen.picks).toBe(0);
    const images = imagesIn(await stored(page));
    expect(images.map((x) => x.fileId)).toEqual(PICTURES.slice(1).map((n) => ids.get(n)));
    expect(images.every((x) => x.alt === "" && !x.picked)).toBe(true);
  });

  test("a case study takes one figure from them, placed like an image added by hand, and keeps the drafted graph", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "casepics");
    const seen = watchPicks(page);
    const ids = watchUploads(page);
    await page.locator("#notes").fill(NOTES);
    await page.locator("#files").setInputFiles([fixture(POSTER), fixture(SKETCH), fixture(DESK)]);
    // Two sent, so the AI chooses between them; the desk is kept as a picture.
    for (const n of PICTURES.slice(0, 2)) await agree(page, n);
    await keep(page, PICTURES[2]!);
    await waitUploaded(page, 3);
    await draft(page);
    expect(seen.picks).toBe(1);
    await Promise.all(seen.answered);
    expect(seen.labels[0]).toEqual(["File 1, picture", "File 2, picture"]);
    const s = await stored(page);
    expect(s.working.format ?? "case-study").toBe("case-study");
    // The one the AI chose, and none of the others.
    expect(imagesIn(s).map((x) => x.fileId)).toEqual([ids.get(PICTURES[0]!)]);
    // A picture they uploaded themselves is nobody else's to clear: no mark, no tick, and nothing taken off the exhbt.
    expect(imagesIn(s)[0]!.picked).toBeUndefined();
    expect(s.working.sections.some((x) => x.kind === "graph")).toBe(true);
    await expect(page.locator(`${READY} [data-picked]`)).toHaveCount(0);
  });
});

/* ---------------- The four layouts of decision 0028 ---------------- */

test.describe("The pictures rule in the layouts of release 4 (FORMAT_RULES)", () => {
  test("a before and after takes the pictures: the lead the AI chose first, the rest in the order uploaded, none marked Before or After", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "beforeafterpics");
    const seen = watchPicks(page);
    const ids = watchUploads(page);
    await page.locator("#notes").fill(inLayout("before-after"));
    // The poster is uploaded second and is the only one sent, so the AI's choice is not simply the first uploaded.
    const [sketch, poster, desk] = [PICTURES[1]!, PICTURES[0]!, PICTURES[2]!];
    await page.locator("#files").setInputFiles([fixture(SKETCH), fixture(POSTER), fixture(DESK)]);
    await keep(page, sketch);
    await agree(page, poster);
    await keep(page, desk);
    await waitUploaded(page, 3);
    await draft(page);
    expect(seen.picks).toBe(1);
    const s = await stored(page);
    expect(s.working.format).toBe("before-after");
    const images = imagesIn(s);
    expect(images.map((x) => x.fileId)).toEqual([poster, sketch, desk].map((n) => ids.get(n)));
    expect(images[0]!.alt).toContain("Development preview");
    // Which picture is the before and which the after is never drafted: the AI has not been told (decision 0028).
    expect(images.every((x) => !x.stage && !x.picked)).toBe(true);
    // Its usual order puts the pictures first, the lead first among them.
    expect((await sectionKinds(page)).slice(0, 3)).toEqual(["image", "image", "image"]);
    expect(await firstDrawnImage(page)).toBe(images[0]!.id);
  });

  test("an event takes the pictures, as many as it shows (six), in the order uploaded, the first as the lead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "eventpics");
    const seen = watchPicks(page);
    const ids = watchUploads(page);
    await page.locator("#notes").fill(inLayout("event"));
    const names = Array.from({ length: 8 }, (_, i) => `night-${i + 1}.png`);
    await page.locator("#files").setInputFiles(names.map(madePicture));
    for (const n of names) await keep(page, n);
    await waitUploaded(page, 8);
    await draft(page);
    // Kept as pictures: none was sent.
    expect(seen.picks).toBe(0);
    const s = await stored(page);
    expect(s.working.format).toBe("event");
    const images = imagesIn(s);
    expect(images.map((x) => x.fileId)).toEqual(names.slice(0, FORMAT_LIMITS.event.images.max).map((n) => ids.get(n)));
    expect(images.every((x) => x.alt === "" && !x.picked)).toBe(true);
    expect(await firstDrawnImage(page)).toBe(images[0]!.id);
    await expect(await draftedLine(page)).not.toContainText(FIGURE_WORDS);
  });

  test("a gallery with more pictures than it shows still gets its eight, the first as the lead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "gallerymany");
    const ids = watchUploads(page);
    await page.locator("#notes").fill(GALLERY_NOTES);
    const names = Array.from({ length: 14 }, (_, i) => `piece-${i + 1}.png`);
    await page.locator("#files").setInputFiles(names.map(madePicture));
    for (const n of names) await keep(page, n);
    await waitUploaded(page, 14);
    await draft(page);
    const images = imagesIn(await stored(page));
    expect(images.map((x) => x.fileId)).toEqual(names.slice(0, FORMAT_LIMITS.gallery.images.max).map((n) => ids.get(n)));
    await expect(await draftedLine(page)).not.toContainText("couldn't look for a figure");
  });

  test("an essay takes nothing from the work: no figure from a Word file and none of the pictures, and nothing said about a figure", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "essaypics");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(inLayout("essay"));
    await page.locator("#files").setInputFiles([fixture(WORD_CHART), fixture(POSTER), fixture(SKETCH)]);
    await agree(page, PICTURES[0]!);
    await keep(page, PICTURES[1]!);
    await waitUploaded(page, 3);
    await draft(page);
    const s = await stored(page);
    expect(s.working.format).toBe("essay");
    expect(imagesIn(s)).toHaveLength(0);
    expect(await sectionKinds(page)).not.toContain("image");
    // Nothing is put on the exhbt: the route that places a figure is never called.
    expect(seen.places).toBe(0);
    await expect(await draftedLine(page)).not.toContainText(FIGURE_WORDS);
  });

  test("a build takes one figure from the pictures: the one the AI chose, placed like an image added by hand, with the drafted graph kept", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "buildpics");
    const seen = watchPicks(page);
    const ids = watchUploads(page);
    await page.locator("#notes").fill(inLayout("build"));
    // The poster is uploaded second and is the one sent: the build gets it, and neither picture kept.
    await page.locator("#files").setInputFiles([fixture(SKETCH), fixture(POSTER), fixture(DESK)]);
    await keep(page, PICTURES[1]!);
    await agree(page, PICTURES[0]!);
    await keep(page, PICTURES[2]!);
    await waitUploaded(page, 3);
    await draft(page);
    expect(seen.picks).toBe(1);
    const s = await stored(page);
    expect(s.working.format).toBe("build");
    expect(imagesIn(s).map((x) => x.fileId)).toEqual([ids.get(PICTURES[0]!)]);
    expect(imagesIn(s)[0]!.picked).toBeUndefined();
    expect(s.working.sections.some((x) => x.kind === "graph")).toBe(true);
    // A build's first picture is its lead.
    expect((await sectionKinds(page))[0]).toBe("image");
  });

  test("a build takes the chart from a Word file in place of the drafted graph, with the tick", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "buildword");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(inLayout("build"));
    await page.locator("#files").setInputFiles(fixture(WORD_CHART));
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(1);
    const s = await stored(page);
    expect(s.working.format).toBe("build");
    expect(imagesIn(s)).toHaveLength(1);
    expect(imagesIn(s)[0]!.picked).toMatchObject({ from: "15-word-chart-picture.docx", media: "word/media/image2.png", shareOk: false });
    // The work's own graph wins (decision 0025): the graph the draft drew is gone.
    expect(s.working.sections.some((x) => x.kind === "graph")).toBe(false);
    expect(await sectionKinds(page)).not.toContain("graph");
    await expect(page.locator(`${READY} input[data-path$=".picked.shareOk"]`)).not.toBeChecked();
    await expect(await draftedLine(page)).toContainText("The figure is from a picture in 15-word-chart-picture.docx. Tick that you may share it before you publish.");
  });
});

test.describe("A hostile zip", () => {
  /** A .docx that is a zip bomb and a zip of too many entries: the draft goes ahead, nothing is sent, nothing breaks. */
  async function hostile(entries: number, bomb: boolean) {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${NOTES}</w:t></w:r></w:p></w:body></w:document>`);
    for (let i = 0; i < entries; i++) zip.file(`customXml/item${i}.xml`, "x");
    zip.file("word/media/../../evil.png", new Uint8Array(8_000).fill(1));
    if (bomb) {
      const png = new Uint8Array(60_000_000);
      png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0x20, 0, 0, 1, 0xf4]);
      zip.file("word/media/image1.png", png);
    }
    return uniqueBytes(Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })));
  }

  test("too many entries: the file is not read for pictures, and the draft still goes ahead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "zipmany");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles({ name: "many.docx", mimeType: DOCX_TYPE, buffer: await hostile(2_400, false) });
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(0);
    const kinds = await sectionKinds(page);
    expect(kinds).toContain("findings");
    expect(kinds).not.toContain("image");
  });

  test("a picture that inflates past the cap: skipped, nothing sent, the draft goes ahead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "zipbomb");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles({ name: "bomb.docx", mimeType: DOCX_TYPE, buffer: await hostile(5, true) });
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(0);
    const kinds = await sectionKinds(page);
    expect(kinds).toContain("findings");
    expect(kinds).not.toContain("image");
  });
});

/* ---------------- The route, called by hand ---------------- */

test.describe("The figure route with a picture the person uploaded", () => {
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const upload = async (page: Page, name: string) => {
    const bytes = uniqueBytes(PNG);
    const t = (await (await page.request.post("/api/files/upload-url", { data: { name, mime: "image/png", bytes: bytes.length, kind: "image" } })).json()) as { fileId: string; uploadUrl: string; headers: Record<string, string> };
    expect((await page.request.put(t.uploadUrl, { headers: t.headers, data: bytes })).ok()).toBe(true);
    return t.fileId;
  };

  test("with no `picked` it places a plain image and takes nothing off; `more` is kept only where the layout takes pictures, and only the person's own pictures", async ({ page }) => {
    test.setTimeout(180_000);
    // Two drafts: Premium, since Free has one draft in 30 days.
    await signInPremium(page, "routeown");
    await page.locator("#notes").fill(GALLERY_NOTES);
    await page.locator("#files").setInputFiles(fixture(SKETCH));
    await keep(page, "17-uploaded-pictures-sketch.png");
    await waitUploaded(page, 1);
    await draft(page);
    const id = idOf(page);
    const a = await upload(page, "a.png");
    const b = await upload(page, "b.png");
    // A "graph" kind from a hand-built request on a picture with no `picked` is read as "other": no graph is taken off.
    const placed = await page.request.post(`/api/exhbts/${id}/figure`, { data: { fileId: a, alt: "", caption: "", kind: "graph", more: [b, "not-a-file-of-theirs"] } });
    expect(placed.status(), await placed.text()).toBe(204);
    const sections = (await stored(page)).working.sections;
    const imgs = sections.filter((s) => s.kind === "image");
    expect(imgs.map((s) => s.fileId)).toContain(a);
    expect(imgs.map((s) => s.fileId)).toContain(b);
    expect(imgs).toHaveLength(3);
    expect(imgs.some((s) => s.picked)).toBe(false);
    expect(sections.some((s) => s.kind === "graph")).toBe(true);
    // A case study ignores `more`.
    await page.goto("/exhbts/new");
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.locator("#notes").fill(NOTES);
    await page.locator("#files").setInputFiles(fixture(NATIVE));
    await waitUploaded(page, 1);
    await draft(page);
    const c = await upload(page, "c.png");
    const d = await upload(page, "d.png");
    expect((await page.request.post(`/api/exhbts/${idOf(page)}/figure`, { data: { fileId: c, alt: "", caption: "", more: [d] } })).status()).toBe(204);
    const only = (await stored(page)).working.sections.filter((s) => s.kind === "image").map((s) => s.fileId);
    expect(only).toEqual([c]);
  });
});
