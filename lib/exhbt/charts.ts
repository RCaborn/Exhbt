import { z } from "zod/v4";
import { sameJson } from "../json";

/**
 * Graphs on an exhbt (decision 0011). Flexible within a fixed set of kinds: every value is typed
 * in and printed on the page, so an employer can read and check each figure. Anything more
 * exotic goes in as an image. Pure, so the editor, the server, the AI draft and the tests share
 * it; components/charts/Chart.tsx draws each kind.
 *
 * Stored in exhbts.blocks (jsonb). Graphs saved before kinds existed have no `kind`: they are
 * before/after graphs, and ChartSchema reads them as such. Docs read straight from the store
 * aren't parsed, so everything here that reads a graph goes through asChart() first.
 */

export const CHART_KINDS = ["beforeAfter", "bar", "groupedBar", "stackedBar", "line", "scatter", "numbers", "table"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

/** What the editor's type picker calls each kind. */
export const KIND_NAMES: Record<ChartKind, string> = {
  beforeAfter: "Before and after",
  bar: "Bars",
  groupedBar: "Grouped bars",
  stackedBar: "Stacked bars",
  line: "Line",
  scatter: "Scatter",
  numbers: "Big numbers",
  table: "Table",
};

/** Caps per kind, checked on publish (LIMITS.charts in lib/exhbt/blocks.ts). */
export const CHART_LIMITS = {
  /** Graphs per exhbt. */
  max: 2,
  titleChars: 80,
  /** Any one label: a row, a series, an axis, a tile or a table cell. */
  labelChars: 40,
  beforeAfter: { rows: { min: 1, max: 3 } },
  bar: { rows: { min: 2, max: 8 } },
  groupedBar: { series: { min: 2, max: 4 }, rows: { min: 1, max: 6 } },
  stackedBar: { series: { min: 2, max: 4 }, rows: { min: 1, max: 8 } },
  line: { series: { min: 1, max: 4 }, rows: { min: 2, max: 12 } },
  scatter: { points: { min: 3, max: 30 } },
  numbers: { tiles: { min: 2, max: 4 } },
  table: { columns: { min: 2, max: 5 }, rows: { min: 1, max: 6 } },
} as const;

/**
 * "Protect the real numbers", for confidential work: the page shows each value as the change
 * from its starting value (%), or as an index (start = 100). The figures typed in stay in the
 * private working copy; publishing stores only the index (publicChart), so the live page and its
 * data table never carry them.
 */
export const ProtectSchema = z.enum(["change", "index"]);
export type Protect = z.infer<typeof ProtectSchema>;

const opt = z.string().optional();
const SeriesRow = z.object({ label: z.string(), values: z.array(z.number()) });

export const BeforeAfterSchema = z.object({
  kind: z.literal("beforeAfter"),
  title: z.string(),
  beforeLabel: z.string(),
  afterLabel: z.string(),
  lowerIsBetter: z.boolean(),
  unit: opt,
  protect: ProtectSchema.optional(),
  rows: z.array(z.object({ label: z.string(), before: z.number(), after: z.number() })),
});

/** One series of bars; `highlight` is the index of the bar to draw darker. */
export const BarSchema = z.object({
  kind: z.literal("bar"),
  title: z.string(),
  xTitle: opt,
  yTitle: opt,
  unit: opt,
  lowerIsBetter: z.boolean().optional(),
  highlight: z.number().int().optional(),
  protect: ProtectSchema.optional(),
  rows: z.array(z.object({ label: z.string(), value: z.number() })),
});

/** Groups of bars, one per series; `highlight` is the series drawn darkest. */
export const GroupedBarSchema = z.object({
  kind: z.literal("groupedBar"),
  title: z.string(),
  xTitle: opt,
  yTitle: opt,
  unit: opt,
  lowerIsBetter: z.boolean().optional(),
  highlight: z.number().int().optional(),
  protect: ProtectSchema.optional(),
  series: z.array(z.string()),
  rows: z.array(SeriesRow),
});

/** One bar per row, split into parts (the series). Parts can't be below 0. */
export const StackedBarSchema = z.object({
  kind: z.literal("stackedBar"),
  title: z.string(),
  xTitle: opt,
  yTitle: opt,
  unit: opt,
  highlight: z.number().int().optional(),
  /** Only as an index: a change from the start would make no sense stacked. */
  protect: z.literal("index").optional(),
  series: z.array(z.string()),
  rows: z.array(SeriesRow),
});

/** Up to 4 lines over an ordered axis (weeks, months); each row is one point along it. */
export const LineSchema = z.object({
  kind: z.literal("line"),
  title: z.string(),
  xTitle: opt,
  yTitle: opt,
  unit: opt,
  lowerIsBetter: z.boolean().optional(),
  highlight: z.number().int().optional(),
  protect: ProtectSchema.optional(),
  series: z.array(z.string()),
  rows: z.array(SeriesRow),
});

/** x/y points, each with an optional label; `highlight` is the point to mark. */
export const ScatterSchema = z.object({
  kind: z.literal("scatter"),
  title: z.string(),
  xTitle: z.string(),
  yTitle: z.string(),
  xUnit: opt,
  unit: opt,
  highlight: z.number().int().optional(),
  points: z.array(z.object({ x: z.number(), y: z.number(), label: opt })),
});

/** 2 to 4 big figures, each with a label and an optional starting value ("from 7.9%"). */
export const NumbersSchema = z.object({
  kind: z.literal("numbers"),
  title: z.string(),
  highlight: z.number().int().optional(),
  tiles: z.array(z.object({ value: z.number(), label: z.string(), unit: opt, from: z.number().optional() })),
});

/** A small table: column headings and rows of cells, as text. `highlight` is a row. */
export const TableSchema = z.object({
  kind: z.literal("table"),
  title: z.string(),
  highlight: z.number().int().optional(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const ChartUnion = z.discriminatedUnion("kind", [
  BeforeAfterSchema,
  BarSchema,
  GroupedBarSchema,
  StackedBarSchema,
  LineSchema,
  ScatterSchema,
  NumbersSchema,
  TableSchema,
]);

/** A graph saved before graphs had kinds is a before/after graph. */
const withKind = (v: unknown): unknown => (v && typeof v === "object" && !("kind" in v) ? { ...v, kind: "beforeAfter" } : v);

/** One graph, as stored. Old graphs without `kind` parse as before/after (no migration: blocks is jsonb). */
export const ChartSchema = z.preprocess(withKind, ChartUnion);
export type Chart = z.output<typeof ChartUnion>;
export type ChartOf<K extends ChartKind> = Extract<Chart, { kind: K }>;
export type BeforeAfter = ChartOf<"beforeAfter">;

/** The graph with its kind, for data read without parsing (the store returns jsonb as it is). */
export const asChart = (c: Chart): Chart => withKind(c) as Chart;

/**
 * Whether two graphs are the same graph: the same kind, words and values, with rows and points in the
 * same order. Both are read as a graph first (ChartSchema), then compared whatever order their keys
 * are in, because a graph read from the database (jsonb) comes back with its keys in another order
 * than the same graph kept in a file or built in code. Never compare two graphs as JSON text.
 * Something that doesn't read as a graph is the same as nothing, itself included.
 */
export function sameChart(a: unknown, b: unknown): boolean {
  const x = ChartSchema.safeParse(a);
  const y = ChartSchema.safeParse(b);
  return x.success && y.success && sameJson(x.data, y.data);
}

/** Which ways a kind can protect its numbers. Scatter, tables and big numbers can't (type them as percentages instead). */
export function protectModes(kind: ChartKind): Protect[] {
  if (kind === "stackedBar") return ["index"];
  if (kind === "beforeAfter" || kind === "bar" || kind === "groupedBar" || kind === "line") return ["change", "index"];
  return [];
}

/* ---------------- A new graph, and whether there's anything to draw ---------------- */

export function newChart(kind: ChartKind = "beforeAfter"): Chart {
  switch (kind) {
    case "beforeAfter":
      return { kind, title: "", beforeLabel: "Before", afterLabel: "After", lowerIsBetter: false, rows: [{ label: "", before: 0, after: 0 }] };
    case "bar":
      return { kind, title: "", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] };
    case "groupedBar":
    case "stackedBar":
      return { kind, title: "", series: ["", ""], rows: [{ label: "", values: [0, 0] }] };
    case "line":
      return { kind, title: "", series: [""], rows: [{ label: "", values: [0] }, { label: "", values: [0] }] };
    case "scatter":
      return { kind, title: "", xTitle: "", yTitle: "", points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] };
    case "numbers":
      return { kind, title: "", tiles: [{ value: 0, label: "" }, { value: 0, label: "" }] };
    case "table":
      return { kind, title: "", columns: ["", ""], rows: [["", ""]] };
  }
}

/** False for a graph with no rows, points or tiles yet (the preview leaves it out). */
export function hasData(raw: Chart): boolean {
  const c = asChart(raw);
  switch (c.kind) {
    case "scatter":
      return c.points.length > 0;
    case "numbers":
      return c.tiles.length > 0;
    case "table":
      return c.columns.length > 0 && c.rows.length > 0;
    default:
      return c.rows.length > 0;
  }
}

/* ---------------- Words and numbers ---------------- */

/**
 * Every piece of text the graph puts on the page that the person wrote: title, axis titles,
 * unit, series names, row labels, tile labels, table headings and cells. For the 200-word cap
 * (decision 0009). The "lower is better" and protected-numbers notes are ours, so not counted.
 */
export function chartTexts(raw: Chart): string[] {
  const c = asChart(raw);
  const unit = "protect" in c && c.protect ? "" : ("unit" in c ? (c.unit ?? "") : "");
  switch (c.kind) {
    case "beforeAfter":
      return [c.title, c.beforeLabel, c.afterLabel, unit, ...c.rows.map((r) => r.label)];
    case "bar":
      return [c.title, c.xTitle ?? "", c.yTitle ?? "", unit, ...c.rows.map((r) => r.label)];
    case "groupedBar":
    case "stackedBar":
    case "line":
      return [c.title, c.xTitle ?? "", c.yTitle ?? "", unit, ...c.series, ...c.rows.map((r) => r.label)];
    case "scatter":
      return [c.title, c.xTitle, c.yTitle, c.xUnit ?? "", c.unit ?? "", ...c.points.map((p) => p.label ?? "")];
    case "numbers":
      return [c.title, ...c.tiles.flatMap((t) => [t.label, t.unit ?? ""])];
    case "table":
      return [c.title, ...c.columns, ...c.rows.flat()];
  }
}

/** Every value the graph plots, for the number check (lib/exhbt/verify.ts). Table cells are text, so they're in chartTexts. */
export function chartValues(raw: Chart): number[] {
  const c = asChart(raw);
  switch (c.kind) {
    case "beforeAfter":
      return c.rows.flatMap((r) => [r.before, r.after]);
    case "bar":
      return c.rows.map((r) => r.value);
    case "groupedBar":
    case "stackedBar":
    case "line":
      return c.rows.flatMap((r) => r.values);
    case "scatter":
      return c.points.flatMap((p) => [p.x, p.y]);
    case "numbers":
      return c.tiles.flatMap((t) => (t.from === undefined ? [t.value] : [t.from, t.value]));
    case "table":
      return [];
  }
}

/* ---------------- Publishing checks ---------------- */

type Issue = { path: string; message: string };

/**
 * What stops a graph being published, each with a path the editor can point at. `p` is where the
 * graph sits in the doc ("sections.1.chart"), so an issue reads "sections.1.chart.rows.2.label".
 */
export function chartIssues(raw: Chart, p: string): Issue[] {
  const c = asChart(raw);
  const L = CHART_LIMITS;
  const out: Issue[] = [];
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) out.push({ path, message });
  };
  const count = (n: number, lim: { min: number; max: number }, path: string, message: string) => need(n >= lim.min && n <= lim.max, path, message);
  const short = (s: string | undefined, path: string) => need((s ?? "").length <= L.labelChars, path, `Keep this to ${L.labelChars} characters.`);
  const named = (s: string, path: string, message: string) => {
    need(s.trim().length > 0, path, message);
    short(s, path);
  };
  const numbers = (vs: number[], path: string) => need(vs.every(Number.isFinite), path, "Every value must be a number.");

  need(c.title.trim().length > 0, `${p}.title`, "Give the graph a title.");
  need(c.title.length <= L.titleChars, `${p}.title`, `Keep the graph's title to ${L.titleChars} characters.`);
  if ("xTitle" in c) short(c.xTitle, `${p}.xTitle`);
  if ("yTitle" in c) short(c.yTitle, `${p}.yTitle`);

  switch (c.kind) {
    case "beforeAfter":
      count(c.rows.length, L.beforeAfter.rows, `${p}.rows`, `A before-and-after graph has ${L.beforeAfter.rows.min} to ${L.beforeAfter.rows.max} rows.`);
      numbers(c.rows.flatMap((r) => [r.before, r.after]), `${p}.rows`);
      c.rows.forEach((r, j) => short(r.label, `${p}.rows.${j}.label`));
      short(c.beforeLabel, `${p}.beforeLabel`);
      short(c.afterLabel, `${p}.afterLabel`);
      break;
    case "bar":
      count(c.rows.length, L.bar.rows, `${p}.rows`, `A bar graph has ${L.bar.rows.min} to ${L.bar.rows.max} bars.`);
      c.rows.forEach((r, j) => named(r.label, `${p}.rows.${j}.label`, "Name this bar or remove it."));
      numbers(c.rows.map((r) => r.value), `${p}.rows`);
      break;
    case "groupedBar":
    case "stackedBar":
    case "line": {
      const lim = L[c.kind];
      const what = c.kind === "line" ? "lines" : "series";
      count(c.series.length, lim.series, `${p}.series`, lim.series.min === 1 ? `Up to ${lim.series.max} lines.` : `This graph needs ${lim.series.min} to ${lim.series.max} ${what}.`);
      c.series.forEach((s, k) => named(s, `${p}.series.${k}`, c.kind === "line" && c.series.length === 1 ? "Say what the line shows." : "Name this series or remove it."));
      const rowsMsg =
        c.kind === "line"
          ? `A line graph has ${lim.rows.min} to ${lim.rows.max} points.`
          : c.kind === "groupedBar"
            ? `Up to ${lim.rows.max} groups of bars.`
            : `Up to ${lim.rows.max} bars.`;
      count(c.rows.length, lim.rows, `${p}.rows`, rowsMsg);
      c.rows.forEach((r, j) => {
        named(r.label, `${p}.rows.${j}.label`, c.kind === "line" ? "Name this point (e.g. Week 1) or remove it." : "Name this row or remove it.");
        need(r.values.length === c.series.length, `${p}.rows.${j}`, "Fill in a value for every series.");
        if (c.kind === "stackedBar") need(r.values.every((v) => v >= 0), `${p}.rows.${j}`, "Stacked bars can't have parts below 0.");
      });
      numbers(c.rows.flatMap((r) => r.values), `${p}.rows`);
      break;
    }
    case "scatter":
      named(c.xTitle, `${p}.xTitle`, "Say what the across axis measures.");
      named(c.yTitle, `${p}.yTitle`, "Say what the up axis measures.");
      count(c.points.length, L.scatter.points, `${p}.points`, `A scatter graph has ${L.scatter.points.min} to ${L.scatter.points.max} points.`);
      c.points.forEach((pt, j) => short(pt.label, `${p}.points.${j}.label`));
      numbers(c.points.flatMap((pt) => [pt.x, pt.y]), `${p}.points`);
      break;
    case "numbers":
      count(c.tiles.length, L.numbers.tiles, `${p}.tiles`, `Show ${L.numbers.tiles.min} to ${L.numbers.tiles.max} numbers.`);
      c.tiles.forEach((t, j) => named(t.label, `${p}.tiles.${j}.label`, "Say what this number is."));
      numbers(c.tiles.flatMap((t) => [t.value, t.from ?? 0]), `${p}.tiles`);
      break;
    case "table":
      count(c.columns.length, L.table.columns, `${p}.columns`, `A table has ${L.table.columns.min} to ${L.table.columns.max} columns.`);
      c.columns.forEach((h, k) => named(h, `${p}.columns.${k}`, "Give this column a heading."));
      count(c.rows.length, L.table.rows, `${p}.rows`, `A table has ${L.table.rows.min} to ${L.table.rows.max} rows.`);
      c.rows.forEach((r, j) => {
        need(r.length === c.columns.length, `${p}.rows.${j}`, "Fill in every column of this row.");
        need(r.some((cell) => cell.trim()), `${p}.rows.${j}`, "Fill in this row or remove it.");
        r.forEach((cell, k) => short(cell, `${p}.rows.${j}.${k}`));
      });
      break;
  }

  if ("protect" in c && c.protect) {
    need(protectModes(c.kind).includes(c.protect), `${p}.protect`, "This kind of graph can't hide its numbers that way.");
    need(baselines(c).every((b) => b > 0), `${p}.protect`, "To protect the numbers, every starting value must be above 0.");
  }
  return out;
}

/* ---------------- Protecting the real numbers ---------------- */

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * The starting values everything is measured from: each row's before value; the first bar; each
 * group's first bar; each line's first point; the first stacked bar's total.
 */
function baselines(c: Chart): number[] {
  switch (c.kind) {
    case "beforeAfter":
      return c.rows.map((r) => r.before);
    case "bar":
      return c.rows.length ? [c.rows[0]!.value] : [];
    case "groupedBar":
      return c.rows.map((r) => r.values[0] ?? 0);
    case "line":
      return c.series.map((_, k) => c.rows[0]?.values[k] ?? 0);
    case "stackedBar":
      return c.rows.length ? [c.rows[0]!.values.reduce((a, b) => a + b, 0)] : [];
    default:
      return [];
  }
}

/** v as an index of base (base = 100), to one decimal place; 0 when there's no usable base. */
const index = (v: number, base: number) => (base > 0 && Number.isFinite(v) ? round1((v / base) * 100) : 0);

/**
 * A protected graph with every value as an index (each starting value = 100) and no unit. The
 * same again for a graph already indexed (its starting values are 100), so the live copy reads
 * the same as the draft. Graphs that aren't protected come back as they are.
 */
export function indexed(raw: Chart): Chart {
  const c = asChart(raw);
  if (!("protect" in c) || !c.protect) return c;
  const bases = baselines(c);
  switch (c.kind) {
    case "beforeAfter":
      return noUnit({ ...c, rows: c.rows.map((r) => ({ ...r, before: r.before > 0 ? 100 : 0, after: index(r.after, r.before) })) });
    case "bar":
      return noUnit({ ...c, rows: c.rows.map((r) => ({ ...r, value: index(r.value, bases[0] ?? 0) })) });
    case "groupedBar":
      return noUnit({ ...c, rows: c.rows.map((r, j) => ({ ...r, values: r.values.map((v) => index(v, bases[j] ?? 0)) })) });
    case "line":
      return noUnit({ ...c, rows: c.rows.map((r) => ({ ...r, values: r.values.map((v, k) => index(v, bases[k] ?? 0)) })) });
    case "stackedBar":
      return noUnit({ ...c, rows: c.rows.map((r) => ({ ...r, values: r.values.map((v) => index(v, bases[0] ?? 0)) })) });
    default:
      return c;
  }
}

/** The same graph without its unit (an index has none). */
function noUnit<T extends { unit?: string }>(c: T): T {
  const out = { ...c };
  delete out.unit;
  return out;
}

/** The graph as it is published: a protected graph keeps only its index, never the figures typed in. */
export const publicChart = (c: Chart): Chart => indexed(c);

/**
 * The values the page shows: as typed; or, when protected, the index, or the change from the
 * start in % (index − 100) with a "%" unit. Drawn and listed in the data table from this.
 */
export function displayed(raw: Chart): Chart {
  const c = asChart(raw);
  if (!("protect" in c) || !c.protect) return c;
  const i = indexed(c);
  if (c.protect === "index") return i;
  const change = (v: number) => round1(v - 100);
  switch (i.kind) {
    case "beforeAfter":
      return { ...i, unit: "%", rows: i.rows.map((r) => ({ ...r, before: change(r.before), after: change(r.after) })) };
    case "bar":
      return { ...i, unit: "%", rows: i.rows.map((r) => ({ ...r, value: change(r.value) })) };
    case "groupedBar":
    case "line":
      return { ...i, unit: "%", rows: i.rows.map((r) => ({ ...r, values: r.values.map(change) })) };
    default:
      return i;
  }
}

/** The line under a protected graph, so nobody reads the index as real figures. */
export function protectNote(raw: Chart): string | null {
  const c = asChart(raw);
  if (!("protect" in c) || !c.protect) return null;
  const from: Record<string, string> = {
    beforeAfter: "each before value",
    bar: "the first bar",
    groupedBar: "the first bar in each group",
    line: "each line's first point",
    stackedBar: "the first bar's total",
  };
  const start = from[c.kind] ?? "the first value";
  return c.protect === "change"
    ? `Shown as the change from ${start}, in %. The real figures aren't shared.`
    : `Shown as an index: ${start} is 100. The real figures aren't shared.`;
}

/* ---------------- Formatting ---------------- */

const NF = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });

/** A number as printed on a graph: as typed, with thousands separators and a real minus sign. */
export const fmtNumber = (v: number): string => `${v < 0 ? "−" : ""}${NF.format(Math.abs(v))}`;

/** A value with its unit: "£1,250", "18%", "4 min". `signed` adds a + to rises (for changes). */
export function fmtValue(v: number, unit?: string, signed = false): string {
  const u = unit?.trim() ?? "";
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  const n = NF.format(Math.abs(v));
  if (!u) return `${sign}${n}`;
  if (/^[£$€]/.test(u)) return `${sign}${u}${n}`;
  return `${sign}${n}${u.length > 1 && /^\p{L}/u.test(u) ? " " : ""}${u}`;
}

/** How a graph prints a value: protected changes get a sign, so a rise reads "+12%". */
export const valueFormatter = (c: Chart) => {
  const unit = "unit" in c ? c.unit : undefined;
  const signed = "protect" in c && c.protect === "change";
  return (v: number) => fmtValue(v, unit, signed);
};

/* ---------------- A short summary, for screen readers ---------------- */

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** One or two sentences describing the graph, for its role="img" label. The data table carries every figure. */
export function chartSummary(raw: Chart): string {
  const c = displayed(raw);
  const f = valueFormatter(c);
  const name = (s: string | undefined, fallback: string) => (s?.trim() ? s.trim() : fallback);
  let s: string;
  switch (c.kind) {
    case "beforeAfter":
      s = `Before and after graph, ${name(c.beforeLabel, "before")} against ${name(c.afterLabel, "after")}. ${c.rows
        .map((r) => `${r.label ? `${r.label}: ` : ""}${f(r.before)} to ${f(r.after)}`)
        .join(". ")}.`;
      break;
    case "bar": {
      if (!c.rows.length) return "Bar graph with no bars yet.";
      const sorted = [...c.rows].sort((a, b) => b.value - a.value);
      const hi = sorted[0]!;
      const lo = sorted[sorted.length - 1]!;
      s = `Bar graph of ${c.rows.length} bars. Highest: ${name(hi.label, "a bar")}, ${f(hi.value)}. Lowest: ${name(lo.label, "a bar")}, ${f(lo.value)}.`;
      break;
    }
    case "groupedBar":
      s = `Grouped bar graph: ${c.rows.length} ${c.rows.length === 1 ? "group" : "groups"} of ${list(c.series.map((x, k) => name(x, `series ${k + 1}`)))}.`;
      break;
    case "stackedBar":
      s = `Stacked bar graph: ${c.rows.length} ${c.rows.length === 1 ? "bar" : "bars"}, each split into ${list(c.series.map((x, k) => name(x, `part ${k + 1}`)))}.`;
      break;
    case "line": {
      const first = c.rows[0];
      const last = c.rows[c.rows.length - 1];
      const over = first && last ? `, from ${name(first.label, "the start")} to ${name(last.label, "the end")}` : "";
      const moves = first && last ? c.series.map((x, k) => `${name(x, `Line ${k + 1}`)} goes from ${f(first.values[k] ?? 0)} to ${f(last.values[k] ?? 0)}`) : [];
      s = `Line graph of ${c.rows.length} points${over}. ${moves.join(". ")}${moves.length ? "." : ""}`;
      break;
    }
    case "scatter":
      s = `Scatter graph of ${c.points.length} points: ${name(c.yTitle, "the up axis")} against ${name(c.xTitle, "the across axis")}.`;
      break;
    case "numbers":
      s = c.tiles.map((t) => `${fmtValue(t.value, t.unit)} ${t.label}${t.from !== undefined ? `, from ${fmtValue(t.from, t.unit)}` : ""}`).join(". ") + ".";
      break;
    case "table":
      s = `Table of ${c.rows.length} rows.`;
      break;
  }
  const note = protectNote(raw);
  return note ? `${s} ${note}` : s;
}

/* ---------------- Switching kinds ---------------- */

/** A graph's data as columns of numbers with a label per row: what the kinds have in common. */
type Grid = { names: string[]; rows: { label: string; values: number[] }[] };

const num = (s: string): number => {
  const v = Number(s.replace(/[,£$€%\s]/g, "").replace(/^−/, "-"));
  return Number.isFinite(v) ? v : 0;
};

function toGrid(c: Chart): Grid {
  switch (c.kind) {
    case "beforeAfter":
      return { names: [c.beforeLabel, c.afterLabel], rows: c.rows.map((r) => ({ label: r.label, values: [r.before, r.after] })) };
    case "bar":
      return { names: [c.yTitle ?? ""], rows: c.rows.map((r) => ({ label: r.label, values: [r.value] })) };
    case "groupedBar":
    case "stackedBar":
    case "line":
      return { names: c.series, rows: c.rows.map((r) => ({ label: r.label, values: r.values })) };
    case "scatter":
      return { names: [c.xTitle, c.yTitle], rows: c.points.map((p) => ({ label: p.label ?? "", values: [p.x, p.y] })) };
    case "numbers": {
      const withFrom = c.tiles.length > 0 && c.tiles.every((t) => t.from !== undefined);
      return {
        names: withFrom ? ["From", "Now"] : [""],
        rows: c.tiles.map((t) => ({ label: t.label, values: withFrom ? [t.from!, t.value] : [t.value] })),
      };
    }
    case "table":
      return { names: c.columns.slice(1), rows: c.rows.map((r) => ({ label: r[0] ?? "", values: r.slice(1).map(num) })) };
  }
}

/**
 * The same graph as another kind, keeping what fits: the title, axis titles and unit, the rows
 * and as many series as the new kind takes. Nothing is invented: a kind that needs more series
 * than there are gets the ones there are, and the publish check asks for the rest.
 */
export function convertChart(raw: Chart, kind: ChartKind): Chart {
  const c = asChart(raw);
  if (c.kind === kind) return c;
  const g = toGrid(c);
  const title = c.title;
  const unit = ("unit" in c ? c.unit : undefined) ?? (c.kind === "numbers" ? c.tiles[0]?.unit : undefined);
  const xTitle = ("xTitle" in c ? c.xTitle : undefined) || undefined;
  const yTitle = ("yTitle" in c ? c.yTitle : undefined) || undefined;
  const lowerIsBetter = "lowerIsBetter" in c ? c.lowerIsBetter : undefined;
  const protect = "protect" in c ? c.protect : undefined;
  const keepProtect = protect && protectModes(kind).includes(protect) ? protect : undefined;
  const optional = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
  const v = (r: Grid["rows"][number], k: number) => r.values[k] ?? 0;

  switch (kind) {
    case "beforeAfter":
      return {
        kind,
        title,
        beforeLabel: g.names[0] || "Before",
        afterLabel: g.names[1] || "After",
        lowerIsBetter: lowerIsBetter ?? false,
        ...optional({ unit, protect: keepProtect }),
        rows: g.rows.slice(0, CHART_LIMITS.beforeAfter.rows.max).map((r) => ({ label: r.label, before: v(r, 0), after: r.values.length > 1 ? v(r, 1) : v(r, 0) })),
      };
    case "bar":
      return {
        kind,
        title,
        ...optional({ xTitle, yTitle: yTitle ?? (g.names.length === 1 ? g.names[0] : undefined), unit, lowerIsBetter, protect: keepProtect }),
        rows: g.rows.slice(0, CHART_LIMITS.bar.rows.max).map((r) => ({ label: r.label, value: v(r, 0) })),
      };
    case "groupedBar":
    case "stackedBar":
    case "line": {
      const lim = CHART_LIMITS[kind];
      const n = Math.max(1, Math.min(lim.series.max, g.names.length));
      const series = Array.from({ length: n }, (_, k) => g.names[k] ?? "");
      return {
        kind,
        title,
        ...optional({ xTitle, yTitle, unit, lowerIsBetter: kind === "stackedBar" ? undefined : lowerIsBetter, protect: kind === "stackedBar" ? (keepProtect === "index" ? "index" : undefined) : keepProtect }),
        series,
        rows: g.rows.slice(0, lim.rows.max).map((r) => ({ label: r.label, values: series.map((_, k) => (kind === "stackedBar" ? Math.max(0, v(r, k)) : v(r, k))) })),
      } as Chart;
    }
    case "scatter":
      return {
        kind,
        title,
        xTitle: xTitle ?? g.names[0] ?? "",
        yTitle: yTitle ?? g.names[1] ?? "",
        ...optional({ unit }),
        points: g.rows.slice(0, CHART_LIMITS.scatter.points.max).map((r) => ({ x: v(r, 0), y: r.values.length > 1 ? v(r, 1) : 0, ...optional({ label: r.label }) })),
      };
    case "numbers":
      return {
        kind,
        title,
        tiles: g.rows.slice(0, CHART_LIMITS.numbers.tiles.max).map((r) =>
          r.values.length > 1 ? { label: r.label, value: v(r, 1), from: v(r, 0), ...optional({ unit }) } : { label: r.label, value: v(r, 0), ...optional({ unit }) },
        ),
      };
    case "table": {
      const cols = Math.min(CHART_LIMITS.table.columns.max, 1 + g.names.length);
      return {
        kind,
        title,
        columns: [xTitle ?? "", ...g.names].slice(0, cols),
        rows: g.rows.slice(0, CHART_LIMITS.table.rows.max).map((r) => [r.label, ...r.values.map((x) => fmtValue(x, unit))].slice(0, cols)),
      };
    }
  }
}
