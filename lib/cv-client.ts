/**
 * Reads a CV file in the browser. A thin wrapper over the general readers in
 * lib/doc-readers.ts, which hold the formats, the fallbacks and the quality check; this file
 * keeps the CV's own size cap, accepted types and AI reader endpoint.
 *
 * When nothing in the browser can read it (a scanned PDF, a photo of a CV), this throws
 * CvNeedsServer. The wizard then asks the visitor whether to send the file to be read by the
 * AI (/api/cv/read), or to paste the text instead. The file is never sent without asking.
 */
import { DocError, DocNeedsServer, extractTextInBrowser, readOnServer } from "./doc-readers";

export {
  SERVER_READABLE,
  decodeText,
  detectKind,
  odtXmlToText,
  rtfToText,
  scrapeBinaryDoc,
  wordXmlToText,
  type ServerReadable,
} from "./doc-readers";

/** The CV names for the general errors: same classes, so `instanceof` works with either name. */
export { DocError as CvError, DocNeedsServer as CvNeedsServer };

export const MAX_CV_BYTES = 5 * 1024 * 1024;
const MAX_CV_CHARS = 20_000;

/** What the file input offers. Extensions first, so the picker shows them on every platform. */
export const CV_ACCEPT =
  ".pdf,.docx,.doc,.odt,.rtf,.txt,.md,.png,.jpg,.jpeg,.webp,.heic,application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword," +
  "application/vnd.oasis.opendocument.text,application/rtf,text/plain,image/*";

/**
 * Returns the CV's text, or throws CvError (a message to show) or CvNeedsServer (ask the
 * visitor whether to send the file to the AI reader).
 */
export function extractCvTextInBrowser(file: File): Promise<string> {
  return extractTextInBrowser(file, { maxBytes: MAX_CV_BYTES, maxChars: MAX_CV_CHARS });
}

/** Asks the server's AI reader for the text of a scan or photo. The visitor has agreed to send it. */
export function readCvOnServer(file: File): Promise<string> {
  return readOnServer(file, "/api/cv/read");
}
