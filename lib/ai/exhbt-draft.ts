import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { LIMITS, SCHEMA_VERSION, text, withHighlight, words, type ExhbtDoc, type Section } from "@/lib/exhbt/blocks";
import { CHART_KINDS, hasData, type Chart } from "@/lib/exhbt/charts";
import { squash } from "@/lib/exhbt/references";
import { normaliseNumber, numbersIn } from "@/lib/exhbt/verify";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

/**
 * Drafts an exhbt from the person's own material (docs/phase-2.md section 6, decision 0007):
 * the text read from their files, their notes and an optional link. The model fills the core
 * and proposes sections (decision 0015) as plain strings; this file turns them into an ExhbtDoc.
 * By default the sections are findings and, when the material has figures, a graph; a second
 * graph, a quote or "what I'd do next" only when the material supports one. Images, links and
 * evidence are not drafted: the person adds them in the editor.
 *
 * Every number must be quoted from the material. The model lists each one with the quote it
 * came from, and lib/exhbt/verify.ts checks the draft against the source text anyway. A quote
 * is kept only when its words and the speaker's name are in the material as written.
 */

const L = LIMITS;
/** Roughly 15-20k tokens of material: enough for a report, and keeps a draft well under a penny. */
export const MAX_MATERIAL_CHARS = 80_000;

const SYSTEM = `You draft "exhbts": short, checked write-ups of a UK student's or graduate's project, read by recruiters in about 30 seconds.

Rules:
- Use only facts in the material you are given (text from their files, their notes, a link they gave). Never invent results, numbers, methods, tools, organisations or dates.
- Every number you write must appear in the material, copied as written there. Do not calculate new figures (no percentage changes, totals or averages the material doesn't state). List every number you used in "numbers", each with "sourceQuote": the exact words from the material that contain it, copied character for character.
- If the material doesn't support a field, leave it empty (empty string or empty list). Do not guess.
- Write for a recruiter's quick read: short, concrete, plain British English. No hype words, no exclamation marks, no first person plural.

Fields:
- title: the question the work set out to answer, written as a question that ends with "?", at most ${L.titleChars} characters, e.g. "Will banks and fintechs cooperate under open banking?". Use the material's own subject and words.
- summary: one sentence, at most ${L.summaryWords} words, on what the work found. It goes on portfolio cards, so it must make sense on its own.
- context: what the work is, at most ${L.contextChars} characters, e.g. "MSc Finance dissertation" or "Year 2 group project". Empty if the material doesn't say.
- whereWhen: where and when it was done, at most ${L.whereWhenChars} characters, e.g. "University of St Andrews, August 2026". Only what the material states; empty if it doesn't say.
- skills: up to ${L.skills.max} skills the material shows being used, each at most ${L.skills.wordsEach} words (e.g. "Python", "Regression analysis").
- gap: the line of context under the question: why it matters, at most ${L.gapWords} words, at most 2 short sentences, e.g. "Open banking makes banks share customer data. Nobody knows whether banks and fintechs will then cooperate or compete."
- gapHighlight: the words in gap that name the gap (what nobody knew or had done), copied exactly from gap, e.g. "Nobody knows whether banks and fintechs will then cooperate or compete." Empty if gap has no such words.
- flow: ${L.flow.min} to ${L.flow.max} steps of the process, in order, each at most ${L.flow.stepWords} words. "detail" is an optional note of at most ${L.flow.detailWords} words (e.g. "14,200 rows"), or null.
- findings: ${L.findings.min} to ${L.findings.max} short bullets of what was found or achieved, each at most ${L.findings.wordsEach} words.
- charts: usually one graph, a second only when the material has a separate set of figures worth one (never more than ${L.charts.max}), only from figures stated in the material, each value copied as written there (no totals, averages or changes you work out). An empty list when the material has no figures worth a graph. Choose the kind that fits the figures:
  - "beforeAfter": one measure before and after a change. series: [what "before" is called, what "after" is called]; rows: ${L.charts.beforeAfter.rows.min} to ${L.charts.beforeAfter.rows.max}, each with values [before, after]. Set lowerIsBetter.
  - "bar": one measure across ${L.charts.bar.rows.min} to ${L.charts.bar.rows.max} categories. rows: each with values [value].
  - "groupedBar": ${L.charts.groupedBar.series.min} to ${L.charts.groupedBar.series.max} series compared across up to ${L.charts.groupedBar.rows.max} groups. series: their names; rows: each with one value per series.
  - "stackedBar": parts that add up to a whole: up to ${L.charts.stackedBar.rows.max} bars of ${L.charts.stackedBar.series.min} to ${L.charts.stackedBar.series.max} parts, none below 0. series: the parts' names.
  - "line": up to ${L.charts.line.series.max} series over an ordered axis such as weeks or months, ${L.charts.line.rows.min} to ${L.charts.line.rows.max} points in order. rows: each point's label and one value per series.
  - "scatter": ${L.charts.scatter.points.min} to ${L.charts.scatter.points.max} pairs of figures, in points; xTitle and yTitle say what each axis measures.
  - "numbers": ${L.charts.numbers.tiles.min} to ${L.charts.numbers.tiles.max} headline figures, in tiles, each with its label, unit and "from" (the starting value, only if the material states one).
  - "table": a small table, up to ${L.charts.table.columns.max} columns and ${L.charts.table.rows.max} rows: columns are the headings, cells the rows of text.
  Fill only the fields the kind uses; leave the rest as empty lists or null. Labels at most ${L.charts.labelChars} characters.
- quote: feedback someone gave on the work (a supervisor, a client, a user), only if the material contains it: "text" copied word for word from the material, at most ${L.quote.words} words; "name" as the material gives it; "role" as the material gives it, or empty. Never write, shorten, join or reword a quote; if the only one is longer than ${L.quote.words} words, or nobody is named, null.
- next: what the person says they would do next or do differently, at most ${L.reflection.words} words, only if the material says so. Empty otherwise.
- In total, aim for about ${L.targetWords} words across everything you write (graph labels, the quote and its name included), and never more than ${L.totalWords}.`;

/**
 * A graph as the model writes it: one flat shape for every kind (structured outputs keep enums
 * but not constant discriminators), turned into the stored kind by toChart. Unused fields are
 * empty lists or null.
 */
const DraftChartSchema = z.object({
  kind: z.enum(CHART_KINDS),
  title: z.string(),
  xTitle: z.string().nullable(),
  yTitle: z.string().nullable(),
  unit: z.string().nullable(),
  lowerIsBetter: z.boolean().nullable(),
  series: z.array(z.string()),
  rows: z.array(z.object({ label: z.string(), values: z.array(z.number()) })),
  points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().nullable() })),
  tiles: z.array(z.object({ value: z.number(), label: z.string(), unit: z.string().nullable(), from: z.number().nullable() })),
  columns: z.array(z.string()),
  cells: z.array(z.array(z.string())),
});
export type DraftChart = z.infer<typeof DraftChartSchema>;

const DraftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  context: z.string(),
  whereWhen: z.string(),
  skills: z.array(z.string()),
  gap: z.string(),
  gapHighlight: z.string(),
  flow: z.array(z.object({ step: z.string(), detail: z.string().nullable() })),
  findings: z.array(z.string()),
  charts: z.array(DraftChartSchema),
  quote: z.object({ text: z.string(), name: z.string(), role: z.string() }).nullable(),
  next: z.string(),
  numbers: z.array(z.object({ value: z.string(), sourceQuote: z.string() })),
});
type Draft = z.infer<typeof DraftSchema>;

export type DraftInput = { text: string; notes?: string; link?: string };
export type DraftNumber = { value: string; sourceQuote: string };
export type DraftResult = {
  doc: ExhbtDoc;
  numbers: DraftNumber[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** Everything the model may draw on, as one string. Also what the numbers are checked against. */
export function materialText({ text, notes, link }: DraftInput): string {
  return [text.trim(), notes?.trim() ? `Notes:\n${notes.trim()}` : "", link?.trim() ? `Link: ${link.trim()}` : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_MATERIAL_CHARS);
}

export async function draftExhbt(input: DraftInput): Promise<DraftResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    // Never hand real people a placeholder draft.
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return mockDraft(input);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(DraftSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `<material>\n${input.text.trim().slice(0, MAX_MATERIAL_CHARS) || "(no files)"}\n</material>`,
          input.notes?.trim() ? `<notes>\n${input.notes.trim()}\n</notes>` : "No notes.",
          input.link?.trim() ? `Link to the work: ${input.link.trim()}` : "No link.",
        ].join("\n\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Exhbt draft failed (stop_reason: ${response.stop_reason})`);
  }
  const { input_tokens, output_tokens } = response.usage;
  const draft = DraftSchema.parse(response.parsed_output);
  return {
    doc: toDoc(draft, materialText(input)),
    numbers: draft.numbers,
    model: response.model,
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    costUsd: costUsd(input_tokens, output_tokens),
  };
}

/** For comparing a quote with the material: one space, straight quotes, no case. */

/**
 * The quote the model proposed, if it's really in the material: its words as written there, and
 * the name too. Anything else is dropped rather than flagged: a quote can't be checked like a
 * number, and an invented one would put words in someone's mouth.
 */
export function quoteFrom(q: Draft["quote"], source: string): { text: string; name: string; role: string } | null {
  if (!q) return null;
  const text = q.text.trim().replace(/^["“‘']+|["”’']+$/g, "").trim();
  const name = q.name.trim();
  const flat = squash(source);
  if (!text || !name || words(text) > L.quote.words || !flat.includes(squash(text)) || !flat.includes(squash(name))) return null;
  const role = q.role.trim();
  return { text, name: name.slice(0, L.quote.nameChars), role: role && flat.includes(squash(role)) ? role.slice(0, L.quote.roleChars) : "" };
}

/**
 * The model's strings as an ExhbtDoc, trimmed to the block counts. Word limits are left to the
 * editor (drafts may run over; publishing may not), but counts are clamped so the layout holds.
 * `source` is the material (materialText), for the quote check.
 */
export function toDoc(d: Draft, source: string): ExhbtDoc {
  const nonEmpty = (s: string) => s.trim().length > 0;
  const findings = d.findings.map((f) => f.trim()).filter(nonEmpty).slice(0, L.findings.max).map(text);
  const charts = d.charts
    .map(toChart)
    .filter((c): c is Chart => c !== null && hasData(c))
    .slice(0, L.charts.max);
  const quote = quoteFrom(d.quote, source);
  const next = d.next.trim();
  // Below the flowchart, in this order (decision 0015): findings, the graphs, the quote, what I'd do next.
  const sections: Section[] = [
    ...(findings.length ? [{ id: "findings", kind: "findings" as const, items: findings }] : []),
    ...charts.map((chart, i) => ({ id: `graph-${i + 1}`, kind: "graph" as const, chart })),
    ...(quote ? [{ id: "quote-1", kind: "quote" as const, ...quote }] : []),
    ...(next ? [{ id: "reflection-1", kind: "reflection" as const, text: text(next) }] : []),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    title: d.title.trim().slice(0, L.titleChars),
    // What it is and where and when sit in the sidebar (decision 0022); the summary goes on portfolio cards.
    context: d.context.trim().slice(0, L.contextChars),
    // Always written, empty or not, so "Back to the AI version" of the header restores them too.
    whereWhen: d.whereWhen.trim().slice(0, L.whereWhenChars),
    summary: d.summary.trim(),
    skills: d.skills.map((s) => s.trim()).filter(nonEmpty).slice(0, L.skills.max),
    // The highlighted gap only when its words are really in the line.
    gap: withHighlight(d.gap, d.gapHighlight),
    flow: d.flow
      .filter((s) => nonEmpty(s.step))
      .slice(0, L.flow.max)
      .map((s) => (s.detail?.trim() ? { step: s.step.trim(), detail: s.detail.trim() } : { step: s.step.trim() })),
    sections,
  };
}

/**
 * One of the model's graphs as a stored graph of its kind, trimmed to the kind's caps. Rows
 * without the values the kind needs are dropped, never filled in. Null when nothing is left.
 */
export function toChart(g: DraftChart): Chart | null {
  const C = L.charts;
  const t = (s: string | null | undefined) => (s ?? "").trim();
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
        lowerIsBetter: g.lowerIsBetter ?? false,
        ...some({ unit: t(g.unit) }),
        rows: kept.map((r) => ({ label: r.label, before: r.values[0]!, after: r.values[1]! })),
      };
    }
    case "bar": {
      const kept = rows.filter((r) => r.values.length >= 1).slice(0, C.bar.rows.max);
      return kept.length ? { kind: "bar", title, ...axes, ...some({ lowerIsBetter: g.lowerIsBetter ?? undefined }), rows: kept.map((r) => ({ label: r.label, value: r.values[0]! })) } : null;
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
      const better = g.kind === "stackedBar" ? {} : some({ lowerIsBetter: g.lowerIsBetter ?? undefined });
      return { kind: g.kind, title, ...axes, ...better, series, rows: kept } as Chart;
    }
    case "scatter": {
      const points = g.points.slice(0, C.scatter.points.max).map((p) => ({ x: p.x, y: p.y, ...some({ label: t(p.label) }) }));
      return points.length ? { kind: "scatter", title, xTitle: t(g.xTitle), yTitle: t(g.yTitle), ...some({ unit: t(g.unit) }), points } : null;
    }
    case "numbers": {
      const tiles = g.tiles
        .filter((x) => t(x.label))
        .slice(0, C.numbers.tiles.max)
        .map((x) => ({ value: x.value, label: t(x.label), ...some({ unit: t(x.unit) }), ...(x.from === null ? {} : { from: x.from }) }));
      return tiles.length ? { kind: "numbers", title, tiles } : null;
    }
    case "table": {
      const columns = g.columns.map(t).slice(0, C.table.columns.max);
      const cells = g.cells
        .slice(0, C.table.rows.max)
        .map((r) => Array.from({ length: columns.length }, (_, k) => t(r[k])))
        .filter((r) => r.some(Boolean));
      return columns.length && cells.length ? { kind: "table", title, columns, rows: cells } : null;
    }
  }
}

/**
 * Local development without an API key: a clearly labelled placeholder built from the
 * material, so the flow (upload, draft, number check, editor) can be tried end to end. Its one
 * finding quotes the material's first sentence, so its numbers are real ones. Its graph is a
 * bar graph (not before/after, so other kinds get exercised too) of the first few figures in
 * the material, as written there, so the number check finds every one. When the notes say
 * "stand-in: add a figure to check", the graph also gets a total it worked out, which the
 * material doesn't state: the mistake the number check exists for, so its flag can be seen
 * without an API key. A sentence in double quotes followed by a name (and ", role") becomes the
 * quote; a sentence starting "Next time" or "If I did this again" becomes what I'd do next.
 */
function mockDraft(input: DraftInput): DraftResult {
  const source = materialText(input).replace(/^File: .*$/gm, "");
  const firstSentence = (source.replace(/\s+/g, " ").match(/[^.!?]{12,}[.!?]/)?.[0] ?? source.slice(0, 120)).trim();
  const quote = firstSentence.split(" ").slice(0, L.findings.wordsEach).join(" ");
  const numbers = numbersIn(quote).map((value) => ({ value, sourceQuote: quote }));
  const figures = [...new Set(numbersIn(source).map(normaliseNumber).filter((v): v is string => v !== null))].slice(0, 4).map(Number);
  // No digits in the labels: they'd be numbers the material doesn't have.
  const names = ["First figure", "Second figure", "Third figure", "Fourth figure"];
  const rows = figures.map((v, i) => ({ label: names[i]!, values: [v] }));
  if (/stand-in: add a figure to check/i.test(input.notes ?? "")) rows.push({ label: "Worked-out total", values: [Math.round(figures.reduce((a, b) => a + b, 0) * 10) / 10] });
  // Feedback in the material: "…" Priya Shah, Cafe manager. (dashes and a comma before the name are fine).
  const q = source.match(/["“]([^"”]{8,400})["”]\s*(?:[-–—,]\s*)?((?:[A-Z][\w'’-]+)(?:\s[A-Z][\w'’-]+){0,3})(?:,\s*([^.\n]{2,60}))?/);
  const feedback = q ? { text: q[1]!.trim(), name: q[2]!.trim(), role: (q[3] ?? "").trim() } : null;
  const next = source.replace(/\s+/g, " ").match(/(?:^|[.!?]\s+)((?:Next time|If I did (?:this|it) again)[^.!?]{3,}[.!?])/i)?.[1]?.split(" ").slice(0, L.reflection.words).join(" ") ?? "";
  const charts: DraftChart[] =
    figures.length >= 2
      ? [
          {
            kind: "bar",
            title: "Placeholder graph: figures from your files",
            xTitle: null,
            yTitle: null,
            unit: null,
            lowerIsBetter: null,
            series: [],
            rows,
            points: [],
            tiles: [],
            columns: [],
            cells: [],
          },
        ]
      : [];
  return {
    model: "mock",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    numbers,
    doc: toDoc({
      title: "Development preview: what would the AI draft from your files?",
      summary: "A placeholder draft, made without an API key.",
      context: "Placeholder: what the work is",
      whereWhen: "Placeholder: where and when",
      skills: ["Placeholder skill"],
      gap: `No API key is configured, so this draft is placeholder text. Set ${ANTHROPIC_API_KEYS_ENV} to draft from your files.`,
      gapHighlight: "this draft is placeholder text",
      flow: [
        { step: "Read the material", detail: null },
        { step: "Drafted the blocks", detail: null },
        { step: "Checked every number", detail: null },
      ],
      findings: [quote, "This finding is a placeholder."],
      charts,
      quote: feedback,
      next,
      numbers,
    }, materialText(input)),
  };
}
