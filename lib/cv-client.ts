/**
 * Extracts CV text in the browser, so the file itself never leaves the visitor's
 * device and the server never parses PDFs (heavy on CPU). Libraries load lazily,
 * only when someone actually picks a file.
 */

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export class CvError extends Error {}

export async function extractCvTextInBrowser(file: File): Promise<string> {
  if (file.size > MAX_CV_BYTES) throw new CvError("That file is over 5 MB. Try a smaller file, or paste the text.");
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  let text: string;
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      throw new CvError("That file doesn't look like a PDF.");
    }
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (name.endsWith(".docx")) {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new CvError("That file doesn't look like a Word document.");
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  } else {
    throw new CvError("Choose a PDF or Word (.docx) file, or paste the text instead.");
  }

  const cleaned = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20_000);
  if (cleaned.length < 80) {
    throw new CvError("We couldn't read much text from that file (it may be a scanned image). Paste it instead.");
  }
  return cleaned;
}
