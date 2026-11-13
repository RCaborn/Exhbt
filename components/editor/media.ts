/**
 * Browser side of images and "the work" as a file: ask for a signed upload URL (kind image or
 * evidence, tied to this exhbt), PUT the bytes, and remove a file again. The server checks the
 * plan's caps and the file type; these checks only spare a round trip.
 */

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

/** Uploads one file for an exhbt and returns its exhbt_files id. Throws UploadError with a message to show. */
export async function uploadForExhbt(file: File, kind: "image" | "evidence", exhbtId: string): Promise<string> {
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

/** Every stored file an exhbt doc points at. */
export function fileIdsOf(doc: { images: { fileId: string }[]; evidence?: { kind: string; fileId?: string } }): string[] {
  const ids = doc.images.map((i) => i.fileId);
  if (doc.evidence?.kind === "file" && doc.evidence.fileId) ids.push(doc.evidence.fileId);
  return ids;
}
