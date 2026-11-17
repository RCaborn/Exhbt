import JSZip from "jszip";

// Document fixtures, generated here so no binary files live in the repo. Shared by the CV
// readers' tests (cv-files.spec.ts) and the exhbt upload tests (phase2-draft.spec.ts).

/** A one-page PDF with real text, or with none (like a scan). Offsets are computed, so pdf.js reads it cleanly. */
export function makePdf(lines: string[]): Buffer {
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

export async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function makeOdt(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text");
  zip.file("content.xml", `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${paragraphs.map((p) => `<text:p>${p}</text:p>`).join("")}</office:text></office:body></office:document-content>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

export const toRtf = (text: string) =>
  `{\\rtf1\\ansi{\\fonttbl{\\f0 Calibri;}}{\\colortbl;\\red0\\green0\\blue0;}\\f0 ${text.split("\n").map((l) => l.replace(/[\\{}]/g, (c) => `\\${c}`)).join("\\par\n")}}`;

/** Word 97-2003 stores body text as UTF-16; a stand-in with the OLE header and the text inside binary noise. */
export const makeDoc = (text: string) =>
  Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(504, 0),
    Buffer.from(text.replace(/\n/g, "\r"), "utf16le"),
    Buffer.alloc(64, 0),
  ]);
