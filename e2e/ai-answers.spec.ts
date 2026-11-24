import { expect, test } from "@playwright/test";
import { z } from "zod/v4";
import { DraftSchema, repairDraft, toChart, type DraftChart } from "../lib/ai/draft-answer";
import { repairIdeas, repairPick, repairRoadmap, repairSwap } from "../lib/ai/repair";
import { ProjectSchema, RoadmapModelSchema } from "../lib/ai/schemas";
import { FIGURE_KINDS } from "../lib/exhbt/blocks";

/**
 * Reading the AI's answers (decision 0029): the repairs that let one stray value cost a graph or a
 * list item rather than the whole feature, and how a drafted graph becomes a stored one. Pure
 * functions, no browser and no AI.
 */

const chart = (over: Omit<Partial<DraftChart>, "kind"> & { kind: string }): DraftChart =>
  ({ title: "T", xTitle: "", yTitle: "", unit: "", lowerIsBetter: false, series: [], rows: [], cells: [], ...over }) as DraftChart;

const draft = (over: Record<string, unknown> = {}) => ({
  format: "case-study",
  formatReason: "question-findings",
  title: "Q?",
  summary: "S",
  context: "",
  whereWhen: "",
  skills: [],
  gap: "",
  gapHighlight: "",
  flow: [{ step: "One", detail: "" }],
  findings: ["F"],
  charts: [],
  quote: { text: "", name: "", role: "" },
  next: "",
  aim: "",
  aimIsHypothesis: false,
  conclusion: "",
  references: [],
  numbers: [],
  ...over,
});

test.describe("The draft's answer, repaired", () => {
  test("an unknown layout becomes a case study, and the strict schema then passes", () => {
    const raw = draft({ format: "poster" });
    expect(DraftSchema.safeParse(raw).success).toBe(false);
    const fixed = repairDraft(raw) as { format: string };
    expect(fixed.format).toBe("case-study");
    expect(DraftSchema.safeParse(fixed).success).toBe(true);
  });

  test("a layout the draft may not choose yet (one of release 4's) becomes a case study too", () => {
    const raw = draft({ format: "build" });
    expect(DraftSchema.safeParse(raw).success).toBe(false);
    const fixed = repairDraft(raw) as { format: string };
    expect(fixed.format).toBe("case-study");
    expect(DraftSchema.safeParse(fixed).success).toBe(true);
  });

  test("an unknown reason for the layout becomes 'default' (no reason is said), and the draft is kept", () => {
    const raw = draft({ format: "research", formatReason: "it reads like a lab report" });
    expect(DraftSchema.safeParse(raw).success).toBe(false);
    const fixed = repairDraft(raw) as { format: string; formatReason: string };
    expect(fixed).toMatchObject({ format: "research", formatReason: "default" });
    expect(DraftSchema.safeParse(fixed).success).toBe(true);
  });

  test("a missing reason becomes 'default', and a known one is left alone", () => {
    const without: Record<string, unknown> = draft();
    delete without.formatReason;
    expect(DraftSchema.safeParse(without).success).toBe(false);
    expect((repairDraft(without) as { formatReason: string }).formatReason).toBe("default");
    expect((repairDraft(draft({ formatReason: "notes" })) as { formatReason: string }).formatReason).toBe("notes");
  });

  test("a graph of an unknown kind is dropped and the other graphs stay", () => {
    const bar = chart({ kind: "bar", rows: [{ label: "A", values: [1] }, { label: "B", values: [2] }] });
    const raw = draft({ charts: [chart({ kind: "pie" }), bar] });
    expect(DraftSchema.safeParse(raw).success).toBe(false);
    const fixed = repairDraft(raw) as { charts: DraftChart[] };
    expect(fixed.charts.map((c) => c.kind)).toEqual(["bar"]);
    expect(DraftSchema.safeParse(fixed).success).toBe(true);
  });

  test("toChart returns no graph, rather than throwing, for a kind it doesn't know", () => {
    expect(toChart(chart({ kind: "pie", rows: [{ label: "A", values: [1] }] }))).toBeNull();
  });

  test("an answer that is wrong in a way repair can't fix still fails the strict schema", () => {
    expect(DraftSchema.safeParse(repairDraft(draft({ title: 5 }))).success).toBe(false);
  });
});

test.describe("The roadmap's answer, repaired", () => {
  const skill = (i: number, needed: number, current: number) => ({ skill: `S${i}`, needed, current, evidence: "" });
  const raw = {
    targetRole: "Analyst",
    summary: "S",
    strengths: Array.from({ length: 7 }, (_, i) => ({ skill: `S${i}`, evidence: "E" })),
    gaps: Array.from({ length: 7 }, (_, i) => ({ skill: `S${i}`, whyItMatters: "W", currentEvidence: i === 0 ? "weak" : "none" })),
    skillMap: [skill(0, 5, 2), skill(1, 3, -1), skill(2, 2.6, 1), skill(3, 1, 0), skill(4, 2, 2), skill(5, 1, 1), skill(6, 1, 1)],
  };

  test("the raw answer fails the strict schema", () => {
    expect(RoadmapModelSchema.safeParse(raw).success).toBe(false);
  });

  test("each list is cut to 6, levels are pulled into 0 to 4, and an unknown evidence value is read as none", () => {
    const fixed = repairRoadmap(raw) as z.infer<typeof RoadmapModelSchema>;
    expect(fixed.strengths).toHaveLength(6);
    expect(fixed.gaps).toHaveLength(6);
    expect(fixed.skillMap).toHaveLength(6);
    expect(fixed.gaps[0]!.currentEvidence).toBe("none");
    expect(fixed.skillMap.map((s) => [s.needed, s.current])).toEqual([[4, 2], [3, 0], [3, 1], [1, 0], [2, 2], [1, 1]]);
    expect(RoadmapModelSchema.safeParse(fixed).success).toBe(true);
  });
});

test.describe("Project ideas and swaps, repaired", () => {
  const project = (weeks: number) => ({ title: "P", brief: "B", closesGaps: ["S"], deliverable: "D", weeks });
  const Ideas = z.object({ projects: z.array(ProjectSchema).max(3) });

  test("a fourth idea is cut and weeks are pulled into 1 to 12", () => {
    const raw = { projects: [project(24), project(0), project(4.4), project(6)] };
    expect(Ideas.safeParse(raw).success).toBe(false);
    const fixed = repairIdeas(raw, 3) as z.infer<typeof Ideas>;
    expect(fixed.projects.map((p) => p.weeks)).toEqual([12, 1, 4]);
    expect(Ideas.safeParse(fixed).success).toBe(true);
  });

  test("a swap of 24 weeks becomes 12", () => {
    const Swap = z.object({ project: ProjectSchema });
    const fixed = repairSwap({ project: project(24) }) as z.infer<typeof Swap>;
    expect(fixed.project.weeks).toBe(12);
    expect(Swap.safeParse(fixed).success).toBe(true);
  });
});

test.describe("The figure pick's answer, repaired", () => {
  // The answer's shape as lib/ai/figure-pick.ts sends it (that file is server-only, so the shape is restated here).
  const KINDS = [...FIGURE_KINDS, "none"] as const;
  const Answer = z.object({
    found: z.boolean(),
    image: z.number().nullable(),
    kind: z.enum(KINDS),
    box: z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() }).nullable(),
    alt: z.string(),
    caption: z.string(),
  });
  const pick = (kind: string) => ({ found: true, image: 2, kind, box: { left: 40, top: 60, right: 500, bottom: 400 }, alt: "A bar chart of queue times.", caption: "Queue times" });

  test("a kind outside the list is read as 'other', which takes nothing off the exhbt, and the pick is kept", () => {
    const raw = pick("bar chart");
    expect(Answer.safeParse(raw).success).toBe(false);
    const fixed = repairPick(raw, KINDS) as { kind: string };
    expect(fixed.kind).toBe("other");
    expect(Answer.safeParse(fixed).success).toBe(true);
  });

  test("a kind in the list is left alone, 'none' included", () => {
    for (const k of KINDS) expect((repairPick(pick(k), KINDS) as { kind: string }).kind).toBe(k);
  });
});

test.describe("Big numbers: each unit beside its own figure", () => {
  const rows = [
    { label: "Paid members", values: [186] },
    { label: "Money raised", values: [2450] },
    { label: "Happy with sessions", values: [91, 64] },
  ];
  const tiles = (c: ReturnType<typeof toChart>) => (c && c.kind === "numbers" ? c.tiles : []);

  test("one series entry per row: each tile takes its own unit, and [value, from] stays in that order", () => {
    const t = tiles(toChart(chart({ kind: "numbers", rows, series: ["", "£", "%"] })));
    expect(t).toEqual([
      { value: 186, label: "Paid members" },
      { value: 2450, label: "Money raised", unit: "£" },
      { value: 91, label: "Happy with sessions", unit: "%", from: 64 },
    ]);
  });

  test("a series shorter than the rows gives no units, so none lands on the wrong figure", () => {
    const t = tiles(toChart(chart({ kind: "numbers", rows, series: ["£", "%"] })));
    expect(t.map((x) => ("unit" in x ? x.unit : undefined))).toEqual([undefined, undefined, undefined]);
  });

  test("with no series, the shared unit field is every tile's unit", () => {
    const t = tiles(toChart(chart({ kind: "numbers", rows: [rows[2]!, { label: "Came back", values: [64] }], unit: "%" })));
    expect(t.map((x) => x.unit)).toEqual(["%", "%"]);
  });

  test("a unit that repeats its tile's label is a name, and is dropped", () => {
    const t = tiles(toChart(chart({ kind: "numbers", rows, series: ["Paid members", "£", "%"] })));
    expect(t[0]).toEqual({ value: 186, label: "Paid members" });
    expect(t[1]!.unit).toBe("£");
  });
});

test.describe("Tables: the headings and the data", () => {
  test("headings in series: every row of cells is data", () => {
    const c = toChart(chart({ kind: "table", series: ["Week", "Score"], cells: [["Week 1", "12"], ["Week 2", "15"]] }));
    expect(c).toEqual({ kind: "table", title: "T", columns: ["Week", "Score"], rows: [["Week 1", "12"], ["Week 2", "15"]] });
  });

  test("years as headings in series are headings, not a data row", () => {
    const c = toChart(chart({ kind: "table", series: ["Measure", "2024", "2025"], cells: [["Members", "140", "236"]] }));
    expect(c && c.kind === "table" ? c.columns : []).toEqual(["Measure", "2024", "2025"]);
  });

  test("no series: the first row of cells is the headings", () => {
    const c = toChart(chart({ kind: "table", cells: [["Task", "What happened"], ["Find a room", "All five found one"]] }));
    expect(c).toEqual({ kind: "table", title: "T", columns: ["Task", "What happened"], rows: [["Find a room", "All five found one"]] });
  });

  test("headings that are bare figures are a data row, so the table is dropped", () => {
    expect(toChart(chart({ kind: "table", cells: [["Week 1", "12"], ["Week 2", "15"]] }))).toBeNull();
  });
});

test.describe("Scatter", () => {
  test("each row's values are [x, y], in that order", () => {
    const c = toChart(chart({ kind: "scatter", xTitle: "Hours of sleep", yTitle: "Reaction time", rows: [{ label: "A", values: [4.5, 312] }, { label: "B", values: [9] }] }));
    expect(c && c.kind === "scatter" ? c.points : []).toEqual([{ x: 4.5, y: 312, label: "A" }]);
  });
});
