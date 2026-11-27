import type { ContentSection, ExhbtDoc, Section, SectionKind } from "./blocks";

/**
 * The layouts an exhbt can have (decisions 0024 and 0028): seven. The new editor offers them all
 * (OFFERED_FORMATS); the classic editor offers the first three (CLASSIC_FORMATS). A leaf file: it may
 * import types from ./blocks but no values, because blocks imports values from here.
 *
 * `format` is one optional field in the jsonb doc. No `format`, or one this code doesn't know
 * (written by a later release), reads as a case study, so no page ever breaks.
 */

export const FORMATS = ["case-study", "gallery", "research", "build", "essay", "before-after", "event"] as const;
export type Format = (typeof FORMATS)[number];
/**
 * The three layouts of decision 0024, and the only place they are listed. They are what the classic
 * editor offers, and what the AI draft chooses among for a person whose editor is the classic one:
 * that editor has no way to edit what the other four add (My role, the pull quote, the Before and
 * After marks, a source with no address), so a person there could pick one and never be able to
 * publish. Goes with the classic editor (release 5).
 */
export const CLASSIC_FORMATS = ["case-study", "gallery", "research"] as const satisfies readonly Format[];
/** The layouts the new editor's menu shows, and the AI draft may choose for a person whose editor it is: all seven since release 4. */
export const OFFERED_FORMATS: readonly Format[] = FORMATS;
/** The layouts offered to a person, by the editor they get (lib/editor-kind.ts). */
export const offeredIn = (editor: "page" | "classic"): readonly Format[] => (editor === "classic" ? CLASSIC_FORMATS : OFFERED_FORMATS);
export const DEFAULT_FORMAT: Format = "case-study";
/**
 * Whether a save or a publish may carry this layout: one that is offered to the person (`offered`:
 * offeredIn their editor), or the one already stored for the exhbt (an exhbt made in the new editor
 * and opened in the classic one keeps its layout). A hand-built request that names a layout the
 * person's editor doesn't offer is not let through.
 */
export const mayCarryFormat = (next: Format, stored: Format, offered: readonly Format[] = OFFERED_FORMATS): boolean => offered.includes(next) || next === stored;
/** Said when a request names a layout the person's editor doesn't offer: by a save or a publish, and by "Add an exhbt". */
export const LAYOUT_NOT_OFFERED = "That layout isn't available yet. Choose another layout and try again.";
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

/**
 * What a layout takes from the person's own work when an exhbt is drafted (decision 0025):
 *  - "figure": its one key figure, the main graph or visual in the work;
 *  - "pictures": the work's pictures, the first of them the lead image;
 *  - "none": nothing. Nothing is looked for and nothing is placed (an essay, say).
 */
export const FROM_WORK = ["figure", "pictures", "none"] as const;
export type FromWork = (typeof FROM_WORK)[number];

/** A thing the main column draws: a section's kind, or the flowchart (decision 0027). */
export type PageKind = SectionKind | "flow";
/** One place in a layout's usual order. `first` means only the first section of these kinds (the lead image, the key figure). */
export type Slot = { kinds: readonly PageKind[]; first?: true };
/**
 * What a layout suggests a page of its kind has. None of it stops publishing (decision 0032): each one the page
 * lacks is a suggestion, at the path "sections", or "myRole" (suggestionsFor in lib/exhbt/blocks.ts).
 */
export type Need =
  | { need: "count"; kinds: readonly SectionKind[]; min: number; message: string }
  /** A findings section, a graph, or an image picked from the work as a graph or a table (decision 0025): what a case study is for. */
  | { need: "results"; message: string }
  | { need: "stages"; message: string }
  | { need: "myRole"; message: string };

export type FormatRule = {
  name: string;
  bestFor: string;
  /** The kinds the layout draws. Any other kind is kept in the doc but not shown, counted or checked (decision 0024). */
  kinds: readonly SectionKind[];
  /** What it takes from the person's work when drafted (decision 0025). */
  fromWork: FromWork;
  /** The usual order: what picking this layout sorts the sections into. */
  template: readonly Slot[];
  /** How a doc with no flow marker is drawn. "flow-first" is today's case study: the flowchart, then the sections in the doc's order. */
  legacy: "flow-first" | "template";
  /** The first section of these kinds is drawn as the lead image or the key figure. */
  first?: { kinds: readonly SectionKind[]; as: "lead" | "key" };
  /** What a page of this kind usually has: suggestions, never requirements (decision 0032). */
  needs: readonly Need[];
};

/**
 * What differs from LIMITS (lib/exhbt/blocks.ts); formatLimits() merges it over them. A case study has no
 * differences. No part has a word limit of its own (decision 0030): how long the AI writes each part, layout
 * by layout, is draftTargets in lib/ai/draft-targets.ts.
 */
export const FORMAT_LIMITS = {
  "case-study": {},
  gallery: {
    findings: { min: 1, max: 3 },
    images: { max: 8 },
    sections: { graph: 1, image: 8, link: 2 },
    minImages: 2,
  },
  research: {
    findings: { min: 2, max: 3 },
    link: { labelWords: 12 },
    sections: { link: 3 },
    maxFigures: 3,
    targetWords: 170,
  },
  // The four of decision 0028. Everything not here is as a case study.
  build: {
    findings: { min: 1, max: 3 },
    images: { max: 4 },
    sections: { graph: 1, image: 4, link: 2 },
  },
  essay: {
    images: { max: 1 },
    link: { labelWords: 12, hrefOptional: true },
    sections: { graph: 1, image: 1, link: 4 },
    targetWords: 170,
  },
  "before-after": {
    findings: { min: 2, max: 3 },
    images: { max: 6 },
    sections: { graph: 1, image: 6 },
    minImages: 2,
  },
  event: {
    findings: { min: 1, max: 3 },
    images: { max: 6 },
    sections: { graph: 1, image: 6, link: 2 },
    minImages: 1,
  },
} as const;

/** The usual order of the gallery, build and event layouts: the lead image, the flowchart, what happened, the other pictures, the rest. */
const PICTURES_FIRST: readonly Slot[] = [
  { kinds: ["image"], first: true },
  { kinds: ["flow"] },
  { kinds: ["findings"] },
  { kinds: ["graph"] },
  { kinds: ["image"] },
  { kinds: ["quote"] },
  { kinds: ["reflection"] },
  { kinds: ["link"] },
];

/**
 * Each layout's facts (decisions 0024, 0025, 0027 and 0028): the kinds it draws, what it takes
 * from the work, its usual order, how a doc with no marker is drawn, its lead or key item, and
 * what a page of its kind usually has (`needs`: read by suggestionsFor and layoutNotes, with these
 * messages, in this order). The flowchart can be taken off every layout, and none of the needs stops
 * publishing (decision 0032): they are what the editor suggests.
 */
export const FORMAT_RULES: Record<Format, FormatRule> = {
  "case-study": {
    name: "Case study",
    bestFor: "A question, how you answered it and what you found. Analysis, business, data and software.",
    kinds: SIX,
    fromWork: "figure",
    template: [{ kinds: ["flow"] }, { kinds: ["findings"] }, { kinds: ["graph"] }, { kinds: ["image"] }, { kinds: ["quote"] }, { kinds: ["reflection"] }, { kinds: ["link"] }],
    legacy: "flow-first",
    needs: [{ need: "results", message: "Add findings or a graph, so the exhbt shows what came of the work." }],
  },
  gallery: {
    name: "Gallery",
    bestFor: "Pictures first, with the brief and what happened. Campaigns, design, architecture, film and products.",
    kinds: SIX,
    fromWork: "pictures",
    template: PICTURES_FIRST,
    legacy: "template",
    first: { kinds: ["image"], as: "lead" },
    needs: [{ need: "count", kinds: ["image"], min: FORMAT_LIMITS.gallery.minImages, message: `A gallery works best with at least ${FORMAT_LIMITS.gallery.minImages} images.` }],
  },
  research: {
    name: "Research",
    bestFor: "Question, aim, method, one key figure, results and conclusion. Lab work, experiments and dissertations.",
    kinds: [...SIX, "aim", "conclusion"],
    fromWork: "figure",
    template: [
      { kinds: ["aim"] },
      { kinds: ["flow"] },
      { kinds: ["graph", "image"], first: true },
      { kinds: ["graph", "image"] },
      { kinds: ["findings"] },
      { kinds: ["conclusion"] },
      { kinds: ["reflection"] },
      { kinds: ["quote"] },
      { kinds: ["link"] },
    ],
    legacy: "template",
    first: { kinds: ["graph", "image"], as: "key" },
    needs: [
      { need: "count", kinds: ["aim"], min: 1, message: "Add your aim or hypothesis." },
      { need: "count", kinds: ["conclusion"], min: 1, message: "Add your conclusion." },
      { need: "count", kinds: ["graph", "image"], min: 1, message: "Add a graph or an image: the key figure." },
      { need: "count", kinds: ["findings"], min: 1, message: "Add your results." },
    ],
  },
  build: {
    name: "Build",
    bestFor: "Something you made that works. Software, apps, engineering and hardware.",
    kinds: SIX,
    fromWork: "figure",
    template: PICTURES_FIRST,
    legacy: "template",
    first: { kinds: ["image"], as: "lead" },
    needs: [{ need: "count", kinds: ["image", "link"], min: 1, message: "Add a screenshot or a link, so people can see it working." }],
  },
  essay: {
    name: "Essay",
    bestFor: "An argument and the sources behind it. Law, history, English and politics.",
    kinds: [...SIX, "pullquote"],
    fromWork: "none",
    template: [{ kinds: ["flow"] }, { kinds: ["findings"] }, { kinds: ["pullquote"] }, { kinds: ["graph"] }, { kinds: ["image"] }, { kinds: ["quote"] }, { kinds: ["reflection"] }, { kinds: ["link"] }],
    legacy: "template",
    needs: [{ need: "count", kinds: ["findings"], min: 1, message: "Add your key points." }],
  },
  "before-after": {
    name: "Before and after",
    bestFor: "A redesign, shown as it was and as it is now. UX, product and design.",
    kinds: SIX,
    fromWork: "pictures",
    template: [{ kinds: ["image"] }, { kinds: ["flow"] }, { kinds: ["findings"] }, { kinds: ["graph"] }, { kinds: ["quote"] }, { kinds: ["reflection"] }, { kinds: ["link"] }],
    legacy: "template",
    needs: [
      { need: "count", kinds: ["image"], min: FORMAT_LIMITS["before-after"].minImages, message: `A before and after works best with at least ${FORMAT_LIMITS["before-after"].minImages} images.` },
      { need: "stages", message: "Mark one image Before and one After." },
      { need: "count", kinds: ["findings"], min: 1, message: "Add what changed and why." },
    ],
  },
  event: {
    name: "Event or performance",
    bestFor: "Something you put on or took part in. Music, drama, sport and societies.",
    kinds: SIX,
    fromWork: "pictures",
    template: PICTURES_FIRST,
    legacy: "template",
    first: { kinds: ["image"], as: "lead" },
    needs: [
      { need: "count", kinds: ["image"], min: FORMAT_LIMITS.event.minImages, message: "Add at least one picture, such as the poster." },
      { need: "myRole", message: "Say what your role was." },
    ],
  },
};

/** What a doc's layout takes from the work. A layout this code doesn't know reads as a case study, as everywhere. */
export const fromWorkOf = (d: { format?: unknown }): FromWork => FORMAT_RULES[formatOf(d)].fromWork;

/**
 * The words the editor and the page use, per layout. The headings among them (`flow`, `findings`, `reflection`,
 * `quote`, `refs`) are what the page draws until the person types a title of their own (decision 0032:
 * flowHeading, sectionHeading and refsHeading below say which heading goes over what).
 */
export type FormatCopy = {
  title: string;
  titleHint: string;
  /** The editor's first card, and what the preview shows for a title not typed yet. */
  header: string;
  emptyTitle: string;
  gap: string;
  gapHint: string;
  /** The flowchart's heading, and its section's name. A case study draws no heading over its flowchart (flowHeading). */
  flow: string;
  findings: string;
  reflection: string;
  /** The field label and the example inside it, for "what I'd do next" / the limitations. */
  reflectionLabel: string;
  reflectionPlaceholder: string;
  /** What the rewrite calls each part, as a plain noun phrase with no article ("Rewrite the brief"). */
  rewriteName: { header: string; gap: string; flow: string; findings: string };
  /** What one link is called ("Link", "Reference", "Source"). */
  link: string;
  linkHint: string;
  /** The quote's heading on the page: "Feedback", or "Review" in an event. Today a literal in exhbt-parts.tsx. */
  quote: string;
  /** What the skill pills are called, the list's accessible name: "Skills used", or "Built with" in a build. Today a literal in ProjectView.tsx. */
  skills: string;
  /** The heading over links drawn as a list (the "refs" group): "References" in research, "Sources" in an essay (a literal in the deleted ResearchMain.tsx before release 2). Absent where the layout draws no such list. */
  refs?: string;
  /** The layout as blockOptions' reasons name it: "in a case study", "in a gallery", "in research", and the same way for the four new ones ("in an essay"). */
  inLayout: string;
};

export const FORMAT_COPY: Record<Format, FormatCopy> = {
  "case-study": {
    title: "Your question (the title)",
    titleHint: "The question the work answers.",
    header: "Your question and details",
    emptyTitle: "Your question",
    gap: "Context",
    gapHint: "Why the question matters. Make the gap bold to highlight it.",
    flow: "Process",
    findings: "What I found",
    reflection: "What I'd do next",
    reflectionLabel: "What you'd do next, or do differently",
    reflectionPlaceholder: "e.g. Next time I'd time the evening queue too, to see if a second till pays off then.",
    rewriteName: { header: "question and details", gap: "context", flow: "process", findings: "findings" },
    link: "Link",
    linkHint: "A repository, a demo or a document. The page shows what it is, and links to it.",
    quote: "Feedback",
    skills: "Skills used",
    inLayout: "in a case study",
  },
  gallery: {
    title: "Name of the work (the title)",
    titleHint: "For example, Freshers' Week campaign for the Law Society.",
    header: "The work and details",
    emptyTitle: "Name of the work",
    gap: "The brief",
    gapHint: "What you were asked to do, and for whom. Make the ask bold to highlight it.",
    flow: "What I did",
    findings: "What happened",
    reflection: "What I'd do next",
    reflectionLabel: "What you'd do next, or do differently",
    reflectionPlaceholder: "e.g. Next time I'd test the poster on the halls noticeboards a week earlier.",
    rewriteName: { header: "work and details", gap: "brief", flow: "steps", findings: "outcome" },
    link: "Link",
    linkHint: "The film, the full set of pictures or the deck. The page shows what it is, and links to it.",
    quote: "Feedback",
    skills: "Skills used",
    inLayout: "in a gallery",
  },
  research: {
    title: "Your research question (the title)",
    titleHint: "The question the study set out to answer.",
    header: "Your research question and details",
    emptyTitle: "Your research question",
    gap: "Background",
    gapHint: "What was known, and what wasn't. Make the gap bold to highlight it.",
    flow: "Method",
    findings: "Results",
    reflection: "Limitations and next steps",
    reflectionLabel: "The limits of the study, and what you'd do next",
    reflectionPlaceholder: "e.g. One university and volunteers only. Next I'd test recall a day later.",
    rewriteName: { header: "research question and details", gap: "background", flow: "method", findings: "results" },
    link: "Reference",
    linkHint: "A paper or source you used. The page shows the citation, and links to it.",
    quote: "Feedback",
    skills: "Skills used",
    refs: "References",
    inLayout: "in research",
  },
  build: {
    title: "What you built (the title)",
    titleHint: "For example, A bus-times app for the campus shuttle.",
    header: "What you built and details",
    emptyTitle: "What you built",
    gap: "The problem",
    gapHint: "The problem it solves, and for whom. Make the problem bold to highlight it.",
    flow: "How I built it",
    findings: "What it does",
    reflection: "What's next",
    reflectionLabel: "What you'd add or change next",
    reflectionPlaceholder: "e.g. Next I'd add live times from the bus company's feed.",
    rewriteName: { header: "build and details", gap: "problem", flow: "build steps", findings: "what it does" },
    link: "Link",
    linkHint: "The demo or the code. The page shows what it is, and links to it.",
    quote: "Feedback",
    skills: "Built with",
    inLayout: "in a build",
  },
  essay: {
    title: "Your question or thesis (the title)",
    titleHint: "The question the essay answers, or the case it makes.",
    header: "Your question and details",
    emptyTitle: "Your question or thesis",
    gap: "Context",
    gapHint: "Why the question matters. Make the key point bold to highlight it.",
    flow: "How the argument runs",
    findings: "Key points",
    reflection: "What I'd look at next",
    reflectionLabel: "What you'd look at next",
    reflectionPlaceholder: "e.g. Next I'd read the court records from the years after the ruling.",
    rewriteName: { header: "question and details", gap: "context", flow: "argument", findings: "key points" },
    link: "Source",
    linkHint: "A book, a paper or a case you used. The page shows the citation, and links to it when it has an address.",
    quote: "Feedback",
    skills: "Skills used",
    refs: "Sources",
    inLayout: "in an essay",
  },
  "before-after": {
    title: "What you redesigned (the title)",
    titleHint: "For example, The library's room-booking page.",
    header: "The redesign and details",
    emptyTitle: "What you redesigned",
    gap: "The problem",
    gapHint: "What was wrong with it, and for whom. Make the problem bold to highlight it.",
    flow: "What I did",
    findings: "What changed and why",
    reflection: "What I'd do next",
    reflectionLabel: "What you'd do next, or do differently",
    reflectionPlaceholder: "e.g. Next I'd test the new page with students who use a screen reader.",
    rewriteName: { header: "redesign and details", gap: "problem", flow: "steps", findings: "changes" },
    link: "Link",
    linkHint: "The prototype. The page shows what it is, and links to it.",
    quote: "Feedback",
    skills: "Skills used",
    inLayout: "in a before and after",
  },
  event: {
    title: "The event (the title)",
    titleHint: "For example, The Music Society's spring concert.",
    header: "The event and details",
    emptyTitle: "The event",
    gap: "The brief",
    gapHint: "What it was for, and who it was for. Make the aim bold to highlight it.",
    flow: "How we put it on",
    findings: "How it went",
    reflection: "What I'd do next",
    reflectionLabel: "What you'd do next, or do differently",
    reflectionPlaceholder: "e.g. Next time I'd open ticket sales a week earlier.",
    rewriteName: { header: "event and details", gap: "brief", flow: "steps", findings: "outcome" },
    link: "Link",
    linkHint: "A recording or the programme. The page shows what it is, and links to it.",
    quote: "Review",
    skills: "Skills used",
    inLayout: "in an event",
  },
};

type Shown = { s: ContentSection; i: number };
type Laid = Pick<ExhbtDoc, "sections"> & { format?: unknown };

/** Whether the layout draws this section. The flowchart's marker is not a section the layout lists: it is never "shown" here (see flowShown). */
export const isShown = (d: { format?: unknown }, s: Section): boolean => s.kind !== "flow" && (FORMAT_RULES[formatOf(d)].kinds as readonly string[]).includes(s.kind);
/** The sections the layout draws, with each one's index in doc.sections (for issue paths). Never the flowchart's marker. */
export const shownSections = (d: Laid): Shown[] => d.sections.flatMap((s, i) => (s.kind !== "flow" && isShown(d, s) ? [{ s, i }] : []));
/** The sections the layout keeps but doesn't draw. Never the flowchart's marker. */
export const hiddenSections = (d: Laid): Shown[] => d.sections.flatMap((s, i) => (s.kind !== "flow" && !isShown(d, s) ? [{ s, i }] : []));

/* ---------------- The flowchart's place (decision 0027) ---------------- */

/** The doc has the flowchart's marker in its sections. */
export const hasMarker = (doc: Pick<ExhbtDoc, "sections">): boolean => doc.sections.some((s) => s.kind === "flow");
/** Touched by the edit-on-page editor: it has the marker, or the flowchart has been taken off. */
export const isArranged = (doc: Pick<ExhbtDoc, "sections" | "flowOff">): boolean => hasMarker(doc) || doc.flowOff === true;
/**
 * False only when the doc says the flowchart has gone (flowOff, and no marker). Every layout lets it go
 * (decision 0032); until then a case study and research always drew one, flowOff or not.
 */
export const flowShown = (doc: Pick<ExhbtDoc, "sections" | "flowOff">): boolean => hasMarker(doc) || doc.flowOff !== true;

/* ---------------- Section titles (decision 0032) ---------------- */

/**
 * The heading a layout draws over its flowchart: its own word for it ("Method", "What I did"), or "" in a
 * case study, which draws none ("Process" there is only the section's name, for a screen reader).
 */
export const flowHeading = (f: Format): string => (f === "case-study" ? "" : FORMAT_COPY[f].flow);

/** The heading a layout draws over a list of links: research's "References", an essay's "Sources". */
export const refsHeading = (f: Format): string => FORMAT_COPY[f].refs ?? FORMAT_COPY[f].link;

/**
 * The heading a layout draws over a section of this kind, or null for a kind it draws none over (a graph, an
 * image, a link, a pull quote). The aim's is "Aim" or "Hypothesis", by its own switch.
 */
export function sectionHeading(s: { kind: string; heading?: unknown }, f: Format): string | null {
  switch (s.kind) {
    case "findings":
      return FORMAT_COPY[f].findings;
    case "quote":
      return FORMAT_COPY[f].quote;
    case "reflection":
      return FORMAT_COPY[f].reflection;
    case "aim":
      return s.heading === "hypothesis" ? "Hypothesis" : "Aim";
    case "conclusion":
      return "Conclusion";
    default:
      return null;
  }
}

/**
 * The title to draw over a part: the person's own when they typed one, nothing ("") when they cleared it, and
 * the layout's heading while they have never touched it (`own` undefined), so an untouched heading follows a
 * layout switch and a typed one is kept through it.
 */
export const titleShown = (own: string | undefined, layoutHeading: string): string => (own === undefined ? layoutHeading : own.trim());
