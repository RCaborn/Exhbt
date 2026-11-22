import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { chartsOf, emptyDoc, ExhbtDocSchema, LIMITS, publicDoc, text, validateForPublish, wordCount, type Chart, type ExhbtDoc } from "../lib/exhbt/blocks";
import { ChartSchema, chartSummary, convertChart, displayed, indexed, newChart, CHART_KINDS } from "../lib/exhbt/charts";
import { headlineFor } from "../lib/exhbt/headline";
import { legacyGpDoc, sampleDocs } from "../lib/exhbt/sample";
import { slugify } from "../lib/exhbt/slug";
import { unverifiedNumbers } from "../lib/exhbt/verify";
import { addGraph, addGraphSection, closeOpenSheet, graph, openAddSectionMenu, openFigures, openPublishSheet, menuItem, pickGraphKind, publish, signInAs, startWithBasics, waitEditor } from "./editor";
import { READY } from "./page-editor";

// Graphs (decision 0011): a fixed set of kinds, every value typed in and printed, a hidden table
// for each, the word cap counting every graph word, the number check covering every graph
// value, and "Protect the real numbers" keeping typed figures out of the published copy.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const [GP] = sampleDocs as [ExhbtDoc];

/** A publishable exhbt with no graphs, and the same with some: graph sections after the findings (decision 0015). */
const base = (): ExhbtDoc => ({
  ...emptyDoc(),
  title: "Shorter lunch queues",
  gap: text("Lunch queues ran long. Would a second till help?"),
  flow: [{ step: "Timed the queue" }, { step: "Opened a second till" }, { step: "Timed it again" }],
  sections: [{ id: "findings", kind: "findings", items: [text("Waits fell."), text("Sales held steady.")] }],
});
const withCharts = (...charts: Chart[]): ExhbtDoc => ({ ...base(), sections: [...base().sections, ...charts.map((chart, i) => ({ id: `graph-${i + 1}`, kind: "graph" as const, chart }))] });
/** Where the first graph's issues point: the section after the findings. */
const G = "sections.1.chart";
const paths = (d: ExhbtDoc) => validateForPublish(d).map((i) => i.path);

const SAMPLES: Record<string, Chart> = {
  bar: { kind: "bar", title: "Average wait", unit: "min", rows: [{ label: "Till A", value: 11 }, { label: "Till B", value: 4 }] },
  groupedBar: { kind: "groupedBar", title: "Marks by term", series: ["Spring", "Autumn"], rows: [{ label: "Sciences", values: [62, 71] }] },
  stackedBar: { kind: "stackedBar", title: "Hours by task", series: ["Sorting", "Driving"], rows: [{ label: "March", values: [30, 12] }] },
  line: { kind: "line", title: "Weekly visits", xTitle: "Week", series: ["Visits"], rows: [{ label: "First", values: [120] }, { label: "Second", values: [135] }] },
  scatter: { kind: "scatter", title: "Revision and marks", xTitle: "Hours revised", yTitle: "Exam mark", points: [{ x: 2, y: 48 }, { x: 5, y: 61, label: "Ana" }, { x: 9, y: 74 }] },
  numbers: { kind: "numbers", title: "Headline results", tiles: [{ value: 6.5, unit: "%", label: "missed appointments", from: 7.9 }, { value: 14200, label: "records cleaned" }] },
  table: { kind: "table", title: "Model comparison", columns: ["Model", "Accuracy"], rows: [["Baseline", "71%"], ["Tuned model", "84%"]] },
};

test.describe("Graph kinds", () => {
  test("a graph saved before kinds existed reads as before and after, and still works everywhere", () => {
    const legacy = { title: "Missed (%)", beforeLabel: "Before", afterLabel: "After", lowerIsBetter: true, unit: "%", rows: [{ label: "All", before: 7.9, after: 6.5 }] };
    expect(ChartSchema.parse(legacy)).toEqual({ kind: "beforeAfter", ...legacy });
    // A doc from before sections, with a graph from before kinds: both are read on the way in.
    const doc = ExhbtDocSchema.parse({ ...legacyGpDoc, charts: [legacy] });
    expect(chartsOf(doc)[0]!.kind).toBe("beforeAfter");
    // The sample GP exhbt keeps the old shape on purpose (lib/exhbt/sample.ts).
    expect("kind" in legacyGpDoc.charts[0]!).toBe(false);
    expect(validateForPublish(GP)).toEqual([]);
    expect(wordCount(GP)).toBe(wordCount(ExhbtDocSchema.parse(legacyGpDoc)));
    expect(headlineFor({ headline: undefined, sections: GP.sections })).toEqual({ value: "−18%", label: "Missed appointments (%), All patients" });
    // Its labels and values are checked like any graph's.
    expect(unverifiedNumbers(withCharts(legacyGpDoc.charts[0]!), "7.9 6.5 11.2")).toEqual(["24", "3", "30", "8.4"]);
    // Publishing gives it its kind.
    expect(chartsOf(publicDoc(legacyGpDoc as unknown as ExhbtDoc))[0]!.kind).toBe("beforeAfter");
  });

  test("every kind parses, and a new one of each is ready to fill in", () => {
    for (const k of CHART_KINDS) {
      expect(ChartSchema.parse(newChart(k)).kind).toBe(k);
      // Empty, so publishing asks for what's missing, each at a path the editor can show.
      expect(validateForPublish(withCharts(newChart(k))).every((i) => i.path.startsWith(G))).toBe(true);
    }
    for (const c of Object.values(SAMPLES)) expect(validateForPublish(withCharts(c))).toEqual([]);
  });

  test("the word count takes in every word on every kind of graph", () => {
    const n = wordCount(base());
    const counts: Record<string, number> = {
      bar: 2 + 1 + 4, // title, unit, two labels
      groupedBar: 3 + 2 + 1, // title, series names, group label
      stackedBar: 3 + 2 + 1,
      line: 2 + 1 + 1 + 2, // title, x axis title, series name, two point labels
      scatter: 3 + 2 + 2 + 1, // title, two axis titles, one point label
      numbers: 2 + 2 + 1 + 2, // title, tile label, unit, tile label (values aren't words)
      table: 2 + 2 + 1 + 1 + 2 + 1, // title, headings, cells
    };
    for (const [k, c] of Object.entries(SAMPLES)) expect(wordCount(withCharts(c)) - n, k).toBe(counts[k]);
  });

  test("graph words can take an exhbt over the cap, and then it can't be published", () => {
    const columns = ["A", "B", "C", "D", "E"];
    const { rows: R, columns: C } = LIMITS.charts.table;
    /** A full table holding k words, spread over its cells. */
    const table = (k: number): Chart => ({
      kind: "table",
      title: "Long table",
      columns,
      rows: Array.from({ length: R.max }, (_, j) =>
        Array.from({ length: C.max }, (_, x) => {
          const i = j * C.max + x;
          return Array.from({ length: Math.floor(k / (R.max * C.max)) + (i < k % (R.max * C.max) ? 1 : 0) }, () => "w").join(" ");
        }),
      ),
    });
    const room = LIMITS.totalWords - wordCount(withCharts(table(0)));
    expect(wordCount(withCharts(table(room)))).toBe(LIMITS.totalWords);
    expect(paths(withCharts(table(room)))).toEqual([]);
    expect(paths(withCharts(table(room + 1)))).toEqual([""]);
  });

  test("each kind's limits stop publishing at the part that breaks them", () => {
    const bars = Array.from({ length: LIMITS.charts.bar.rows.max + 1 }, (_, i) => ({ label: `Bar ${"x".repeat(i)}`, value: i }));
    expect(paths(withCharts({ kind: "bar", title: "Bars", rows: bars }))).toEqual([`${G}.rows`]);
    expect(paths(withCharts({ kind: "bar", title: "Bars", rows: [{ label: "", value: 1 }, { label: "B", value: 2 }] }))).toEqual([`${G}.rows.0.label`]);
    const five = ["a", "b", "c", "d", "e"];
    expect(paths(withCharts({ kind: "groupedBar", title: "G", series: five, rows: [{ label: "R", values: [1, 2, 3, 4, 5] }] }))).toEqual([`${G}.series`]);
    expect(paths(withCharts({ kind: "stackedBar", title: "S", series: ["a", "b"], rows: [{ label: "R", values: [3, -1] }] }))).toEqual([`${G}.rows.0`]);
    expect(paths(withCharts({ kind: "groupedBar", title: "G", series: ["a", "b"], rows: [{ label: "R", values: [1] }] }))).toEqual([`${G}.rows.0`]);
    const points = Array.from({ length: LIMITS.charts.line.rows.max + 1 }, (_, i) => ({ label: `P${"x".repeat(i)}`, values: [i] }));
    expect(paths(withCharts({ kind: "line", title: "L", series: ["s"], rows: points }))).toEqual([`${G}.rows`]);
    expect(paths(withCharts({ ...(SAMPLES.scatter as Chart), xTitle: "" } as Chart))).toEqual([`${G}.xTitle`]);
    const dots = Array.from({ length: LIMITS.charts.scatter.points.max + 1 }, (_, i) => ({ x: i, y: i }));
    expect(paths(withCharts({ kind: "scatter", title: "S", xTitle: "x", yTitle: "y", points: dots }))).toEqual([`${G}.points`]);
    const tiles = Array.from({ length: LIMITS.charts.numbers.tiles.max + 1 }, () => ({ value: 1, label: "thing" }));
    expect(paths(withCharts({ kind: "numbers", title: "N", tiles }))).toEqual([`${G}.tiles`]);
    expect(paths(withCharts({ kind: "table", title: "T", columns: ["a", "b", "c", "d", "e", "f"], rows: [["1", "2", "3", "4", "5", "6"]] }))).toEqual([`${G}.columns`]);
    expect(paths(withCharts({ kind: "table", title: "T", columns: ["a", ""], rows: [["1", "2"]] }))).toEqual([`${G}.columns.1`]);
    expect(paths(withCharts({ ...(SAMPLES.bar as Chart), title: "" } as Chart))).toEqual([`${G}.title`]);
    // A third graph: the sections as a whole are over (two graphs at most).
    expect(paths(withCharts(SAMPLES.bar!, SAMPLES.line!, SAMPLES.table!))).toEqual(["sections"]);
  });

  test("every graph value is checked against the material, whatever the kind", () => {
    const source = "Waits of 11 and 4 minutes. Visits 120 then 135. Marks 48, 61 and 74 after 2, 5 and 9 hours. 6.5% from 7.9%, 14,200 records, 71% and 84%. Spring 62, autumn 71, sciences; 30 and 12 hours.";
    for (const [k, c] of Object.entries(SAMPLES)) expect(unverifiedNumbers(withCharts(c), source), k).toEqual([]);
    expect(unverifiedNumbers(withCharts({ ...(SAMPLES.line as Chart), rows: [{ label: "First", values: [120] }, { label: "Second", values: [150] }] } as Chart), source)).toEqual(["150"]);
    expect(unverifiedNumbers(withCharts({ ...(SAMPLES.scatter as Chart), points: [{ x: 2, y: 48 }, { x: 5, y: 66 }, { x: 9, y: 74 }] } as Chart), source)).toEqual(["66"]);
    expect(unverifiedNumbers(withCharts({ kind: "numbers", title: "N", tiles: [{ value: 6.5, label: "a", from: 8.1 }, { value: 14200, label: "b" }] }), source)).toEqual(["8.1"]);
    expect(unverifiedNumbers(withCharts({ kind: "table", title: "T", columns: ["Model", "Accuracy"], rows: [["Tuned", "88%"]] }), source)).toEqual(["88%"]);
  });

  test("switching kind keeps the figures that fit", () => {
    const ba: Chart = { kind: "beforeAfter", title: "Waits", beforeLabel: "Before", afterLabel: "After", lowerIsBetter: true, unit: "min", rows: [{ label: "Lunch", before: 11, after: 4 }] };
    expect(convertChart(ba, "groupedBar")).toMatchObject({ kind: "groupedBar", title: "Waits", unit: "min", series: ["Before", "After"], rows: [{ label: "Lunch", values: [11, 4] }], lowerIsBetter: true });
    expect(convertChart(ba, "numbers")).toMatchObject({ tiles: [{ label: "Lunch", value: 4, from: 11, unit: "min" }] });
    expect(convertChart(convertChart(ba, "line"), "beforeAfter")).toMatchObject({ beforeLabel: "Before", afterLabel: "After", rows: [{ label: "Lunch", before: 11, after: 4 }] });
    expect(convertChart(ba, "table")).toMatchObject({ rows: [["Lunch", "11 min", "4 min"]] });
    expect(convertChart(ba, "bar")).toMatchObject({ rows: [{ label: "Lunch", value: 11 }] });
  });

  test("protected numbers: shown as change or an index, and the published copy has only the index", () => {
    const line: Chart = { kind: "line", title: "Weekly revenue", unit: "£", protect: "change", series: ["Shop"], rows: [{ label: "A", values: [48317] }, { label: "B", values: [52904] }, { label: "C", values: [61230] }] };
    expect(displayed(line)).toMatchObject({ unit: "%", rows: [{ values: [0] }, { values: [9.5] }, { values: [26.7] }] });
    expect(displayed({ ...line, protect: "index" } as Chart)).toMatchObject({ rows: [{ values: [100] }, { values: [109.5] }, { values: [126.7] }] });
    expect(chartSummary(line)).toContain("+26.7%");
    const pub = JSON.stringify(publicDoc(withCharts(line)));
    for (const raw of ["48317", "52904", "61230", "£"]) expect(pub).not.toContain(raw);
    // Publishing twice changes nothing, and draws the same as the draft.
    expect(indexed(indexed(line))).toEqual(indexed(line));
    expect(displayed(chartsOf(publicDoc(withCharts(line)))[0]!)).toEqual(displayed(line));
    // Every kind that can protect does; a zero start can't be protected.
    expect(chartsOf(publicDoc(withCharts({ kind: "beforeAfter", title: "W", beforeLabel: "B", afterLabel: "A", lowerIsBetter: true, protect: "index", rows: [{ label: "x", before: 250, after: 200 }] })))[0]).toMatchObject({ rows: [{ before: 100, after: 80 }] });
    expect(chartsOf(publicDoc(withCharts({ kind: "stackedBar", title: "S", protect: "index", series: ["a", "b"], rows: [{ label: "x", values: [30, 10] }, { label: "y", values: [60, 20] }] })))[0]).toMatchObject({ rows: [{ values: [75, 25] }, { values: [150, 50] }] });
    expect(paths(withCharts({ kind: "bar", title: "B", protect: "change", rows: [{ label: "x", value: 0 }, { label: "y", value: 5 }] }))).toEqual([`${G}.protect`]);
    // The headline worked out from a protected before-and-after graph is the same ratio.
    const ba: Chart = { kind: "beforeAfter", title: "Costs", beforeLabel: "B", afterLabel: "A", lowerIsBetter: true, protect: "change", rows: [{ label: "", before: 250, after: 200 }] };
    expect(headlineFor({ sections: [{ id: "graph-1", kind: "graph", chart: ba }] })).toEqual(headlineFor(publicDoc(withCharts(ba))));
  });
});

/* ---------------- In the browser ---------------- */

/** Fills inputs by their labels, in order. */
async function fill(scope: Locator | Page, values: [string, string][]) {
  for (const [label, value] of values) await scope.getByLabel(label, { exact: true }).fill(value);
}

/** A graph on the project page, by its title. */
const figure = (page: Page, title: string) => page.locator("figure[data-chart]").filter({ hasText: title });

/** The graph prints these values, and its hidden table has them too. */
async function shows(page: Page, title: string, values: string[], summary?: RegExp) {
  const f = figure(page, title);
  await expect(f).toBeVisible();
  const table = page.getByRole("table", { name: title, exact: true });
  await expect(table).toBeAttached();
  for (const v of values) {
    await expect(f.getByText(v, { exact: true }).first()).toBeVisible();
    await expect(table.getByText(v, { exact: true }).first()).toBeAttached();
  }
  if (summary) await expect(f.locator("[role=img]")).toHaveAttribute("aria-label", summary);
}

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

test.describe("Graphs in the editor and on the page", () => {
  test("bars and grouped bars: built in the editor, printed on the page with hidden tables, no accessibility violations", async ({ page }) => {
    test.setTimeout(150_000); // two graphs' worth of typing in the sheet, then the public page cold
    const title = "Graphs one: bars";
    await signInAs(page, "gwen");
    await startWithBasics(page, title);

    const g1 = await addGraph(page, 1, "Bars", "Average wait");
    await fill(g1, [["Unit (optional)", "min"], ["Graph 1, bar 1 label", "Till A"], ["Graph 1, bar 1 Value", "11"], ["Graph 1, bar 2 label", "Till B"], ["Graph 1, bar 2 Value", "4"]]);
    await g1.getByRole("button", { name: "Add a bar to graph 1" }).click();
    await fill(g1, [["Graph 1, bar 3 label", "Till C"], ["Graph 1, bar 3 Value", "7"]]);
    await g1.getByLabel("Bar to stand out").selectOption({ label: "Till B" });
    // A value that isn't a number is caught as it's typed.
    await g1.getByLabel("Graph 1, bar 2 Value").fill("four");
    await expect(g1.getByText("Type a number")).toBeVisible();
    await g1.getByLabel("Graph 1, bar 2 Value").fill("4");
    await expect(g1.getByText("Type a number")).toHaveCount(0);

    const g2 = await addGraph(page, 2, "Grouped bars", "Marks by term");
    await fill(g2, [["Graph 2, series 1 name", "Spring"], ["Graph 2, series 2 name", "Autumn"], ["Graph 2, group 1 label", "Sciences"], ["Graph 2, group 1 Spring", "62"], ["Graph 2, group 1 Autumn", "71"]]);
    await g2.getByRole("button", { name: "Add a group to graph 2" }).click();
    await fill(g2, [["Graph 2, group 2 label", "Arts"], ["Graph 2, group 2 Spring", "55"], ["Graph 2, group 2 Autumn", "64"]]);
    // The page redraws as you type, with every value.
    await expect(page.locator(`${READY} figure[data-chart]`).filter({ hasText: "Marks by term" }).getByText("64", { exact: true }).first()).toBeVisible();
    // Both graphs are used: the menu says so and won't add a third.
    await closeOpenSheet(page);
    await openAddSectionMenu(page);
    await expect(menuItem(page, "Add a graph")).toBeDisabled();
    await expect(menuItem(page, "Add a graph")).toContainText(`Up to ${LIMITS.charts.max} graphs in a case study`);
    await page.keyboard.press("Escape");
    await axe(page, "editor");

    await publish(page, { changes: true });
    await page.goto(`/p/gwen/${slugify(title)}`);
    await shows(page, "Average wait", ["11 min", "4 min", "7 min"], /^Bar graph of 3 bars\. Highest: Till A, 11 min\. Lowest: Till B, 4 min\.$/);
    await shows(page, "Marks by term", ["62", "71", "55", "64"], /^Grouped bar graph: 2 groups of Spring and Autumn\.$/);
    await axe(page, "project page");
  });

  test("stacked bars and a line", async ({ page }) => {
    const title = "Graphs two: stacks and lines";
    await signInAs(page, "gary");
    await startWithBasics(page, title);

    const g1 = await addGraph(page, 1, "Stacked bars", "Hours by task");
    await fill(g1, [["Graph 1, part 1 name", "Sorting"], ["Graph 1, part 2 name", "Driving"], ["Graph 1, bar 1 label", "March"], ["Graph 1, bar 1 Sorting", "30"], ["Graph 1, bar 1 Driving", "12"]]);

    const g2 = await addGraph(page, 2, "Line", "Weekly visits");
    await fill(g2, [["Along the bottom (optional)", "Week"], ["Graph 2, line 1 name", "Visits"], ["Graph 2, point 1 label", "First"], ["Graph 2, point 1 Visits", "120"], ["Graph 2, point 2 label", "Second"], ["Graph 2, point 2 Visits", "135"]]);
    await g2.getByRole("button", { name: "Add a point to graph 2" }).click();
    await fill(g2, [["Graph 2, point 3 label", "Third"], ["Graph 2, point 3 Visits", "160"]]);
    await axe(page, "editor");

    await publish(page, { changes: true });
    await page.goto(`/p/gary/${slugify(title)}`);
    await shows(page, "Hours by task", ["30", "12", "42"], /^Stacked bar graph: 1 bar, each split into Sorting and Driving\.$/);
    await shows(page, "Weekly visits", ["120", "135", "160"], /^Line graph of 3 points, from First to Third\. Visits goes from 120 to 160\.$/);
    // On a phone the graphs reflow: every value still printed, nothing scrolls sideways.
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(figure(page, "Hours by task").getByText("42", { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await axe(page, "project page");
  });

  test("scatter and big numbers", async ({ page }) => {
    const title = "Graphs three: scatter and numbers";
    await signInAs(page, "gina");
    await startWithBasics(page, title);

    const g1 = await addGraph(page, 1, "Scatter", "Revision and marks");
    await fill(g1, [["Across: what it measures", "Hours revised"], ["Up: what it measures", "Exam mark"]]);
    for (const [j, [x, y, label]] of [["2", "48", "Ana"], ["5", "61", ""], ["9", "74", "Ben"]].entries()) {
      await fill(g1, [[`Graph 1, point ${j + 1} label`, label!], [`Graph 1, point ${j + 1} Hours revised`, x!], [`Graph 1, point ${j + 1} Exam mark`, y!]]);
    }
    await g1.getByLabel("Point to stand out").selectOption({ label: "Ben" });

    const g2 = await addGraph(page, 2, "Big numbers", "Headline results");
    await fill(g2, [["Graph 2, number 1 label", "missed appointments"], ["Graph 2, number 1 value", "6.5"], ["Graph 2, number 1 unit", "%"], ["Graph 2, number 1 from", "7.9"]]);
    await fill(g2, [["Graph 2, number 2 label", "records cleaned"], ["Graph 2, number 2 value", "14,200"]]);
    await axe(page, "editor");

    await publish(page, { changes: true });
    await page.goto(`/p/gina/${slugify(title)}`);
    await shows(page, "Revision and marks", ["Ana", "Ben"], /^Scatter graph of 3 points: Exam mark against Hours revised\.$/);
    await expect(figure(page, "Revision and marks").getByText("(9, 74)", { exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Revision and marks" }).getByRole("cell", { name: "61", exact: true })).toBeAttached();
    await shows(page, "Headline results", ["6.5%", "14,200"]);
    await expect(figure(page, "Headline results").getByText("from 7.9%", { exact: true })).toBeVisible();
    await axe(page, "project page");
  });

  test("a table, and a before-and-after graph switched to grouped bars and back", async ({ page }) => {
    const title = "Graphs four: a table";
    await signInAs(page, "gus");
    await startWithBasics(page, title);

    const g1 = await addGraph(page, 1, "Table", "Model comparison");
    await fill(g1, [["Graph 1, column 1 heading", "Model"], ["Graph 1, column 2 heading", "Accuracy"], ["Graph 1, row 1, column 1", "Baseline"], ["Graph 1, row 1, column 2", "71%"]]);
    await g1.getByRole("button", { name: "Add a row to graph 1" }).click();
    await fill(g1, [["Graph 1, row 2, column 1", "Tuned model"], ["Graph 1, row 2, column 2", "84%"]]);

    // A new graph starts as before and after.
    await addGraphSection(page);
    const g2 = graph(page, 2);
    await expect(g2.getByRole("radio", { name: "Before and after", exact: true })).toBeChecked();
    await fill(g2, [["Title", "Missed appointments"], ["Before is called", "Day before"], ["After is called", "Same day"], ["Unit (optional)", "%"], ["Graph 2, row 1 group", "All patients"], ["Graph 2, row 1 Day before", "7.9"], ["Graph 2, row 1 Same day", "6.5"]]);
    await pickGraphKind(g2, "Grouped bars");
    await expect(g2.getByLabel("Graph 2, series 1 name")).toHaveValue("Day before");
    await expect(g2.getByLabel("Graph 2, group 1 Same day")).toHaveValue("6.5");
    await pickGraphKind(g2, "Before and after");
    await expect(g2.getByLabel("Graph 2, row 1 Same day")).toHaveValue("6.5");
    await expect(g2.getByLabel("Before is called")).toHaveValue("Day before");

    await publish(page, { changes: true });
    await page.goto(`/p/gus/${slugify(title)}`);
    const table = page.getByRole("table", { name: "Model comparison" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("cell", { name: "84%" })).toBeVisible();
    await shows(page, "Missed appointments", ["7.9%", "6.5%"], /^Before and after graph, Day before against Same day\. All patients: 7\.9% to 6\.5%\.$/);
    await axe(page, "project page");
  });

  test("an exhbt saved before graph kinds still shows its graph, and opens in the editor", async ({ page }) => {
    // The seeded GP exhbt's graph has no kind (lib/exhbt/sample.ts).
    await page.goto("/dev/portfolio?username=lexi&plan=premium&count=1");
    await page.goto("/p/lexi/gp-reminders");
    await shows(page, "Missed appointments (%)", ["7.9%", "6.5%", "11.2%", "8.4%"], /^Before and after graph, 24-hour reminder against 3-hour reminder\./);

    await page.goto("/auth/dev?email=lexi@example.com&next=/exhbts");
    await page.getByRole("link", { name: `Edit ${GP.title}` }).click();
    await waitEditor(page);
    await openFigures(page, 1);
    const g = graph(page, 1);
    await expect(g.getByRole("radio", { name: "Before and after", exact: true })).toBeChecked();
    await expect(g.getByLabel("Graph 1, row 2 group")).toHaveValue("Under 30");
    await expect(page.locator(`${READY} figure[data-chart]`).getByText("11.2%", { exact: true }).first()).toBeVisible();
  });

  test("graph labels can push an exhbt over 200 words, and then it can't be published", async ({ page }) => {
    const title = "Graphs five: too many words";
    await signInAs(page, "gail");
    await startWithBasics(page, title);
    const g = await addGraph(page, 1, "Table", "A long table");
    for (let k = 0; k < LIMITS.charts.table.columns.max - 2; k++) await g.getByRole("button", { name: "Add a column to graph 1" }).click();
    for (let j = 0; j < LIMITS.charts.table.rows.max - 1; j++) await g.getByRole("button", { name: "Add a row to graph 1" }).click();
    for (let k = 1; k <= LIMITS.charts.table.columns.max; k++) {
      await g.getByLabel(`Graph 1, column ${k} heading`).fill(`Heading ${"x".repeat(k)}`);
      for (let j = 1; j <= LIMITS.charts.table.rows.max; j++) await g.getByLabel(`Graph 1, row ${j}, column ${k}`).fill("six words in every one cell");
    }
    await expect(page.getByText(/^\d+ words · aim for/)).toContainText(/^2[0-9]{2} words/);
    await openPublishSheet(page);
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toHaveCount(0);
    await closeOpenSheet(page);
    await page.getByRole("button", { name: /things? to fix$/ }).click();
    await expect(page.getByRole("region", { name: "Things to fix before publishing" })).toContainText(`Keep the whole exhbt to ${LIMITS.totalWords} words`);
    await expect(page.getByText("It's live.")).toHaveCount(0);
  });

  test("a graph number the AI worked out is flagged; its own figures aren't", async ({ page }) => {
    await signInAs(page, "gerri");
    const material = "Library footfall study. The library counted 1,240 visits in the first week and 1,580 visits in the second week, after the new opening hours began.";

    // The stand-in AI graphs the figures it finds: every one is in the material.
    const plain = await page.request.post("/api/exhbts/draft", { data: { text: material } });
    expect(plain.status()).toBe(200);
    expect(((await plain.json()) as { unverified: string[] }).unverified).toEqual([]);

    // Asked to, it adds a total it worked out, which the check flags.
    const res = await page.request.post("/api/exhbts/draft", { data: { text: material, notes: "stand-in: add a figure to check" } });
    const { id, unverified } = (await res.json()) as { id: string; unverified: string[] };
    expect(unverified).toEqual(["2820"]);
    await page.goto(`/exhbts/${id}/edit`);
    await waitEditor(page);
    await page.getByRole("button", { name: "1 number to check" }).click();
    await expect(page.getByRole("list", { name: "Numbers to check" })).toContainText("Check this number: 2820");
    await page.keyboard.press("Escape");
    await openFigures(page, 1);
    const g = graph(page, 1);
    await expect(g.getByRole("radio", { name: "Bars", exact: true })).toBeChecked();
    await expect(g.getByLabel("Graph 1, bar 3 label")).toHaveValue("Worked-out total");
    await expect(g.getByLabel("Graph 1, bar 3 Value")).toHaveValue("2820");
  });

  test("protect the real numbers: the page shows only the change, and the typed figures never reach the published page", async ({ page }) => {
    const title = "Graphs six: confidential revenue";
    const RAW = ["48317", "48,317", "52904", "52,904", "61230", "61,230"];
    await signInAs(page, "gabe");
    await startWithBasics(page, title);
    const g = await addGraph(page, 1, "Line", "Weekly revenue");
    await fill(g, [["Unit (optional)", "£"], ["Graph 1, line 1 name", "Shop"], ["Graph 1, point 1 label", "Opening week"], ["Graph 1, point 1 Shop", "48317"], ["Graph 1, point 2 label", "Next week"], ["Graph 1, point 2 Shop", "52904"]]);
    await g.getByRole("button", { name: "Add a point to graph 1" }).click();
    await fill(g, [["Graph 1, point 3 label", "Last week"], ["Graph 1, point 3 Shop", "61230"]]);

    // As typed, the preview prints the figures.
    const card = g.locator("figure[data-chart]");
    await expect(card.getByText("£61,230", { exact: true }).first()).toBeVisible();
    await g.getByLabel("Protect the real numbers").selectOption({ label: "Yes: show an index, each line's first point = 100" });
    await expect(card.getByText("126.7", { exact: true }).first()).toBeVisible();
    await g.getByLabel("Protect the real numbers").selectOption({ label: "Yes: show the change from each line's first point, in %" });
    await expect(card.getByText("+26.7%", { exact: true }).first()).toBeVisible();
    await expect(card.getByText("£61,230", { exact: true })).toHaveCount(0);
    await expect(card).toContainText("The real figures aren't shared.");

    await publish(page, { changes: true });
    const url = `/p/gabe/${slugify(title)}`;
    await page.goto(url);
    await shows(page, "Weekly revenue", ["+9.5%", "+26.7%"], /Shown as the change from each line's first point, in %\. The real figures aren't shared\.$/);
    await expect(figure(page, "Weekly revenue")).toContainText("The real figures aren't shared.");
    // Not in the page, its data or its table, nor on the portfolio's front page.
    for (const path of [url, "/p/gabe"]) {
      const html = await (await page.request.get(path)).text();
      for (const raw of RAW) expect(html, `${path} has ${raw}`).not.toContain(raw);
    }
    await axe(page, "protected graph");

    // The draft keeps what was typed, so it can still be edited.
    await page.goto("/exhbts");
    await page.getByRole("link", { name: `Edit ${title}` }).click();
    await waitEditor(page);
    await openFigures(page, 1);
    await expect(graph(page, 1).getByLabel("Graph 1, point 3 Shop")).toHaveValue("61230");
  });
});
