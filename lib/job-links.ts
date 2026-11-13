import { words } from "./exhbt/blocks";
import { SLUG_MAX, slugify, uniqueSlug } from "./exhbt/slug";

/**
 * Per-job link rules that aren't plan figures (those stay in lib/entitlements.ts).
 * The introduction cap is the product rule in docs/phase-2.md section 8. The character
 * cap matches the curated_links.intro check. Company and role match that table too.
 */

export const INTRO_WORDS = 40;
export const INTRO_CHARS = 400;
export const COMPANY_MAX = 120;
export const DESCRIPTION_MAX = 20_000;

export type RankedPick = { exhbtId: string; reason: string };

/** Unambiguous four-character codes: no 0/o or 1/l. */
const SUFFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomSuffixes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    let s = "";
    for (let i = 0; i < 4; i++) s += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)]!;
    return s;
  });
}

/**
 * The path on the person's host. Clean uses the company (or a stem they typed) and adds
 * -2, -3 when they already use it. Suffix appends a short code so the address can't be guessed.
 * `suffixes` is passed in so tests can fix the code.
 */
export function jobLinkSlug(stem: string, style: "clean" | "suffix", taken: Iterable<string>, suffixes: string[]): string {
  const used = new Set(taken);
  const base = slugify(stem);
  if (style === "clean") return uniqueSlug(base, used);
  for (const suf of suffixes) {
    const code = suf.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4);
    if (code.length < 4) continue;
    const extra = `-${code}`;
    const room = SLUG_MAX - extra.length;
    let head = base.length <= room ? base : base.slice(0, room).replace(/-+$/, "");
    if (!head) head = "job";
    const candidate = `${head}${extra}`;
    if (!used.has(candidate)) return candidate;
  }
  return uniqueSlug(base, used);
}

/** Keeps only ids this person published, in the model's order, with a one-line reason. */
export function acceptedPicks(raw: RankedPick[], allowed: readonly string[], limit: number): RankedPick[] {
  const ok = new Set(allowed);
  const seen = new Set<string>();
  const out: RankedPick[] = [];
  for (const p of raw) {
    if (!ok.has(p.exhbtId) || seen.has(p.exhbtId)) continue;
    seen.add(p.exhbtId);
    out.push({ exhbtId: p.exhbtId, reason: oneLine(p.reason) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Portfolio order, no reasons. Used when a match wasn't run. */
export function orderedPicks(ids: readonly string[], limit: number): RankedPick[] {
  return ids.slice(0, limit).map((exhbtId) => ({ exhbtId, reason: "" }));
}

export function clampIntro(raw: string): { ok: true; intro: string } | { ok: false; error: string } {
  const intro = raw.trim().replace(/\s+/g, " ");
  if (words(intro) > INTRO_WORDS) return { ok: false, error: `Keep the introduction to ${INTRO_WORDS} words.` };
  if (intro.length > INTRO_CHARS) return { ok: false, error: "That introduction is too long." };
  return { ok: true, intro };
}

/** Last resort when the model wrote past the cap: keep the first 40 words, then the character cap. */
export function trimIntro(raw: string): string {
  const cut = raw.trim().split(/\s+/).filter(Boolean).slice(0, INTRO_WORDS).join(" ");
  if (cut.length <= INTRO_CHARS) return cut;
  return cut.slice(0, INTRO_CHARS).replace(/\s+\S*$/, "");
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 180);
}
