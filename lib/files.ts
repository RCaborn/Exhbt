import "server-only";
import { getStore, isSupabaseConfigured, supabaseAdmin } from "./store";

/** How long a signed file link on a portfolio page works. Short, so unpublishing takes effect quickly. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * A short-lived link to a stored file (both buckets are private). Null when the file is
 * missing. In development without Supabase, files uploaded through the /dev/upload stand-in
 * are served from /dev/files/<id>, so portfolio pages show them locally.
 */
export async function signedFileUrl(fileId: string | null | undefined): Promise<string | null> {
  if (!fileId) return null;
  const file = await getStore().getFile(fileId);
  if (!file) return null;
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
