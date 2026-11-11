/**
 * Reads a CV file in the browser, so the file itself stays on the visitor's device and the
 * server never parses documents (heavy on Worker CPU). Libraries load lazily, only when
 * someone picks a file. Each format has more than one reader, tried in order, and every
 * result goes through the same quality check (lib/cv-quality.ts).
 *
 * When nothing in the browser can read it (a scanned PDF, a photo of a CV), this throws
 * CvNeedsServer. The wizard then asks the visitor whether to send the file to be read by the
 * AI (/api/cv/read), or to paste the text instead. The file is never sent without asking.
 */
import { checkCvText, cleanCvText } from "./cv-quality";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export class CvError extends Error {}

/** The browser couldn't read this file, but the AI reader can (a PDF or an image). */
export class CvNeedsServer extends Error {
  constructor(public kind: "scan" | "image") {
    super(kind);
  }
}

/** File types the server-side AI reader accepts. */
export const SERVER_READABLE = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ServerReadable = (typeof SERVER_READABLE)[number];

/** What the file input offers. Extensions first, so the picker shows them on every platform. */
export const CV_ACCEPT =
  ".pdf,.docx,.doc,.odt,.rtf,.txt,.md,.png,.jpg,.jpeg,.webp,.heic,application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword," +
  "application/vnd.oasis.opendocument.text,application/rtf,text/plain,image/*";

type Kind = "pdf" | "docx" | "odt" | "doc" | "rtf" | "text" | "image" | "heic" | "pages" | "unknown";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** Decides the format from the file's first bytes, falling back to its name. Names lie; bytes rarely do. */
export function detectKind(bytes: Uint8Array, name: string, type: string): Kind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) || startsWith(bytes, [0xff, 0xd8, 0xff])) return "image"; // PNG, JPEG
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image"; // GIF
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image";
  if (ascii(bytes, 4, 8) === "ftyp" && /heic|heix|mif1|heif/.test(ascii(bytes, 8, 12))) return "heic";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "doc"; // Word 97-2003
  if (ascii(bytes, 0, 5) === "{\\rtf") return "rtf";
  if (startsWith(bytes, [0x50, 0x4b])) {
    // Zip: Word, OpenDocument or Pages. The name tells them apart; the readers check the contents.
    if (ext === "odt") return "odt";
    if (ext === "pages") return "pages";
    return "docx";
  }
  if (ext === "pdf" || type === "application/pdf") return "pdf"; // Some PDFs have junk before %PDF.
  if (["txt", "md", "text"].includes(ext) || type.startsWith("text/")) return "text";
  return looksLikeText(bytes) ? "text" : "unknown";
}

function looksLikeText(b: Uint8Array): boolean {
  const sample = b.subarray(0, 4096);
  if (!sample.length) return false;
  let odd = 0;
  for (const c of sample) if (c < 9 || (c > 13 && c < 32)) odd++;
  return odd / sample.length < 0.02;
}

/** Plain text in whatever encoding Windows, Mac or a phone saved it in. */
export function decodeText(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** RTF to plain text: enough for CVs (paragraphs, tabs, escaped and Unicode characters). */
export function rtfToText(rtf: string): string {
  let out = "";
  let depth = 0;
  const skipAt: number[] = []; // depths of groups to drop (fonts, colours, pictures, metadata)
  let i = 0;
  const skipping = () => skipAt.length > 0;
  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === "{") {
      depth++;
      i++;
      // Destinations we don't want: {\* ...} and the known header tables.
      const m = /^\\(\*|fonttbl|colortbl|stylesheet|info|pict|header|footer|listtable|listoverridetable|themedata|datastore|latentstyles|rsidtbl|generator|xmlnstbl)/.exec(rtf.slice(i, i + 20));
      if (m && !skipping()) skipAt.push(depth);
      continue;
    }
    if (ch === "}") {
      if (skipAt[skipAt.length - 1] === depth) skipAt.pop();
      depth--;
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = rtf[i + 1];
      if (next === "\\" || next === "{" || next === "}") {
        if (!skipping()) out += next;
        i += 2;
        continue;
      }
      if (next === "'") {
        if (!skipping()) out += new TextDecoder("windows-1252").decode(new Uint8Array([parseInt(rtf.slice(i + 2, i + 4), 16)]));
        i += 4;
        continue;
      }
      const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40));
      if (m) {
        i += m[0].length;
        if (skipping()) continue;
        const [, word, num] = m;
        if (word === "par" || word === "line" || word === "row") out += "\n";
        else if (word === "tab" || word === "cell") out += "\t";
        else if (word === "u" && num) {
          const code = Number(num);
          out += String.fromCharCode(code < 0 ? code + 65536 : code);
          if (rtf[i] === "?") i++; // the plain-text stand-in that follows \u
        }
        continue;
      }
      i += 2;
      continue;
    }
    if (!skipping() && ch !== "\r" && ch !== "\n") out += ch;
    i++;
  }
  return out;
}

/** Text runs from an old binary .doc. Word 97-2003 stores body text as plain cp1252 or UTF-16. */
export function scrapeBinaryDoc(bytes: Uint8Array): string {
  const runs: string[] = [];
  // UTF-16LE runs of printable characters.
  let cur = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const printable = (code >= 32 && code < 0xd800 && code !== 0xfffd) || code === 13 || code === 9;
    if (printable) cur += code === 13 ? "\n" : String.fromCharCode(code);
    else {
      if (cur.replace(/\s/g, "").length >= 6) runs.push(cur);
      cur = "";
    }
  }
  if (cur.replace(/\s/g, "").length >= 6) runs.push(cur);
  const utf16 = runs.join("\n");
  // Single-byte runs (files saved with "fast save" or by older tools).
  const single = (new TextDecoder("windows-1252").decode(bytes).match(/[\x20-\x7e\xa0-\xff\r\n\t]{12,}/g) ?? []).join("\n");
  // Keep whichever looks more like a CV.
  return checkCvText(utf16).ok || utf16.length > single.length ? utf16 : single;
}

/** Word's own XML: every <w:t> run, with paragraph and line breaks kept. */
export function wordXmlToText(xml: string): string {
  // Turn tabs and breaks into text runs of their own, then keep only the runs' text.
  const marked = xml
    .replace(/<w:tab\/>/g, "<w:t>\t</w:t>")
    .replace(/<w:br\b[^>]*\/>|<w:cr\/>|<\/w:p>/g, "<w:t>\n</w:t>");
  const runs = [...marked.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  return runs
    .join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** OpenDocument content.xml to text. */
export function odtXmlToText(xml: string): string {
  return xml
    .replace(/<text:tab\/>/g, "\t")
    .replace(/<text:line-break\/>|<\/text:p>|<\/text:h>/g, "\n")
    .replace(/<text:s(?: text:c="(\d+)")?\/>/g, (_, n) => " ".repeat(Number(n ?? 1)))
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function readPdf(bytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // A copy: pdf.js may detach the buffer it's given, and a later reader needs the bytes.
  const pdf = await getDocumentProxy(bytes.slice());
  const merged = (await extractText(pdf, { mergePages: true })).text;
  const pages = (await extractText(pdf, { mergePages: false })).text;
  return [merged, Array.isArray(pages) ? pages.join("\n\n") : String(pages)];
}

async function readDocx(buf: ArrayBuffer): Promise<string[]> {
  const out: string[] = [];
  try {
    const mammoth = await import("mammoth");
    out.push((await mammoth.extractRawText({ arrayBuffer: buf })).value);
  } catch {
    // Fall through to reading the XML directly.
  }
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const parts = Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n));
  parts.sort((a, b) => (a === "word/document.xml" ? -1 : b === "word/document.xml" ? 1 : a.localeCompare(b)));
  // Text boxes (common in designed CVs) sit inside document.xml, so the XML reader catches them.
  const xml = await Promise.all(parts.map((p) => zip.file(p)!.async("string")));
  out.push(xml.map(wordXmlToText).join("\n"));
  return out;
}

async function readOdt(buf: ArrayBuffer): Promise<string[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const content = zip.file("content.xml");
  return content ? [odtXmlToText(await content.async("string"))] : [];
}

/**
 * Returns the CV's text, or throws CvError (a message to show) or CvNeedsServer (ask the
 * visitor whether to send the file to the AI reader).
 */
export async function extractCvTextInBrowser(file: File): Promise<string> {
  if (file.size === 0) throw new CvError("That file is empty. Try another, or paste the text.");
  if (file.size > MAX_CV_BYTES) throw new CvError("That file is over 5 MB. Try a smaller file, or paste the text.");
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const kind = detectKind(bytes, file.name, file.type);

  if (kind === "image") throw new CvNeedsServer("image");
  if (kind === "heic") {
    throw new CvError("That's an iPhone photo format we can't read. Take a screenshot of it, or save the CV as a PDF.");
  }
  if (kind === "pages") throw new CvError("Pages files can't be read. In Pages, choose File > Export To > PDF, then upload that.");
  if (kind === "unknown") throw new CvError("We can't read that type of file. Upload a PDF, Word document or text file, or paste the text.");

  let candidates: string[] = [];
  try {
    if (kind === "pdf") candidates = await readPdf(bytes);
    else if (kind === "docx") candidates = await readDocx(buf);
    else if (kind === "odt") candidates = await readOdt(buf);
    else if (kind === "rtf") candidates = [rtfToText(decodeText(bytes))];
    else if (kind === "doc") candidates = [scrapeBinaryDoc(bytes)];
    else candidates = [decodeText(bytes)];
  } catch (e) {
    const message = (e as Error)?.message ?? "";
    if (kind === "pdf" && /password/i.test(message)) {
      throw new CvError("That PDF is password-protected. Save a copy without a password, or paste the text.");
    }
    // A PDF the reader chokes on can usually still be read by the AI reader.
    if (kind === "pdf") throw new CvNeedsServer("scan");
    candidates = [];
  }

  for (const c of candidates) {
    const text = cleanCvText(c);
    if (checkCvText(text).ok) return text;
  }
  // Nothing usable. A PDF is probably a scan or uses unusual fonts: the AI reader handles both.
  if (kind === "pdf") throw new CvNeedsServer("scan");
  if (kind === "doc") throw new CvError("We couldn't read that older Word file. Save it as .docx or PDF, or paste the text.");
  throw new CvError("We couldn't read much text from that file. Try a PDF, or paste the text instead.");
}

/** Asks the server's AI reader for the text of a scan or photo. The visitor has agreed to send it. */
export async function readCvOnServer(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  let res: Response;
  try {
    res = await fetch("/api/cv/read", { method: "POST", body });
  } catch {
    throw new CvError("We couldn't reach our reader. Check your connection, or paste the text.");
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok || !data.text) throw new CvError(data.error ?? "We couldn't read that file. Paste the text instead.");
  return data.text;
}
