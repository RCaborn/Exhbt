import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { checkCvText, cleanCvText } from "../lib/cv-quality";
import { decodeText, detectKind, odtXmlToText, rtfToText, scrapeBinaryDoc, wordXmlToText } from "../lib/cv-client";
import { waitForBuilder } from "./helpers";

// The CV readers (lib/cv-client.ts, lib/cv-quality.ts) and the upload step. Fixtures are
// generated here, so no binary files live in the repo.

const CV =
  "Amara Okafor\n" +
  "BSc Data Science, University of Example, 2026. Expected 2:1.\n" +
  "Experience: part-time retail supervisor, 2023-2025. Managed a team of four and handled customer complaints.\n" +
  "Projects: built an appointment reminder model in Python with pandas, using 14,000 records.\n" +
  "Skills: Python, SQL, Excel, data visualisation.";

/** A one-page PDF with real text, or with none (like a scan). Offsets are computed, so pdf.js reads it cleanly. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = lines.length
    ? `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`
    : "0 0 1 rg 50 50 200 200 re f"; // a filled box: something on the page, but no text
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function makeOdt(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text");
  zip.file("content.xml", `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${paragraphs.map((p) => `<text:p>${p}</text:p>`).join("")}</office:text></office:body></office:document-content>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

const toRtf = (text: string) =>
  `{\\rtf1\\ansi{\\fonttbl{\\f0 Calibri;}}{\\colortbl;\\red0\\green0\\blue0;}\\f0 ${text.split("\n").map((l) => l.replace(/[\\{}]/g, (c) => `\\${c}`)).join("\\par\n")}}`;

/** Word 97-2003 stores body text as UTF-16; a stand-in with the OLE header and the text inside binary noise. */
const makeDoc = (text: string) =>
  Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(504, 0),
    Buffer.from(text.replace(/\n/g, "\r"), "utf16le"),
    Buffer.alloc(64, 0),
  ]);

test.describe("CV readers", () => {
  test("the quality check passes a real CV and rejects scans and broken fonts", () => {
    expect(checkCvText(CV).ok).toBe(true);
    expect(checkCvText("Page 1").reason).toBe("too_short");
    // What a PDF with a broken font map gives: letters, but not words.
    const shifted = CV.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 94) % 26) + 97));
    expect(checkCvText(shifted).ok).toBe(false);
    expect(checkCvText("\ufffd".repeat(40) + CV.slice(0, 60)).ok).toBe(false);
    expect(checkCvText("12/03/2024 | 0.00 | 1,250 | ".repeat(10)).ok).toBe(false);
  });

  test("tidy-up keeps line breaks and drops runs of spaces", () => {
    expect(cleanCvText("A  b\r\n\r\n\r\n\r\nc\u0000")).toBe("A b\n\nc");
  });

  test("format detection trusts bytes over the name", () => {
    const pdf = makePdf(["x"]);
    expect(detectKind(new Uint8Array(pdf), "cv.docx", "")).toBe("pdf");
    expect(detectKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), "cv.pdf", "")).toBe("image");
    expect(detectKind(new Uint8Array(Buffer.from("Just text")), "cv", "")).toBe("text");
  });

  test("RTF, Word XML, OpenDocument XML and old .doc give the text", () => {
    expect(rtfToText(toRtf(CV)).trim()).toBe(CV);
    expect(rtfToText("{\\rtf1 caf\\'e9 \\u8212? done}")).toBe("café — done");
    expect(wordXmlToText('<w:p><w:r><w:t>BSc</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve"> 2026 &amp; more</w:t></w:r></w:p><w:p><w:r><w:t>Next</w:t></w:r></w:p>')).toBe(
      "BSc\t 2026 & more\nNext\n",
    );
    expect(odtXmlToText("<text:p>One<text:s text:c=\"2\"/>two</text:p><text:p>Three</text:p>")).toBe("One  two\nThree\n");
    expect(scrapeBinaryDoc(new Uint8Array(makeDoc(CV)))).toContain("University of Example");
  });

  test("text files in Windows encodings decode", () => {
    expect(decodeText(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toBe("café"); // windows-1252
    expect(decodeText(new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("CV", "utf16le")])))).toBe("CV");
  });
});

async function openCvStep(page: Page) {
  await page.goto("/roadmap/new?role=Junior%20data%20analyst");
  await waitForBuilder(page);
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
}

async function upload(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.locator("#cvFile").setInputFiles({ name, mimeType, buffer });
}

test.describe("CV upload", () => {
  const cases: [string, string, () => Promise<Buffer> | Buffer][] = [
    ["cv.pdf", "application/pdf", () => makePdf(CV.split("\n"))],
    ["cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", () => makeDocx(CV.split("\n"))],
    ["cv.odt", "application/vnd.oasis.opendocument.text", () => makeOdt(CV.split("\n"))],
    ["cv.rtf", "application/rtf", () => Buffer.from(toRtf(CV), "latin1")],
    ["cv.doc", "application/msword", () => makeDoc(CV)],
    ["cv.txt", "text/plain", () => Buffer.from(CV)],
  ];
  for (const [name, mime, make] of cases) {
    test(`reads a ${name.split(".")[1]} file on the device`, async ({ page }) => {
      let sent = false;
      page.on("request", (r) => {
        if (r.url().includes("/api/cv/read")) sent = true;
      });
      await openCvStep(page);
      await upload(page, name, mime, await make());
      await expect(page.locator("#cv-status")).toContainText(`from ${name}`);
      await page.getByRole("button", { name: "Check or edit what we read" }).click();
      await expect(page.locator("#cvPaste")).toHaveValue(/University of Example/);
      expect(sent).toBe(false);
    });
  }

  test("a scanned PDF asks before sending, then the AI reader fills in the text", async ({ page }) => {
    await openCvStep(page);
    await upload(page, "scan.pdf", "application/pdf", makePdf([]));
    await expect(page.getByText("That PDF looks like a scan")).toBeVisible();
    await page.getByRole("button", { name: "Read it for me" }).click();
    // Without an API key the reader returns a labelled placeholder.
    await expect(page.locator("#cv-status")).toContainText("from scan.pdf");
    await page.getByRole("button", { name: "Check or edit what we read" }).click();
    await expect(page.locator("#cvPaste")).toHaveValue(/Development preview/);
  });

  test("a photo can be pasted instead, and nothing is sent", async ({ page }) => {
    let sent = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/cv/read")) sent = true;
    });
    await openCvStep(page);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    await upload(page, "cv.png", "image/png", png);
    await expect(page.getByText("That's a photo")).toBeVisible();
    await page.getByRole("button", { name: "Paste the text instead" }).click();
    await expect(page.locator("#cvPaste")).toBeVisible();
    expect(sent).toBe(false);
  });

  test("an unreadable file explains what to do", async ({ page }) => {
    await openCvStep(page);
    await upload(page, "cv.pages", "application/octet-stream", Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]));
    await expect(page.locator("#cv-error")).toContainText("Export To > PDF");
  });
});
