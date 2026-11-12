import "server-only";
import { getStore, isSupabaseConfigured, supabaseAdmin } from "./store";

/** How long a signed file link on a portfolio page works. Short, so unpublishing takes effect quickly. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * A short-lived link to a stored file (both buckets are private). Null when the file is
 * missing, or in development without Supabase (pages then show the layout without it).
 */
export async function signedFileUrl(fileId: string | null | undefined): Promise<string | null> {
  if (!fileId) return null;
  const file = await getStore().getFile(fileId);
  if (!file || !isSupabaseConfigured()) return null;
  const { data, error } = await supabaseAdmin().storage.from(file.bucket).createSignedUrl(file.path, SIGNED_URL_SECONDS, {
    // Images show inline; anything else downloads rather than opening in our origin.
    download: file.mime.startsWith("image/") ? undefined : true,
  });
  return error ? null : data.signedUrl;
}
