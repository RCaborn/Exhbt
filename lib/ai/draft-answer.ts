import { z } from "zod/v4";
import { LIMITS } from "@/lib/exhbt/blocks";
import { DRAFT_FORMATS } from "@/lib/exhbt/formats";
import { LAYOUT_REASONS } from "@/lib/exhbt/drafted";
import { CHART_KINDS, type Chart } from "@/lib/exhbt/charts";

/** The layouts the draft may choose, and the reasons it may give: the schema's enums and repairDraft read these lists. */
const DRAFT_LAYOUTS: readonly string[] = DRAFT_FORMATS;
const REASONS: readonly string[] = LAYOUT_REASONS;

/**
 * The draft's answer shape and the code that reads it. Pure (no server-only), so the tests in
 * e2e/ai-answers.spec.ts can run it. lib/ai/exhbt-draft.ts sends this schema and builds the doc.
 *
 * A graph as the model writes it: one flat shape for every kind, turned into the stored kind by
 * toChart. Unused fields are empty strings, empty lists or false.
 *
 * The answer shape is kept small on purpose (decision 0029): the API compiles it into a grammar
 * and refuses one that is too large, at about 52 to 56 fields in all, with a nullable field
 * costing about two and an array of objects a little more than its fields. So nothing here is
 * nullable (empty means "none"), and every kind shares one row type: a scatter point is a row
 * with values [x, y], a number tile a row with values [value] or [value, from] and its unit in
 * `series`, a table's headings in `series` or else the first row of `cells`.
 * `npm run probe:ai` checks the shape against the real API, with the growth already planned.
 *
 * The SDK (1.6) sends an enum, a list's maximum and a number's range only as description text,
 * so the model can write a value outside them. repairDraft fixes the answer before the strict
 * schema reads it, so one stray value costs a graph, not the draft.
 */
export const DraftChartSchema = z.object({
  kind: z.enum(CHART_KINDS),
  title: z.string(),
  xTitle: z.string(),
  yTitle: z.string(),
  unit: z.string(),
  lowerIsBetter: z.boolean(),
  series: z.array(z.string()),
  rows: z.array(z.object({ label: z.string(), values: z.array(z.number()) })),
  cells: z.array(z.array(z.string())),
});
export type DraftChart = z.infer<typeof DraftChartSchema>;

export const DraftSchema = z.object({
  format: z.enum(DRAFT_FORMATS),
  /** Why that layout: a fixed signal, never the model's own words (lib/exhbt/drafted.ts, decision 0025). Non-null, like every field here. */
  formatReason: z.enum(LAYOUT_REASONS),
  title: z.string(),
  summary: z.string(),
  context: z.string(),
  whereWhen: z.string(),
  skills: z.array(z.string()),
  gap: z.string(),
  gapHighlight: z.string(),
  flow: z.array(z.object({ step: z.string(), detail: z.string() })),
  findings: z.array(z.string()),
  charts: z.array(DraftChartSchema),
  // All three empty when there is no quote.
  quote: z.object({ text: z.string(), name: z.string(), role: z.string() }),
  next: z.string(),
  aim: z.string(),
  aimIsHypothesis: z.boolean(),
  conclusion: z.string(),
  references: z.array(z.object({ label: z.string(), url: z.string() })),
  numbers: z.array(z.object({ value: z.string(), sourceQuote: z.string() })),
});
export type Draft = z.infer<typeof DraftSchema>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KINDS: readonly string[] = CHART_KINDS;

/**
 * The model's answer made to fit the strict schema, where it can be without guessing: an unknown
 * layout becomes a case study (as toDoc would read it anyway), an unknown or missing reason for the
 * layout becomes "default", which says no reason at all (checkedReason does the same to a reason
 * the draft doesn't bear out), and a graph of an unknown kind is dropped. Anything else that's
 * wrong is left for the schema to reject.
 */
export function repairDraft(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };
  if (!DRAFT_LAYOUTS.includes(String(out.format))) out.format = "case-study";
  if (!REASONS.includes(String(out.formatReason))) out.formatReason = "default";
  if (Array.isArray(out.charts)) out.charts = out.charts.filter((c) => !isObject(c) || KINDS.includes(String(c.kind)));
  return out;
}

/** A heading that is only a figure (a data row put where the headings go). */
const bareNumber = (s: string) => /^[\s\d.,%£$€+\-−]+$/.test(s) && /\d/.test(s);
const squashed = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * One of the model's graphs as a stored graph of its kind, trimmed to the kind's caps. Rows
 * without the values the kind needs are dropped, never filled in. Null when nothing is left, or
 * when the kind isn't one this code knows.
 */
export function toChart(g: DraftChart): Chart | null {
  const C = LIMITS.charts;
  const t = (s: string | undefined) => (s ?? "").trim();
  // false stores nothing, as null did before (decision 0029), so the graph's default holds.
  const better = g.lowerIsBetter ? true : undefined;
  const some = (o: Record<string, string | boolean | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
  const axes = some({ xTitle: t(g.xTitle), yTitle: t(g.yTitle), unit: t(g.unit) });
  const title = t(g.title);
  const rows = g.rows.map((r) => ({ label: t(r.label), values: r.values }));
  switch (g.kind) {
    case "beforeAfter": {
      const kept = rows.filter((r) => r.values.length >= 2).slice(0, C.beforeAfter.rows.max);
      if (!kept.length) return null;
      return {
        kind: "beforeAfter",
        title,
        beforeLabel: t(g.series[0]) || "Before",
        afterLabel: t(g.series[1]) || "After",
        lowerIsBetter: g.lowerIsBetter,
        ...some({ unit: t(g.unit) }),
        rows: kept.map((r) => ({ label: r.label, before: r.values[0]!, after: r.values[1]! })),
      };
    }
    case "bar": {
      const kept = rows.filter((r) => r.values.length >= 1).slice(0, C.bar.rows.max);
      return kept.length ? { kind: "bar", title, ...axes, ...some({ lowerIsBetter: better }), rows: kept.map((r) => ({ label: r.label, value: r.values[0]! })) } : null;
    }
    case "groupedBar":
    case "stackedBar":
    case "line": {
      const lim = C[g.kind];
      const series = g.series.map(t).slice(0, lim.series.max);
      const kept = rows
        .filter((r) => r.values.length >= series.length && (g.kind !== "stackedBar" || r.values.every((v) => v >= 0)))
        .slice(0, lim.rows.max)
        .map((r) => ({ label: r.label, values: r.values.slice(0, series.length) }));
      if (!series.length || !kept.length) return null;
      const lower = g.kind === "stackedBar" ? {} : some({ lowerIsBetter: better });
      return { kind: g.kind, title, ...axes, ...lower, series, rows: kept } as Chart;
    }
    case "scatter": {
      // A point is a row with values [x, y]; a row without both is dropped.
      const points = rows
        .filter((r) => r.values.length >= 2)
        .slice(0, C.scatter.points.max)
        .map((r) => ({ x: r.values[0]!, y: r.values[1]!, ...some({ label: r.label }) }));
      return points.length ? { kind: "scatter", title, xTitle: t(g.xTitle), yTitle: t(g.yTitle), ...some({ unit: t(g.unit) }), points } : null;
    }
    case "numbers": {
      // A tile is a row with values [value] or [value, from]. Its unit comes from series only when
      // series has one entry per row (a shorter list would shift the units onto the wrong figures),
      // and from the shared unit field when series is empty. A "unit" that repeats the tile's own
      // label is a name, not a unit, and is dropped.
      const perRow = g.series.length === g.rows.length;
      const shared = g.series.length === 0 ? t(g.unit) : "";
      const tiles = rows
        .map((r, i) => {
          const u = perRow ? t(g.series[i]) : shared;
          return { ...r, unit: u && squashed(u) !== squashed(r.label) ? u : "" };
        })
        .filter((r) => r.label && r.values.length >= 1)
        .slice(0, C.numbers.tiles.max)
        .map((r) => ({ value: r.values[0]!, label: r.label, ...some({ unit: r.unit }), ...(r.values.length >= 2 ? { from: r.values[1]! } : {}) }));
      return tiles.length ? { kind: "numbers", title, tiles } : null;
    }
    case "table": {
      // Headings: series when it is filled (then every row of cells is data), else the first row
      // of cells. When the headings come from cells and are bare figures, a data row is where
      // they should be, so the table is dropped rather than shown with a row missing.
      const fromSeries = g.series.some((s) => t(s));
      const head = fromSeries ? g.series : (g.cells[0] ?? []);
      const columns = head.map((c) => t(c)).slice(0, C.table.columns.max);
      if (!fromSeries && columns.some(bareNumber)) return null;
      const cells = g.cells
        .slice(fromSeries ? 0 : 1)
        .slice(0, C.table.rows.max)
        .map((r) => Array.from({ length: columns.length }, (_, k) => t(r[k])))
        .filter((r) => r.some(Boolean));
      return columns.length && cells.length ? { kind: "table", title, columns, rows: cells } : null;
    }
    default:
      // A kind this code doesn't know: no graph, rather than a draft that fails.
      return null;
  }
}
