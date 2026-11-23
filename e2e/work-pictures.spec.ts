import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { detectKind, slideXmlToText } from "../lib/doc-readers";
import { readOfficePictures } from "../lib/figures/office";
import { uniqueEmail } from "./helpers";

// The key visual from Word, PowerPoint and uploaded pictures (decision 0025, "Pictures from Word and
// PowerPoint"), with the stand-in AI (it picks the first image it is sent, and reads a kind from the
// file's name). The files are the figure eval's own (evals/figure-pick/fixtures/build-office.mjs).

const FIX = "evals/figure-pick/fixtures";
const WORD_CHART = `${FIX}/15-word-chart-picture.docx`;
const PPTX = `${FIX}/16-pptx-chart-and-photo.pptx`;
const NATIVE = `${FIX}/18-word-native-chart.docx`;
const POSTER = `${FIX}/17-uploaded-pictures-poster.png`;
const SKETCH = `${FIX}/17-uploaded-pictures-sketch.png`;
const DESK = `${FIX}/17-uploaded-pictures-desk.png`;
const NOTES = "Final-year project on GP appointment reminders at two practices in Leeds. Missed appointments fell from 7.9% to 6.5% across all patients after the reminder moved.";
const GALLERY_NOTES = `${NOTES} stand-in: layout gallery`;
const CHART_LINE = "We couldn't lift the chart from this file. Save it as a PDF and we'll take it from that.";
const TICK = "I may share this figure on my portfolio";

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
});

/* ---------------- The draft page ---------------- */

async function signInFree(page: Page, name: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(name))}&next=/exhbts/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}
const draftedLine = (page: Page) => page.locator("[data-drafted]");
const sectionKinds = (page: Page) => page.locator("li[data-section-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));

/** Counts the pick requests, and keeps the labels the model was told (the route says them outside production). */
function watchPicks(page: Page) {
  const seen = { picks: 0, labels: [] as string[][], answered: [] as Promise<void>[] };
  page.on("request", (r) => {
    if (r.url().includes("/api/exhbts/figure-pick")) seen.picks++;
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

async function waitUploaded(page: Page, n: number) {
  await expect(page.getByTestId("file-status").filter({ hasText: "uploaded" })).toHaveCount(n, { timeout: 30_000 });
}
async function draft(page: Page) {
  await page.getByRole("button", { name: "Draft my exhbt" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit/, { timeout: 90_000 });
  await expect(page.locator("[data-ready=true]")).toBeAttached();
}
/** Agrees to send a picture to be read (and so to be looked at for the key figure). */
const agree = (page: Page, name: string) => page.getByRole("group", { name: `Read ${name}?` }).getByRole("button", { name: "Read it for me" }).click();
const keep = (page: Page, name: string) => page.getByRole("group", { name: `Read ${name}?` }).getByRole("button", { name: "Keep it as a picture" }).click();
const idOf = (page: Page) => new URL(page.url()).pathname.split("/")[2]!;
type Stored = { working: { sections: { kind: string; fileId?: string; alt?: string; picked?: { from: string; media?: string; shareOk: boolean } }[] } };
const stored = async (page: Page) => (await (await page.request.get(`/dev/parity?id=${idOf(page)}`)).json()) as Stored;

test.describe("A Word file", () => {
  test("its chart, pasted in as a picture, is offered with the crest, picked, and takes the place of the drafted graph", async ({ page }) => {
    test.setTimeout(180_000);
    await signInFree(page, "wordpic");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles(WORD_CHART);
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
    // From a Word file, so it carries the tick, as one from a PDF does; the note says it is a picture in the file.
    const note = page.locator("[data-picked]");
    await expect(note.getByText("From 15-word-chart-picture.docx, a picture in it.", { exact: false })).toBeVisible();
    await expect(note.getByLabel(TICK)).not.toBeChecked();
    await expect(draftedLine(page)).toContainText("The figure is from a picture in 15-word-chart-picture.docx. Tick that you may share it before you publish.");
    const picked = (await stored(page)).working.sections.find((s) => s.kind === "image")!.picked!;
    expect(picked).toMatchObject({ from: "15-word-chart-picture.docx", media: "word/media/image2.png", shareOk: false });
    // The picture on the page was cut out of the file at full size.
    const img = page.getByRole("region", { name: "Preview" }).locator("[data-part=image] img").first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(400);
  });

  test("a chart drawn in Word itself can't be lifted: nothing is sent and the line says to save it as a PDF", async ({ page }) => {
    await signInFree(page, "wordnative");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles(NATIVE);
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(0);
    expect(await sectionKinds(page)).not.toContain("image");
    expect(await sectionKinds(page)).toContain("graph");
    await expect(draftedLine(page)).toContainText(CHART_LINE);
    await expect(draftedLine(page)).not.toContainText("only be taken from a PDF");
  });
});

test.describe("A PowerPoint file", () => {
  test("is read as material, and its chart picture is picked ahead of the photo on the next slide", async ({ page }) => {
    test.setTimeout(180_000);
    await signInFree(page, "pptxpic");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(NOTES);
    await page.locator("#files").setInputFiles(PPTX);
    await waitUploaded(page, 1);
    // The slides' text counts as words: the file was accepted and read.
    await expect(page.getByTestId("file-status")).toContainText("words");
    await draft(page);
    expect(seen.picks).toBe(1);
    await Promise.all(seen.answered);
    // The logo on every slide and the master's crest are not sent: two pictures, the slide 2 chart and the slide 3 photo.
    expect(seen.labels[0]).toEqual(["File 1, slide 2", "File 1, slide 3"]);
    expect((await sectionKinds(page)).slice(0, 2)).toEqual(["findings", "image"]);
    expect((await stored(page)).working.sections.find((s) => s.kind === "image")!.picked).toMatchObject({ from: "16-pptx-chart-and-photo.pptx", media: "ppt/media/image7.png", shareOk: false });
    await expect(page.locator("[data-picked]").getByLabel(TICK)).not.toBeChecked();
  });
});

test.describe("Pictures uploaded with the work", () => {
  test("a gallery gets the lead the AI chose, then the others in the order they were uploaded; no tick, no description but the lead's", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "gallerypics");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(GALLERY_NOTES);
    // Uploaded poster first, so the stand-in (which picks the first picture sent) leads with it.
    await page.locator("#files").setInputFiles([POSTER, SKETCH, DESK]);
    for (const n of ["17-uploaded-pictures-poster.png", "17-uploaded-pictures-sketch.png", "17-uploaded-pictures-desk.png"]) await agree(page, n);
    await waitUploaded(page, 3);
    await draft(page);
    expect(seen.picks).toBe(1);
    await Promise.all(seen.answered);
    expect(seen.labels[0]).toEqual(["File 1, picture", "File 2, picture", "File 3, picture"]);
    const sections = (await stored(page)).working.sections;
    const images = sections.filter((s) => s.kind === "image");
    expect(images).toHaveLength(3);
    // The lead has the AI's description; the others are empty for the person to write. None carries the share tick.
    expect(images[0]!.alt).toContain("Development preview");
    expect(images[1]!.alt).toBe("");
    expect(images[2]!.alt).toBe("");
    expect(images.every((s) => !s.picked)).toBe(true);
    await expect(page.locator("[data-picked]")).toHaveCount(0);
    // The files in the order uploaded (the lead first, then the sketch, then the desk).
    const files = await page.request.get(`/dev/parity?id=${idOf(page)}`);
    expect(files.ok()).toBe(true);
    expect(new Set(images.map((s) => s.fileId)).size).toBe(3);
  });

  test("pictures kept without reading are never sent, and still go on a gallery in the order uploaded, the first as the lead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "gallerykeep");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(GALLERY_NOTES);
    await page.locator("#files").setInputFiles([SKETCH, DESK]);
    for (const n of ["17-uploaded-pictures-sketch.png", "17-uploaded-pictures-desk.png"]) await keep(page, n);
    await waitUploaded(page, 2);
    await draft(page);
    expect(seen.picks).toBe(0);
    const images = (await stored(page)).working.sections.filter((s) => s.kind === "image");
    expect(images).toHaveLength(2);
    expect(images.every((s) => s.alt === "" && !s.picked)).toBe(true);
  });

  test("a case study takes one figure from them, placed like an image added by hand, and keeps the drafted graph", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "casepics");
    const seen = watchPicks(page);
    await page.locator("#notes").fill(NOTES);
    await page.locator("#files").setInputFiles([POSTER, SKETCH, DESK]);
    for (const n of ["17-uploaded-pictures-poster.png", "17-uploaded-pictures-sketch.png", "17-uploaded-pictures-desk.png"]) await agree(page, n);
    await waitUploaded(page, 3);
    await draft(page);
    expect(seen.picks).toBe(1);
    const sections = (await stored(page)).working.sections;
    expect(sections.filter((s) => s.kind === "image")).toHaveLength(1);
    // A picture they uploaded themselves is nobody else's to clear: no mark, no tick, and nothing taken off the exhbt.
    expect(sections.find((s) => s.kind === "image")!.picked).toBeUndefined();
    expect(sections.some((s) => s.kind === "graph")).toBe(true);
    await expect(page.locator("[data-picked]")).toHaveCount(0);
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
    return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  }

  test("too many entries: the file is not read for pictures, and the draft still goes ahead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "zipmany");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles({ name: "many.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await hostile(2_400, false) });
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(0);
    expect(await sectionKinds(page)).not.toContain("image");
    expect(page.url()).toMatch(/\/edit/);
  });

  test("a picture that inflates past the cap: skipped, nothing sent, the draft goes ahead", async ({ page }) => {
    test.setTimeout(240_000);
    await signInFree(page, "zipbomb");
    const seen = watchPicks(page);
    await page.locator("#files").setInputFiles({ name: "bomb.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await hostile(5, true) });
    await waitUploaded(page, 1);
    await draft(page);
    expect(seen.picks).toBe(0);
    expect(await sectionKinds(page)).not.toContain("image");
  });
});

/* ---------------- The route, called by hand ---------------- */

test.describe("The figure route with a picture the person uploaded", () => {
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const upload = async (page: Page, name: string) => {
    const t = (await (await page.request.post("/api/files/upload-url", { data: { name, mime: "image/png", bytes: PNG.length, kind: "image" } })).json()) as { fileId: string; uploadUrl: string; headers: Record<string, string> };
    expect((await page.request.put(t.uploadUrl, { headers: t.headers, data: PNG })).ok()).toBe(true);
    return t.fileId;
  };

  test("with no `picked` it places a plain image and takes nothing off; `more` is kept only for a gallery, and only the person's own pictures", async ({ page }) => {
    test.setTimeout(180_000);
    await signInFree(page, "routeown");
    await page.locator("#notes").fill(GALLERY_NOTES);
    await page.locator("#files").setInputFiles(SKETCH);
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
    expect(imgs.some((s) => s.picked)).toBe(false);
    // A case study ignores `more`.
    await page.goto("/exhbts/new");
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.locator("#notes").fill(NOTES);
    await page.locator("#files").setInputFiles(NATIVE);
    await waitUploaded(page, 1);
    await draft(page);
    const c = await upload(page, "c.png");
    const d = await upload(page, "d.png");
    expect((await page.request.post(`/api/exhbts/${idOf(page)}/figure`, { data: { fileId: c, alt: "", caption: "", more: [d] } })).status()).toBe(204);
    const only = (await stored(page)).working.sections.filter((s) => s.kind === "image").map((s) => s.fileId);
    expect(only).toEqual([c]);
  });
});
