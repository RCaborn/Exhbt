/**
 * Checks every structured answer the app asks the AI for against the real API (decision 0029).
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
 *   npm run probe:ai -- --warn-unchecked  # only a definite refusal fails
 *
 * Every form but --dry calls the real API and is paid for. Nothing runs this script automatically:
 * no push, pull request, deploy or schedule. It is run by hand (.github/workflows/ai-shapes.yml,
 * or here), with the owner's say-so, the cost stated first (decision 0029).
 *
 * Exits non-zero if any shape the app sends, or the planned-growth check, is refused. A shape that
 * couldn't be checked (no key, the service unreachable, a rate limit) also fails, unless
 * --warn-unchecked is given: then it prints a GitHub warning and passes, while a refused shape
 * always fails. Explore variants are measurements and never fail the run. Never prints the key or
 * the environment.
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
import { DRAFT_BLOCKS } from "@/lib/exhbt/draft-blocks";
import { LAYOUT_REASONS } from "@/lib/exhbt/drafted";
import { FORMATS } from "@/lib/exhbt/formats";

type Json = Record<string, unknown>;
type OutputConfig = { effort: "low" | "medium" | "high"; format: { type: "json_schema"; schema: Json } };
type Shape = { name: string; config: OutputConfig; kind: "app" | "growth" | "explore" };

const cfg = (c: { effort: "low"; format: { type: "json_schema"; schema: Json } }): OutputConfig => ({ effort: c.effort, format: { type: "json_schema", schema: c.format.schema } });

/** Every structured answer the app asks for, as the app sends it. */
const APP_SHAPES: Shape[] = [
  { name: "draft", config: cfg(DRAFT_OUTPUT_CONFIG), kind: "app" },
  ...DRAFT_BLOCKS.map((b) => ({ name: `rewrite: ${b}`, config: cfg(rewriteOutputConfig(b)), kind: "app" as const })),
  { name: "figure pick", config: cfg(FIGURE_PICK_OUTPUT_CONFIG), kind: "app" },
  { name: "job match", config: cfg(JOB_MATCH_OUTPUT_CONFIG), kind: "app" },
  { name: "portfolio intro", config: cfg(INTRO_OUTPUT_CONFIG), kind: "app" },
  { name: "project ideas", config: cfg(IDEAS_OUTPUT_CONFIG), kind: "app" },
  { name: "project swap", config: cfg(SWAP_OUTPUT_CONFIG), kind: "app" },
  { name: "roadmap", config: cfg(ROADMAP_OUTPUT_CONFIG), kind: "app" },
];

/**
 * The draft as it will be once the work already built or decided has landed, so a release can't
 * take the schema over the limit unseen. Release 2's formatReason is in the real schema now; on
 * top of it, release 4 (decision 0028) lets the draft choose any of the 7 layouts (FORMATS) and
 * adds: a fixed reason for each new layout, so about 12 reasons; a pull quote and a "my role"
 * line; an essay's sources, each a citation with an optional address (kept apart from research's
 * references here, the larger case); and the demo and code links of a build, each with a label,
 * an address and a short description. Before and After marks on images are never drafted (0028),
 * so they are not here.
 * Release 4's own schema isn't on a branch yet, so its field names and new reasons here are stand-ins.
 */
const PlannedGrowth = (DraftSchema as unknown as z.ZodObject<z.ZodRawShape>).extend({
  format: z.enum(FORMATS),
  formatReason: z.enum([...LAYOUT_REASONS, "built-thing", "argument-sources", "before-and-after", "event-role"]),
  pullQuote: z.string(),
  myRole: z.string(),
  sources: z.array(z.object({ label: z.string(), url: z.string() })),
  links: z.array(z.object({ label: z.string(), url: z.string(), description: z.string() })),
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
 * Measurements, not checks: how many more fields fit on top of the draft and of the planned
 * growth (decision 0029 has the numbers). A rung that flips from accepted to refused places the limit.
 */
function exploreShapes(): Shape[] {
  const draft = DRAFT_OUTPUT_CONFIG.format.schema as Json;
  const growth = GROWTH.config.format.schema;
  const v = (name: string, schema: Json): Shape => ({ name: `explore: ${name}`, config: { effort: "low", format: { type: "json_schema", schema } }, kind: "explore" });
  return [
    ...[4, 8, 12, 16, 20, 24].map((n) => v(`draft + ${n} strings`, plus(draft, n, STR, "s"))),
    ...[1, 2, 4, 8].map((n) => v(`draft + ${n} nullable strings`, plus(draft, n, NSTR, "n"))),
    ...[2, 4, 6, 8, 10, 12, 16].map((n) => v(`draft with planned growth + ${n} strings`, plus(growth, n, STR, "s"))),
    v("draft with planned growth, enums sent as real enums", realEnums(growth)),
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

/** "refused": the API turned the request down (a 400). "unchecked": no answer either way (auth, rate limit, server, network). */
type Outcome = { shape: Shape; ok: boolean; status: "accepted" | "refused" | "unchecked"; message: string };

async function probe(client: Anthropic, shape: Shape): Promise<Outcome> {
  try {
    const r = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 64,
      output_config: shape.config,
      messages: [{ role: "user", content: "Answer with any valid value." }],
    });
    return { shape, ok: true, status: "accepted", message: `stop_reason ${r.stop_reason}` };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const body = e.error as { error?: { message?: string } } | undefined;
      const message = body?.error?.message ?? e.message;
      // Only a 400 about the schema is a refusal of the shape. Any other 400 (no credit, a bad key setting) says
      // nothing about the shape, so it is "unchecked": a run to repeat, not a shape to fix.
      const aboutShape = e.status === 400 && /grammar|schema|union|output_config|output format/i.test(message);
      return { shape, ok: false, status: aboutShape ? "refused" : "unchecked", message: `${e.status}: ${message}` };
    }
    return { shape, ok: false, status: "unchecked", message: `not sent: ${e instanceof Error ? e.message : String(e)}` };
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
  const warnUnchecked = argv.includes("--warn-unchecked");
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    if (warnUnchecked) {
      console.log("::warning::No API key here, so the AI request shapes were not checked.");
      return;
    }
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
    console.log(`${r.status.toUpperCase().padEnd(9)} ${r.shape.name}  [${sz.chars} chars, ${sz.fields} fields, ${sz.nullable} nullable, ${sz.enums} enums]  ${r.ok ? r.message : `\n          ${r.message}`}`);
  }
  const failed = results.filter((r) => !r.ok && r.shape.kind !== "explore");
  const refused = failed.filter((r) => r.status === "refused");
  const unchecked = failed.filter((r) => r.status === "unchecked");
  if (refused.length) console.log(`\n${refused.length} shape(s) refused by the API: ${refused.map((r) => r.shape.name).join(", ")}`);
  if (unchecked.length) console.log(`\n${unchecked.length} shape(s) could not be checked (not a refusal; run again): ${unchecked.map((r) => r.shape.name).join(", ")}`);
  if (!failed.length) console.log("\nEvery shape the app sends was accepted, and the planned growth fits.");
  if (refused.length) process.exit(1);
  if (unchecked.length) {
    if (warnUnchecked) console.log(`::warning::${unchecked.length} AI request shape(s) could not be checked (not a refusal).`);
    else process.exit(1);
  }
}

void main();
