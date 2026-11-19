import { plain, sectionTexts, type ContentSection, type ExhbtDoc } from "./blocks";
import { chartTexts, chartValues } from "./charts";
import { flowShown, isShown } from "./formats";

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

/**
 * All the text a reader sees in an exhbt, plus every value on its graphs, whatever their kind:
 * the core, my role and every section (findings, graphs, captions, the quote with its name and
 * role, what I'd do next, the link's label and description, the pull quote). It reads everything
 * kept, shown or not: a flowchart taken off the page and a kind the layout doesn't draw too.
 */
function docTexts(d: ExhbtDoc): string[] {
  return [
    d.title,
    d.context,
    d.whereWhen ?? "",
    d.myRole ?? "",
    d.summary ?? "",
    d.headline?.value ?? "",
    d.headline?.label ?? "",
    ...d.skills,
    plain(d.gap),
    ...d.flow.flatMap((s) => [s.step, s.detail ?? ""]),
    ...d.sections.flatMap((s) => (s.kind === "graph" ? [...chartTexts(s.chart), ...chartValues(s.chart).map(String)] : sectionTexts(s))),
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

/** Each field of a section that a reader sees, with the path validateForPublish gives it. */
function sectionFields(s: ContentSection, p: string): [string, string[]][] {
  switch (s.kind) {
    case "findings":
      return s.items.map((it, k): [string, string[]] => [`${p}.items.${k}`, [plain(it)]]);
    case "graph":
      return [[`${p}.chart`, [...chartTexts(s.chart), ...chartValues(s.chart).map(String)]]];
    case "image":
      return [[`${p}.caption`, [plain(s.caption)]]];
    case "quote":
      return [
        [`${p}.text`, [s.text]],
        [`${p}.name`, [s.name]],
        [`${p}.role`, [s.role]],
      ];
    case "link":
      return [
        [`${p}.label`, [s.label]],
        [`${p}.description`, [s.description]],
      ];
    case "pullquote":
      return [[`${p}.text`, [s.text]]];
    case "reflection":
    case "aim":
    case "conclusion":
      return [[`${p}.text`, [plain(s.text)]]];
  }
}

/**
 * The path of the first field on the page whose text holds the number `n` (compared by value, as
 * normaliseNumber does), for "Things to fix": "title", "skills.2", "flow.1.detail",
 * "sections.3.items.0", "sections.2.chart". Only fields the page draws: a flowchart taken off the
 * page, a section the layout keeps but doesn't draw, the summary and the headline have no place
 * to jump to. Null when no such field holds it (or `n` isn't a number).
 */
export function pathOfNumber(doc: ExhbtDoc, n: string): string | null {
  const want = normaliseNumber(n);
  if (want === null) return null;
  const holds = (t: string) => numbersIn(t).some((m) => normaliseNumber(m) === want);
  const fields: [string, string[]][] = [
    ["title", [doc.title]],
    ["context", [doc.context]],
    ["whereWhen", [doc.whereWhen ?? ""]],
    ["myRole", [doc.myRole ?? ""]],
    ...doc.skills.map((s, i): [string, string[]] => [`skills.${i}`, [s]]),
    ["gap", [plain(doc.gap)]],
    ...(flowShown(doc)
      ? doc.flow.flatMap((s, i): [string, string[]][] => [
          [`flow.${i}.step`, [s.step]],
          [`flow.${i}.detail`, [s.detail ?? ""]],
        ])
      : []),
    ...doc.sections.flatMap((s, i) => (s.kind !== "flow" && isShown(doc, s) ? sectionFields(s, `sections.${i}`) : [])),
  ];
  return fields.find(([, texts]) => texts.some(holds))?.[0] ?? null;
}
