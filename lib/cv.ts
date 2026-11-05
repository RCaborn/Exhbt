import "server-only";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Extracts plain text from an uploaded CV. Throws a user-facing message on failure. */
export async function extractCvText(file: File): Promise<string> {
  if (file.size > MAX_CV_BYTES) throw new Error("That file is over 5 MB. Try a smaller file or paste the text.");
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (file.type === PDF || name.endsWith(".pdf")) {
    if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) throw new Error("That file does not look like a PDF.");
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return clean(text);
  }

  if (file.type === DOCX || name.endsWith(".docx")) {
    if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) throw new Error("That file does not look like a Word document.");
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return clean(value);
  }

  throw new Error("Upload a PDF or Word (.docx) file, or paste the text instead.");
}

function startsWith(bytes: Uint8Array, magic: number[]) {
  return magic.every((b, i) => bytes[i] === b);
}

function clean(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20_000);
}
