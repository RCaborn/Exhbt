import { plain, words, type ExhbtDoc, type Issue } from "@/lib/exhbt/blocks";
import { sectionLabel, sectionWords } from "@/lib/exhbt/sections";

/**
 * Pure helpers the editor and its server actions share: which card an issue belongs to,
 * when to show it, and the numbers the AI flagged.
 */

/** Numbers the AI draft couldn't find in the person's files (docs/phase-2.md section 6). Optional on the doc. */
export const unverifiedOf = (doc: ExhbtDoc): string[] => (doc as { unverified?: string[] }).unverified ?? [];

/** The doc with one flagged number confirmed ("That's right"), so it no longer blocks publishing. */
export function confirmNumber(doc: ExhbtDoc, n: string): ExhbtDoc {
  return { ...doc, unverified: unverifiedOf(doc).filter((u) => u !== n) } as ExhbtDoc;
}

/**
 * The editor's cards: the fixed core, one per section below the flowchart (`section-2` is the
 * third section on the page, decision 0015), "sections" for issues about the sections as a whole
 * (how many, findings or a graph), the work, and "overall" for the word total.
 */
export type CardKey = "header" | "gap" | "flow" | "evidence" | "sections" | "overall" | `section-${number}`;

/** Which card an issue path ("flow.2.step", "sections.1.chart.title", "title") points at. */
export function cardOf(path: string): CardKey {
  const [head = "", idx] = path.split(".");
  if (["title", "context", "skills", "headline"].includes(head)) return "header";
  if (head === "sections") return idx !== undefined && /^\d+$/.test(idx) ? `section-${Number(idx)}` : "sections";
  if (["gap", "flow", "evidence"].includes(head)) return head as CardKey;
  return "overall";
}

/** Whatever sits at a path, e.g. "flow.2.step" → doc.flow[2].step, "sections.0.items" → doc.sections[0].items. */
function at(doc: ExhbtDoc, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), doc);
}

function hasContent(v: unknown): boolean {
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some((r) => typeof r === "object" && r && "t" in r ? String((r as { t: string }).t).trim() : hasContent(r));
  if (v && typeof v === "object") return Object.values(v).some(hasContent);
  return typeof v === "number";
}

/** Issues about how many of something there are: always worth knowing, filled in or not. */
const isCount = (path: string) => ["flow", "skills", "sections"].includes(path) || /^sections\.\d+\.items$/.test(path);

/**
 * Issues worth showing now. A field that's still empty isn't nagged about until the person
 * tries to publish; anything over a limit shows as soon as it happens.
 */
export function visibleIssues(doc: ExhbtDoc, issues: Issue[], showAll: boolean): Issue[] {
  if (showAll) return issues;
  return issues.filter((i) => {
    const v = at(doc, i.path);
    // Counts (flow, findings, sections, …) and the overall total are always worth knowing.
    if (i.path === "" || (Array.isArray(v) && isCount(i.path))) return true;
    return hasContent(v);
  });
}

export const issuesAt = (issues: Issue[], path: string) => issues.filter((i) => i.path === path);
export const issuesIn = (issues: Issue[], card: CardKey) => issues.filter((i) => cardOf(i.path) === card);

/**
 * Words in each card. They add up to wordCount in lib/exhbt/blocks.ts, which counts every word on
 * the page except alt text and link addresses ("200 should cap everything").
 */
export function cardWords(doc: ExhbtDoc): Partial<Record<CardKey, number>> {
  const sum = (xs: string[]) => xs.reduce((n, s) => n + words(s), 0);
  return {
    header: sum([doc.title, doc.context, ...doc.skills, doc.headline?.value ?? "", doc.headline?.label ?? ""]),
    gap: words(plain(doc.gap)),
    flow: sum(doc.flow.flatMap((s) => [s.step, s.detail ?? ""])),
    ...Object.fromEntries(doc.sections.map((s, i) => [`section-${i}`, sectionWords(s)])),
    evidence: words(doc.evidence?.label ?? ""),
  };
}

const LABELS: Record<string, string> = { title: "Title", context: "Context line", skills: "Skills", headline: "Headline number", gap: "The question", evidence: "The work", sections: "Sections" };

/** "flow.2.step" becomes "Process, box 3", "sections.0.items.1" "Finding 2": which part an issue is about, for the list at the top. */
export function labelOf(path: string, doc: ExhbtDoc): string {
  const [head, idx, field, sub] = path.split(".");
  const n = idx !== undefined && /^\d+$/.test(idx) ? Number(idx) : null;
  if (head === "flow") return n !== null ? `Process, box ${n + 1}` : "Process";
  if (head === "skills" && n !== null) return `Skill ${n + 1}`;
  if (head === "sections" && n !== null) {
    const s = doc.sections[n];
    if (s?.kind === "findings" && field === "items" && sub !== undefined && /^\d+$/.test(sub)) return `Finding ${Number(sub) + 1}`;
    return sectionLabel(doc.sections, n);
  }
  return LABELS[head ?? ""] ?? "";
}
