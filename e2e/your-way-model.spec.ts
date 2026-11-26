import { expect, test } from "@playwright/test";
import {
  attributionOf,
  besideOf,
  emptyDoc,
  ExhbtDocSchema,
  filledFlow,
  formatLimits,
  hasBody,
  isBlank,
  LIMITS,
  publicDoc,
  richOf,
  SCHEMA_VERSION,
  suggestionsFor,
  text,
  trimRuns,
  validateForPublish,
  wordCount,
  type Chart,
  type ContentSection,
  type ExhbtDoc,
  type Section,
} from "../lib/exhbt/blocks";
import { flowHeading, FORMAT_RULES, FORMATS, refsHeading, sectionHeading, titleShown, type Format } from "../lib/exhbt/formats";
import { applyTemplate, blockOptions, flowShown, insertBlock, pageItems, removeItem, restoreFlow } from "../lib/exhbt/layouts";
import { sectionWords } from "../lib/exhbt/sections";
import { cardWords } from "../components/editor/model";
import { beforeAfterDoc, buildDoc, essayDoc, eventDoc, fullDoc, galleryDoc, researchDoc } from "../lib/exhbt/sample";

/*
 * Decision 0032, "write it your way", as pure functions (no page): formatting kept beside a plain string,
 * a part's own title, what counts as empty, what still stops publishing and what is only suggested, and
 * the flowchart leaving any layout. The browser's side is e2e/your-way.spec.ts; the build before 0032
 * reading these docs is e2e/step-back.spec.ts.
 */

const FLOW = { id: "flow", kind: "flow" } as const;
type Of<K extends ContentSection["kind"]> = Extract<ContentSection, { kind: K }>;
const bar: Chart = { kind: "bar", title: "Waits (min)", unit: "min", rows: [{ label: "Before", value: 11 }, { label: "After", value: 4 }] };
const findings = (items = [text("Waits fell from 11 to 4 minutes."), text("Sales held.")]): Of<"findings"> => ({ id: "findings", kind: "findings", items });
const graph = (chart: Chart = bar): Of<"graph"> => ({ id: "graph-1", kind: "graph", chart });
const image = (n = 1, extra: Partial<Of<"image">> = {}): Of<"image"> => ({ id: `image-${n}`, kind: "image", fileId: `f${n}`, alt: "A queue at the till", caption: [], ...extra });
const quote = (extra: Partial<Of<"quote">> = {}): Of<"quote"> => ({ id: "quote-1", kind: "quote", text: "Lunch is calmer now.", name: "Priya Shah", role: "Manager", ...extra });
const next = (words = "Time the evening queue too."): Of<"reflection"> => ({ id: "reflection-1", kind: "reflection", text: text(words) });
const link = (extra: Partial<Of<"link">> = {}): Of<"link"> => ({ id: "link-1", kind: "link", href: "https://example.com/code", label: "The code", description: "", ...extra });
const aim = (words = "To cut the queue."): Of<"aim"> => ({ id: "aim-1", kind: "aim", text: text(words) });
const conclusion = (words = "It worked."): Of<"conclusion"> => ({ id: "conclusion-1", kind: "conclusion", text: text(words) });
const pull = (words = "The law moved before the people did."): Of<"pullquote"> => ({ id: "pullquote-1", kind: "pullquote", text: words });

const core = (sections: Section[], format?: Format, extra: Partial<ExhbtDoc> = {}): ExhbtDoc => ({
  schemaVersion: SCHEMA_VERSION,
  ...(format && format !== "case-study" ? { format } : {}),
  title: "Shorter queues",
  context: "Year 2 module",
  skills: ["Excel"],
  gap: text("Would a second till help?"),
  flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
  sections,
  ...extra,
});
const messages = (d: ExhbtDoc) => validateForPublish(d).map((i) => `${i.path}: ${i.message}`);
const suggested = (d: ExhbtDoc) => suggestionsFor(d).map((i) => `${i.path}: ${i.message}`);
const ids = (d: ExhbtDoc) => pageItems(d).map((it) => it.id);

test.describe("Formatting kept beside a plain string", () => {
  test("richOf uses the runs only while they spell the string and format something; besideOf keeps runs only when they do", () => {
    const runs = [{ t: "Lunch is " }, { t: "calmer", b: true }, { t: " now." }];
    expect(richOf("Lunch is calmer now.", runs)).toBe(runs);
    expect(richOf("Lunch is quieter now.", runs)).toEqual(text("Lunch is quieter now."));
    expect(richOf("Lunch is calmer now.", undefined)).toEqual(text("Lunch is calmer now."));
    expect(richOf("Lunch is calmer now.", text("Lunch is calmer now."))).toEqual(text("Lunch is calmer now."));
    expect(richOf("", undefined)).toEqual([]);
    expect(besideOf(runs)).toEqual({ words: "Lunch is calmer now.", runs });
    expect(besideOf(text("Plain words."))).toEqual({ words: "Plain words.", runs: undefined });
    expect(besideOf([])).toEqual({ words: "", runs: undefined });
  });

  test("trimRuns takes the spaces off the two ends and nothing else", () => {
    expect(trimRuns([{ t: "  Lunch is " }, { t: "calmer", i: true }, { t: " now.  " }])).toEqual([{ t: "Lunch is " }, { t: "calmer", i: true }, { t: " now." }]);
    expect(trimRuns([{ t: "  " }, { t: " calmer ", b: true }, { t: " " }])).toEqual([{ t: "calmer", b: true }]);
    expect(trimRuns([{ t: "   " }])).toEqual([]);
  });

  test("the plain string is what every count and check reads; a link in the runs must still be https", () => {
    const runs = [{ t: "Lunch is " }, { t: "calmer", b: true }, { t: " now." }];
    const d = core([FLOW, findings(), quote({ textRuns: runs })]);
    expect(wordCount(d)).toBe(wordCount(core([FLOW, findings(), quote()])));
    expect(ExhbtDocSchema.parse(d).sections[2]).toMatchObject({ text: "Lunch is calmer now.", textRuns: runs });
    expect(messages(d)).toEqual([]);
    expect(messages(core([FLOW, quote({ textRuns: [{ t: "Lunch is calmer now.", href: "http://example.com" }] })]))).toEqual(["sections.1.text: Links must start with https://."]);
  });
});

test.describe("What counts as empty", () => {
  test("a section is blank when it has nothing to show a visitor", () => {
    const blank: ContentSection[] = [
      findings([[], [{ t: "  " }]]),
      graph({ kind: "bar", title: "", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] }),
      quote({ text: " " }),
      quote({ text: "", name: "Priya Shah" }),
      next(""),
      aim(""),
      conclusion(""),
      pull(" "),
      link({ href: "", label: "", description: " " }),
    ];
    for (const s of blank) expect(isBlank(s), JSON.stringify(s)).toBe(true);
    const something: ContentSection[] = [
      findings([[], text("One point.")]),
      graph(),
      // A graph somebody has started is not blank: its own checks then apply.
      graph({ kind: "bar", title: "Waits", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] }),
      image(),
      quote({ name: "", role: "" }),
      next(),
      pull(),
      link({ label: "" }),
      link({ href: "", label: "A book" }),
      link({ href: "example.com", label: "" }),
    ];
    for (const s of something) expect(isBlank(s), JSON.stringify(s)).toBe(false);
  });

  test("a flowchart's boxes are the ones with words, and a page needs something besides its title", () => {
    expect(filledFlow([{ step: "One" }, { step: " " }, { step: "", detail: "a note" }, { step: "" }])).toEqual([{ step: "One" }, { step: "", detail: "a note" }]);
    const bare = { ...emptyDoc(), title: "Shorter queues" };
    expect(hasBody(bare)).toBe(false);
    expect(hasBody({ ...bare, gap: text("Why it mattered.") })).toBe(true);
    expect(hasBody({ ...bare, flow: [{ step: "Timed it" }] })).toBe(true);
    expect(hasBody({ ...bare, flow: [{ step: "Timed it" }], flowOff: true })).toBe(false);
    expect(hasBody({ ...bare, sections: [image()] })).toBe(true);
    // A kind the layout does not draw is not on the page.
    expect(hasBody({ ...bare, sections: [aim()] })).toBe(false);
  });

  test("the words on the page are the words a visitor sees: nothing blank is counted, a role only with a name, a title never", () => {
    const base = core([FLOW, findings(), quote()]);
    const n = wordCount(base);
    expect(wordCount(core([FLOW, findings(), quote({ name: "", role: "Manager" })]))).toBe(n - 3);
    expect(wordCount(core([FLOW, findings(), quote({ text: "" })]))).toBe(n - 7);
    expect(wordCount(core([FLOW, findings(), quote(), graph({ kind: "beforeAfter", title: "", beforeLabel: "Before", afterLabel: "After", lowerIsBetter: false, rows: [{ label: "", before: 0, after: 0 }] })]))).toBe(n);
    expect(wordCount(core([FLOW, { ...findings(), title: "What the tills showed" }, quote({ title: "From the manager" })], undefined, { flowTitle: "How I did it", refsTitle: "Reading" }))).toBe(n);
    // The classic editor's cards still add up to the page's total.
    const d = core([FLOW, findings([text("One."), []]), quote({ name: "", role: "Manager" }), next("")]);
    expect(Object.values(cardWords(d)).reduce<number>((a, b) => a + (b ?? 0), 0)).toBe(wordCount(d));
    expect(sectionWords(next(""))).toBe(0);
    expect(attributionOf({ name: " Priya Shah ", role: "Manager" })).toBe("Priya Shah, Manager");
    expect(attributionOf({ name: "Priya Shah", role: "" })).toBe("Priya Shah");
    expect(attributionOf({ name: "", role: "Manager" })).toBe("");
  });
});

test.describe("What still stops publishing, and what no longer does", () => {
  test("nothing has to be filled in: every part left empty publishes, and so does a quote with no name", () => {
    const d = core([FLOW, findings([text("Waits fell."), []]), quote({ name: "", role: "" }), next(""), link({ href: "", label: "", description: "" }), graph({ kind: "bar", title: "", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] })], undefined, {
      gap: [],
      skills: ["Excel", ""],
      flow: [{ step: "Timed it" }, { step: "" }, { step: "" }],
    });
    expect(messages(d)).toEqual([]);
    // Each of these said "fill it in or remove it" before 0032.
    for (const sections of [[FLOW, findings([text("Waits fell."), text("Sales held."), []])], [FLOW, findings(), quote({ text: "" })], [FLOW, findings(), quote({ name: "" })], [FLOW, findings(), next("")], [FLOW, findings(), link({ label: "" })]] as Section[][])
      expect(messages(core(sections))).toEqual([]);
    expect(messages(core([FLOW, findings(), aim(""), conclusion("")], "research"))).toEqual([]);
    expect(messages(core([FLOW, findings(), pull("")], "essay"))).toEqual([]);
    expect(messages(core([FLOW, findings()], undefined, { gap: [] }))).toEqual([]);
    expect(messages(core([FLOW, findings()], undefined, { flow: [{ step: "Timed it" }, { step: "" }] }))).toEqual([]);
    expect(messages(core([FLOW, findings([text("One point.")])]))).toEqual([]);
  });

  test("a title, and something on the page besides it", () => {
    expect(messages({ ...emptyDoc() })).toEqual(["title: Add a title.", "gap: Add something besides the title: a line of context here, or a section below."]);
    expect(messages({ ...emptyDoc(), title: "Shorter queues" })).toEqual(["gap: Add something besides the title: a line of context here, or a section below."]);
    expect(messages({ ...emptyDoc(), title: "Shorter queues", gap: text("Why it mattered.") })).toEqual([]);
    expect(messages({ ...emptyDoc(), title: "Shorter queues", flow: [{ step: "Timed it" }] })).toEqual([]);
  });

  test("the limits that keep the page's shape, the page's words, and what keeps it honest and readable", () => {
    const long = (n: number) => "x".repeat(n);
    expect(messages(core([FLOW, findings()], undefined, { title: long(81) }))).toEqual(["title: Keep the title to 80 characters."]);
    expect(messages(core([FLOW, findings()], undefined, { context: long(91), whereWhen: long(61), myRole: long(61) }))).toEqual([
      'context: Keep "What it is" to 90 characters.',
      'whereWhen: Keep "Where and when" to 60 characters.',
      'myRole: Keep "My role" to 60 characters.',
    ]);
    expect(messages(core([FLOW, findings()], undefined, { skills: ["a", "b", "c", "d", "e", "f", "one two three four"] }))).toEqual(["skills: Up to 6 skills.", "skills.6: Keep each skill short."]);
    expect(messages(core([FLOW, findings()], undefined, { flow: Array.from({ length: 7 }, (_, i) => ({ step: i === 0 ? "one two three four five six seven eight nine" : `Step ${i}`, detail: i === 1 ? "one two three four five six seven" : undefined })) }))).toEqual([
      "flow: Up to 6 boxes in the flowchart.",
      "flow.0.step: Keep each box to 8 words.",
      "flow.1.detail: Keep the detail to 6 words.",
    ]);
    expect(messages(core([FLOW, findings(Array.from({ length: 5 }, (_, i) => text(`Point ${i + 1}.`))), quote({ name: long(61), role: long(61) }), link({ label: "one two three four five six seven eight nine" })]))).toEqual([
      "sections.1.items: Up to 4 findings.",
      "sections.2.name: Keep the name to 60 characters.",
      "sections.2.role: Keep the role to 60 characters.",
      "sections.3.label: Keep the label to 8 words.",
    ]);
    expect(messages(core([FLOW, findings(), quote(), { ...quote(), id: "quote-2" }, graph(), { ...graph(), id: "graph-2" }, { ...graph(), id: "graph-3" }]))).toEqual(["sections: Up to 2 graphs.", "sections: Only one quote."]);
    // A picture needs its description, and a figure from the person's files its tick.
    expect(messages(core([FLOW, image(1, { alt: "" }), image(2, { picked: { from: "report.pdf", page: 3, shareOk: false } })]))).toEqual([
      "sections.1.alt: Describe the image for people who can't see it.",
      "sections.2.picked.shareOk: Tick that you may share this figure, or remove it.",
    ]);
    // A link that goes nowhere, a link that is not https, and a graph left half made.
    expect(messages(core([FLOW, findings(), link({ href: "" })]))).toEqual(["sections.2.href: Use a full https:// link."]);
    expect(messages(core([FLOW, findings(), link({ href: "http://example.com" })]))).toEqual(["sections.2.href: Use a full https:// link."]);
    expect(messages(core([FLOW, findings([[{ t: "See the log", href: "http://example.com/log" }]])]))).toEqual(["sections.1.items.0: Links must start with https://."]);
    expect(messages(core([FLOW, graph({ kind: "bar", title: "Waits", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] })]))).toEqual(["sections.1.chart.rows.0.label: Name this bar or remove it.", "sections.1.chart.rows.1.label: Name this bar or remove it."]);
    expect(messages(core([FLOW, findings()], undefined, { evidence: { kind: "link", href: "example.com/report", label: "The report" } }))).toEqual(["evidence: Use a full https:// link to the work."]);
    // The page's own total.
    const wordy = core([FLOW, findings([text(Array.from({ length: 201 }, (_, i) => `w${i}`).join(" "))])]);
    expect(messages(wordy)).toEqual([`: Keep the whole exhbt to 200 words (it's ${wordCount(wordy)}).`]);
  });

  test("a part's own title is one line of at most the limit, wherever it is kept", () => {
    const over = "x".repeat(LIMITS.sectionTitleChars + 1);
    const at = "x".repeat(LIMITS.sectionTitleChars);
    const m = `Keep this title to ${LIMITS.sectionTitleChars} characters.`;
    expect(messages(core([FLOW, { ...findings(), title: at }, quote({ title: at }), { ...next(), title: at }], undefined, { flowTitle: at, refsTitle: at }))).toEqual([]);
    expect(messages(core([FLOW, { ...findings(), title: over }, quote({ title: over }), { ...next(), title: over }], undefined, { flowTitle: over, refsTitle: over }))).toEqual([
      `flowTitle: ${m}`,
      `refsTitle: ${m}`,
      `sections.1.title: ${m}`,
      `sections.2.title: ${m}`,
      `sections.3.title: ${m}`,
    ]);
    expect(messages(core([FLOW, findings(), { ...aim(), title: over }, { ...conclusion(), title: over }], "research"))).toEqual([`sections.2.title: ${m}`, `sections.3.title: ${m}`]);
    // A flowchart off the page is kept, not checked.
    expect(messages(core([findings()], undefined, { flowOff: true, flowTitle: over }))).toEqual([]);
  });
});

test.describe("Suggestions: what a layout usually has, and nothing requires", () => {
  /** Each layout's sample with one of the things it used to need taken away, the suggestion that must be listed, and nothing to fix. */
  const cases: { format: Format; doc: ExhbtDoc; says: string }[] = [
    { format: "case-study", doc: core([FLOW, quote()]), says: "sections: Add findings or a graph, so the exhbt shows what came of the work." },
    { format: "gallery", doc: { ...galleryDoc(["g1"]), sections: galleryDoc(["g1"]).sections.filter((s, i, all) => s.kind !== "image" || all.findIndex((x) => x.kind === "image") === i) }, says: "sections: A gallery works best with at least 2 images." },
    { format: "research", doc: { ...researchDoc("r1"), sections: researchDoc("r1").sections.filter((s) => s.kind !== "aim") }, says: "sections: Add your aim or hypothesis." },
    { format: "build", doc: { ...buildDoc(["b1", "b2"]), sections: buildDoc(["b1", "b2"]).sections.filter((s) => s.kind !== "image" && s.kind !== "link") }, says: "sections: Add a screenshot or a link, so people can see it working." },
    { format: "essay", doc: { ...essayDoc(), sections: essayDoc().sections.filter((s) => s.kind !== "findings") }, says: "sections: Add your key points." },
    { format: "before-after", doc: { ...beforeAfterDoc(["a1", "a2", "a3", "a4"]), sections: beforeAfterDoc(["a1", "a2", "a3", "a4"]).sections.map((s) => (s.kind === "image" ? { ...s, stage: undefined } : s)) }, says: "sections: Mark one image Before and one After." },
    { format: "event", doc: { ...eventDoc(["v1", "v2", "v3"]), myRole: "" }, says: "myRole: Say what your role was." },
  ];
  for (const c of cases) {
    test(`${FORMAT_RULES[c.format].name}: publishes without it, and the suggestion says so`, () => {
      expect(c.doc.format ?? "case-study").toBe(c.format);
      expect(messages(c.doc)).toEqual([]);
      expect(suggested(c.doc)).toContain(c.says);
    });
  }

  test("every layout's sample has nothing to fix and nothing suggested", () => {
    const samples: ExhbtDoc[] = [fullDoc, galleryDoc(["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"]), researchDoc("r1"), buildDoc(["b1", "b2", "b3"]), essayDoc("e1"), beforeAfterDoc(["a1", "a2", "a3", "a4"]), eventDoc(["v1", "v2", "v3", "v4"])];
    expect(samples.map((d) => d.format ?? "case-study")).toEqual([...FORMATS]);
    for (const d of samples) {
      expect(messages(d), d.title).toEqual([]);
      expect(suggested(d), d.title).toEqual([]);
    }
  });

  test("every unmet need of a layout is suggested, in its order, and only what a visitor would see answers one", () => {
    expect(suggested(core([], "research"))).toEqual(["sections: Add your aim or hypothesis.", "sections: Add your conclusion.", "sections: Add a graph or an image: the key figure.", "sections: Add your results."]);
    expect(suggested(core([], "before-after"))).toEqual(["sections: A before and after works best with at least 2 images.", "sections: Mark one image Before and one After.", "sections: Add what changed and why."]);
    expect(suggested(core([], "event"))).toEqual(["sections: Add at least one picture, such as the poster.", "myRole: Say what your role was."]);
    // An aim with no words is not drawn, so it answers nothing; with words it does.
    expect(suggested(core([FLOW, aim(""), conclusion(), graph(), findings()], "research"))).toEqual(["sections: Add your aim or hypothesis."]);
    expect(suggested(core([FLOW, aim(), conclusion(), graph(), findings()], "research"))).toEqual([]);
    // A new exhbt's empty findings do not count as findings either.
    expect(suggested({ ...emptyDoc(), title: "Shorter queues", gap: text("Why it mattered.") })).toEqual(["sections: Add findings or a graph, so the exhbt shows what came of the work."]);
  });

  test("a short flowchart and a single point are suggestions too, each at its own place", () => {
    const d = core([FLOW, findings([text("One point.")])], undefined, { flow: [{ step: "Timed it" }, { step: "Timed it again" }, { step: "" }] });
    expect(messages(d)).toEqual([]);
    expect(suggested(d)).toEqual([`flow: Most flowcharts have at least ${LIMITS.flow.min} boxes. Add another if it helps.`, `sections.1.items: Most pages have at least ${LIMITS.findings.min} points here. Add another if you have one.`]);
    // Where the layout's own least is one point, one is enough; an empty flowchart or findings section is simply not drawn.
    expect(formatLimits("gallery").findings.min).toBe(1);
    expect(suggested(core([FLOW, image(1), image(2), findings([text("One point.")])], "gallery"))).toEqual([]);
    expect(suggested(core([FLOW, graph()], undefined, { flow: [{ step: "" }, { step: "" }, { step: "" }] }))).toEqual([]);
  });
});

test.describe("The flowchart can be taken off any layout", () => {
  for (const format of FORMATS) {
    test(`${FORMAT_RULES[format].name}: off, offered back, and back where it is put`, () => {
      const d = core([FLOW, findings(), quote()], format);
      const off = removeItem(d, "flow");
      expect(flowShown(off)).toBe(false);
      expect(off.flowOff).toBe(true);
      expect(off.flow).toEqual(d.flow);
      expect(ids(off)).toEqual(["findings", "quote-1"]);
      expect(blockOptions(off).at(-1)).toEqual({ kind: "flow", name: "Flowchart" });
      expect(blockOptions(d).some((o) => o.kind === "flow")).toBe(false);
      // Its words (eight, in its three boxes) are not counted and its boxes are not checked while it is off.
      expect(wordCount(off)).toBe(wordCount(d) - 8);
      expect(messages({ ...off, flow: Array.from({ length: 7 }, () => ({ step: "one two three four five six seven eight nine" })) })).toEqual([]);
      // Back by the "+": at the place chosen, with its boxes.
      const back = insertBlock(off, "flow", 1)!;
      expect(back.id).toBe("flow");
      expect(ids(back.doc)).toEqual(["findings", "flow", "quote-1"]);
      expect("flowOff" in back.doc).toBe(false);
      expect(restoreFlow(off).flow).toEqual(d.flow);
      // The published copy has no flowchart either.
      expect(ids(publicDoc(off))).toEqual(["findings", "quote-1"]);
      expect(publicDoc(off).flow).toEqual([]);
    });
  }

  test("a layout switch leaves a flowchart that was taken off where the person left it: off", () => {
    const off = removeItem(core([FLOW, findings(), image(1), image(2)], "gallery"), "flow");
    for (const to of FORMATS) {
      const switched = applyTemplate(off, to);
      expect(flowShown(switched), to).toBe(false);
      expect(ids(switched).includes("flow"), to).toBe(false);
      expect(switched.flow).toEqual(off.flow);
    }
  });
});

test.describe("A part's own title", () => {
  test("the layout's heading until one is typed, the person's from then on, none once it is cleared", () => {
    expect(titleShown(undefined, "What I found")).toBe("What I found");
    expect(titleShown("  The tills  ", "What I found")).toBe("The tills");
    expect(titleShown("", "What I found")).toBe("");
    expect(titleShown(undefined, "")).toBe("");
    expect(FORMATS.map(flowHeading)).toEqual(["", "What I did", "Method", "How I built it", "How the argument runs", "What I did", "How we put it on"]);
    expect(FORMATS.map(refsHeading)).toEqual(["Link", "Link", "References", "Link", "Sources", "Link", "Link"]);
    expect([findings(), quote(), next(), aim(), { ...aim(), heading: "hypothesis" }, conclusion(), graph(), image(), link(), pull()].map((s) => sectionHeading(s, "research"))).toEqual([
      "Results",
      "Feedback",
      "Limitations and next steps",
      "Aim",
      "Hypothesis",
      "Conclusion",
      null,
      null,
      null,
      null,
    ]);
    expect(sectionHeading(quote(), "event")).toBe("Review");
  });

  test("a layout switch keeps a title the person typed; one they never touched follows the new layout", () => {
    const d = core([FLOW, { ...findings(), title: "What the tills showed" }, quote(), { ...next(), title: "" }], undefined, { flowTitle: "How I did it" });
    for (const to of FORMATS) {
      const switched = applyTemplate(d, to);
      const found = switched.sections.find((s) => s.kind === "findings") as Of<"findings">;
      const said = switched.sections.find((s) => s.kind === "quote") as Of<"quote">;
      const then = switched.sections.find((s) => s.kind === "reflection") as Of<"reflection">;
      // Typed: kept. Cleared: still cleared. Never touched: the new layout's own.
      expect(titleShown(found.title, sectionHeading(found, to)!)).toBe("What the tills showed");
      expect(titleShown(then.title, sectionHeading(then, to)!)).toBe("");
      expect(said.title).toBeUndefined();
      expect(titleShown(said.title, sectionHeading(said, to)!)).toBe(to === "event" ? "Review" : "Feedback");
      expect(titleShown(switched.flowTitle, flowHeading(to))).toBe("How I did it");
    }
    // The flowchart's title stays with its boxes while it is off the page, and comes back with it.
    const off = removeItem(d, "flow");
    expect(off.flowTitle).toBe("How I did it");
    expect(pageItems(restoreFlow(off)).find((it) => it.kind === "flow")).toMatchObject({ title: "How I did it" });
    expect("title" in pageItems(core([FLOW, findings()]))[0]!).toBe(false);
  });
});

test.describe("The published copy holds only what a visitor is shown", () => {
  test("blank sections, empty findings, empty boxes, empty skills and a role with no name stay in the working copy", () => {
    const working = core([FLOW, findings([text("Waits fell."), [], text("Sales held.")]), quote({ name: "", role: "Manager" }), next(""), graph(), link({ href: "", label: "", description: "" })], undefined, {
      skills: ["Excel", ""],
      flow: [{ step: "Timed it" }, { step: "" }, { step: "Timed it again" }],
    });
    const live = publicDoc(working);
    expect(live.sections.map((s) => s.id)).toEqual(["flow", "findings", "quote-1", "graph-1"]);
    expect((live.sections[1] as Of<"findings">).items).toEqual([text("Waits fell."), text("Sales held.")]);
    expect(live.sections[2]).toMatchObject({ name: "", role: "" });
    expect(live.flow).toEqual([{ step: "Timed it" }, { step: "Timed it again" }]);
    expect(live.skills).toEqual(["Excel"]);
    // Nothing in the working copy was touched, and a doc with nothing blank is published as it is.
    expect(working.sections).toHaveLength(6);
    expect(working.flow).toHaveLength(3);
    const full = core([FLOW, findings(), quote(), next(), link()]);
    expect(publicDoc(full)).toEqual(full);
    // A flowchart with no box filled in keeps its marker and its place, and goes live with no boxes: the page draws none for it.
    const none = publicDoc(core([findings(), FLOW, quote()], undefined, { flow: [{ step: "" }, { step: " " }] }));
    expect(none.sections.map((s) => s.id)).toEqual(["findings", "flow", "quote-1"]);
    expect(none.flow).toEqual([]);
  });
});
