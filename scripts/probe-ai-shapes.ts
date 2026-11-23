/**
 * Checks every structured answer the app asks the AI for against the real API (decision 0026).
 *
 * The API compiles each answer's JSON schema into a grammar before the model writes a word, and
 * refuses a schema whose grammar is too large ("The compiled grammar is too large..."). Only the
 * real API can say whether a schema fits: the stand-in AI used by the tests never compiles one.
 * So this sends each schema exactly as the app does (each module exports its output_config), with
 * a one-line prompt and a tiny max_tokens, and reports accepted or refused with the API's message.
 * A few pence a year: the answers are cut off after a handful of tokens.
 *
 *   npm run probe:ai               # every shape the app sends, plus "draft with planned growth"
 *   npm run probe:ai -- --dry      # no API calls: the size of each schema only (no key needed)
 *   npm run probe:ai -- --explore  # also the measuring variants (what each construct costs)
 *
 * Exits non-zero if any shape the app sends, or the planned-growth check, is refused. Explore
 * variants are measurements and never fail the run. Never prints the key or the environment.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { DRAFT_OUTPUT_CONFIG, DraftSchema } from "@/lib/ai/exhbt-draft";
import { rewriteOutputConfig } from "@/lib/ai/exhbt-rewrite";
import { FIGURE_PICK_OUTPUT_CONFIG } from "@/lib/ai/figure-pick";
import { JOB_MATCH_OUTPUT_CONFIG } from "@/lib/ai/job-match";
import { INTRO_OUTPUT_CONFIG } from "@/lib/ai/portfolio-intro";
import { IDEAS_OUTPUT_CONFIG, SWAP_OUTPUT_CONFIG } from "@/lib/ai/projects";
import { ROADMAP_OUTPUT_CONFIG } from "@/lib/ai/roadmap";
import { AI_MODEL, anthropicApiKey } from "@/lib/ai/model";

type Json = Record<string, unknown>;
type OutputConfig = { effort: "low" | "medium" | "high"; format: { type: "json_schema"; schema: Json } };
type Shape = { name: string; config: OutputConfig; kind: "app" | "growth" | "explore" };

const cfg = (c: { effort: "low"; format: { type: "json_schema"; schema: Json } }): OutputConfig => ({ effort: c.effort, format: { type: "json_schema", schema: c.format.schema } });

/** Every structured answer the app asks for, as the app sends it. */
const APP_SHAPES: Shape[] = [
  { name: "draft", config: cfg(DRAFT_OUTPUT_CONFIG), kind: "app" },
  ...(["header", "gap", "flow", "findings", "skills"] as const).map((b) => ({ name: `rewrite: ${b}`, config: cfg(rewriteOutputConfig(b)), kind: "app" as const })),
  { name: "figure pick", config: cfg(FIGURE_PICK_OUTPUT_CONFIG), kind: "app" },
  { name: "job match", config: cfg(JOB_MATCH_OUTPUT_CONFIG), kind: "app" },
  { name: "portfolio intro", config: cfg(INTRO_OUTPUT_CONFIG), kind: "app" },
  { name: "project ideas", config: cfg(IDEAS_OUTPUT_CONFIG), kind: "app" },
  { name: "project swap", config: cfg(SWAP_OUTPUT_CONFIG), kind: "app" },
  { name: "roadmap", config: cfg(ROADMAP_OUTPUT_CONFIG), kind: "app" },
];

/**
 * The draft as it will be once the work already built has landed, so a release can't take the
 * schema over the limit unseen: release 2's formatReason (8 values), and release 4's 7 layouts,
 * a pull quote, a "my role" line and a before/after mark on each image.
 */
const PlannedGrowth = (DraftSchema as unknown as z.ZodObject<z.ZodRawShape>).extend({
  format: z.enum(["case-study", "gallery", "research", "r4-a", "r4-b", "r4-c", "r4-d"]),
  formatReason: z.enum(["notes", "aim-results", "hypothesis-results", "study", "visual-work", "mostly-pictures", "question-findings", "default"]),
  pullQuote: z.string(),
  myRole: z.string(),
  imageMarks: z.array(z.object({ file: z.string(), mark: z.enum(["none", "before", "after"]) })),
});
const GROWTH: Shape = { name: "draft with planned growth", config: cfg({ effort: "low", format: zodOutputFormat(PlannedGrowth) }), kind: "growth" };

// ---------------------------------------------------------------------------------------------
// Schema surgery for the explore variants. They work on the JSON schema the app sends.

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const isNullType = (s: unknown) => typeof s === "object" && s !== null && (s as Json).type === "null";
/** Nullable as the SDK sends it: `type: [X, "null"]`, or `anyOf: [X, {type: "null"}]` for an object. */
const isNullable = (node: Json) => (Array.isArray(node.type) && node.type.includes("null")) || Boolean((node.anyOf as Json[] | undefined)?.some(isNullType));

/** Walks every sub-schema, parents first. `path` names object properties as a.b[].c */
function walk(s: unknown, fn: (node: Json, path: string) => void, path = ""): void {
  if (typeof s !== "object" || s === null) return;
  const node = s as Json;
  fn(node, path);
  for (const [k, v] of Object.entries((node.properties as Json) ?? {})) walk(v, fn, path ? `${path}.${k}` : k);
  if (node.items) walk(node.items, fn, `${path}[]`);
  for (const alt of (node.anyOf as unknown[]) ?? []) walk(alt, fn, path);
  for (const def of Object.values((node.$defs as Json) ?? {})) walk(def, fn, `$def`);
}

/** Makes nullable sub-schemas non-null at the given paths (all paths when `only` is omitted). */
function denull(schema: Json, only?: (path: string) => boolean): Json {
  const out = clone(schema);
  walk(out, (node, path) => {
    if (!isNullable(node) || (only && !only(path))) return;
    if (Array.isArray(node.type)) {
      const rest = node.type.filter((t) => t !== "null");
      node.type = rest.length === 1 ? rest[0] : rest;
      return;
    }
    const keep = (node.anyOf as Json[]).find((a) => !isNullType(a))!;
    delete node.anyOf;
    Object.assign(node, keep);
  });
  return out;
}

/**
 * The SDK (1.6) moves an enum into the description ("{enum: [...]}"), so no enum reaches the
 * grammar. This puts them back as real enums, to see what they would cost if a later SDK sent them.
 */
function realEnums(schema: Json): Json {
  const out = clone(schema);
  walk(out, (node) => {
    const m = typeof node.description === "string" ? /^\{enum: (\[.*\])\}$/.exec(node.description) : null;
    if (!m) return;
    node.enum = JSON.parse(m[1]!) as string[];
    delete node.description;
  });
  return out;
}

/** The object at `path` without the named properties. */
function without(schema: Json, names: string[], path = ""): Json {
  const out = clone(schema);
  walk(out, (node, p) => {
    if (p !== path || node.type !== "object" || !node.properties) return;
    for (const n of names) delete (node.properties as Json)[n];
    node.required = ((node.required as string[]) ?? []).filter((r) => !names.includes(r));
  });
  return out;
}

/** Adds n extra fields of the given JSON schema to the object at `path`, to measure what one more field costs. */
function plus(schema: Json, n: number, field: Json, tag: string, path = ""): Json {
  const out = clone(schema);
  walk(out, (node, p) => {
    if (p !== path || node.type !== "object" || !node.properties) return;
    for (let i = 0; i < n; i++) {
      (node.properties as Json)[`${tag}${i}`] = clone(field);
      (node.required as string[]).push(`${tag}${i}`);
    }
  });
  return out;
}

const STR = { type: "string" };
const NSTR = { type: ["string", "null"] };

/**
 * A candidate answer shape under test: no nullable anywhere (empty string, empty list or false
 * instead), the quote a flat object of empty strings, and one row type for every chart kind
 * (scatter points and number tiles become rows: values [x, y] or [value, from], with a unit).
 */
const CandChart = z.object({
  kind: z.enum(["beforeAfter", "bar", "groupedBar", "stackedBar", "line", "scatter", "numbers", "table"]),
  title: z.string(),
  xTitle: z.string(),
  yTitle: z.string(),
  unit: z.string(),
  lowerIsBetter: z.boolean(),
  series: z.array(z.string()),
  rows: z.array(z.object({ label: z.string(), values: z.array(z.number()), unit: z.string() })),
  columns: z.array(z.string()),
  cells: z.array(z.array(z.string())),
});
const Cand = (DraftSchema as unknown as z.ZodObject<z.ZodRawShape>).extend({
  flow: z.array(z.object({ step: z.string(), detail: z.string() })),
  charts: z.array(CandChart),
  quote: z.object({ text: z.string(), name: z.string(), role: z.string() }),
});
const CandGrowth = Cand.extend(PlannedGrowth.shape).extend({ flow: Cand.shape.flow, charts: Cand.shape.charts, quote: Cand.shape.quote });

function exploreShapes(): Shape[] {
  const draft = DRAFT_OUTPUT_CONFIG.format.schema as Json;
  const cand = zodOutputFormat(Cand).schema as Json;
  const candGrowth = zodOutputFormat(CandGrowth).schema as Json;
  const v = (name: string, schema: Json): Shape => ({ name: `explore: ${name}`, config: { effort: "low", format: { type: "json_schema", schema } }, kind: "explore" });
  const added17Nov = ["format", "aim", "aimIsHypothesis", "conclusion", "references"];
  const nov16 = without(draft, added17Nov);
  const LADDER = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const PAIR = { type: "array", items: { type: "object", properties: { a: STR, b: STR }, additionalProperties: false, required: ["a", "b"] } };
  const NEST = (n: number) => ({ type: "object", properties: Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${i}`, STR])), additionalProperties: false, required: Array.from({ length: n }, (_, i) => `s${i}`) });
  const addObj = (schema: Json, name: string, obj: Json) => {
    const out = clone(schema);
    (out.properties as Json)[name] = obj;
    (out.required as string[]).push(name);
    return out;
  };
  // Research-only fields grouped in one object: does the width of one object drive the cost?
  const research = ["aim", "aimIsHypothesis", "conclusion", "references"];
  const grouped = (schema: Json) => {
    const props = schema.properties as Json;
    const inner = { type: "object", properties: Object.fromEntries(research.map((k) => [k, props[k]])), additionalProperties: false, required: research };
    return addObj(without(schema, research), "research", inner);
  };
  const flatQuote = (schema: Json) => plus(without(schema, ["quote"]), 3, STR, "quote");
  const noCells = (schema: Json) => without(schema, ["cells"], "charts[]");
  // Every plain string in the schema as a $ref to one shared definition: does reuse shrink the grammar?
  const refStrings = (schema: Json) => {
    const out = clone(schema);
    walk(out, (node) => {
      if (node.type === "string" && Object.keys(node).length === 1) {
        delete node.type;
        node.$ref = "#/$defs/str";
      }
    });
    out.$defs = { ...((out.$defs as Json) ?? {}), str: { type: "string" } };
    return out;
  };
  const REF = { $ref: "#/$defs/str" };
  const withStrDef = (schema: Json) => ({ ...clone(schema), $defs: { str: { type: "string" } } });
  const lean = (schema: Json) => without(without(schema, ["columns"], "charts[]"), ["unit"], "charts[].rows[]");
  const L2 = [4, 8, 12, 16, 24, 32];
  return [
    ...[4, 8, 12].map((n) => v(`candidate + ${n} numbers`, plus(cand, n, { type: "number" }, "x"))),
    ...[4, 8, 12, 16].map((n) => v(`candidate + ${n} booleans`, plus(cand, n, { type: "boolean" }, "b"))),
    ...[8, 16, 32, 64].map((n) => v(`candidate + ${n} strings as one shared $ref`, plus(withStrDef(cand), n, REF, "s"))),
    ...[0, 8, 16, 32].map((n) => v(`candidate, every string a shared $ref, + ${n} more`, plus(refStrings(cand), n, REF, "s"))),
    ...L2.map((n) => v(`lean growth (no columns, no row unit) + ${n} strings`, plus(lean(candGrowth), n, STR, "s"))),
  ];
}

// ---------------------------------------------------------------------------------------------
// Sizes, so a refusal can be read against what grew.

function size(schema: Json) {
  let nullable = 0;
  let enums = 0;
  let objects = 0;
  let arrays = 0;
  let fields = 0;
  walk(schema, (node) => {
    if (isNullable(node)) nullable++;
    if (Array.isArray(node.enum) || (typeof node.description === "string" && node.description.startsWith("{enum:"))) enums++;
    if (node.type === "object") {
      objects++;
      fields += Object.keys((node.properties as Json) ?? {}).length;
    }
    if (node.type === "array") arrays++;
  });
  return { chars: JSON.stringify(schema).length, fields, objects, arrays, nullable, enums };
}

// ---------------------------------------------------------------------------------------------

type Outcome = { shape: Shape; ok: boolean; message: string };

async function probe(client: Anthropic, shape: Shape): Promise<Outcome> {
  try {
    const r = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 64,
      output_config: shape.config,
      messages: [{ role: "user", content: "Answer with any valid value." }],
    });
    return { shape, ok: true, message: `stop_reason ${r.stop_reason}` };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const body = e.error as { error?: { message?: string } } | undefined;
      return { shape, ok: false, message: `${e.status}: ${body?.error?.message ?? e.message}` };
    }
    return { shape, ok: false, message: `not sent: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const explore = argv.includes("--explore");
  const shapes = [...APP_SHAPES, GROWTH, ...(explore ? exploreShapes() : [])];

  if (dry) {
    for (const s of shapes) console.log(`${s.name.padEnd(80)} ${JSON.stringify(size(s.config.format.schema))}`);
    return;
  }
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    console.error("No API key: set ANTHROPIC_API_KEYS or ANTHROPIC_API_KEY, or run with --dry.");
    process.exit(2);
  }
  // Retries only for rate limits and server errors; a 400 is the answer we are here for.
  const client = new Anthropic({ apiKey, maxRetries: 3 });
  const results: Outcome[] = [];
  const queue = [...shapes];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) results.push(await probe(client, s));
    }),
  );
  results.sort((a, b) => shapes.indexOf(a.shape) - shapes.indexOf(b.shape));
  for (const r of results) {
    const sz = size(r.shape.config.format.schema);
    console.log(`${r.ok ? "ACCEPTED" : "REFUSED "}  ${r.shape.name}  [${sz.chars} chars, ${sz.fields} fields, ${sz.nullable} nullable, ${sz.enums} enums]  ${r.ok ? r.message : `\n          ${r.message}`}`);
  }
  const failed = results.filter((r) => !r.ok && r.shape.kind !== "explore");
  console.log(failed.length ? `\n${failed.length} shape(s) refused: ${failed.map((r) => r.shape.name).join(", ")}` : "\nEvery shape the app sends was accepted.");
  if (failed.length) process.exit(1);
}

void main();
