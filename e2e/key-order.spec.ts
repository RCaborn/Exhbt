import { expect, test, type Page } from "@playwright/test";
import { emptyDoc, normaliseDoc, SCHEMA_VERSION, type Chart, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { aiVersionOf, graphsAsDrafted, readAiVersion } from "../lib/exhbt/draft-blocks";
import { jsonbOrder, throughRealJsonb } from "./jsonb";

// The live database keeps each exhbt in a jsonb column, which hands an object's keys back in its own
// order: shortest first, then by their bytes. The in-memory store these tests run on keeps keys as
// written, so a comparison of JSON text between a stored doc and one built another way passed here
// and failed on the live site (release 2 review, figure-fresh-key-order): the figure route never
// recognised a graph the draft drew, and never took it off. These tests put the stored doc through
// that reordering (e2e/jsonb.ts) and, where a Postgres server is installed, through a real jsonb column.

const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const graph = (id: string, chart: Chart): Section => ({ id, kind: "graph", chart });

/** One graph of each kind, written in the order the draft writes them, with the optional fields a draft can fill in. */
const CHARTS: Chart[] = [
  { kind: "beforeAfter", title: "Missed appointments", beforeLabel: "Before", afterLabel: "After", lowerIsBetter: true, unit: "%", rows: [{ label: "All patients", before: 7.9, after: 6.5 }, { label: "Under 30", before: 11.2, after: 8.4 }] },
  { kind: "bar", title: "Waits by day", xTitle: "Day", yTitle: "Minutes", unit: "min", lowerIsBetter: true, rows: [{ label: "Monday", value: 11 }, { label: "Tuesday", value: 4 }] },
  { kind: "groupedBar", title: "Recall by group", xTitle: "Week", yTitle: "Words", series: ["Spaced", "Massed"], rows: [{ label: "Week 1", values: [21, 18] }, { label: "Week 4", values: [26, 17] }] },
  { kind: "stackedBar", title: "Time by task", unit: "h", series: ["Build", "Test"], rows: [{ label: "Sprint 1", values: [30, 10] }, { label: "Sprint 2", values: [22, 18] }] },
  { kind: "line", title: "Sign-ups by week", xTitle: "Week", yTitle: "Sign-ups", series: ["Last year", "This year"], rows: [{ label: "1", values: [12, 20] }, { label: "2", values: [15, 31] }] },
  { kind: "scatter", title: "Sleep and score", xTitle: "Hours of sleep", yTitle: "Score", unit: "%", points: [{ x: 5, y: 52 }, { x: 7, y: 68, label: "Median" }, { x: 9, y: 71 }] },
  { kind: "numbers", title: "At a glance", tiles: [{ value: 6.5, label: "Missed", unit: "%", from: 7.9 }, { value: 14200, label: "Rows cleaned" }] },
  { kind: "table", title: "Results by condition", columns: ["Condition", "Mean", "SD"], rows: [["Spaced", "26.1", "4.2"], ["Massed", "17.3", "5.0"]] },
];

const core: Omit<ExhbtDoc, "sections"> = {
  schemaVersion: SCHEMA_VERSION,
  title: "Does a later reminder cut missed appointments?",
  context: "Final-year project",
  skills: ["Excel"],
  gap: [{ t: "Missed appointments cost the practice time, and " }, { t: "nobody had tested the reminder", b: true }, { t: "." }],
  flow: [{ step: "Collected the figures", detail: "Six months of bookings" }, { step: "Changed the reminder time" }, { step: "Compared the two" }],
};
const findings: Section = { id: "findings", kind: "findings", items: [[{ t: "Missed appointments fell." }], [{ t: "Two practices took part." }]] };
/** The exhbt a draft makes: the words, then the graphs it drew. */
const draftedDoc = (charts: Chart[]): ExhbtDoc => ({ ...core, sections: [findings, ...charts.map((c, i) => graph(`graph-${i + 1}`, c))] });
/** The graphs the draft drew, as the figure route reads them: written to the AI version's file as JSON and read back (lib/draft-tools.ts). */
const draftedGraphs = (doc: ExhbtDoc) => readAiVersion(JSON.stringify(aiVersionOf(doc, "the source text"))).drafted;
/** The doc as the live store hands it back: out of a jsonb column, then read into the current shape (fromExhbtRow). */
const fromDatabase = (doc: ExhbtDoc): ExhbtDoc => normaliseDoc(jsonbOrder(JSON.parse(JSON.stringify(doc))));
const chartsOn = (doc: { sections: Section[] }): Chart[] => doc.sections.flatMap((s) => (s.kind === "graph" ? [s.chart] : []));

/** The graph with the first number in it one higher: a value the person changed. */
function withANumberChanged(chart: Chart): Chart {
  let done = false;
  const walk = (v: unknown): unknown => {
    if (done) return v;
    if (typeof v === "number") {
      done = true;
      return v + 1;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(chart) as Chart;
  if (!done) {
    // A table holds its figures as text: change the first cell.
    const t = structuredClone(chart) as Extract<Chart, { kind: "table" }>;
    t.rows[0]![0] = `${t.rows[0]![0]} (changed)`;
    return t;
  }
  return out;
}
/** The graph with its rows, points or tiles the other way round: the same data in another order is another graph. */
function withRowsReversed(chart: Chart): Chart {
  const c = structuredClone(chart) as Record<string, unknown>;
  for (const key of ["rows", "points", "tiles"]) if (Array.isArray(c[key])) c[key] = [...(c[key] as unknown[])].reverse();
  return c as Chart;
}

/* ---------------- Pure ---------------- */

test.describe("A graph the draft drew is recognised whatever order its keys come back in", () => {
  test("every kind of graph, after the database has reordered its keys at every depth", () => {
    for (const chart of CHARTS) {
      const doc = draftedDoc([chart]);
      const drafted = draftedGraphs(doc);
      expect(drafted, chart.kind).toHaveLength(1);
      const stored = fromDatabase(doc);
      // The reordering is real for this kind: the text of the two differs though the data is the same.
      expect(JSON.stringify(chartsOn(stored)[0]), chart.kind).not.toBe(JSON.stringify(drafted![0]));
      expect(chartsOn(stored)[0], chart.kind).toEqual(drafted![0]);
      expect(graphsAsDrafted(stored, drafted), chart.kind).toBe(true);
      // And in the order it was written, as the in-memory store keeps it.
      expect(graphsAsDrafted(doc, drafted), chart.kind).toBe(true);
    }
  });

  test("a graph the person changed still counts as different, in either order", () => {
    for (const chart of CHARTS) {
      const drafted = draftedGraphs(draftedDoc([chart]));
      const edits: Chart[] = [{ ...chart, title: `${chart.title} (my title)` }, withANumberChanged(chart), withRowsReversed(chart)];
      for (const [i, edited] of edits.entries()) {
        expect(edited, `${chart.kind} edit ${i}`).not.toEqual(chart);
        const doc = draftedDoc([edited]);
        expect(graphsAsDrafted(doc, drafted), `${chart.kind} edit ${i}, as written`).toBe(false);
        expect(graphsAsDrafted(fromDatabase(doc), drafted), `${chart.kind} edit ${i}, from the database`).toBe(false);
      }
    }
  });

  test("several graphs: each must be one the draft drew, and with nothing recorded none is", () => {
    const [a, b, c] = [CHARTS[0]!, CHARTS[1]!, CHARTS[4]!];
    const drafted = draftedGraphs(draftedDoc([a, b]));
    expect(graphsAsDrafted(fromDatabase(draftedDoc([a, b])), drafted)).toBe(true);
    expect(graphsAsDrafted(fromDatabase(draftedDoc([b, a])), drafted)).toBe(true);
    // A third graph is the person's own, so the exhbt is no longer the draft.
    expect(graphsAsDrafted(fromDatabase(draftedDoc([a, c])), drafted)).toBe(false);
    // An AI version kept before the draft's graphs were recorded: nothing counts as drawn by the draft.
    expect(graphsAsDrafted(fromDatabase(draftedDoc([a])), undefined)).toBe(false);
    expect(graphsAsDrafted(fromDatabase(draftedDoc([a])), [])).toBe(false);
    // No graph on the exhbt: nothing to ask.
    expect(graphsAsDrafted(fromDatabase(draftedDoc([])), undefined)).toBe(true);
    // A graph saved before graphs had kinds reads as before and after on both sides.
    const { kind: _kind, ...old } = a as Extract<Chart, { kind: "beforeAfter" }>;
    void _kind;
    expect(graphsAsDrafted(fromDatabase({ ...emptyDoc(), sections: [graph("graph-1", old as Chart)] }), [a])).toBe(true);
  });
});

/* ---------------- A real jsonb column ---------------- */

test.describe("Through a real jsonb column", () => {
  test("Postgres reorders the keys as these tests do, and the drafted graph is still recognised", () => {
    test.setTimeout(180_000);
    const docs = CHARTS.map((chart) => draftedDoc([chart]));
    // Keys chosen to show the rule: length in bytes first (é is two bytes), then the bytes (capitals before small letters).
    const probe = { title: 1, kind: 2, rows: 3, "é": 4, zz: 5, ab: 6, B: 7, a: 8, "": 9, "a longer key": 10, nested: [{ t: "x", href: "y", b: true, i: false }] };
    const back = throughRealJsonb([...docs, probe]);
    if ("skipped" in back) console.log(`[jsonb] real Postgres round trip skipped: ${back.skipped}`);
    test.skip("skipped" in back, "skipped" in back ? back.skipped : "");
    if ("skipped" in back) return;
    console.log(`[jsonb] real Postgres round trip ran on ${back.server}`);
    test.info().annotations.push({ type: "postgres", description: back.server });

    // The helper the other tests use gives exactly the order Postgres gives.
    expect(Object.keys(back.values[docs.length] as object)).toEqual(["", "B", "a", "ab", "zz", "é", "kind", "rows", "title", "nested", "a longer key"]);
    for (const [i, sent] of [...docs, probe].entries()) expect(JSON.stringify(back.values[i]), `value ${i}`).toBe(JSON.stringify(jsonbOrder(sent)));

    for (const [i, doc] of docs.entries()) {
      const kind = CHARTS[i]!.kind;
      const drafted = draftedGraphs(doc);
      const stored = normaliseDoc(back.values[i]);
      // Postgres really did hand the graph back in another order than the draft wrote it.
      expect(JSON.stringify(chartsOn(stored)[0]), kind).not.toBe(JSON.stringify(drafted![0]));
      expect(graphsAsDrafted(stored, drafted), kind).toBe(true);
      // A graph the person changed is still different after the round trip.
      expect(graphsAsDrafted(stored, draftedGraphs(draftedDoc([withANumberChanged(CHARTS[i]!)]))), kind).toBe(false);
    }
  });
});

/* ---------------- The figure route ---------------- */

type Stored = { working: { sections: Section[] }; aiVersion: { graphs?: Chart[] } };

/** Stores a drafted exhbt with its keys in the database's order, and its AI version as the draft writes it. Signs in as its owner. */
async function seedFromDatabase(page: Page, charts: Chart[], drafted: Chart[]) {
  const username = unique("keyorder");
  const doc = jsonbOrder(draftedDoc(charts));
  const res = await page.request.post("/dev/parity", {
    data: { username, slug: "reminders", doc, working: doc, extraFiles: ["figure"], aiVersion: { blocks: {}, unverified: {}, drafted } },
  });
  expect(res.status(), await res.text()).toBe(200);
  const seeded = (await res.json()) as { id: string; files: Record<string, string> };
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  return seeded;
}
const stored = async (page: Page, id: string) => (await (await page.request.get(`/dev/parity?id=${id}`)).json()) as Stored;
const place = (page: Page, id: string, fileId: string) =>
  page.request.post(`/api/exhbts/${id}/figure`, { data: { fileId, kind: "graph", alt: "The report's own chart", caption: "", picked: { from: "report.pdf", page: 2 } } });

test.describe("The figure route, with the exhbt stored as the live database stores it", () => {
  test("a fresh draft: the drafted graph is recognised and taken off, for every kind of graph", async ({ page }) => {
    test.setTimeout(180_000);
    for (const chart of CHARTS) {
      const { id, files } = await seedFromDatabase(page, [chart], [chart]);
      // What is stored has its keys in another order than the graph the AI version recorded.
      const before = await stored(page, id);
      expect(JSON.stringify(chartsOn(before.working)[0]), chart.kind).not.toBe(JSON.stringify(chart));
      expect((await place(page, id, files.figure!)).status(), chart.kind).toBe(204);
      const after = await stored(page, id);
      expect(after.working.sections.map((s) => s.kind), chart.kind).toEqual(["findings", "image"]);
      // The graph it took the place of is kept with the AI version.
      expect(after.aiVersion.graphs, chart.kind).toEqual([chart]);
    }
  });

  test("two drafted graphs both go; a graph the person changed stays, and so does the one beside it", async ({ page }) => {
    const [a, b] = [CHARTS[1]!, CHARTS[0]!];
    const fresh = await seedFromDatabase(page, [a, b], [a, b]);
    expect((await place(page, fresh.id, fresh.files.figure!)).status()).toBe(204);
    const gone = await stored(page, fresh.id);
    expect(gone.working.sections.map((s) => s.kind)).toEqual(["findings", "image"]);
    expect(gone.aiVersion.graphs).toEqual([a, b]);

    const edited = await seedFromDatabase(page, [a, withANumberChanged(b)], [a, b]);
    expect((await place(page, edited.id, edited.files.figure!)).status()).toBe(204);
    const kept = await stored(page, edited.id);
    expect(kept.working.sections.map((s) => s.kind).sort()).toEqual(["findings", "graph", "graph", "image"]);
    expect(kept.aiVersion.graphs).toBeUndefined();
  });
});
