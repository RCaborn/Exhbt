import { plain, type ExhbtDoc } from "./blocks";

/**
 * Every number in an exhbt must come from the person's own material (docs/phase-2.md section 6,
 * decision 0007). This finds the ones that don't, so the editor can say "We couldn't find 18% in
 * your files: check it." Pure, so the server and tests share it.
 *
 * Numbers are compared by value, not by how they're written: "14,200" matches "14200",
 * "18 %" matches "18%", "£1,250.50" matches "1250.5", and "−18%" matches "18".
 * A number the AI worked out itself (a percentage change, a total) is flagged on purpose.
 */

/** Thousands with commas first, so "14,200" is one number but "1,25" is two. */
const NUMBER = /(?<![\w.])[-+−–]?\s?[£$€]?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s?%)?/g;

/** A number's value as a canonical string, or null if it isn't one. */
export function normaliseNumber(raw: string): string | null {
  const digits = raw.replace(/[-+−–£$€%,\s]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? String(n) : null;
}

/** Every number in a text, as written (trimmed). */
export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map((m) => m.trim());
}

/** All the text a reader sees in an exhbt, plus the chart values. */
function docTexts(d: ExhbtDoc): string[] {
  return [
    d.title,
    d.context,
    d.headline?.value ?? "",
    d.headline?.label ?? "",
    ...d.skills,
    plain(d.gap),
    ...d.flow.flatMap((s) => [s.step, s.detail ?? ""]),
    ...d.findings.map(plain),
    ...d.charts.flatMap((c) => [c.title, c.beforeLabel, c.afterLabel, ...c.rows.flatMap((r) => [r.label, String(r.before), String(r.after)])]),
    ...d.images.map((im) => plain(im.caption)),
  ];
}

/** Every number written anywhere in the exhbt, as written. */
export const numbersInDoc = (doc: ExhbtDoc): string[] => docTexts(doc).flatMap(numbersIn);

/**
 * Numbers in the exhbt that don't appear anywhere in the source text, as written in the
 * exhbt, once each. Empty means every number was found.
 */
export function unverifiedNumbers(doc: ExhbtDoc, sourceText: string): string[] {
  const known = new Set(numbersIn(sourceText).map(normaliseNumber).filter((v): v is string => v !== null));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of docTexts(doc).flatMap(numbersIn)) {
    const v = normaliseNumber(raw);
    if (v === null || known.has(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(raw);
  }
  return out;
}
