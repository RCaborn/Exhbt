import { z } from "zod/v4";
import { asChart, CHART_LIMITS, ChartSchema, chartIssues, chartTexts, publicChart, type Chart } from "./charts";

/**
 * An exhbt as stored (exhbts.blocks): the layout Rory set on 12 Nov 2026, as data.
 * docs/decisions/0007-exhbt-block-editor.md, docs/phase-2.md section 6.
 *
 *   header:  photo + name (from the profile, not stored here) · skill boxes · title · context line
 *   body:    the gap → process flowchart → findings → graphs (0-2) → images (0-2)
 *   footer:  the work (evidence) · trust badge (system)
 *
 * The order is fixed. People edit every word and add or remove flowchart boxes, findings,
 * graphs and images within the limits. Drafts may break the limits (saving is never
 * blocked); publishing may not (validateForPublish, run on the server).
 */

export const SCHEMA_VERSION = 1;

/** Hard limits, checked on publish. The editor shows them as it goes. */
export const LIMITS = {
  titleChars: 80,
  contextChars: 90,
  skills: { max: 6, wordsEach: 3, charsEach: 32 },
  gapWords: 40,
  flow: { min: 3, max: 6, stepWords: 8, detailWords: 6 },
  findings: { min: 2, max: 4, wordsEach: 20 },
  /** Graphs: up to 2, each one of a fixed set of kinds with its own caps (lib/exhbt/charts.ts, decision 0011). */
  charts: CHART_LIMITS,
  images: { max: 2, captionWords: 15 },
  evidenceCaptionWords: 15,
  /** Every word on the page (see wordCount). 150 is what the editor aims for; 200 is the limit. */
  totalWords: 200,
  targetWords: 150,
} as const;

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
});

export const EvidenceSchema = z.union([
  z.object({ kind: z.literal("file"), fileId: z.string(), label: z.string() }),
  z.object({ kind: z.literal("link"), href: z.string(), label: z.string() }),
]);

export const ExhbtDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  title: z.string(),
  /** One line under the title, e.g. "BSc Economics, final-year project". */
  context: z.string(),
  /** The one number that sums it up, on portfolio tiles. Optional. */
  headline: z.object({ value: z.string(), label: z.string() }).optional(),
  skills: z.array(z.string()),
  /** Context and the gap: the question and why it mattered. */
  gap: RichTextSchema,
  flow: z.array(FlowStepSchema),
  findings: z.array(RichTextSchema),
  charts: z.array(ChartSchema),
  images: z.array(ImageSchema),
  evidence: EvidenceSchema.optional(),
  /** Numbers the AI wrote that weren't found in the uploaded material (lib/exhbt/verify.ts); the editor flags each one. */
  unverified: z.array(z.string()).optional(),
});
export type ExhbtDoc = z.infer<typeof ExhbtDocSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export type { Chart };

export function emptyDoc(): ExhbtDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: "",
    context: "",
    skills: [],
    gap: [],
    flow: [{ step: "" }, { step: "" }, { step: "" }],
    findings: [[], []],
    charts: [],
    images: [],
  };
}

export const plain = (rt: RichText): string => rt.map((r) => r.t).join("");
export const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Every word on the page, for the 200-word cap (Rory, 12 Nov 2026: "200 should cap everything"):
 * header, skills, headline, the gap, the flowchart, findings, every word on the graphs (titles,
 * axis titles, units, series names, row and tile labels, table headings and cells), image
 * captions and the evidence label. Only image alt text is left out: it isn't shown on the page.
 */
export function wordCount(d: ExhbtDoc): number {
  return [
    d.title,
    d.context,
    ...d.skills,
    d.headline?.value ?? "",
    d.headline?.label ?? "",
    plain(d.gap),
    ...d.flow.flatMap((s) => [s.step, s.detail ?? ""]),
    ...d.findings.map(plain),
    ...d.charts.flatMap(chartTexts),
    ...d.images.map((im) => plain(im.caption)),
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

/**
 * What stops publishing. Each issue has a path the editor can point at
 * (e.g. "flow.2.step", "findings.0"). Empty means it can be published.
 */
export function validateForPublish(d: ExhbtDoc): Issue[] {
  const L = LIMITS;
  const out: Issue[] = [];
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) out.push({ path, message });
  };
  const parsed = ExhbtDocSchema.safeParse(d);
  if (!parsed.success) return [{ path: "", message: "This exhbt couldn't be read. Reload and try again." }];

  need(d.title.trim().length > 0, "title", "Add a title.");
  need(d.title.length <= L.titleChars, "title", `Keep the title to ${L.titleChars} characters.`);
  need(d.context.length <= L.contextChars, "context", `Keep the context line to ${L.contextChars} characters.`);

  need(d.skills.length <= L.skills.max, "skills", `Up to ${L.skills.max} skills.`);
  d.skills.forEach((s, i) => {
    need(s.trim().length > 0, `skills.${i}`, "Fill in this skill or remove it.");
    need(words(s) <= L.skills.wordsEach && s.length <= L.skills.charsEach, `skills.${i}`, "Keep each skill short.");
  });

  need(words(plain(d.gap)) > 0, "gap", "Say what the question was.");
  need(words(plain(d.gap)) <= L.gapWords, "gap", `Keep the question to ${L.gapWords} words.`);

  need(d.flow.length >= L.flow.min, "flow", `The flowchart needs at least ${L.flow.min} boxes.`);
  need(d.flow.length <= L.flow.max, "flow", `Up to ${L.flow.max} boxes in the flowchart.`);
  d.flow.forEach((s, i) => {
    need(s.step.trim().length > 0, `flow.${i}.step`, "Type in this box or remove it.");
    need(words(s.step) <= L.flow.stepWords, `flow.${i}.step`, `Keep each box to ${L.flow.stepWords} words.`);
    need(words(s.detail ?? "") <= L.flow.detailWords, `flow.${i}.detail`, `Keep the detail to ${L.flow.detailWords} words.`);
  });

  need(d.findings.length >= L.findings.min, "findings", `Add at least ${L.findings.min} findings.`);
  need(d.findings.length <= L.findings.max, "findings", `Up to ${L.findings.max} findings.`);
  d.findings.forEach((f, i) => {
    need(words(plain(f)) > 0, `findings.${i}`, "Fill in this finding or remove it.");
    need(words(plain(f)) <= L.findings.wordsEach, `findings.${i}`, `Keep each finding to ${L.findings.wordsEach} words.`);
  });

  need(d.charts.length <= L.charts.max, "charts", `Up to ${L.charts.max} graphs.`);
  parsed.data.charts.forEach((c, i) => out.push(...chartIssues(c, i)));

  need(d.images.length <= L.images.max, "images", `Up to ${L.images.max} images.`);
  d.images.forEach((im, i) => {
    need(im.alt.trim().length > 0, `images.${i}.alt`, "Describe the image for people who can't see it.");
    need(words(plain(im.caption)) <= L.images.captionWords, `images.${i}.caption`, `Keep the caption to ${L.images.captionWords} words.`);
  });

  if (d.evidence?.kind === "link") need(safeHref(d.evidence.href) !== null, "evidence", "Use a full https:// link to the work.");
  for (const [path, rt] of [["gap", d.gap] as const, ...d.findings.map((f, i) => [`findings.${i}`, f] as const)]) {
    if (rt.some((r) => r.href !== undefined && safeHref(r.href) === null)) out.push({ path, message: "Links must start with https://." });
  }

  need(wordCount(d) <= L.totalWords, "", `Keep the whole exhbt to ${L.totalWords} words (it's ${wordCount(d)}).`);
  return out;
}

/**
 * The copy employers see, made when an exhbt is published (lib/store.ts publishExhbt): the same
 * doc, except that a graph whose numbers are protected keeps only its index, never the figures
 * typed in (decision 0011).
 */
export const publicDoc = (d: ExhbtDoc): ExhbtDoc => ({ ...d, charts: d.charts.map(publicChart) });

/** The doc with every graph given its kind, for a doc read straight from the store (it may predate kinds). */
export const withChartKinds = (d: ExhbtDoc): ExhbtDoc => ({ ...d, charts: d.charts.map(asChart) });

/** Plain text to runs, for drafts and for tests. */
export const text = (t: string): RichText => (t ? [{ t }] : []);
