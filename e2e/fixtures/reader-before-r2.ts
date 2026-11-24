import { z } from "zod/v4";
import { asChart, ChartSchema, type Chart } from "../../lib/exhbt/charts";

/**
 * A frozen copy of how the code before release 2 reads a stored exhbt: `normaliseDoc`, the doc's
 * schema and `FORMATS`, copied from lib/exhbt/blocks.ts and lib/exhbt/formats.ts at release 2's
 * base commit (phase-2-r2 at 8a6c302). Do not import them from lib/: this is the old reader on
 * purpose, so e2e/layout-model.spec.ts can show that docs as later releases write them (a flowchart
 * marker, flowOff, a pull quote, an image's stage, myRole, a new layout id) still read, under the
 * code they would meet after a two-step rollback, as a doc that page can draw (decision 0027, "The
 * parity gate", step 7). The graph schema is imported: release 2 does not change lib/exhbt/charts.ts.
 */

export const OLD_SCHEMA_VERSION = 2;
export const OLD_FORMATS = ["case-study", "gallery", "research"] as const;
export const OLD_SECTION_KINDS = ["findings", "graph", "image", "quote", "reflection", "link", "aim", "conclusion"] as const;
const isFormat = (v: unknown) => typeof v === "string" && (OLD_FORMATS as readonly string[]).includes(v);

const RunSchema = z.object({ t: z.string(), b: z.boolean().optional(), i: z.boolean().optional(), href: z.string().optional() });
const RichTextSchema = z.array(RunSchema);
const FlowStepSchema = z.object({ step: z.string(), detail: z.string().optional() });
const ImageSchema = z.object({
  fileId: z.string(),
  alt: z.string(),
  caption: RichTextSchema,
  w: z.number().int().min(1).max(20000).optional(),
  h: z.number().int().min(1).max(20000).optional(),
});
const EvidenceSchema = z.union([
  z.object({ kind: z.literal("file"), fileId: z.string(), label: z.string() }),
  z.object({ kind: z.literal("link"), href: z.string(), label: z.string() }),
]);
const SectionId = z.string().min(1).max(40);
const FIGURE_KINDS = ["graph", "table", "other"] as const;
const FigureBoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const PickedSchema = z.object({
  from: z.string(),
  sourceFileId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  media: z.string().optional(),
  box: FigureBoxSchema.optional(),
  kind: z.enum(FIGURE_KINDS).optional().catch(undefined),
  shareOk: z.boolean(),
});
const SectionSchema = z.discriminatedUnion("kind", [
  z.object({ id: SectionId, kind: z.literal("findings"), items: z.array(RichTextSchema) }),
  z.object({ id: SectionId, kind: z.literal("graph"), chart: ChartSchema }),
  ImageSchema.extend({ id: SectionId, kind: z.literal("image"), picked: PickedSchema.optional() }),
  z.object({ id: SectionId, kind: z.literal("quote"), text: z.string(), name: z.string(), role: z.string() }),
  z.object({ id: SectionId, kind: z.literal("reflection"), text: RichTextSchema }),
  z.object({ id: SectionId, kind: z.literal("link"), href: z.string(), label: z.string(), description: z.string() }),
  z.object({ id: SectionId, kind: z.literal("aim"), text: RichTextSchema, heading: z.enum(["aim", "hypothesis"]).optional() }),
  z.object({ id: SectionId, kind: z.literal("conclusion"), text: RichTextSchema }),
]);
const DocSchema = z.object({
  schemaVersion: z.literal(OLD_SCHEMA_VERSION),
  format: z.enum(OLD_FORMATS).optional(),
  title: z.string(),
  context: z.string(),
  whereWhen: z.string().optional(),
  summary: z.string().optional(),
  headline: z.object({ value: z.string(), label: z.string() }).optional(),
  skills: z.array(z.string()),
  gap: RichTextSchema,
  flow: z.array(FlowStepSchema),
  sections: z.array(SectionSchema),
  evidence: EvidenceSchema.optional(),
  unverified: z.array(z.string()).optional(),
});
export type OldDoc = z.infer<typeof DocSchema>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

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

export function oldNormaliseDoc(raw: unknown): OldDoc {
  if (!isObject(raw)) return raw as OldDoc;
  if (Array.isArray(raw.sections)) {
    const { format, ...rest } = raw;
    const known = raw.sections.filter((s) => !isObject(s) || (OLD_SECTION_KINDS as readonly string[]).includes(s.kind as string));
    return { ...(isFormat(format) ? { ...rest, format } : rest), sections: withIds(known) } as OldDoc;
  }
  const { findings, charts, images, ...rest } = raw;
  const sections: unknown[] = [];
  if (Array.isArray(findings) && findings.length) sections.push({ id: "findings", kind: "findings", items: findings });
  if (Array.isArray(charts)) charts.forEach((c, i) => sections.push({ id: `graph-${i + 1}`, kind: "graph", chart: c }));
  if (Array.isArray(images)) images.forEach((im, i) => sections.push({ ...(isObject(im) ? im : {}), id: `image-${i + 1}`, kind: "image" }));
  return { ...rest, schemaVersion: OLD_SCHEMA_VERSION, sections: withIds(sections) } as OldDoc;
}

/** The old reader's schema: what the store's read and every save ran a doc through. */
export const OldExhbtDocSchema = z.preprocess(oldNormaliseDoc, DocSchema);
