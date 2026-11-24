#!/usr/bin/env node
// A short account of a Playwright run, from its JSON report, for a job's log:
//   node scripts/e2e-summary.mjs test-results/webkit.json
// The WebKit job (.github/workflows/webkit.yml) ends with it, because its log is all that a machine
// without WebKit sees of the run: the totals, the time each spec took, every failure grouped by the
// line it failed on with the error once, the tests that passed only on a retry, the tests that never
// ran, and the page errors the tests heard (e2e/page-editor.ts, hear). It always exits 0.
import fs from "node:fs";

const file = process.argv[2] ?? "test-results/webkit.json";
if (!fs.existsSync(file)) {
  console.log(`== e2e summary: no report at ${file} (the run did not get as far as writing one)`);
  process.exit(0);
}
const report = JSON.parse(fs.readFileSync(file, "utf8"));

const plain = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, "");
const clip = (s, n = 260) => (s.length > n ? `${s.slice(0, n)}…` : s);
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const mins = (ms) => `${(ms / 60000).toFixed(1)}m`;

/** Every test in the report, flat: { project, file, line, title, status, results }. */
const tests = [];
(function walk(suites, path) {
  for (const s of suites ?? []) {
    const here = s.title && s.title !== s.file ? [...path, s.title] : path;
    for (const spec of s.specs ?? []) for (const t of spec.tests ?? []) tests.push({ project: t.projectName, file: spec.file, line: spec.line, title: [...here, spec.title].join(" › "), status: t.status, results: t.results ?? [] });
    walk(s.suites, here);
  }
})(report.suites, []);

const name = (t) => `[${t.project}] ${t.file}:${t.line} › ${clip(t.title, 200)}`;
const spent = (t) => t.results.reduce((n, r) => n + (r.duration ?? 0), 0);
const neverRan = (t) => t.results.length === 0 || t.results.every((r) => r.status === "interrupted");
const failed = tests.filter((t) => t.status === "unexpected" && !neverRan(t));
const flaky = tests.filter((t) => t.status === "flaky");
const unrun = tests.filter(neverRan);
const skipped = tests.filter((t) => t.status === "skipped" && !neverRan(t));
const passed = tests.filter((t) => t.status === "expected");

console.log(`== e2e summary: ${tests.length} tests: ${passed.length} passed, ${failed.length} failed, ${flaky.length} passed on a retry, ${skipped.length} skipped, ${unrun.length} never ran; ${mins(report.stats?.duration ?? 0)}`);
for (const e of report.errors ?? []) console.log(`run error: ${clip(plain(e.message), 600)}`);

console.log("\n-- by spec: tests, failed, time");
const bySpec = new Map();
for (const t of tests) {
  const k = `[${t.project}] ${t.file}`;
  const row = bySpec.get(k) ?? { n: 0, bad: 0, ms: 0 };
  row.n += 1;
  row.bad += t.status === "unexpected" && !neverRan(t) ? 1 : 0;
  row.ms += spent(t);
  bySpec.set(k, row);
}
for (const [k, r] of bySpec) console.log(`${k}: ${r.n} tests, ${r.bad} failed, ${mins(r.ms)}`);

/** An error's message without colour, long lines clipped, a call log's repeats dropped, `max` lines at most. */
function words(err, max) {
  const out = [];
  let prev = "";
  for (const raw of plain(err?.message).split("\n")) {
    const line = clip(raw.trimEnd());
    const key = line.replace(/\d+/g, "#");
    if (!line.trim() || key === prev) continue;
    prev = key;
    out.push(line);
  }
  return out.length > max ? [...out.slice(0, max), `… (${out.length - max} more lines)`] : out;
}
const firstError = (t) => t.results.find((r) => r.error || r.errors?.length);
/** A test's errors as one: a timeout's first error is only "Test timeout exceeded", and what it was waiting on is in its second. */
const errorOf = (t) => {
  const r = firstError(t);
  const all = r?.errors?.length ? r.errors : r?.error ? [r.error] : [];
  return all.length ? { message: all.map((e) => e.message).join("\n") } : undefined;
};
const where = (t) => {
  const r = firstError(t);
  const loc = r?.error?.location ?? r?.errors?.find((e) => e.location)?.location;
  return loc ? `${loc.file.split(/[\\/]/).pop()}:${loc.line}` : "nowhere";
};
const head = (t) => (plain(errorOf(t)?.message).split("\n").find((l) => l.trim()) ?? "no error message").trim().replace(/\d+/g, "#");

if (failed.length) {
  console.log("\n-- failures, grouped by the line they failed on (the first test's error in full, then what the others received)");
  const groups = new Map();
  for (const t of failed) {
    const k = `${where(t)} ${head(t)}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  let g = 0;
  for (const [k, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n#${++g}: ${list.length} test${list.length > 1 ? "s" : ""} at ${clip(k, 200)}`);
    list.forEach((t, i) => {
      const last = t.results.at(-1);
      console.log(`  ${name(t)} (${last?.status}, ${secs(last?.duration ?? 0)}${t.results.length > 1 ? `, ${t.results.length} tries` : ""})`);
      const lines = words(errorOf(t), i === 0 ? 45 : 60);
      // After the first, only what differs: the lines of a diff that were received, or the "Received" lines.
      const shown = i === 0 ? lines : lines.filter((l) => /^\s*\+ |Received|Error: (?!expect)/.test(l)).slice(0, 8);
      for (const l of shown) console.log(`      ${l}`);
    });
  }
}

if (flaky.length) {
  console.log("\n-- passed only on a retry (the first try's error)");
  for (const t of flaky) {
    console.log(`  ${name(t)} at ${where(t)}`);
    for (const l of words(errorOf(t), 6)) console.log(`      ${l}`);
  }
}

if (unrun.length) {
  console.log("\n-- never ran (the run was stopped first), by spec");
  const by = new Map();
  for (const t of unrun) by.set(`[${t.project}] ${t.file}`, (by.get(`[${t.project}] ${t.file}`) ?? 0) + 1);
  for (const [k, n] of by) console.log(`  ${k}: ${n}`);
}

// What the pages said: uncaught errors and console errors, each once, with how often and in how many tests.
const heard = new Map();
for (const t of tests)
  for (const r of t.results)
    for (const o of r.stdout ?? []) {
      for (const line of plain(o.text).split("\n")) {
        if (!/^\[(page|console) error\]/.test(line)) continue;
        const k = clip(line.replace(/\d{3,}/g, "#"), 300);
        const row = heard.get(k) ?? { n: 0, tests: new Set(), bad: 0 };
        row.n += 1;
        row.tests.add(name(t));
        heard.set(k, row);
      }
    }
if (heard.size) {
  console.log("\n-- what the pages said (times, tests), most often first");
  for (const [k, r] of [...heard].sort((a, b) => b[1].n - a[1].n).slice(0, 30)) console.log(`  ${r.n}x in ${r.tests.size} tests: ${k}\n      first in ${[...r.tests][0]}`);
}

console.log("\n-- the ten slowest");
for (const t of [...tests].sort((a, b) => spent(b) - spent(a)).slice(0, 10)) console.log(`  ${secs(spent(t))} ${name(t)}`);
console.log("== end of e2e summary");
