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
  {
    title: string;
    titleHint: string;
    /** The editor's first card, and what the preview shows for a title not typed yet. */
    header: string;
    emptyTitle: string;
    gap: string;
    gapHint: string;
    gapMissing: string;
    flow: string;
    findings: string;
    reflection: string;
    /** The field label and the example inside it, for "what I'd do next" / the limitations. */
    reflectionLabel: string;
    reflectionPlaceholder: string;
    /** What the rewrite calls each part, as a plain noun phrase with no article ("Rewrite the brief"). */
    rewriteName: { header: string; gap: string; flow: string; findings: string };
    link: string;
    linkHint: string;
  }
> = {
  "case-study": {
    title: "Your question (the title)",
    titleHint: "The question the work answers.",
    header: "Your question and details",
    emptyTitle: "Your question",
    gap: "Context",
    gapHint: "Why the question matters. Make the gap bold to highlight it.",
    gapMissing: "Add the context: why the question matters.",
    flow: "Process",
    findings: "What I found",
    reflection: "What I'd do next",
    reflectionLabel: "What you'd do next, or do differently",
    reflectionPlaceholder: "e.g. Next time I'd time the evening queue too, to see if a second till pays off then.",
    rewriteName: { header: "question and details", gap: "context", flow: "process", findings: "findings" },
    link: "Link",
    linkHint: "A repository, a demo or a document. The page shows what it is, and links to it.",
  },
  gallery: {
    title: "Name of the work (the title)",
    titleHint: "For example, Freshers' Week campaign for the Law Society.",
    header: "The work and details",
    emptyTitle: "Name of the work",
    gap: "The brief",
    gapHint: "What you were asked to do, and for whom. Make the ask bold to highlight it.",
    gapMissing: "Add the brief: what you were asked to do, and for whom.",
    flow: "What I did",
    findings: "What happened",
    reflection: "What I'd do next",
    reflectionLabel: "What you'd do next, or do differently",
    reflectionPlaceholder: "e.g. Next time I'd test the poster on the halls noticeboards a week earlier.",
    rewriteName: { header: "work and details", gap: "brief", flow: "steps", findings: "outcome" },
    link: "Link",
    linkHint: "The film, the full set of pictures or the deck. The page shows what it is, and links to it.",
  },
  research: {
    title: "Your research question (the title)",
    titleHint: "The question the study set out to answer.",
    header: "Your research question and details",
    emptyTitle: "Your research question",
    gap: "Background",
    gapHint: "What was known, and what wasn't. Make the gap bold to highlight it.",
    gapMissing: "Add the background: what was known, and the gap.",
    flow: "Method",
    findings: "Results",
    reflection: "Limitations and next steps",
    reflectionLabel: "The limits of the study, and what you'd do next",
    reflectionPlaceholder: "e.g. One university and volunteers only. Next I'd test recall a day later.",
    rewriteName: { header: "research question and details", gap: "background", flow: "method", findings: "results" },
    link: "Reference",
    linkHint: "A paper or source you used. The page shows the citation, and links to it.",
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
