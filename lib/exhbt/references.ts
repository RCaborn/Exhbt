import { safeHref } from "./blocks";

/**
 * Pure helpers for what the AI draft may keep from the person's material (decision 0024). No
 * `server-only`, so the e2e specs can import them. The AI only uses facts the person supplied:
 * a reference is kept only when its address is in the material as written.
 */

/** Text with smart quotes, runs of spaces and case flattened, so "is it in the source?" ignores typography. */
export const squash = (s: string): string => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The references that are real: each needs an https address that appears in `source` as written
 * and a label. Anything else is dropped (never made up, never http:, never javascript:). At most `max`.
 */
export function referencesFrom(refs: { label: string; url: string }[], source: string, max: number): { href: string; label: string }[] {
  const flat = squash(source);
  const out: { href: string; label: string }[] = [];
  for (const r of refs) {
    if (out.length >= max) break;
    const label = r.label.trim();
    const url = r.url.trim();
    const href = safeHref(url);
    if (!label || !url || !href || !flat.includes(squash(url))) continue;
    out.push({ href, label });
  }
  return out;
}
