/**
 * Runner for the figure eval (evals/figure-pick/README.md, decision 0025): does the real model
 * choose the right figure in a report, and cut it out whole?
 *
 *   npm run eval:figures                          # real picks (needs ANTHROPIC_API_KEYS or ANTHROPIC_API_KEY)
 *   npm run eval:figures -- --mock                # no key: the app's stand-in, to check the plumbing
 *   npm run eval:figures -- --self-test           # no browser, no calls: the marking, marked
 *   npm run eval:figures -- --truth               # no calls: draws every report's true box, to check the answer key
 *   npm run eval:figures -- --only 04,05          # some reports
 *   npm run eval:figures:crops -- job-log.txt     # redraws every cut in a job log or a results.jsonl, as PNG files
 *
 * It starts the app in development and drives /dev/figure-eval in a real browser (Playwright,
 * evals/figure-pick/figures.eval.ts), so the pages are drawn, chosen, sent, checked and cut by the
 * app's own code. Then it prints one line of JSON per report and exits 1 unless every report passed.
 * A real run never falls back to the stand-in: without a key it stops, and an answer from anything
 * but the model asked for is an error.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { selfTest, selfTestOffice, type EvalCase, type OfficeCase } from "../evals/figure-pick/grade";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey } from "../lib/ai/model";

const ROOT = process.cwd();
const EVAL_DIR = join(ROOT, "evals/figure-pick");
const CONFIG = "evals/figure-pick/playwright.config.ts";

type Mode = "real" | "mock" | "truth" | "redraw";
type Args = { mode: Mode; selfTest: boolean; only: string; redraw: string | null; out: string | null };

function parseArgs(argv: string[]): Args {
  const args: Args = { mode: "real", selfTest: false, only: "", redraw: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--mock") args.mode = "mock";
    else if (a === "--truth") args.mode = "truth";
    else if (a === "--self-test") args.selfTest = true;
    else if (a === "--only") args.only = argv[++i] ?? "";
    else if (a === "--out") args.out = argv[++i] ?? null;
    else if (a === "--redraw") args.mode = "redraw";
    else if (a === "--help" || a === "-h") {
      console.log("Usage: npm run eval:figures -- [--mock | --truth | --self-test] [--only 04,05]\n       npm run eval:figures:crops -- <job log or results.jsonl> [--out <folder>]");
      process.exit(0);
    } else if (args.mode === "redraw" && !a.startsWith("--") && !args.redraw) args.redraw = a;
    else {
      console.error(`Unknown option ${a}. Try --help.`);
      process.exit(1);
    }
  }
  return args;
}

const cases = () => JSON.parse(readFileSync(join(EVAL_DIR, "fixtures/cases.json"), "utf8")) as EvalCase[];
/** The Word, PowerPoint and picture cases, made by fixtures/build-office.mjs. */
const officeCases = () => JSON.parse(readFileSync(join(EVAL_DIR, "fixtures/cases-office.json"), "utf8")) as OfficeCase[];
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

/** Every eval line in a file: a results.jsonl, or a job log with a timestamp before each line. */
function evalLines(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const at = raw.indexOf('{"eval":"figure-pick"');
    if (at < 0) continue;
    try {
      out.push(JSON.parse(raw.slice(at)) as Record<string, unknown>);
    } catch {
      // A line cut short in the log: left out.
    }
  }
  return out;
}

function playwright(env: Record<string, string>, hideKey: boolean): number {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  if (hideKey) {
    // The app must take its stand-in path (or, for the modes that call nothing, hold no key at all).
    delete childEnv.ANTHROPIC_API_KEYS;
    delete childEnv.ANTHROPIC_API_KEY;
  }
  const run = spawnSync("npx", ["playwright", "test", "-c", CONFIG], { cwd: ROOT, env: childEnv, stdio: "inherit" });
  return run.status ?? 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.selfTest) {
    const all = cases();
    const office = officeCases();
    const problems = [...selfTest(all), ...selfTestOffice(office)];
    console.log(`Self-test of the marking on ${all.length} reports and ${office.length} Word, PowerPoint and picture cases (no browser, no API calls):`);
    for (const p of problems) console.log(`  ${p}`);
    console.log(problems.length ? "Self-test failed: fix the marking before trusting a run." : "Self-test passed: a perfect answer passes every report, and each kind of wrong answer does not.");
    process.exit(problems.length ? 1 : 0);
  }

  if (args.mode === "redraw") {
    if (!args.redraw || !existsSync(args.redraw)) {
      console.error("Give the job log or results.jsonl to redraw: npm run eval:figures:crops -- <file>");
      process.exit(1);
    }
    const lines = evalLines(readFileSync(args.redraw, "utf8"));
    if (!lines.length) {
      console.error(`No figure eval lines in ${args.redraw}. They start {"eval":"figure-pick".`);
      process.exit(1);
    }
    const runDir = args.out ?? join(EVAL_DIR, "runs", `${stamp()}-redraw`);
    mkdirSync(runDir, { recursive: true });
    const file = join(runDir, "lines.json");
    writeFileSync(file, JSON.stringify(lines));
    const status = playwright({ FIGURE_EVAL_MODE: "redraw", FIGURE_EVAL_RUN_DIR: runDir, FIGURE_EVAL_LINES: file }, true);
    const drawn = lines.filter((l) => l.page && l.cut).length;
    console.log(status === 0 ? `Redrew ${drawn} cuts from ${lines.length} lines into ${runDir}` : "The redraw failed: see above.");
    process.exit(status);
  }

  if (args.mode === "real" && !anthropicApiKey()) {
    console.error(
      `No Anthropic API key found. Set ${ANTHROPIC_API_KEYS_ENV} (or ANTHROPIC_API_KEY) to run the figure eval with ${AI_MODEL},\n` +
        "or run with --mock to check the plumbing with the app's stand-in, or --self-test to check the marking.",
    );
    process.exit(1);
  }

  const wanted: { id: string }[] = [...cases(), ...officeCases()].filter((c) => !args.only || args.only.split(",").some((o) => c.id === o.trim() || c.id.startsWith(`${o.trim()}-`)));
  if (!wanted.length) {
    console.error("No reports matched.");
    process.exit(1);
  }
  const runDir = args.out ?? join(EVAL_DIR, "runs", `${stamp()}${args.mode === "real" ? "" : `-${args.mode}`}`);
  mkdirSync(runDir, { recursive: true });
  console.log(`Figure eval: ${wanted.length} reports, ${args.mode === "real" ? AI_MODEL : args.mode === "mock" ? "the stand-in (no API calls)" : "the answer key (no API calls)"}`);
  const status = playwright({ FIGURE_EVAL_MODE: args.mode, FIGURE_EVAL_RUN_DIR: runDir, FIGURE_EVAL_ONLY: args.only }, args.mode !== "real");

  if (args.mode === "truth") {
    const file = join(runDir, "truth.jsonl");
    if (existsSync(file)) console.log(readFileSync(file, "utf8").trimEnd());
    console.log(status === 0 ? `\nThe answer key drew: look at the pictures in ${runDir}` : "\nThe answer key has a problem: see above.");
    process.exit(status);
  }

  // One line of JSON per report, whatever the reporter printed above.
  const file = join(runDir, "results.jsonl");
  const lines = existsSync(file) ? evalLines(readFileSync(file, "utf8")) : [];
  console.log("\nFigure eval results, one line per report:");
  for (const l of lines) console.log(JSON.stringify(l));
  const byCase = new Map(lines.map((l) => [String(l.case), l]));
  const missing = wanted.filter((c) => !byCase.has(c.id)).map((c) => c.id);
  const count = (r: string) => lines.filter((l) => l.result === r).length;
  const cost = lines.reduce((n, l) => n + (typeof l.costUsd === "number" ? l.costUsd : 0), 0);
  console.log(
    `\nFigure eval (${args.mode}): ${count("pass")} passed, ${count("fail")} failed, ${count("error")} errors` +
      `${missing.length ? `, ${missing.length} with no result (${missing.join(", ")})` : ""} of ${wanted.length}. Cost $${cost.toFixed(4)}. Pictures and results.jsonl: ${runDir}`,
  );
  for (const l of lines.filter((x) => x.result !== "pass")) console.log(`  ${String(l.result).toUpperCase()} ${String(l.case)}: ${(l.why as string[]).join("; ")}`);

  // The stand-in doesn't look at the pages, so its run can only show that the path works end to end.
  const ok = args.mode === "real" ? missing.length === 0 && count("pass") === wanted.length : missing.length === 0 && count("error") === 0 && status === 0;
  if (args.mode === "mock") console.log(ok ? "The path works end to end. A mock run says nothing about how well the model chooses." : "The path is broken: see above.");
  process.exit(ok ? 0 : 1);
}

main();
