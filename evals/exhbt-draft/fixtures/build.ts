/**
 * Builds the binary eval fixtures (PDF and Word) from the plain-text sources in src/, and
 * refreshes each answer key's `sourceNumbers` (every number in the source, as written).
 *
 *   npx tsx evals/exhbt-draft/fixtures/build.ts
 *
 * The generated files are committed too (they are small), so the eval runs without this step.
 * Rerun it after editing anything in src/ or the text fixtures. Output is deterministic.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { makeDocx } from "../../../e2e/doc-fixtures";
import { parseCsv } from "../../../lib/doc-readers";
import { numbersIn } from "../../../lib/exhbt/verify";

const DIR = join(process.cwd(), "evals/exhbt-draft/fixtures");
const SRC = join(DIR, "src");

/** Which source becomes which file. Text, markdown and CSV fixtures are their own source. */
const BUILDS: { src: string; out: string; kind: "pdf" | "docx" }[] = [
  { src: "01-econ-dissertation.txt", out: "01-econ-dissertation.pdf", kind: "pdf" },
  { src: "03-finance-dcf.txt", out: "03-finance-dcf.docx", kind: "docx" },
  { src: "04-marketing-society.txt", out: "04-marketing-society.docx", kind: "docx" },
  { src: "05-eng-lab-report.txt", out: "05-eng-lab-report.pdf", kind: "pdf" },
  { src: "06-history-essay.txt", out: "06-history-essay.docx", kind: "docx" },
];

/** Wraps a paragraph to lines of at most `width` characters, keeping leading spaces (table rows). */
function wrap(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let cur = "";
  for (const word of line.split(" ")) {
    if (cur && (cur + " " + word).length > width) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * A multi-page A4 PDF with real text in Helvetica 10pt (e2e/doc-fixtures.ts makePdf is one page
 * only). Offsets are computed so pdf.js reads it cleanly. Latin-1 only, which covers "£".
 */
function makeMultiPagePdf(text: string): Buffer {
  const LINES_PER_PAGE = 58;
  const lines = text.split("\n").flatMap((l) => (l.trim() ? wrap(l.trimEnd(), 95) : [""]));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));

  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  // Objects: 1 catalog, 2 pages, 3 font, then a page and its content stream for each page.
  const objects: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  pages.forEach((pageLines, i) => {
    const stream = `BT /F1 10 Tf 50 800 Td 13 TL ${pageLines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });

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

/**
 * Word file with fixed timestamps inside the zip, so rebuilding gives identical bytes. Same
 * structure as e2e/doc-fixtures.ts makeDocx: re-zipped here with a fixed date on every entry.
 */
async function deterministicDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(await makeDocx(paragraphs));
  const fixed = new JSZip();
  const date = new Date(Date.UTC(2026, 0, 1));
  for (const name of Object.keys(zip.files).sort()) {
    const entry = zip.files[name]!;
    if (!entry.dir) fixed.file(name, await entry.async("uint8array"), { date, createFolders: false });
  }
  return fixed.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** The answer key as JSON, one key per line and one fact per line, so it stays easy to edit by hand. */
function formatFacts(facts: Record<string, unknown>): string {
  const lines = Object.entries(facts).map(([key, value]) => {
    const isListOfObjects = Array.isArray(value) && value.length > 0 && value.every((v) => v && typeof v === "object" && !Array.isArray(v));
    const body = isListOfObjects
      ? `[\n${(value as unknown[]).map((v) => `    ${JSON.stringify(v)}`).join(",\n")}\n  ]`
      : JSON.stringify(value);
    return `  ${JSON.stringify(key)}: ${body}`;
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}

async function main() {
  for (const b of BUILDS) {
    const text = readFileSync(join(SRC, b.src), "utf8");
    const bytes = b.kind === "pdf" ? makeMultiPagePdf(text) : await deterministicDocx(text.split("\n").filter((l) => l.trim()));
    writeFileSync(join(DIR, b.out), bytes);
    console.log(`built ${b.out} (${bytes.length} bytes)`);
  }

  // The source text behind each fixture file: src/ for generated files, the file itself otherwise.
  // A CSV is read cell by cell, so "08:00,398" doesn't read as one number.
  const sourceOf = (file: string) => {
    const built = BUILDS.find((b) => b.out === file);
    const raw = readFileSync(built ? join(SRC, built.src) : join(DIR, file), "utf8");
    return file.endsWith(".csv") ? parseCsv(raw).flat().join("\n") : raw;
  };

  for (const name of readdirSync(DIR).filter((n) => n.endsWith(".facts.json")).sort()) {
    const path = join(DIR, name);
    const facts = JSON.parse(readFileSync(path, "utf8")) as { files: string[]; notesFile?: string | null; sourceNumbers?: string[] };
    const texts = [...facts.files.map(sourceOf), facts.notesFile ? sourceOf(facts.notesFile) : ""];
    facts.sourceNumbers = [...new Set(texts.flatMap(numbersIn))];
    writeFileSync(path, formatFacts(facts));
    console.log(`${name}: ${facts.sourceNumbers.length} numbers in the source`);
  }
}

void main();
