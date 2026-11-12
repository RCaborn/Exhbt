import "server-only";
import { getPlan, limitsFor } from "./plan";
import { devBlobs, devStorageEnabled } from "./files";
import type { ExhbtDoc } from "./exhbt/blocks";
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
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** The stored content type for a file, from its name (the browser's type is only a hint). Null if we don't store it. */
export function storedType(name: string, mime: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const byExt = TYPES[ext];
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
  const type = storedType(req.name, req.mime);
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

/* ---------------- Clean-up: an exhbt's files, and every file on account deletion ---------------- */

/** Supabase removes up to 1,000 paths per call; smaller batches keep each request quick. */
const REMOVE_BATCH = 100;

/** Removes the stored objects (not the records), bucket by bucket in batches. Logs and carries on if one fails. */
async function removeStoredObjects(files: StoredFile[]): Promise<void> {
  if (!files.length) return;
  if (!isSupabaseConfigured()) {
    if (devStorageEnabled()) for (const f of files) devBlobs().delete(f.id);
    return;
  }
  const storage = supabaseAdmin().storage;
  for (const bucket of ["sources", "evidence"] as const) {
    const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path);
    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const { error } = await storage.from(bucket).remove(paths.slice(i, i + REMOVE_BATCH));
      if (error) console.error("storage remove failed", bucket, error.message);
    }
  }
}

/** The file ids an exhbt's working or live copy points at (images and a file as the work). */
function fileIdsIn(doc: ExhbtDoc | null | undefined): string[] {
  if (!doc) return [];
  const ids = (doc.images ?? []).map((im) => im.fileId);
  if (doc.evidence?.kind === "file") ids.push(doc.evidence.fileId);
  return ids;
}

/**
 * Deletes an exhbt and its files: the ones attached to it, and the images or evidence its
 * pages point at unless another of the person's exhbts or their profile photo uses them too.
 * Storage objects go first, then the records, then the exhbt. False if it isn't theirs.
 */
export async function deleteExhbtWithFiles(userId: string, exhbtId: string): Promise<boolean> {
  const store = getStore();
  const [exhbt, all, profile, attached] = await Promise.all([
    store.getExhbt(exhbtId),
    store.listExhbts(userId),
    store.getPortfolioProfile(userId),
    store.listFiles(userId, exhbtId),
  ]);
  if (!exhbt || exhbt.userId !== userId) return false;

  const usedElsewhere = new Set([
    ...all.filter((e) => e.id !== exhbtId).flatMap((e) => [...fileIdsIn(e.doc), ...fileIdsIn(e.published)]),
    ...(profile.photoFileId ? [profile.photoFileId] : []),
  ]);
  const files = new Map(attached.map((f) => [f.id, f]));
  for (const id of new Set([...fileIdsIn(exhbt.doc), ...fileIdsIn(exhbt.published)])) {
    if (files.has(id) || usedElsewhere.has(id)) continue;
    const f = await store.getFile(id);
    if (f && f.userId === userId) files.set(id, f);
  }

  const doomed = [...files.values()];
  await removeStoredObjects(doomed);
  for (const f of doomed) await store.deleteFile(f.id, userId);
  return store.deleteExhbt(exhbtId, userId);
}

/**
 * Removes every stored object a person has, before their account is deleted. The records go
 * with the account (the database cascade, or the in-memory store's deleteUserData).
 */
export async function deleteAllFiles(userId: string): Promise<void> {
  await removeStoredObjects(await getStore().listFiles(userId));
}
