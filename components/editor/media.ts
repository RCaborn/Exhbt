/**
 * Browser side of images and "the work" as a file: ask for a signed upload URL (kind image or
 * evidence, tied to this exhbt), PUT the bytes, and remove a file again. The server checks the
 * plan's caps and the file type; these checks only spare a round trip.
 */
import { finishUpload } from "@/components/team/finish-upload";
import { imagesOf, type ExhbtDoc } from "@/lib/exhbt/blocks";

const MB = 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";
export const WORK_EXTENSIONS = ["pdf", "docx", "pptx", "xlsx", "zip", "txt"];
export const WORK_ACCEPT = WORK_EXTENSIONS.map((e) => `.${e}`).join(",");

export class UploadError extends Error {}

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";

/** A plain-English reason the file can't be used, or null if it looks fine. */
export function checkFile(file: File, kind: "image" | "evidence", maxMb: number): string | null {
  if (kind === "image" && !(IMAGE_TYPES.includes(file.type) || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext(file.name)))) {
    return "Use a JPEG, PNG, WebP or GIF picture.";
  }
  if (kind === "evidence" && !WORK_EXTENSIONS.includes(ext(file.name))) {
    return "Attach a PDF, Word, PowerPoint, Excel, zip or text file.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > maxMb * MB) return `That file is over ${maxMb} MB, the limit for each file on your plan.`;
  return null;
}

/**
 * Uploads one file for an exhbt and returns its exhbt_files id. Throws UploadError with a message
 * to show. Without `exhbtId` (a figure picked while the exhbt is still being drafted) the file is
 * attached to the exhbt later, when it is put on it.
 */
export async function uploadForExhbt(file: File, kind: "image" | "evidence", exhbtId?: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/files/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: file.name, mime: file.type, bytes: file.size, kind, exhbtId }),
    });
  } catch {
    throw new UploadError("Couldn't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { fileId?: string; uploadUrl?: string; headers?: Record<string, string>; error?: string };
  if (!res.ok || !data.fileId || !data.uploadUrl) throw new UploadError(data.error ?? "We couldn't upload that file.");
  let put: Response;
  try {
    put = await fetch(data.uploadUrl, { method: "PUT", headers: data.headers, body: file });
  } catch {
    await removeFile(data.fileId);
    throw new UploadError("The upload didn't finish. Check your connection and try again.");
  }
  if (!put.ok) {
    await removeFile(data.fileId);
    throw new UploadError("The upload didn't finish. Try again.");
  }
  // Fingerprints the stored file; a match on someone else's exhbt raises the team prompt. Doesn't wait.
  void finishUpload(data.fileId, file.name);
  return data.fileId;
}

/** Deletes a stored file. Never throws: a leftover file is harmless, a stuck editor isn't. */
export async function removeFile(fileId: string): Promise<void> {
  try {
    await fetch(`/api/files/${fileId}`, { method: "DELETE" });
  } catch {
    // Left behind; it still counts towards storage until the account is cleared.
  }
}

/** Every stored file an exhbt doc points at: its image sections and a file as the work. */
export function fileIdsOf(doc: ExhbtDoc): string[] {
  const ids = imagesOf(doc).map((i) => i.fileId);
  if (doc.evidence?.kind === "file" && doc.evidence.fileId) ids.push(doc.evidence.fileId);
  return ids;
}

/** The longest side an uploaded picture keeps, and the weight above which it is re-encoded (decision 0024). */
export const IMAGE_LONG_EDGE = 2400;
export const IMAGE_HEAVY_BYTES = 1.5 * MB;

/** A picture's size in pixels, as the browser would draw it (EXIF orientation applied), or nothing if it can't be read. */
export async function readSize(file: Blob): Promise<{ w: number; h: number } | undefined> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = { w: bmp.width, h: bmp.height };
    bmp.close();
    return size;
  } catch {
    return undefined;
  }
}

/**
 * Shrinks a picture in the browser before it goes up, so a gallery of pictures stays well inside
 * the plan's storage: over 2,400 pixels on the long edge, or over 1.5 MB, it is drawn to a canvas
 * (scaled down, never up) and re-encoded: JPEG stays JPEG, PNG and WebP become WebP, at 0.86. A GIF
 * is never changed. The original is kept when it wasn't scaled down and the result isn't smaller.
 * The file is named from the encoded type (so the server's extension check agrees). Returns the
 * final size too. On any error the original goes up and the server's caps still apply.
 */
export async function prepareImage(file: File): Promise<{ file: File; w?: number; h?: number }> {
  try {
    const gif = file.type === "image/gif" || ext(file.name) === "gif";
    const bmp = await createImageBitmap(file, gif ? undefined : { imageOrientation: "from-image" });
    const w0 = bmp.width;
    const h0 = bmp.height;
    const long = Math.max(w0, h0);
    if (gif || (long <= IMAGE_LONG_EDGE && file.size <= IMAGE_HEAVY_BYTES)) {
      bmp.close();
      return { file, w: w0, h: h0 };
    }
    const scale = Math.min(1, IMAGE_LONG_EDGE / long);
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return { file, w: w0, h: h0 };
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const jpeg = file.type === "image/jpeg" || ["jpg", "jpeg"].includes(ext(file.name));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, jpeg ? "image/jpeg" : "image/webp", 0.86));
    if (!blob || (scale === 1 && blob.size >= file.size)) return { file, w: w0, h: h0 };
    const type = blob.type === "image/jpeg" || blob.type === "image/webp" ? blob.type : "image/png";
    const e = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return { file: new File([blob], `${base}.${e}`, { type }), w, h };
  } catch {
    return { file };
  }
}
