import { safeHref } from "./blocks";

/**
 * Pure helpers for what the AI draft may keep from the person's material (decision 0024). No
 * `server-only`, so the e2e specs can import them. The AI only uses facts the person supplied:
 * a reference is kept only when its address is in the material as written.
 */

/** Text with smart quotes, runs of spaces and case flattened, so "is it in the source?" ignores typography. */
export const squash = (s: string): string => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

/**
 * True when `url` is in `source` exactly as written (same case) and is the whole address there: at
 * some occurrence what follows it is optional sentence punctuation and then a space, a closing
 * bracket or quote (straight or curly), or the end. So a DOI with brackets in it matches, and one
 * cut short at a bracket, a lower-cased one or a shorter host does not.
 */
function writtenIn(source: string, url: string): boolean {
  for (let i = source.indexOf(url); i >= 0; i = source.indexOf(url, i + 1)) {
    if (/^[.,;:!?]*(\s|[)\]>"'”’]|$)/.test(source.slice(i + url.length))) return true;
  }
  return false;
}

/**
 * The references that are real: each needs an https address that appears in `source` exactly as
 * written (same case, whole address: a changed or cut-short one is dropped) and a label. Anything
 * else is dropped (never made up, never http:, never javascript:). At most `max`.
 */
export function referencesFrom(refs: { label: string; url: string }[], source: string, max: number): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  for (const r of refs) {
    if (out.length >= max) break;
    const label = r.label.trim();
    const url = r.url.trim();
    const href = safeHref(url);
    if (!label || !url || !href || !writtenIn(source, url)) continue;
    out.push({ href, label });
  }
  return out;
}
