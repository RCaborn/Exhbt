import type { ExhbtDoc } from "./blocks";

/**
 * The stored files an exhbt doc points at: each image section's file and the evidence file
 * (links point at nothing we store). Pure, so the stores, the pages and the tests share it.
 */
export function fileIdsIn(doc: Pick<ExhbtDoc, "sections" | "evidence">): string[] {
  const ids: string[] = [];
  for (const s of doc.sections) if (s.kind === "image") ids.push(s.fileId);
  if (doc.evidence?.kind === "file") ids.push(doc.evidence.fileId);
  return [...new Set(ids)];
}

/**
 * The doc without any file the person doesn't own: an image section whose file isn't in `keep`
 * is dropped, and so is a file as the work. The same object comes back when nothing changes.
 */
export function withoutFiles<T extends Pick<ExhbtDoc, "sections" | "evidence">>(doc: T, keep: ReadonlySet<string>): T {
  const sections = doc.sections.filter((s) => s.kind !== "image" || keep.has(s.fileId));
  const evidenceGone = doc.evidence?.kind === "file" && !keep.has(doc.evidence.fileId);
  if (sections.length === doc.sections.length && !evidenceGone) return doc;
  const out = { ...doc, sections };
  if (evidenceGone) delete out.evidence;
  return out;
}

/** Stored file ids are UUIDs; anything else can't be ours (and must never reach a uuid column). */
export const looksLikeFileId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
