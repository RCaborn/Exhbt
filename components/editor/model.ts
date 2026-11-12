import { plain, words, type ExhbtDoc, type Issue } from "@/lib/exhbt/blocks";

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

export type CardKey = "header" | "gap" | "flow" | "findings" | "charts" | "images" | "evidence" | "overall";

/** Which card an issue path ("flow.2.step", "findings.0", "title") points at. */
export function cardOf(path: string): CardKey {
  const head = path.split(".")[0] ?? "";
  if (["title", "context", "skills", "headline"].includes(head)) return "header";
  if (["gap", "flow", "findings", "charts", "images", "evidence"].includes(head)) return head as CardKey;
  return "overall";
}

/** Whatever sits at a path, e.g. "flow.2.step" → doc.flow[2].step. */
function at(doc: ExhbtDoc, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), doc);
}

function hasContent(v: unknown): boolean {
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some((r) => typeof r === "object" && r && "t" in r ? String((r as { t: string }).t).trim() : hasContent(r));
  if (v && typeof v === "object") return Object.values(v).some(hasContent);
  return typeof v === "number";
}

/**
 * Issues worth showing now. A field that's still empty isn't nagged about until the person
 * tries to publish; anything over a limit shows as soon as it happens.
 */
export function visibleIssues(doc: ExhbtDoc, issues: Issue[], showAll: boolean): Issue[] {
  if (showAll) return issues;
  return issues.filter((i) => {
    const v = at(doc, i.path);
    // Counts (flow, findings, …) and the overall total are always worth knowing.
    if (i.path === "" || (Array.isArray(v) && ["flow", "findings", "charts", "images", "skills"].includes(i.path))) return true;
    return hasContent(v);
  });
}

export const issuesAt = (issues: Issue[], path: string) => issues.filter((i) => i.path === path);
export const issuesIn = (issues: Issue[], card: CardKey) => issues.filter((i) => cardOf(i.path) === card);

/**
 * Words in each card. They add up to wordCount in lib/exhbt/blocks.ts, which counts every word on
 * the page except alt text ("200 should cap everything").
 */
export function cardWords(doc: ExhbtDoc): Record<"header" | "gap" | "flow" | "findings" | "charts" | "images" | "evidence", number> {
  const sum = (xs: string[]) => xs.reduce((n, s) => n + words(s), 0);
  return {
    header: sum([doc.title, doc.context, ...doc.skills, doc.headline?.value ?? "", doc.headline?.label ?? ""]),
    gap: words(plain(doc.gap)),
    flow: sum(doc.flow.flatMap((s) => [s.step, s.detail ?? ""])),
    findings: sum(doc.findings.map(plain)),
    charts: sum(doc.charts.flatMap((c) => [c.title, c.beforeLabel, c.afterLabel, c.unit ?? "", ...c.rows.map((r) => r.label)])),
    images: sum(doc.images.map((im) => plain(im.caption))),
    evidence: words(doc.evidence?.label ?? ""),
  };
}
