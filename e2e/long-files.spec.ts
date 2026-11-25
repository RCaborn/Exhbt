import { expect, test, type Page } from "@playwright/test";
import { AI_LONG_PROMPT_TOKENS } from "../lib/ai/model";
import { extractTextInBrowser } from "../lib/doc-readers";
import { filesBudget, keepStartAndEnd, LEFT_OUT, MAX_MATERIAL_CHARS, NOTES_ROOM, sharesOf } from "../lib/material";
import { makeDocx } from "./doc-fixtures";
import { uniqueEmail } from "./helpers";
import { waitEditor } from "./editor";
import { uniqueBytes } from "./unique-bytes";

// Long files are read whole, or by their start and their end (lib/material.ts): Rory's 15,000-word
// dissertation was read only as far as about 7,000 words, so its results and conclusion were lost.
// The stand-in AI shows what it was given: "What I'd do next" is the first sentence of the material
// that starts "Next time", so a file whose only such sentence is in its last paragraph shows whether
// the end was read.

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const n = (x: number) => x.toLocaleString("en-GB");

/** Ordinary prose for a long report: no sentence starts "Next time", and no word the stand-in reads as a layout. */
const BANK = (
  "the team looked at the appointments kept and missed at each practice and wrote down what changed from one week to the next while the reminders went out " +
  "at the times set in the plan and the patients answered by text or by phone so the records show how many came in and how many did not and why"
).split(" ");
/** A paragraph of exactly 100 words, opening with its number so each one can be found. */
const paragraph = (i: number) => [`Part`, `${i}:`, ...Array.from({ length: 98 }, (_, k) => BANK[(i * 7 + k) % BANK.length]!)].join(" ") + ".";
/** The last paragraph: the results, and the only sentence that starts "Next time". */
const LAST = "In the end missed appointments fell from 7.9% to 6.5% at the two practices. Next time I would ask the Bramley practice for its winter records as well.";
/** A sentence for the middle of a very long file, which the draft must not get: it is left out. */
const MIDDLE = "Next time I would ask the Ashfield practice for its summer records too.";

/** A PDF of `perPage` lines a page, as many pages as the lines need: makePdf (e2e/doc-fixtures.ts) draws one page, and a reader drops what runs off it. */
function pagedPdf(lines: string[], perPage: number): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const pages = Array.from({ length: Math.ceil(lines.length / perPage) }, (_, p) => lines.slice(p * perPage, (p + 1) * perPage));
  // 1 the catalog, 2 the pages, 3 the font, then each page and its content.
  const pageId = (p: number) => 4 + p * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, p) => `${pageId(p)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pages.flatMap((page, p) => {
      const stream = `BT /F1 11 Tf 50 780 Td 14 TL ${page.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${pageId(p) + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
        `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
      ];
    }),
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function signIn(page: Page, name: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(name))}&next=/exhbts/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}
async function stored(page: Page) {
  const id = new URL(page.url()).pathname.split("/")[2]!;
  return (await (await page.request.get(`/dev/parity?id=${id}`)).json()) as { working: unknown };
}

test.describe("The material budget (lib/material.ts)", () => {
  test("is big enough for a 20,000-word dissertation and stays well under the price step", () => {
    // A dissertation of 20,000 words with its references runs to about 8.5 characters a word (Rory's read at that).
    expect(20_000 * 8.5 + NOTES_ROOM).toBeLessThan(MAX_MATERIAL_CHARS);
    // At four characters a token, and at three (figures and tables), with room for the draft's instructions.
    expect(MAX_MATERIAL_CHARS / 4 + 6_000).toBeLessThan(AI_LONG_PROMPT_TOKENS * 0.7);
    expect(MAX_MATERIAL_CHARS / 3 + 6_000).toBeLessThan(AI_LONG_PROMPT_TOKENS);
  });

  test("a file that fits is kept whole; one that doesn't keeps two thirds from its start and one third from its end, cut at paragraphs", () => {
    const text = Array.from({ length: 300 }, (_, i) => paragraph(i + 1)).join("\n\n");
    expect(keepStartAndEnd(text, text.length)).toBe(text);
    const max = Math.floor(text.length / 3);
    const kept = keepStartAndEnd(text, max);
    expect(kept.length).toBeLessThanOrEqual(max);
    const [start, end] = kept.split(`\n\n${LEFT_OUT}\n\n`);
    expect(kept.split(LEFT_OUT)).toHaveLength(2);
    // Whole paragraphs on both sides of the gap: the start ends a paragraph, the end starts one.
    expect(start!.startsWith("Part 1:")).toBe(true);
    expect(start!.endsWith(".")).toBe(true);
    expect(end!.startsWith("Part ")).toBe(true);
    expect(end!.endsWith(paragraph(300))).toBe(true);
    // About two thirds and one third.
    expect(start!.length / (start!.length + end!.length)).toBeGreaterThan(0.6);
    expect(start!.length / (start!.length + end!.length)).toBeLessThan(0.72);
    // Text with no paragraph breaks is cut between words.
    const flat = text.replace(/\n\n/g, " ");
    const [s2, e2] = keepStartAndEnd(flat, 5_000).split(`\n\n${LEFT_OUT}\n\n`);
    expect(flat.startsWith(`${s2} `)).toBe(true);
    expect(flat.endsWith(` ${e2}`)).toBe(true);
  });

  test("a long PDF comes back whole from the reader the draft page uses, its last paragraph and all", async () => {
    // 15,000 words in lines of ten, 50 lines a page, then the last paragraph: 31 pages, about 75,000 characters. Every line
    // fits the page's width, the last paragraph's two sentences on a line each: a reader drops what runs off the page.
    const lines = Array.from({ length: 150 }, (_, i) => paragraph(i + 1).split(" ")).flatMap((w) => Array.from({ length: 10 }, (_, k) => w.slice(k * 10, k * 10 + 10).join(" ")));
    const pdf = new Uint8Array(pagedPdf([...lines, ...LAST.split(/(?<=\.) /)], 50));
    const asFile = () => new File([pdf], "dissertation.pdf", { type: "application/pdf" });
    const whole = await extractTextInBrowser(asFile(), { maxChars: Number.POSITIVE_INFINITY });
    expect(words(whole)).toBeGreaterThan(15_000);
    expect(whole).toContain("Next time I would ask the Bramley practice for its winter records as well.");
    // Read with the readers' default, as the draft page read every file before, it stops short and the end is lost.
    expect(await extractTextInBrowser(asFile())).not.toContain("Bramley");
  });

  test("the files share it: the short ones whole, the long ones the rest in equal parts", () => {
    expect(sharesOf([1_000, 2_000], 10_000)).toEqual([1_000, 2_000]);
    expect(sharesOf([500_000, 1_000, 90_000], 200_000)).toEqual([109_000, 1_000, 90_000]);
    expect(sharesOf([500_000, 300_000, 1_000], 201_000)).toEqual([100_000, 100_000, 1_000]);
    for (const lengths of [[5, 6, 7], [900_000, 900_000, 900_000, 10], [0, 400_000]]) {
      expect(sharesOf(lengths, 234_000).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(234_000);
    }
    // The files' room is the budget less the notes and each file's name line.
    expect(filesBudget(["report.pdf"])).toBe(MAX_MATERIAL_CHARS - NOTES_ROOM - "report.pdf".length - 9);
  });
});

test.describe("A long file on the draft page", () => {
  test("a 15,000-word dissertation is read whole, and the draft gets its last paragraph", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, "longread");
    // About 75,000 characters: past the 60,000 a file used to be cut at, well within the budget.
    const paragraphs = [...Array.from({ length: 150 }, (_, i) => paragraph(i + 1)), LAST];
    const total = words(paragraphs.join(" "));
    expect(total).toBeGreaterThan(15_000);
    await page.locator("#files").setInputFiles({ name: "dissertation.docx", mimeType: DOCX, buffer: uniqueBytes(await makeDocx(paragraphs)) });
    await expect(page.getByTestId("file-status")).toContainText(`We read all ${n(total)} words`);
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await expect(page.getByText(`${n(total)} words to draft from`)).toBeVisible();
    const sent = page.waitForRequest((r) => r.url().endsWith("/api/exhbts/draft") && r.method() === "POST");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    const text = ((await sent).postDataJSON() as { text: string }).text;
    expect(text).toContain(LAST);
    expect(text).not.toContain(LEFT_OUT);
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 90_000 });
    await waitEditor(page);
    // The stand-in drafted "What I'd do next" from the last paragraph: it was given the end of the file.
    expect(JSON.stringify((await stored(page)).working)).toContain("Bramley");
  });

  test("a file too long for the budget keeps its start and its end, the page says so, and a short file beside it is read whole", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, "longcut");
    // About 300,000 characters. With the budget as it is the draft gets paragraphs 1 to about 314 and
    // about 445 to 600; paragraph 380 is in the middle of what is left out.
    const paragraphs = Array.from({ length: 600 }, (_, i) => paragraph(i + 1));
    paragraphs[379] = `${paragraphs[379]} ${MIDDLE}`;
    paragraphs[599] = LAST;
    const total = words(paragraphs.join(" "));
    // Its own last word makes the file this run's own (random bytes after the text would be read as a word).
    const short = `A short note on the two practices and the reminders they sent, with the weeks and the times written out in full for the team to check, ref-${Date.now().toString(36)}.`;
    await page.locator("#files").setInputFiles([
      { name: "long-report.docx", mimeType: DOCX, buffer: uniqueBytes(await makeDocx(paragraphs)) },
      { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from(`${short}\n`) },
    ]);
    const status = page.getByTestId("file-status");
    await expect(status.filter({ hasText: "uploaded" })).toHaveCount(2, { timeout: 30_000 });
    // The long file: some of its words, the start and the end. The short one: all of it.
    const long = status.first();
    await expect(long).toContainText(new RegExp(`We read [\\d,]+ of your ${n(total)} words: the start and the end`));
    await expect(status.nth(1)).toContainText(`We read all ${n(words(short))} words`);
    const read = Number(((await long.textContent()) ?? "").match(/We read ([\d,]+) of/)![1]!.replace(/,/g, ""));
    expect(read).toBeGreaterThan(30_000);
    expect(read).toBeLessThan(total);
    // What it drafts from is what was read.
    await expect(page.getByText(`${n(read + words(short))} words to draft from`)).toBeVisible();

    const sent = page.waitForRequest((r) => r.url().endsWith("/api/exhbts/draft") && r.method() === "POST");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    const text = ((await sent).postDataJSON() as { text: string }).text;
    expect(text.length).toBeLessThanOrEqual(MAX_MATERIAL_CHARS - NOTES_ROOM);
    expect(text).toContain(paragraph(1));
    expect(text).toContain(LEFT_OUT);
    expect(text).toContain(LAST);
    expect(text).not.toContain(MIDDLE);
    expect(text).toContain(short);
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 90_000 });
    await waitEditor(page);
    // The stand-in saw the end, not the middle: its "What I'd do next" names Bramley, not Ashfield.
    const doc = JSON.stringify((await stored(page)).working);
    expect(doc).toContain("Bramley");
    expect(doc).not.toContain("Ashfield");
  });
});
