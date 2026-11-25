import { z } from "zod/v4";
import { formatLimits, LIMITS, SCHEMA_VERSION, text, withHighlight, words, type ExhbtDoc, type Section } from "@/lib/exhbt/blocks";
import { CLASSIC_FORMATS, FORMATS, isFormat } from "@/lib/exhbt/formats";
import { CLASSIC_REASONS, LAYOUT_REASONS } from "@/lib/exhbt/drafted";
import { CHART_KINDS, hasData, type Chart } from "@/lib/exhbt/charts";
import { pullquoteFrom, referencesFrom, roleFrom, sourcesFrom, squash } from "@/lib/exhbt/references";

/**
 * The draft's answer shape and the code that reads it: the schemas, the repair, and the answer
 * turned into an exhbt doc (toDoc), with the checks that keep only what the person supplied. Pure
 * (no server-only), so the tests in e2e/ai-answers.spec.ts and e2e/layouts-new.spec.ts can run it.
 * lib/ai/exhbt-draft.ts sends these schemas.
 *
 * There are two shapes, because a draft chooses among the layouts the person's editor offers
 * (lib/exhbt/formats.ts, offeredIn):
 *  - "three": the three layouts of decision 0024, for a person whose editor is the classic one.
 *    DraftSchema, exactly as it was sent before release 4: 39 fields.
 *  - "seven": all seven (decision 0028), for a person whose editor is the new one. DraftSchemaSeven:
 *    the same and two more fields, `pullquote` and `myRole`: 41 fields.
 *
 * A graph as the model writes it: one flat shape for every kind, turned into the stored kind by
 * toChart. Unused fields are empty strings, empty lists or false.
 *
 * The answer shape is kept small on purpose (decision 0029): the API compiles it into a grammar
 * and refuses one that is too large, at about 52 to 56 fields in all, with a nullable field
 * costing about two and an array of objects a little more than its fields. So nothing here is
 * nullable (empty means "none"), and every kind shares one row type: a scatter point is a row
 * with values [x, y], a number tile a row with values [value] or [value, from] and its unit in
 * `series`, a table's headings in `series` or else the first row of `cells`. For the same reason
 * the seven-layout answer has no list of its own for an essay's sources or a build's links: both
 * are rows of `references` (a label and an address, the address empty for a source that has none).
 * `npm run probe:ai` checks both shapes against the real API; e2e/layouts-new.spec.ts holds the
 * field counts, so a field can't be added unseen.
 *
 * The SDK (1.6) sends an enum, a list's maximum and a number's range only as description text,
 * so the model can write a value outside them. repairDraft fixes the answer before the strict
 * schema reads it, so one stray value costs a graph, not the draft.
 */

/** Which layouts a draft may choose: the classic editor's three, or all seven. */
export type DraftLayouts = "three" | "seven";
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

/** The answer of a draft that chooses among three layouts. Unchanged by release 4: the request the live site has been sending. */
export const DraftSchema = z.object({
  format: z.enum(CLASSIC_FORMATS),
  /** Why that layout: a fixed signal, never the model's own words (lib/exhbt/drafted.ts, decision 0025). Non-null, like every field here. */
  formatReason: z.enum(CLASSIC_REASONS),
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

const { numbers: numbersField, ...sharedFields } = DraftSchema.omit({ format: true, formatReason: true }).shape;

/**
 * The answer of a draft that chooses among all seven layouts (decision 0028): the same fields, the
 * two enums widened, and the two parts the new layouts add that nothing else can hold. Both are
 * empty strings for "none", and both are kept only when the material holds them word for word (toDoc).
 * `numbers` stays last, after everything the model wrote.
 */
export const DraftSchemaSeven = z.object({
  format: z.enum(FORMATS),
  formatReason: z.enum(LAYOUT_REASONS),
  ...sharedFields,
  /** Essay only: one sentence of the person's own, copied from the material, drawn large. */
  pullquote: z.string(),
  /** Event only: the person's part in it, as the material says it. */
  myRole: z.string(),
  numbers: numbersField,
});

/** A draft's answer, whichever shape it came in: the seven-layout fields are absent from a three-layout answer. */
export type Draft = Omit<z.infer<typeof DraftSchemaSeven>, "pullquote" | "myRole"> & { pullquote?: string; myRole?: string };

/** The schema for a draft's answer. */
export const draftSchema = (layouts: DraftLayouts): z.ZodType<Draft> => (layouts === "seven" ? DraftSchemaSeven : DraftSchema);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KINDS: readonly string[] = CHART_KINDS;
/** The layouts each kind of draft may choose and the reasons it may give: what its schema's enums hold. */
const CHOICES: Record<DraftLayouts, { formats: readonly string[]; reasons: readonly string[] }> = {
  three: { formats: CLASSIC_FORMATS, reasons: CLASSIC_REASONS },
  seven: { formats: FORMATS, reasons: LAYOUT_REASONS },
};

/**
 * The model's answer made to fit the strict schema, where it can be without guessing: a layout the
 * draft may not choose becomes a case study (as toDoc would read an unknown one anyway), an unknown
 * or missing reason for the layout becomes "default", which says no reason at all (checkedReason does
 * the same to a reason the draft doesn't bear out), and a graph of an unknown kind is dropped. In a
 * seven-layout answer a pull quote or a role that is missing or isn't text becomes "", which is none.
 * Anything else that's wrong is left for the schema to reject.
 *
 * The caps on what the new layouts add are toDoc's, as every list's are: a pull quote over its words
 * or a role over its characters is left off, sources are cut to the essay's four and links to the
 * build's two.
 */
export function repairDraft(raw: unknown, layouts: DraftLayouts = "three"): unknown {
  if (!isObject(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };
  const { formats, reasons } = CHOICES[layouts];
  if (!formats.includes(String(out.format))) out.format = "case-study";
  if (!reasons.includes(String(out.formatReason))) out.formatReason = "default";
  if (Array.isArray(out.charts)) out.charts = out.charts.filter((c) => !isObject(c) || KINDS.includes(String(c.kind)));
  if (layouts === "seven") for (const k of ["pullquote", "myRole"]) if (typeof out[k] !== "string") out[k] = "";
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

/* ---------------- The answer as an exhbt doc ---------------- */

const L = LIMITS;

/**
 * The quote the model proposed, if it's really in the material: its words as written there, and
 * the name too. Anything else is dropped rather than flagged: a quote can't be checked like a
 * number, and an invented one would put words in someone's mouth.
 */
export function quoteFrom(q: Draft["quote"] | null, source: string): { text: string; name: string; role: string } | null {
  if (!q) return null;
  const said = q.text.trim().replace(/^["“‘']+|["”’']+$/g, "").trim();
  const name = q.name.trim();
  const flat = squash(source);
  if (!said || !name || words(said) > L.quote.words || !flat.includes(squash(said)) || !flat.includes(squash(name))) return null;
  const role = q.role.trim();
  return { text: said, name: name.slice(0, L.quote.nameChars), role: role && flat.includes(squash(role)) ? role.slice(0, L.quote.roleChars) : "" };
}

/**
 * The model's strings as an ExhbtDoc, trimmed to the block counts. Word limits are left to the
 * editor (drafts may run over; publishing may not), but counts are clamped so the layout holds.
 * `source` is the material (materialText in ./exhbt-draft.ts): everything the person supplied.
 *
 * Only what the person supplied (AGENTS.md; decision 0028, "The AI chooses among seven"). The parts
 * that could put words in someone's mouth, or send a reader somewhere, are kept only when the
 * material holds them, and are left off otherwise, never flagged or filled in:
 *  - the quote: its words and the speaker's name, as written in the material (quoteFrom);
 *  - a reference (research) and a link (a build's demo and code): its https address, as written;
 *  - a source (an essay): its address as written, or with no address its citation word for word;
 *  - the pull quote (an essay): word for word, and within its cap;
 *  - My role (an event): word for word, and within its cap.
 * Before and After marks are never set: the AI hasn't seen the pictures, and no picture is drafted.
 * A part that belongs to another layout is not kept hidden: it is left off.
 */
export function toDoc(d: Draft, source: string): ExhbtDoc {
  const nonEmpty = (s: string) => s.trim().length > 0;
  // The layout the draft chose; the caps are that layout's (decisions 0024 and 0028).
  const f = isFormat(d.format) ? d.format : "case-study";
  const FL = formatLimits(f);
  const findings = d.findings.map((x) => x.trim()).filter(nonEmpty).slice(0, FL.findings.max).map(text);
  const charts = d.charts
    .map(toChart)
    .filter((c): c is Chart => c !== null && hasData(c))
    .slice(0, FL.sections.graph);
  const quote = quoteFrom(d.quote, source);
  const next = d.next.trim();
  const findingsSection: Section[] = findings.length ? [{ id: "findings", kind: "findings" as const, items: findings }] : [];
  const graphs: Section[] = charts.map((chart, i) => ({ id: `graph-${i + 1}`, kind: "graph" as const, chart }));
  const quoteSection: Section[] = quote ? [{ id: "quote-1", kind: "quote" as const, ...quote }] : [];
  const nextSection: Section[] = next ? [{ id: "reflection-1", kind: "reflection" as const, text: text(next) }] : [];
  /** Link sections, each label cut to the layout's cap. Their descriptions are the person's to write. */
  const links = (kept: { href: string; label: string }[]): Section[] =>
    kept.map((r, i) => ({ id: `link-${i + 1}`, kind: "link" as const, href: r.href, label: r.label.split(/\s+/).slice(0, FL.link.labelWords).join(" "), description: "" }));
  let sections: Section[];
  if (f === "research") {
    // Research poster order: the aim, the results, the graphs, the conclusion, feedback, limitations, then the references.
    const aim = d.aim.trim();
    const conclusion = d.conclusion.trim();
    sections = [
      ...(aim ? [{ id: "aim-1", kind: "aim" as const, text: text(aim), ...(d.aimIsHypothesis ? { heading: "hypothesis" as const } : {}) }] : []),
      ...findingsSection,
      ...graphs,
      ...(conclusion ? [{ id: "conclusion-1", kind: "conclusion" as const, text: text(conclusion) }] : []),
      ...quoteSection,
      ...nextSection,
      ...links(referencesFrom(d.references, source, FL.sections.link)),
    ];
  } else if (f === "essay") {
    // An essay's usual order: the key points, the pull quote, the graph, feedback, what I'd look at next, then the sources.
    const pullquote = pullquoteFrom(d.pullquote ?? "", source, FL.pullquote.words);
    sections = [
      ...findingsSection,
      ...(pullquote ? [{ id: "pullquote-1", kind: "pullquote" as const, text: pullquote }] : []),
      ...graphs,
      ...quoteSection,
      ...nextSection,
      ...links(sourcesFrom(d.references, source, FL.sections.link)),
    ];
  } else if (f === "build") {
    // A build ends with its links (the demo, the code), each only with an https address from the material.
    sections = [...findingsSection, ...graphs, ...quoteSection, ...nextSection, ...links(referencesFrom(d.references, source, FL.sections.link))];
  } else {
    // Below the flowchart, in this order (decision 0015): findings, the graphs, the quote, what I'd do next.
    // A layout keeps nothing that belongs to another: no aim, conclusion, references or pull quote is stored hidden.
    sections = [...findingsSection, ...graphs, ...quoteSection, ...nextSection];
  }
  const myRole = f === "event" ? roleFrom(d.myRole ?? "", source, L.myRoleChars) : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    // Only when it isn't a case study, so a case-study draft is the same doc as before layouts.
    ...(f === "case-study" ? {} : { format: f }),
    title: d.title.trim().slice(0, L.titleChars),
    // What it is and where and when sit in the sidebar (decision 0022); the summary goes on portfolio cards.
    context: d.context.trim().slice(0, L.contextChars),
    // Always written, empty or not, so "Back to the AI version" of the header restores them too.
    whereWhen: d.whereWhen.trim().slice(0, L.whereWhenChars),
    ...(myRole ? { myRole } : {}),
    summary: d.summary.trim(),
    skills: d.skills.map((s) => s.trim()).filter(nonEmpty).slice(0, L.skills.max),
    // The highlighted gap only when its words are really in the line.
    gap: withHighlight(d.gap, d.gapHighlight),
    flow: d.flow
      .filter((s) => nonEmpty(s.step))
      .slice(0, L.flow.max)
      .map((s) => (s.detail.trim() ? { step: s.step.trim(), detail: s.detail.trim() } : { step: s.step.trim() })),
    sections,
  };
}

/**
 * What the model wrote, for the parts the four layouts add, that the material didn't bear out and so
 * isn't on the doc: a measure of the prompt for the draft eval, never shown to the person. Only the
 * parts the chosen layout uses are counted.
 */
export function leftOff(d: Draft, doc: ExhbtDoc): string[] {
  const out: string[] = [];
  const has = (kind: Section["kind"]) => doc.sections.filter((s) => s.kind === kind).length;
  if (doc.format === "essay" && (d.pullquote ?? "").trim() && !has("pullquote")) out.push("pull quote");
  if (doc.format === "event" && (d.myRole ?? "").trim() && !doc.myRole) out.push("My role");
  if (doc.format === "essay" || doc.format === "build" || doc.format === "research") {
    const written = d.references.filter((r) => r.label.trim() || r.url.trim()).length;
    const cap = formatLimits(doc.format).sections.link;
    const lost = Math.min(written, cap) - has("link");
    if (lost > 0) out.push(`${lost} ${doc.format === "essay" ? "source" : doc.format === "build" ? "link" : "reference"}${lost === 1 ? "" : "s"}`);
  }
  return out;
}
