import "server-only";
import { looksLikeFileId } from "./exhbt/doc-files";
import { getStore, isSupabaseConfigured, supabaseAdmin, type StoredFile } from "./store";

/** How long a signed file link on a portfolio page works. Short, so unpublishing takes effect quickly. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * The one rule for showing a stored file as part of someone's exhbt, portfolio or profile: it must
 * belong to that person (`StoredFile.userId`). A teammate's copy of a shared file is a record of
 * their own (makeOwnExhbt, decision 0013), so it passes as theirs; a file another person owns
 * never does, whoever learns its id. Every signed link goes through here.
 */
export function mayShowFile(file: StoredFile | null, ownerId: string): file is StoredFile {
  return Boolean(file && ownerId && file.userId === ownerId);
}

/**
 * A short-lived link to a stored file (both buckets are private). Null when the file is
 * missing or isn't `ownerId`'s. In development without Supabase, files uploaded through the /dev/upload stand-in
 * are served from /dev/files/<id>, so portfolio pages show them locally.
 */
export async function signedFileUrl(fileId: string | null | undefined, ownerId: string): Promise<string | null> {
  if (!fileId || !looksLikeFileId(fileId)) return null;
  const file = await getStore().getFile(fileId);
  if (!mayShowFile(file, ownerId)) return null;
  if (!isSupabaseConfigured()) return devStorageEnabled() && devBlobs().has(fileId) ? `/dev/files/${fileId}` : null;
  const { data, error } = await supabaseAdmin().storage.from(file.bucket).createSignedUrl(file.path, SIGNED_URL_SECONDS, {
    // Images show inline; anything else downloads rather than opening in our origin.
    download: file.mime.startsWith("image/") ? undefined : true,
  });
  return error ? null : data.signedUrl;
}

/* ---------------- Development stand-in for Supabase Storage ---------------- */

/** True only in development and tests without Supabase: the /dev/upload and /dev/files routes 404 otherwise. */
export const devStorageEnabled = () => !isSupabaseConfigured() && process.env.NODE_ENV !== "production";

const g = globalThis as unknown as { __exhbtDevBlobs?: Map<string, Uint8Array> };

/** Uploaded bytes by file id, in memory, for the dev routes. Gone when the server restarts. */
export function devBlobs(): Map<string, Uint8Array> {
  if (!devStorageEnabled()) throw new Error("Development only.");
  return (g.__exhbtDevBlobs ??= new Map());
}
