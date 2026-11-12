import "server-only";
import { getPlan, limitsFor } from "./plan";
import { devBlobs, devStorageEnabled } from "./files";
import { getStore, isSupabaseConfigured, supabaseAdmin, type StoredFile } from "./store";

/**
 * Uploads go straight from the browser to Supabase Storage with a signed upload URL, so the
 * Worker never handles big files (docs/phase-2.md section 6). This file checks the plan's caps,
 * records the file (exhbt_files) and hands back where to PUT the bytes.
 *
 * Buckets (section 5): `sources` (private, project material) and `evidence` (private, served
 * through short-lived signed URLs: evidence files, images on an exhbt, profile photos).
 * In development without Supabase, the URL is the /dev/upload stand-in.
 */

const MB = 1024 * 1024;

export type UploadKind = StoredFile["kind"];
export const UPLOAD_KINDS = ["source", "evidence", "image", "photo"] as const satisfies readonly UploadKind[];

/** The file types we store, by extension. Anything that could run in a browser (HTML, SVG) is refused. */
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
/** Extra types allowed as "the work" on an exhbt (kind evidence), not as project material or pictures. */
const EVIDENCE_ONLY_TYPES: Record<string, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** The stored content type for a file, from its name (the browser's type is only a hint). Null if we don't store it. */
export function storedType(name: string, mime: string, kind?: UploadKind): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const byExt = TYPES[ext] ?? (kind === "evidence" ? EVIDENCE_ONLY_TYPES[ext] : undefined);
  if (byExt) return byExt;
  return Object.values(TYPES).includes(mime) ? mime : null;
}

export type UploadRequest = { name: string; mime: string; bytes: number; kind: UploadKind; exhbtId?: string | null };
export type UploadTicket = { fileId: string; uploadUrl: string; headers: Record<string, string> };
export type UploadResult = ({ ok: true } & UploadTicket) | { ok: false; status: number; reason: string };

const refuse = (status: number, reason: string): UploadResult => ({ ok: false, status, reason });

/** A safe last path segment: letters, digits, dots, dashes; the original name is not otherwise kept. */
const safeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[-.]+|-+$/g, "")
    .slice(-80) || "file";

/**
 * Checks the caps, records the file and returns a signed URL to PUT the bytes to. The record
 * is made first, so the storage total counts it at once (two quick uploads can't both squeeze
 * under the cap); a failed upload's record is removed with deleteFile.
 */
export async function createUpload(userId: string, req: UploadRequest): Promise<UploadResult> {
  const plan = await getPlan(userId);
  const caps = limitsFor(plan);
  const type = storedType(req.name, req.mime, req.kind);
  if (!type) return refuse(415, "We can't store that type of file. Upload a PDF, Word, OpenDocument, text, CSV or Excel file, or an image.");
  if ((req.kind === "image" || req.kind === "photo") && !IMAGE_TYPES.has(type)) {
    return refuse(415, "Only images can be used as a picture.");
  }
  if (!Number.isInteger(req.bytes) || req.bytes <= 0) return refuse(400, "That file is empty.");
  if (req.bytes > caps.uploadMbPerFile * MB) {
    return refuse(413, `That file is over ${caps.uploadMbPerFile} MB, the limit for each file on your plan.`);
  }
  const store = getStore();
  const used = await store.storageBytesUsed(userId);
  if (used + req.bytes > caps.storageMbTotal * MB) {
    return refuse(413, `That would take you over your plan's ${caps.storageMbTotal} MB of storage. Remove a file first.`);
  }

  const fileId = crypto.randomUUID();
  const bucket: StoredFile["bucket"] = req.kind === "source" ? "sources" : "evidence";
  // The user's folder first: account deletion removes everything under it.
  const path = `${userId}/${fileId}/${safeName(req.name)}`;
  await store.createFile({ id: fileId, userId, bucket, path, mime: type, bytes: req.bytes, kind: req.kind, exhbtId: req.exhbtId ?? null });
  await store.logEvent("file_uploaded", userId, { fileId, kind: req.kind, bytes: req.bytes, mime: type });

  const headers = { "content-type": type };
  if (!isSupabaseConfigured()) {
    if (!devStorageEnabled()) return refuse(500, "File storage isn't set up.");
    return { ok: true, fileId, uploadUrl: `/dev/upload/${fileId}`, headers };
  }
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    await store.deleteFile(fileId, userId);
    console.error("signed upload url failed", error?.message);
    return refuse(502, "We couldn't start the upload just now. Try again in a moment.");
  }
  return { ok: true, fileId, uploadUrl: data.signedUrl, headers };
}

/** Removes a file: the stored object, then its record. False if it isn't theirs. */
export async function deleteFile(userId: string, fileId: string): Promise<boolean> {
  const store = getStore();
  const file = await store.getFile(fileId);
  if (!file || file.userId !== userId) return false;
  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin().storage.from(file.bucket).remove([file.path]);
    if (error) console.error("storage remove failed", error.message);
  } else if (devStorageEnabled()) {
    devBlobs().delete(fileId);
  }
  return (await store.deleteFile(fileId, userId)) !== null;
}
