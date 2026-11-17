import { z } from "zod/v4";
import { FORMAT_COPY, FORMAT_LIMITS, FORMAT_RULES, FORMATS, formatOf, isFormat, isShown, shownSections, type Format } from "./formats";
import { asChart, CHART_LIMITS, ChartSchema, chartIssues, chartTexts, publicChart, type Chart } from "./charts";

/**
 * An exhbt as stored (exhbts.blocks): the layout Rory set on 12 Nov 2026, as data, with the
 * optional parts as sections (13 Nov 2026). docs/decisions/0007, 0015; docs/phase-2.md section 6.
 *
 *   header:   photo + name (from the profile, not stored here) · skill boxes · the title, phrased as
 *             the question · the context line (gap), its bold run drawn as a highlight
 *   sidebar:  what it is (context) · where and when · the checks · the work · Save as PDF
 *   core:     the context line → the process flowchart (3 to 6 boxes). Always there, in this order.
 *   sections: below the flowchart, in the person's order: findings, graphs (0-2), images (0-2),
 *             a quote, what I'd do next, a link. Each can be added, removed and moved.
 *   footer:   the work (evidence) · trust badge (system)
 *
 * Drafts may break the limits (saving is never blocked); publishing may not (validateForPublish,
 * run on the server). Docs saved before sections existed are read by normaliseDoc. The page layout
 * (16 Nov 2026) is decision 0022: `whereWhen` and `summary` are optional, so older docs read as they are.
 */

export const SCHEMA_VERSION = 2;

/** `aim` and `conclusion` are drawn only by the research layout (decision 0024). Last, so the order of issues for the older kinds is unchanged. */
export const SECTION_KINDS = ["findings", "graph", "image", "quote", "reflection", "link", "aim", "conclusion"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Hard limits, checked on publish. The editor shows them as it goes. */
export const LIMITS = {
  /** The title is the question the work answers (decision 0022). */
  titleChars: 80,
  /** "What it is", e.g. "MSc Finance dissertation" (stored as `context`). */
  contextChars: 90,
  /** "Where and when", e.g. "University of St Andrews, August 2026". */
  whereWhenChars: 60,
  /** One sentence on what you found, for portfolio cards (exhbtSummary). */
  summaryWords: 25,
  skills: { max: 6, wordsEach: 3, charsEach: 32 },
  gapWords: 40,
  flow: { min: 3, max: 6, stepWords: 8, detailWords: 6 },
  findings: { min: 2, max: 4, wordsEach: 20 },
  /** Graphs: up to 2, each one of a fixed set of kinds with its own caps (lib/exhbt/charts.ts, decision 0011). */
  charts: CHART_LIMITS,
  images: { max: 2, captionWords: 15 },
  /** Feedback someone gave, in their words, with their name and (optionally) role. */
  quote: { words: 30, nameChars: 60, roleChars: 60 },
  /** What I'd do next: one or two lines. */
  reflection: { words: 35 },
  /** A repository, demo or document: https only. */
  link: { labelWords: 8, descriptionWords: 15 },
  /** Research only (decision 0024). */
  aim: { words: 20 },
  conclusion: { words: 25 },
  /** How many of each section an exhbt can have (decision 0015). */
  sections: { findings: 1, graph: CHART_LIMITS.max, image: 2, quote: 1, reflection: 1, link: 1, aim: 1, conclusion: 1 } satisfies Record<SectionKind, number>,
  evidenceCaptionWords: 15,
  /** Every word on the page (see wordCount). 150 is what the editor aims for; 200 is the limit. */
  totalWords: 200,
  targetWords: 150,
} as const;

type Widen<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] extends object ? Widen<T[K]> : T[K] };
export type Limits = Omit<Widen<typeof LIMITS>, "sections"> & {
  sections: Record<SectionKind, number>;
  /** Fewest images a layout needs (a gallery: two). */
  minImages: number;
  /** Most graphs and images together (research: three), or null for no combined cap. */
  maxFigures: number | null;
};

/**
 * LIMITS with a layout's own caps merged over them (decision 0024). A case study's are LIMITS,
 * unchanged. Not named limitsFor: that's lib/plan-rules.ts.
 */
export function formatLimits(f: Format): Limits {
  const o = FORMAT_LIMITS[f] as {
    gapWords?: number;
    findings?: Partial<Limits["findings"]>;
    images?: Partial<Limits["images"]>;
    link?: Partial<Limits["link"]>;
    reflection?: Partial<Limits["reflection"]>;
    sections?: Partial<Record<SectionKind, number>>;
    minImages?: number;
    maxFigures?: number;
    targetWords?: number;
  };
  return {
    ...LIMITS,
    gapWords: o.gapWords ?? LIMITS.gapWords,
    targetWords: o.targetWords ?? LIMITS.targetWords,
    findings: { ...LIMITS.findings, ...o.findings },
    images: { ...LIMITS.images, ...o.images },
    link: { ...LIMITS.link, ...o.link },
    reflection: { ...LIMITS.reflection, ...o.reflection },
    sections: { ...LIMITS.sections, ...o.sections },
    minImages: o.minImages ?? 0,
    maxFigures: o.maxFigures ?? null,
  };
}

/**
 * Text with a little formatting: bold, italic and links, nothing else (decision 0007).
 * Stored as runs, rendered by components/exhbt/RichText.tsx. Never raw HTML.
 */
export const RunSchema = z.object({
  t: z.string(),
  b: z.boolean().optional(),
  i: z.boolean().optional(),
  /** https only; checked by safeHref before rendering. */
  href: z.string().optional(),
});
export const RichTextSchema = z.array(RunSchema);
export type Run = z.infer<typeof RunSchema>;
export type RichText = z.infer<typeof RichTextSchema>;

export const FlowStepSchema = z.object({ step: z.string(), detail: z.string().optional() });

/** A graph: before/after, bars, grouped or stacked bars, a line, scatter, big numbers or a small table (lib/exhbt/charts.ts). */
export { ChartSchema };

export const ImageSchema = z.object({
  /** exhbt_files.id, served through a signed URL. */
  fileId: z.string(),
  /** Read aloud by screen readers; required to publish. */
  alt: z.string(),
  caption: RichTextSchema,
  /** The picture's size in pixels after the browser's resize, so a page knows its shape before it loads. Older images have none. */
  w: z.number().int().min(1).max(20000).optional(),
  h: z.number().int().min(1).max(20000).optional(),
});

export const EvidenceSchema = z.union([
  z.object({ kind: z.literal("file"), fileId: z.string(), label: z.string() }),
  z.object({ kind: z.literal("link"), href: z.string(), label: z.string() }),
]);

/* ---------------- Sections (decision 0015) ---------------- */

/** Stable within a doc, so the editor keeps each section's fields as it moves. */
const SectionId = z.string().min(1).max(40);

export const FindingsSectionSchema = z.object({ id: SectionId, kind: z.literal("findings"), items: z.array(RichTextSchema) });
export const GraphSectionSchema = z.object({ id: SectionId, kind: z.literal("graph"), chart: ChartSchema });
/** Where a picked figure sits on its page: fractions of the page's width and height, from the top left. */
export const FigureBoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export type FigureBox = z.infer<typeof FigureBoxSchema>;

/**
 * A figure Exhbt picked from the person's upload when it drafted the exhbt (decision 0017). It
 * may be someone else's to share (a supervisor's chart, a company's diagram), so publishing
 * waits until the person ticks that they may share it (`shareOk`). Only in the working copy:
 * publicDoc leaves it out of what employers see.
 */
export const PickedSchema = z.object({
  /** The uploaded file's name, for "From report.pdf, page 3". */
  from: z.string(),
  /** That file's exhbt_files.id, so the editor can show its other pages. Missing if it wasn't stored. */
  sourceFileId: z.string().optional(),
  /** The PDF page it is on, from 1. */
  page: z.number().int().min(1).optional(),
  /** A picture inside a Word or PowerPoint file: its path in the file, e.g. "ppt/media/image3.png". */
  media: z.string().optional(),
  /** The crop on the page (PDFs only). */
  box: FigureBoxSchema.optional(),
  /** Ticked: the person says they may share it. */
  shareOk: z.boolean(),
});
export type Picked = z.infer<typeof PickedSchema>;

export const ImageSectionSchema = ImageSchema.extend({ id: SectionId, kind: z.literal("image"), picked: PickedSchema.optional() });
/** Someone else's words, so plain text: no formatting to put words in their mouth. */
export const QuoteSectionSchema = z.object({ id: SectionId, kind: z.literal("quote"), text: z.string(), name: z.string(), role: z.string() });
export const ReflectionSectionSchema = z.object({ id: SectionId, kind: z.literal("reflection"), text: RichTextSchema });
/** `href` is checked by safeHref; only the label and description show (and count). */
export const LinkSectionSchema = z.object({ id: SectionId, kind: z.literal("link"), href: z.string(), label: z.string(), description: z.string() });

/** Research only: the aim or hypothesis, and the conclusion (decision 0024). Short formatted text, like "What I'd do next". */
export const AimSectionSchema = z.object({ id: SectionId, kind: z.literal("aim"), text: RichTextSchema, heading: z.enum(["aim", "hypothesis"]).optional() });
export const ConclusionSectionSchema = z.object({ id: SectionId, kind: z.literal("conclusion"), text: RichTextSchema });

export const SectionSchema = z.discriminatedUnion("kind", [
  FindingsSectionSchema,
  GraphSectionSchema,
  ImageSectionSchema,
  QuoteSectionSchema,
  ReflectionSectionSchema,
  LinkSectionSchema,
  AimSectionSchema,
  ConclusionSectionSchema,
]);
export type Section = z.output<typeof SectionSchema>;
export type SectionOf<K extends SectionKind> = Extract<Section, { kind: K }>;

const DocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** The exhbt's layout (decision 0024). Absent is a case study; never defaulted, so an old doc parses without it. */
  format: z.enum(FORMATS).optional(),
  title: z.string(),
  /**
   * "What it is", in the sidebar, e.g. "MSc Finance dissertation" (decision 0022). The key is
   * older than the name: it was the line under the title, and every stored doc already holds this.
   */
  context: z.string(),
  /** "Where and when", in the sidebar, e.g. "University of St Andrews, August 2026". Optional: older docs have none. */
  whereWhen: z.string().optional(),
  /** One sentence on what you found, for portfolio cards. Optional; exhbtSummary falls back to the first finding. */
  summary: z.string().optional(),
  /** The one number that sums it up, on job-link tiles and link previews (not on the page since decision 0022). Optional. */
  headline: z.object({ value: z.string(), label: z.string() }).optional(),
  skills: z.array(z.string()),
  /**
   * The context line under the title: why the question matters. Its bold run is drawn as the
   * highlighted phrase, the gap (decision 0022). Called "The question" before the title became one.
   */
  gap: RichTextSchema,
  /** The process flowchart: always there, 3 to 6 boxes. */
  flow: z.array(FlowStepSchema),
  /** Everything below the flowchart, in page order. */
  sections: z.array(SectionSchema),
  /** The work, in the footer beside the trust badge (not a section: the badge's "source attached" reads it). */
  evidence: EvidenceSchema.optional(),
  /** Numbers the AI wrote that weren't found in the uploaded material (lib/exhbt/verify.ts); the editor flags each one. */
  unverified: z.array(z.string()).optional(),
});
export type ExhbtDoc = z.infer<typeof DocSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type { Chart };

/**
 * An exhbt as stored before sections (schema version 1): findings, graphs and images at the top,
 * always drawn in that order. Rows like this are still in the database; normaliseDoc reads them.
 */
export type ExhbtDocV1 = Omit<ExhbtDoc, "schemaVersion" | "sections"> & {
  schemaVersion: 1;
  findings: RichText[];
  charts: Chart[];
  images: Image[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Every section with an id, and no id twice (a repeat or a missing one gets the next free `${kind}-n`). */
function withIds(sections: unknown[]): unknown[] {
  const seen = new Set<string>();
  const ids = new Set(sections.map((s) => (isObject(s) && typeof s.id === "string" ? s.id : "")));
  return sections.map((s) => {
    if (!isObject(s)) return s;
    let id = typeof s.id === "string" && s.id && !seen.has(s.id) ? s.id : "";
    if (!id) {
      const kind = typeof s.kind === "string" ? s.kind : "section";
      for (let n = 1; !id; n++) if (!ids.has(`${kind}-${n}`) && !seen.has(`${kind}-${n}`)) id = `${kind}-${n}`;
    }
    seen.add(id);
    const out: Record<string, unknown> = { ...s, id };
    if (out.kind === "graph" && isObject(out.chart)) out.chart = asChart(out.chart as Chart);
    return out;
  });
}

/**
 * Any stored exhbt in the current shape, without parsing it (it never throws; ExhbtDocSchema
 * runs it first). A doc saved before sections keeps its page as it was: findings, then each
 * graph, then each image, with fixed ids, so reading it twice gives the same doc. Graphs get their
 * kind (decision 0011). The work stays in the footer. Run by the store on every read, so every
 * reader sees sections; no migration, since blocks is jsonb.
 */
export function normaliseDoc(raw: unknown): ExhbtDoc {
  if (!isObject(raw)) return raw as ExhbtDoc;
  if (Array.isArray(raw.sections)) {
    // A layout this code doesn't know (written by a later release) reads as a case study, and a
    // section kind it doesn't know is left out of what is read, so no reader or schema ever meets one.
    const { format, ...rest } = raw;
    const known = raw.sections.filter((s) => !isObject(s) || (SECTION_KINDS as readonly string[]).includes(s.kind as string));
    return { ...(isFormat(format) ? { ...rest, format } : rest), sections: withIds(known) } as ExhbtDoc;
  }
  const { findings, charts, images, ...rest } = raw;
  const sections: unknown[] = [];
  if (Array.isArray(findings) && findings.length) sections.push({ id: "findings", kind: "findings", items: findings });
  if (Array.isArray(charts)) charts.forEach((c, i) => sections.push({ id: `graph-${i + 1}`, kind: "graph", chart: c }));
  if (Array.isArray(images)) images.forEach((im, i) => sections.push({ ...(isObject(im) ? im : {}), id: `image-${i + 1}`, kind: "image" }));
  return { ...rest, schemaVersion: SCHEMA_VERSION, sections: withIds(sections) } as ExhbtDoc;
}

/** An exhbt, checked for shape. Docs saved before sections are read as sections first (normaliseDoc). */
export const ExhbtDocSchema = z.preprocess(normaliseDoc, DocSchema);

/* ---------------- Reading sections ---------------- */

export const sectionsOf = <K extends SectionKind>(d: Pick<ExhbtDoc, "sections">, kind: K): SectionOf<K>[] =>
  d.sections.filter((s): s is SectionOf<K> => s.kind === kind);
/** The findings bullets, or none when there's no findings section. */
export const findingsOf = (d: Pick<ExhbtDoc, "sections">): RichText[] => sectionsOf(d, "findings")[0]?.items ?? [];
/** Every graph, in page order. */
export const chartsOf = (d: Pick<ExhbtDoc, "sections">): Chart[] => sectionsOf(d, "graph").map((s) => s.chart);
/** Every image, in page order. */
export const imagesOf = (d: Pick<ExhbtDoc, "sections">): SectionOf<"image">[] => sectionsOf(d, "image");

export function emptyDoc(): ExhbtDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: "",
    context: "",
    skills: [],
    gap: [],
    flow: [{ step: "" }, { step: "" }, { step: "" }],
    sections: [{ id: "findings", kind: "findings", items: [[], []] }],
  };
}

export const plain = (rt: RichText): string => rt.map((r) => r.t).join("");
export const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * One sentence on what the exhbt found, for portfolio cards and the featured band: the summary
 * the person wrote, or else the first finding as plain text. Empty when there's neither.
 */
export function exhbtSummary(d: Pick<ExhbtDoc, "summary" | "sections">): string {
  const own = d.summary?.trim();
  if (own) return own;
  const first = findingsOf(d).find((f) => plain(f).trim());
  return first ? plain(first).trim() : "";
}

/** Every text a section puts on the page, for the word cap. Image alt text and link addresses don't show, so they're left out. */
export function sectionTexts(s: Section): string[] {
  switch (s.kind) {
    case "findings":
      return s.items.map(plain);
    case "graph":
      return chartTexts(s.chart);
    case "image":
      return [plain(s.caption)];
    case "quote":
      return [s.text, s.name, s.role];
    case "reflection":
      return [plain(s.text)];
    case "link":
      return [s.label, s.description];
    case "aim":
    case "conclusion":
      return [plain(s.text)];
  }
}

/**
 * Every word on the page, for the 200-word cap (Rory, 12 and 13 Nov 2026: "200 should cap
 * everything", "even if you add, it is within limit"): header, skills, headline, what it is, where
 * and when, the summary (it shows on portfolio cards), the context line, the
 * flowchart, every section (findings, every word on the graphs, image captions, the quote with its
 * name and role, what I'd do next, the link's label and description) and the evidence label. Only
 * image alt text and link addresses are left out: they aren't shown on the page.
 */
export function wordCount(d: ExhbtDoc): number {
  return [
    d.title,
    d.context,
    d.whereWhen ?? "",
    d.summary ?? "",
    ...d.skills,
    d.headline?.value ?? "",
    d.headline?.label ?? "",
    plain(d.gap),
    ...d.flow.flatMap((s) => [s.step, s.detail ?? ""]),
    // A kind the layout doesn't draw is kept but not counted (decision 0024).
    ...shownSections(d).flatMap(({ s }) => sectionTexts(s)),
    d.evidence?.label ?? "",
  ].reduce((n, s) => n + words(s), 0);
}

/** Links must be https (no javascript:, data: or http:). */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type Issue = { path: string; message: string };

/** What a person calls a kind, in messages ("Only one quote."). The case study's wording is unchanged. */
function oneOf(kind: SectionKind, L: Limits): string {
  switch (kind) {
    case "findings":
      return "Only one findings section.";
    case "graph":
      return L.sections.graph === 1 ? "Only one graph." : `Up to ${L.sections.graph} graphs.`;
    case "image":
      return `Up to ${L.sections.image} images.`;
    case "quote":
      return "Only one quote.";
    case "reflection":
      return "Only one section on what you'd do next.";
    case "link":
      return L.sections.link === 1 ? "Only one link." : `Up to ${L.sections.link} links.`;
    case "aim":
      return "Only one aim or hypothesis.";
    case "conclusion":
      return "Only one conclusion.";
  }
}

/**
 * What stops publishing. Each issue has a path the editor can point at
 * (e.g. "flow.2.step", "sections.0.items.1"). Empty means it can be published.
 */
export function validateForPublish(d: ExhbtDoc): Issue[] {
  const out: Issue[] = [];
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) out.push({ path, message });
  };
  const parsed = ExhbtDocSchema.safeParse(d);
  if (!parsed.success) return [{ path: "", message: "This exhbt couldn't be read. Reload and try again." }];
  const doc = parsed.data;
  // The layout sets the caps and which kinds are checked: a kind it doesn't draw is kept but not checked (decision 0024).
  const F = formatOf(doc);
  const L = formatLimits(F);
  const kinds = new Set<SectionKind>(FORMAT_RULES[F].kinds);
  const httpsOnly = (rt: RichText, path: string) => need(!rt.some((r) => r.href !== undefined && safeHref(r.href) === null), path, "Links must start with https://.");

  need(doc.title.trim().length > 0, "title", "Add a title.");
  need(doc.title.length <= L.titleChars, "title", `Keep the title to ${L.titleChars} characters.`);
  need(doc.context.length <= L.contextChars, "context", `Keep "What it is" to ${L.contextChars} characters.`);
  need((doc.whereWhen ?? "").length <= L.whereWhenChars, "whereWhen", `Keep "Where and when" to ${L.whereWhenChars} characters.`);
  need(words(doc.summary ?? "") <= L.summaryWords, "summary", `Keep the summary to one sentence of ${L.summaryWords} words or fewer.`);

  need(doc.skills.length <= L.skills.max, "skills", `Up to ${L.skills.max} skills.`);
  doc.skills.forEach((s, i) => {
    need(s.trim().length > 0, `skills.${i}`, "Fill in this skill or remove it.");
    need(words(s) <= L.skills.wordsEach && s.length <= L.skills.charsEach, `skills.${i}`, "Keep each skill short.");
  });

  need(words(plain(doc.gap)) > 0, "gap", FORMAT_COPY[F].gapMissing);
  need(words(plain(doc.gap)) <= L.gapWords, "gap", `Keep the context to ${L.gapWords} words.`);
  httpsOnly(doc.gap, "gap");

  need(doc.flow.length >= L.flow.min, "flow", `The flowchart needs at least ${L.flow.min} boxes.`);
  need(doc.flow.length <= L.flow.max, "flow", `Up to ${L.flow.max} boxes in the flowchart.`);
  doc.flow.forEach((s, i) => {
    need(s.step.trim().length > 0, `flow.${i}.step`, "Type in this box or remove it.");
    need(words(s.step) <= L.flow.stepWords, `flow.${i}.step`, `Keep each box to ${L.flow.stepWords} words.`);
    need(words(s.detail ?? "") <= L.flow.detailWords, `flow.${i}.detail`, `Keep the detail to ${L.flow.detailWords} words.`);
  });

  // Sections: how many of each (more than the layout allows is an error; nothing is hidden), and what the layout needs.
  for (const kind of SECTION_KINDS) if (kinds.has(kind)) need(sectionsOf(doc, kind).length <= L.sections[kind], "sections", oneOf(kind, L));
  const nImages = sectionsOf(doc, "image").length;
  const nFigures = nImages + sectionsOf(doc, "graph").length;
  if (F === "case-study") {
    need(doc.sections.some((s) => s.kind === "findings" || s.kind === "graph"), "sections", "Add findings or a graph, so the exhbt shows what came of the work.");
  } else if (F === "gallery") {
    need(nImages >= L.minImages, "sections", `A gallery needs at least ${L.minImages} images.`);
  } else {
    need(sectionsOf(doc, "aim").length > 0, "sections", "Add your aim or hypothesis.");
    need(sectionsOf(doc, "conclusion").length > 0, "sections", "Add your conclusion.");
    need(nFigures > 0, "sections", "Add a graph or an image: the key figure.");
    need(L.maxFigures === null || nFigures <= L.maxFigures, "sections", `Up to ${L.maxFigures} figures, graphs and images together.`);
    need(sectionsOf(doc, "findings").length > 0, "sections", "Add your results.");
  }

  doc.sections.forEach((s, n) => {
    if (!kinds.has(s.kind)) return;
    const p = `sections.${n}`;
    switch (s.kind) {
      case "findings":
        need(s.items.length >= L.findings.min, `${p}.items`, `Add at least ${L.findings.min} findings.`);
        need(s.items.length <= L.findings.max, `${p}.items`, `Up to ${L.findings.max} findings.`);
        s.items.forEach((f, i) => {
          need(words(plain(f)) > 0, `${p}.items.${i}`, "Fill in this finding or remove it.");
          need(words(plain(f)) <= L.findings.wordsEach, `${p}.items.${i}`, `Keep each finding to ${L.findings.wordsEach} words.`);
          httpsOnly(f, `${p}.items.${i}`);
        });
        break;
      case "graph":
        out.push(...chartIssues(s.chart, `${p}.chart`));
        break;
      case "image":
        // A figure picked from their upload may not be theirs to share (decision 0017).
        need(!s.picked || s.picked.shareOk, `${p}.picked.shareOk`, "Tick that you may share this figure, or remove it.");
        need(s.alt.trim().length > 0, `${p}.alt`, "Describe the image for people who can't see it.");
        need(words(plain(s.caption)) <= L.images.captionWords, `${p}.caption`, `Keep the caption to ${L.images.captionWords} words.`);
        httpsOnly(s.caption, `${p}.caption`);
        break;
      case "quote":
        need(words(s.text) > 0, `${p}.text`, "Type in the quote or remove it.");
        need(words(s.text) <= L.quote.words, `${p}.text`, `Keep the quote to ${L.quote.words} words.`);
        need(s.name.trim().length > 0, `${p}.name`, "Say who said it.");
        need(s.name.length <= L.quote.nameChars, `${p}.name`, `Keep the name to ${L.quote.nameChars} characters.`);
        need(s.role.length <= L.quote.roleChars, `${p}.role`, `Keep the role to ${L.quote.roleChars} characters.`);
        break;
      case "reflection":
        need(words(plain(s.text)) > 0, `${p}.text`, "Say what you'd do next, or remove this.");
        need(words(plain(s.text)) <= L.reflection.words, `${p}.text`, `Keep this to ${L.reflection.words} words.`);
        httpsOnly(s.text, `${p}.text`);
        break;
      case "link":
        need(safeHref(s.href) !== null, `${p}.href`, "Use a full https:// link.");
        need(s.label.trim().length > 0, `${p}.label`, "Say what the link is.");
        need(words(s.label) <= L.link.labelWords, `${p}.label`, `Keep the label to ${L.link.labelWords} words.`);
        need(words(s.description) <= L.link.descriptionWords, `${p}.description`, `Keep the description to ${L.link.descriptionWords} words.`);
        break;
      case "aim":
        need(words(plain(s.text)) > 0, `${p}.text`, "Write your aim or hypothesis, or remove this.");
        need(words(plain(s.text)) <= L.aim.words, `${p}.text`, `Keep the aim to ${L.aim.words} words.`);
        httpsOnly(s.text, `${p}.text`);
        break;
      case "conclusion":
        need(words(plain(s.text)) > 0, `${p}.text`, "Write your conclusion, or remove this.");
        need(words(plain(s.text)) <= L.conclusion.words, `${p}.text`, `Keep the conclusion to ${L.conclusion.words} words.`);
        httpsOnly(s.text, `${p}.text`);
        break;
    }
  });

  if (doc.evidence?.kind === "link") need(safeHref(doc.evidence.href) !== null, "evidence", "Use a full https:// link to the work.");

  need(wordCount(doc) <= L.totalWords, "", `Keep the whole exhbt to ${L.totalWords} words (it's ${wordCount(doc)}).`);
  return out;
}

/**
 * The copy employers see, made when an exhbt is published (lib/store.ts publishExhbt): the same
 * doc, except that a graph whose numbers are protected keeps only its index, never the figures
 * typed in (decision 0011), wherever its section sits, and a picked figure's note of where it came
 * from stays in the working copy (decision 0017). A section the layout doesn't draw (an aim outside
 * research) stays in the working copy too (decision 0024).
 */
export function publicDoc(raw: ExhbtDoc): ExhbtDoc {
  const d = normaliseDoc(raw);
  return {
    ...d,
    // A kind the layout doesn't draw stays in the working copy, not in what employers see.
    sections: d.sections.filter((s) => isShown(d, s)).map((s) => {
      if (s.kind === "graph") return { ...s, chart: publicChart(s.chart) };
      if (s.kind === "image" && s.picked) {
        const rest = { ...s };
        delete rest.picked;
        return rest;
      }
      return s;
    }),
  };
}

/** Plain text to runs, for drafts and for tests. */
export const text = (t: string): RichText => (t ? [{ t }] : []);

/**
 * The context line as runs, with `phrase` (the gap) marked: the bold run the page draws as a
 * highlight (decision 0022). The first place the phrase occurs, as written; plain text when it's
 * empty or not in the line, so the AI can't highlight words that aren't there.
 */
export function withHighlight(line: string, phrase: string): RichText {
  const t = line.trim();
  const p = phrase.trim().replace(/^["“‘']+|["”’']+$/g, "").trim();
  const at = p ? t.indexOf(p) : -1;
  if (at < 0) return text(t);
  return [{ t: t.slice(0, at) }, { t: p, b: true }, { t: t.slice(at + p.length) }].filter((r) => r.t.length > 0);
}
