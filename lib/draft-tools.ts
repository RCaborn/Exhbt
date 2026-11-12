import "server-only";
import { devBlobs, devStorageEnabled } from "./files";
import { emptyAiVersion, type AiVersion } from "./exhbt/draft-blocks";
import { deleteFile } from "./uploads";
import { getStore, isSupabaseConfigured, supabaseAdmin, type StoredFile } from "./store";

/**
 * What an exhbt keeps from its draft so the AI can help later (docs/phase-2.md section 6):
 *
 *   - the source text the draft was made from (text/plain), so "Rewrite" has the facts;
 *   - the latest AI version of each block (application/json), so "Back to the AI version" works.
 *
 * Both are ordinary private files: `exhbt_files` rows of kind `source` in the private `sources`
 * bucket, attached to the exhbt, so deleting the exhbt removes them (deleteDraftFiles, called by
 * the delete action; the rows also cascade). They are never read by the portfolio.
 * Nothing here is shown on a public page.
 *
 * TODO(retention): section 5 promises source material is kept for 30 days only. There is no
 * scheduler yet, so nothing expires these files. When one exists (a Worker cron), delete
 * kind = 'source' files older than 30 days; rewrites then refuse ("the source has expired")
 * and the editor already hides the rewrite controls when there is no source.
 */

const SOURCE_NAME = "draft-source.txt";
const AI_NAME = "ai-version.json";
const bytesOf = (s: string) => new TextEncoder().encode(s);
const nameOf = (f: StoredFile) => f.path.split("/").pop();

async function putObject(file: StoredFile, bytes: Uint8Array): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin().storage.from(file.bucket).upload(file.path, bytes, { contentType: file.mime, upsert: true });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
  } else if (devStorageEnabled()) {
    devBlobs().set(file.id, bytes);
  } else {
    throw new Error("File storage isn't set up.");
  }
}

async function getObject(file: StoredFile): Promise<string | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseAdmin().storage.from(file.bucket).download(file.path);
    return error || !data ? null : await data.text();
  }
  const blob = devStorageEnabled() ? devBlobs().get(file.id) : undefined;
  return blob ? new TextDecoder().decode(blob) : null;
}

async function find(userId: string, exhbtId: string, name: string): Promise<StoredFile | undefined> {
  return (await getStore().listExhbtFiles(exhbtId, userId)).find((f) => f.kind === "source" && nameOf(f) === name);
}

/** Writes (or replaces) one of the exhbt's private draft files. Replacing makes a new record, so sizes stay true. */
async function write(userId: string, exhbtId: string, name: string, mime: string, body: string): Promise<void> {
  const old = await find(userId, exhbtId, name);
  const bytes = bytesOf(body);
  const id = crypto.randomUUID();
  const file: StoredFile = { id, userId, bucket: "sources", path: `${userId}/${id}/${name}`, mime, bytes: bytes.length, kind: "source" };
  await getStore().createFile({ ...file, exhbtId });
  try {
    await putObject(file, bytes);
  } catch (e) {
    await getStore().deleteFile(id, userId);
    throw e;
  }
  if (old) await deleteFile(userId, old.id);
}

export async function saveDraftSource(userId: string, exhbtId: string, text: string): Promise<void> {
  if (text.trim()) await write(userId, exhbtId, SOURCE_NAME, "text/plain", text);
}

/** The text the exhbt was drafted from, or null (started from scratch, deleted, or expired). */
export async function loadDraftSource(userId: string, exhbtId: string): Promise<string | null> {
  const f = await find(userId, exhbtId, SOURCE_NAME);
  return f ? getObject(f) : null;
}

export async function saveAiVersion(userId: string, exhbtId: string, v: AiVersion): Promise<void> {
  await write(userId, exhbtId, AI_NAME, "application/json", JSON.stringify(v));
}

export async function loadAiVersion(userId: string, exhbtId: string): Promise<AiVersion> {
  const f = await find(userId, exhbtId, AI_NAME);
  const raw = f ? await getObject(f) : null;
  if (!raw) return emptyAiVersion();
  try {
    const v = JSON.parse(raw) as Partial<AiVersion>;
    return { blocks: v.blocks ?? {}, unverified: v.unverified ?? {} };
  } catch {
    return emptyAiVersion();
  }
}

/** Removes every file attached to the exhbt (stored objects first), before the exhbt row goes. */
export async function deleteExhbtFiles(userId: string, exhbtId: string): Promise<void> {
  for (const f of await getStore().listExhbtFiles(exhbtId, userId)) await deleteFile(userId, f.id).catch(() => undefined);
}
