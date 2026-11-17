import type { ExhbtDoc, Section, SectionKind } from "./blocks";

/**
 * The three layouts an exhbt can have (decision 0024). A leaf file: it may import types from
 * ./blocks but no values, because blocks imports values from here.
 *
 * `format` is one optional field in the jsonb doc. No `format`, or one this code doesn't know
 * (written by a later release), reads as a case study, so no page ever breaks.
 */

export const FORMATS = ["case-study", "gallery", "research"] as const;
export type Format = (typeof FORMATS)[number];
export const DEFAULT_FORMAT: Format = "case-study";
export const isFormat = (v: unknown): v is Format => typeof v === "string" && (FORMATS as readonly string[]).includes(v);
export const formatOf = (d: { format?: unknown }): Format => (isFormat(d.format) ? d.format : DEFAULT_FORMAT);

/** The doc in a layout and nothing else changed. A case study removes the key, so an old doc round-trips exactly. */
export function withFormat<T extends ExhbtDoc>(doc: T, f: Format): T {
  if (f === DEFAULT_FORMAT) {
    const rest = { ...doc };
    delete rest.format;
    return rest;
  }
  return { ...doc, format: f };
}

const SIX = ["findings", "graph", "image", "quote", "reflection", "link"] as const satisfies readonly SectionKind[];

/** The kinds each layout draws. A kind it doesn't draw is kept in the doc but not shown, counted or checked. */
export const FORMAT_RULES: Record<Format, { name: string; bestFor: string; kinds: readonly SectionKind[] }> = {
  "case-study": { name: "Case study", bestFor: "A question, how you answered it and what you found. Analysis, business, data and software.", kinds: SIX },
  gallery: { name: "Gallery", bestFor: "Pictures first, with the brief and what happened. Campaigns, design, architecture, film and products.", kinds: SIX },
  research: { name: "Research", bestFor: "Question, aim, method, one key figure, results and conclusion. Lab work, experiments and dissertations.", kinds: [...SIX, "aim", "conclusion"] },
};

/** The words the editor and the page use, per layout. */
export const FORMAT_COPY: Record<
  Format,
  { title: string; titleHint: string; gap: string; gapHint: string; gapMissing: string; flow: string; findings: string; reflection: string; link: string }
> = {
  "case-study": {
    title: "Your question (the title)",
    titleHint: "The question the work answers.",
    gap: "Context",
    gapHint: "Why the question matters. Make the gap bold to highlight it.",
    gapMissing: "Add the context: why the question matters.",
    flow: "Process",
    findings: "What I found",
    reflection: "What I'd do next",
    link: "Link",
  },
  gallery: {
    title: "Name of the work (the title)",
    titleHint: "For example, Freshers' Week campaign for the Law Society.",
    gap: "The brief",
    gapHint: "What you were asked to do, and for whom. Make the ask bold to highlight it.",
    gapMissing: "Add the brief: what you were asked to do, and for whom.",
    flow: "What I did",
    findings: "What happened",
    reflection: "What I'd do next",
    link: "Link",
  },
  research: {
    title: "Your research question (the title)",
    titleHint: "The question the study set out to answer.",
    gap: "Background",
    gapHint: "What was known, and what wasn't. Make the gap bold to highlight it.",
    gapMissing: "Add the background: what was known, and the gap.",
    flow: "Method",
    findings: "Results",
    reflection: "Limitations and next steps",
    link: "Reference",
  },
};

/** What differs from LIMITS (lib/exhbt/blocks.ts); formatLimits() merges it over them. A case study has no differences. */
export const FORMAT_LIMITS = {
  "case-study": {},
  gallery: {
    gapWords: 30,
    findings: { min: 1, max: 3, wordsEach: 15 },
    images: { max: 8, captionWords: 10 },
    link: { descriptionWords: 10 },
    sections: { graph: 1, image: 8, link: 2 },
    minImages: 2,
  },
  research: {
    gapWords: 25,
    findings: { min: 2, max: 3, wordsEach: 15 },
    images: { captionWords: 20 },
    reflection: { words: 25 },
    link: { labelWords: 12, descriptionWords: 10 },
    sections: { link: 3 },
    maxFigures: 3,
    targetWords: 170,
  },
} as const;

type Shown = { s: Section; i: number };
type Laid = Pick<ExhbtDoc, "sections"> & { format?: unknown };

export const isShown = (d: { format?: unknown }, s: Section): boolean => FORMAT_RULES[formatOf(d)].kinds.includes(s.kind);
/** The sections the layout draws, with each one's index in doc.sections (for issue paths). */
export const shownSections = (d: Laid): Shown[] => d.sections.flatMap((s, i) => (isShown(d, s) ? [{ s, i }] : []));
/** The sections the layout keeps but doesn't draw. */
export const hiddenSections = (d: Laid): Shown[] => d.sections.flatMap((s, i) => (isShown(d, s) ? [] : [{ s, i }]));
