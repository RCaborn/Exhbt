import { safeHref } from "./blocks";
import { materialWords } from "./emphasis";

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

/* ---------------- The parts the four layouts of decision 0028 add ---------------- */

/**
 * True when `words` are in `source` word for word (typography, spacing and case aside): as written there, or with the
 * material's own emphasis marks taken out (a Markdown file's `**bold**`), since what the AI copies is read with its
 * marks taken out (decision 0029, "Emphasis inside the answer"). Nothing is never "in" it.
 */
export function saidIn(source: string, words: string): boolean {
  const w = squash(words);
  return w.length > 0 && (squash(source).includes(w) || squash(materialWords(source)).includes(w));
}

/** Text with the quote marks round it taken off: a sentence quoted from the material is compared without them. */
const unquoted = (s: string): string => s.trim().replace(/^["“‘']+|["”’']+$/g, "").trim();

/**
 * An essay's pull quote, if the draft may keep it: the person's own sentence, found word for word in
 * the material and at most `maxWords` long. Anything else is none: the AI never writes one, and one
 * that is too long is not cut, because a cut sentence is not what the person wrote.
 */
export function pullquoteFrom(text: string, source: string, maxWords: number): string | null {
  const t = unquoted(text);
  return t && t.split(/\s+/).length <= maxWords && saidIn(source, t) ? t : null;
}

/**
 * "My role", if the material states it in these words and it fits the sidebar (`maxChars`). Anything
 * else is none: the person types it, and until then an event can't be published.
 */
export function roleFrom(role: string, source: string, maxChars: number): string | null {
  const r = unquoted(role).replace(/[.;,]+$/, "").trim();
  return r && r.length <= maxChars && saidIn(source, r) ? r : null;
}

/**
 * An essay's sources that are real, at most `max`. One with an https address is kept as a reference
 * is: the address must be in the material as written (referencesFrom). One with no address, or with
 * an address the material doesn't hold, is kept without an address, and only when its citation is in
 * the material word for word. Anything else is dropped: never a source or an address made up.
 */
export function sourcesFrom(refs: { label: string; url: string }[], source: string, max: number): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  for (const r of refs) {
    if (out.length >= max) break;
    const label = r.label.trim();
    if (!label) continue;
    const [linked] = r.url.trim() ? referencesFrom([r], source, 1) : [];
    if (linked) out.push(linked);
    else if (saidIn(source, label)) out.push({ href: "", label });
  }
  return out;
}

/** Whether a stored link's address is one the material holds: as written there, or as safeHref writes it (a bare host gains its "/"). */
function addressIn(source: string, href: string): boolean {
  if (writtenIn(source, href)) return true;
  return (source.match(/https:\/\/[^\s<>"'“”‘’]+/g) ?? []).some((u) => {
    // The address as written, with sentence punctuation and closing brackets taken off its end one at a time.
    for (let end = u.length; end > "https://".length; end--) {
      if (safeHref(u.slice(0, end)) === href) return true;
      if (!/[.,;:!?)\]]/.test(u[end - 1]!)) break;
    }
    return false;
  });
}

/**
 * What a drafted doc holds that its material doesn't bear out, among the parts a draft must take from
 * the material and nowhere else: a pull quote or My role that isn't there word for word, a link whose
 * address isn't there, a source with no address whose citation isn't there. Empty for every draft
 * toDoc makes (lib/ai/draft-answer.ts keeps only what these same checks pass); the draft eval fails a
 * draft where it isn't (scripts/eval-drafts.ts).
 */
export function unsupportedParts(doc: { myRole?: string; sections: readonly { kind: string; text?: unknown; href?: unknown; label?: unknown }[] }, source: string): string[] {
  const out: string[] = [];
  if (doc.myRole?.trim() && !saidIn(source, doc.myRole)) out.push(`My role isn't in the material: "${doc.myRole}"`);
  for (const s of doc.sections) {
    if (s.kind === "pullquote" && typeof s.text === "string" && !saidIn(source, s.text)) out.push(`The pull quote isn't in the material: "${s.text}"`);
    if (s.kind !== "link" || typeof s.href !== "string" || typeof s.label !== "string") continue;
    if (s.href.trim() ? !addressIn(source, s.href) : !saidIn(source, s.label)) out.push(s.href.trim() ? `A link's address isn't in the material: ${s.href}` : `A source with no address isn't in the material: "${s.label}"`);
  }
  return out;
}
