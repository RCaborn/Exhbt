import { expect, test } from "@playwright/test";
import {
  ExhbtDocSchema,
  chartsOf,
  findingsOf,
  imagesOf,
  normaliseDoc,
  publicDoc,
  SCHEMA_VERSION,
  sectionsOf,
  sectionTexts,
  text,
  validateForPublish,
  wordCount,
  type Chart,
  type ContentSection,
  type ExhbtDoc,
  type Section,
  type SectionKind,
} from "../lib/exhbt/blocks";
import { FORMAT_RULES, FORMATS, fromWorkOf, hiddenSections, OFFERED_FORMATS, offeredIn, shownSections, withFormat, type Format } from "../lib/exhbt/formats";
import { tileFromDoc } from "../lib/exhbt/headline";
import { adopt, applyTemplate, blockOptions, flowShown, hasMarker, insertBlock, insertImage, isArranged, keptItems, moveItem, pageItems, removeItem, restoreFlow, rowsFor, structureKey, type Cell, type ItemCell, type Row } from "../lib/exhbt/layouts";
import { layoutNotes, newSection, roomFor, sectionLabel, sectionName, withKeyFigure, withWorkVisual } from "../lib/exhbt/sections";
import { pathOfNumber } from "../lib/exhbt/verify";
import { readAiVersion } from "../lib/exhbt/draft-blocks";
import { ORDER_FIXTURES, SAMPLE_FIXTURES, todayCaseRows, todayGalleryRows, todayResearchRows, type OrderFixture } from "./fixtures/order-docs";
import { OLD_FORMATS, OLD_SECTION_KINDS, OldExhbtDocSchema } from "./fixtures/reader-before-r2";

// The model and the layout engine (decisions 0027 and 0028), as pure functions: no page.

/* ---------------- Helpers ---------------- */

const FLOW = { id: "flow", kind: "flow" } as const;
const bar: Chart = { kind: "bar", title: "Waits (min)", unit: "min", rows: [{ label: "Before", value: 11 }, { label: "After", value: 4 }] };
const findings = (): ContentSection => ({ id: "findings", kind: "findings", items: [text("Waits fell from 11 to 4 minutes."), text("Sales held.")] });
const graph = (n = 1): ContentSection => ({ id: `graph-${n}`, kind: "graph", chart: bar });
const image = (n = 1, stage?: "before" | "after"): ContentSection => ({ id: `image-${n}`, kind: "image", fileId: `f${n}`, alt: "A queue", caption: text(`Picture ${n}`), ...(stage ? { stage } : {}) });
const quote = (): ContentSection => ({ id: "quote-1", kind: "quote", text: "Lunch is calmer now.", name: "Priya Shah", role: "Manager" });
const next = (): ContentSection => ({ id: "reflection-1", kind: "reflection", text: text("Time the evening queue too.") });
const link = (n = 1, href = "https://example.com/code"): ContentSection => ({ id: `link-${n}`, kind: "link", href, label: `Source ${n}`, description: "" });
const aim = (): ContentSection => ({ id: "aim-1", kind: "aim", text: text("To cut the queue.") });
const conclusion = (): ContentSection => ({ id: "conclusion-1", kind: "conclusion", text: text("It worked.") });
const pull = (): ContentSection => ({ id: "pullquote-1", kind: "pullquote", text: "The law moved before the people did." });

/** A complete core with these sections, in a layout. */
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

const itemStr = (c: ItemCell) => (c.as === "plain" ? c.item.id : `${c.item.id}:${c.as}`);
const cellStr = (c: Cell): string => (c.cell === "item" ? itemStr(c) : `${c.name}[${c.items.map((i) => i.item.id).join(", ")}]`);
/** The rows as the fixtures write them (e2e/fixtures/order-docs.ts). */
const rowStr = (r: Row): string =>
  r.row === "one" ? cellStr(r.cell) : r.row === "pair" ? `${r.ratio}${r.reversed ? "~" : ""}(${cellStr(r.left)}, ${cellStr(r.right)})` : `${r.of}[${r.items.map(itemStr).join(", ")}]`;
const rows = (d: ExhbtDoc, skip?: (s: ContentSection) => boolean) => rowsFor(pageItems(d, skip), formatOf(d)).map(rowStr);
const formatOf = (d: ExhbtDoc): Format => FORMAT_RULES[d.format as Format] ? (d.format as Format) : "case-study";
const ids = (d: ExhbtDoc) => d.sections.map((s) => s.id);
const itemIds = (d: ExhbtDoc, skip?: (s: ContentSection) => boolean) => pageItems(d, skip).map((it) => it.id);
const skipOf = (f: OrderFixture) => (f.skip ? (s: ContentSection) => f.skip!.includes(s.id) : undefined);
const FIXTURES = [...SAMPLE_FIXTURES, ...ORDER_FIXTURES];
const docOf = (f: OrderFixture) => normaliseDoc(f.doc);
const messages = (d: ExhbtDoc) => validateForPublish(d).map((i) => `${i.path}: ${i.message}`);

/* ---------------- The schema ---------------- */

test.describe("The model: the marker and the new fields", () => {
  test("normaliseDoc keeps one marker, with the id flow, and drops flowOff beside it", () => {
    const two = normaliseDoc(core([FLOW, findings(), { id: "flow-2", kind: "flow" } as unknown as Section, graph()], "gallery", { flowOff: true }));
    expect(ids(two)).toEqual(["flow", "findings", "graph-1"]);
    expect("flowOff" in two).toBe(false);
    // A marker stored under another id still reads as "flow"; a section that had the id "flow" gets its own.
    const odd = normaliseDoc(core([{ id: "flow", kind: "quote", text: "a", name: "b", role: "" } as Section, { id: "x", kind: "flow" } as unknown as Section]));
    expect(odd.sections.map((s) => `${s.kind}:${s.id}`)).toEqual(["quote:quote-1", "flow:flow"]);
    // flowOff with no marker stays: the flowchart is off the page.
    expect(normaliseDoc(core([findings()], "gallery", { flowOff: true })).flowOff).toBe(true);
    // A kind or a layout this code doesn't know is still dropped.
    const later = normaliseDoc({ ...core([findings(), { id: "v-1", kind: "video" } as unknown as Section]), format: "timeline" });
    expect(ids(later)).toEqual(["findings"]);
    expect("format" in later).toBe(false);
  });

  test("a pull quote, a stage, My role, flowOff and every layout survive a read and a parse", () => {
    for (const format of FORMATS) {
      const d = core([FLOW, pull(), image(1, "before"), image(2, "after")], format, { myRole: "Stage manager" });
      const parsed = ExhbtDocSchema.parse(d);
      expect(parsed).toEqual(normaliseDoc(d));
      expect(parsed.format ?? "case-study").toBe(format);
      expect(parsed.myRole).toBe("Stage manager");
      expect(imagesOf(parsed).map((s) => s.stage)).toEqual(["before", "after"]);
      expect(sectionsOf(parsed, "pullquote")[0]!.text).toBe("The law moved before the people did.");
    }
    expect(ExhbtDocSchema.parse(core([findings()], "gallery", { flowOff: true })).flowOff).toBe(true);
    // A stage this code doesn't know reads as none.
    const odd = ExhbtDocSchema.parse(core([{ ...image(1), stage: "during" } as unknown as Section]));
    expect(imagesOf(odd)[0]!.stage).toBeUndefined();
  });

  test("all seven layouts are offered since release 4, the classic editor keeps to three, and the four new ones say what they take from the work", () => {
    expect(FORMATS).toEqual(["case-study", "gallery", "research", "build", "essay", "before-after", "event"]);
    expect(OFFERED_FORMATS).toEqual([...FORMATS]);
    expect(offeredIn("page")).toEqual([...FORMATS]);
    expect(offeredIn("classic")).toEqual(["case-study", "gallery", "research"]);
    expect(FORMATS.map((f) => fromWorkOf({ format: f }))).toEqual(["figure", "pictures", "figure", "figure", "none", "pictures", "pictures"]);
    expect(FORMATS.map((f) => FORMAT_RULES[f].flowRemovable)).toEqual([false, true, false, true, true, true, true]);
  });

  test("an old reader (the code before release 2) reads what later releases write as a page it can draw", () => {
    const later: ExhbtDoc[] = [
      ...FORMATS.map((format) => core([FLOW, findings(), pull(), image(1, "before"), graph()], format, { myRole: "Producer" })),
      core([findings(), image(1, "after")], "event", { flowOff: true, myRole: "Stage manager" }),
      publicDoc(core([findings(), image(1)], "gallery", { flowOff: true })),
    ];
    for (const d of later) {
      const old = OldExhbtDocSchema.parse(JSON.parse(JSON.stringify(d)));
      expect(old.sections.every((s) => (OLD_SECTION_KINDS as readonly string[]).includes(s.kind))).toBe(true);
      expect(old.format === undefined || (OLD_FORMATS as readonly string[]).includes(old.format)).toBe(true);
      // Nothing it can't hold is kept: no marker, no flowOff, no My role, no stage.
      expect(JSON.stringify(old)).not.toMatch(/"flowOff"|"myRole"|"stage"|"kind":"flow"|"kind":"pullquote"/);
    }
  });
});

/* ---------------- The AI version (step 9) ---------------- */

test.describe("The model: the AI version keeps the graphs a figure replaced", () => {
  test("a rewrite's read, change and write keeps the graphs; graphs that aren't charts read as none", () => {
    // What the rewrite action does: load (readAiVersion), change one block, save (JSON, as saveAiVersion writes it), load again.
    const stored = JSON.stringify({ blocks: { gap: text("The old context.") }, unverified: { gap: [] }, graphs: [bar] });
    const ai = readAiVersion(stored);
    expect(ai.graphs).toEqual([bar]);
    (ai.blocks as Record<string, unknown>).gap = text("The new context.");
    ai.unverified.gap = ["18%"];
    const again = readAiVersion(JSON.stringify(ai));
    expect(again.graphs).toEqual([bar]);
    expect(again.blocks.gap).toEqual(text("The new context."));
    expect(again.unverified.gap).toEqual(["18%"]);
    for (const graphs of [[{ kind: "nothing" }], "a graph", [bar, 42], undefined]) expect("graphs" in readAiVersion(JSON.stringify({ blocks: {}, unverified: {}, graphs }))).toBe(false);
    expect(readAiVersion(null)).toEqual({ blocks: {}, unverified: {} });
    expect(readAiVersion("not json")).toEqual({ blocks: {}, unverified: {} });
  });
});

/* ---------------- The helpers ---------------- */

test.describe("The model: helpers see content sections only", () => {
  test("every helper that returns sections leaves the marker out", () => {
    const d = core([graph(), FLOW, findings(), image(), aim()]);
    expect(shownSections(d).map((x) => x.s.id)).toEqual(["graph-1", "findings", "image-1"]);
    expect(shownSections(d).map((x) => x.i)).toEqual([0, 2, 3]);
    expect(hiddenSections(d).map((x) => x.s.id)).toEqual(["aim-1"]);
    expect(chartsOf(d)).toHaveLength(1);
    expect(imagesOf(d)).toHaveLength(1);
    expect(findingsOf(d)).toHaveLength(2);
    expect(sectionsOf(d, "findings")).toHaveLength(1);
    expect(sectionTexts(FLOW)).toEqual([]);
    expect(sectionTexts(pull())).toEqual(["The law moved before the people did."]);
    expect(sectionLabel(d.sections, 1)).toBe("Flowchart");
    expect(sectionName("pullquote", "essay")).toBe("Pull quote");
    expect(newSection("pullquote", d.sections)).toEqual({ id: "pullquote-1", kind: "pullquote", text: "" });
    expect(roomFor(d.sections, "graph")).toBe(1);
  });

  test("withKeyFigure on an arranged case study with no findings puts the figure straight after the marker", () => {
    const fig = { fileId: "key", alt: "The key figure" };
    expect(ids(withKeyFigure(core([quote(), FLOW, next()]), fig))).toEqual(["quote-1", "flow", "image-1", "reflection-1"]);
    // With no marker, as before: first.
    expect(ids(withKeyFigure(core([quote(), next()]), fig))).toEqual(["image-1", "quote-1", "reflection-1"]);
    // With findings, straight after them either way.
    expect(ids(withKeyFigure(core([FLOW, findings(), quote()]), fig))).toEqual(["flow", "findings", "image-1", "quote-1"]);
  });

  test("withWorkVisual leaves the marker where it is", () => {
    const r = withWorkVisual(core([FLOW, findings(), graph(), next()]), { fileId: "work", alt: "Their graph", kind: "graph" });
    expect(r.placed).toBe(true);
    expect(ids(r.doc)).toEqual(["flow", "findings", "image-1", "reflection-1"]);
  });
});

/* ---------------- Reading a removed flowchart, and publishing ---------------- */

test.describe("The model: a removed flowchart and the published copy", () => {
  test("a removed flowchart is not drawn, counted or checked, and goes live with no boxes", () => {
    const on = core([findings(), image(1), image(2)], "gallery");
    const off: ExhbtDoc = { ...on, flowOff: true, flow: [{ step: "" }] };
    expect(flowShown(off)).toBe(false);
    expect(isArranged(off)).toBe(true);
    // Arranged (flowOff), so drawn in its stored order.
    expect(pageItems(off).map((it) => it.id)).toEqual(["findings", "image-1", "image-2"]);
    expect(wordCount(off)).toBe(wordCount({ ...on, flow: [] }));
    expect(messages(off)).toEqual([]);
    expect(messages({ ...off, flowOff: undefined })).toEqual(["flow: The flowchart needs at least 3 boxes.", "flow.0.step: Type in this box or remove it."]);
    const pub = publicDoc(off);
    expect(pub.flow).toEqual([]);
    expect(pub.flowOff).toBe(true);
    expect(tileFromDoc(off).methodology).toEqual([]);
    expect(tileFromDoc(on).methodology).toHaveLength(3);
  });

  test("a case study and research always draw the flowchart, first when it has no marker", () => {
    for (const format of ["case-study", "research"] as const) {
      const d = core([findings(), graph()], format, { flowOff: true });
      expect(flowShown(d)).toBe(true);
      expect(pageItems(d)[0]).toMatchObject({ id: "flow", kind: "flow", index: -1 });
      expect(wordCount(d)).toBe(wordCount({ ...d, flowOff: undefined }));
      expect(publicDoc(d).flow).toEqual(d.flow);
    }
  });

  test("publicDoc keeps the marker where it is, and leaves out what the layout doesn't draw", () => {
    const d = core([graph(), FLOW, aim(), findings()]);
    expect(ids(publicDoc(d))).toEqual(["graph-1", "flow", "findings"]);
    expect(publicDoc(d).flow).toEqual(d.flow);
  });

  test("the published copy keeps the order, for every fixture and each made arranged", () => {
    for (const f of FIXTURES) {
      const d = docOf(f);
      const a = adopt(d);
      // Arranged and then moved: the second page item goes to the end (by hand: the engine's moves come in milestone 2).
      const items = pageItems(a);
      const moved = items[1]!;
      const sections = a.sections.filter((_, i) => i !== moved.index);
      const arranged = { ...a, sections: [...sections, a.sections[moved.index]!] };
      for (const doc of [d, a, arranged]) expect(itemIds(publicDoc(doc)), f.name).toEqual(itemIds(doc));
      expect(hasMarker(publicDoc(arranged))).toBe(true);
    }
  });

  test("My role and the pull quote are counted and checked; a source may have no address in an essay only", () => {
    const essay = core([findings(), pull(), link(1, "")], "essay", { myRole: "Author" });
    expect(wordCount(essay)).toBe(wordCount({ ...essay, myRole: undefined }) + 1);
    expect(messages(essay)).toEqual([]);
    expect(messages({ ...essay, myRole: "x".repeat(61) })).toEqual(['myRole: Keep "My role" to 60 characters.']);
    expect(messages(core([findings(), { ...pull(), text: "" } as ContentSection], "essay"))).toEqual(["sections.1.text: Type in the pull quote or remove it."]);
    expect(messages(core([findings(), { ...pull(), text: "word ".repeat(31) } as ContentSection], "essay"))).toEqual(["sections.1.text: Keep the pull quote to 30 words."]);
    expect(messages(core([findings(), link(1, "")]))).toEqual(["sections.1.href: Use a full https:// link."]);
    expect(messages(core([findings(), link(1, "http://example.com")], "essay"))).toEqual(["sections.1.href: Use a full https:// link."]);
    // A pull quote outside an essay is kept, not counted and not checked.
    const kept = core([findings(), { ...pull(), text: "" } as ContentSection]);
    expect(messages(kept)).toEqual([]);
    expect(keptItems(kept).map((it) => it.id)).toEqual(["pullquote-1"]);
  });

  test("each layout's needs, with today's messages in today's order", () => {
    // Research: the cap on figures together sits between the need for a figure and the need for results, as before.
    expect(messages(core([image(1), image(2), image(3), image(4)], "research"))).toEqual([
      "sections: Up to 2 images.",
      "sections: Add your aim or hypothesis.",
      "sections: Add your conclusion.",
      "sections: Up to 3 figures, graphs and images together.",
      "sections: Add your results.",
    ]);
    expect(messages(core([], "gallery"))).toEqual(["sections: A gallery needs at least 2 images."]);
    expect(messages(core([quote()]))).toEqual(["sections: Add findings or a graph, so the exhbt shows what came of the work."]);
    // The four new layouts.
    expect(messages(core([findings()], "build"))).toEqual(["sections: Add a screenshot or a link, so people can see it working."]);
    expect(messages(core([findings(), link()], "build"))).toEqual([]);
    expect(messages(core([], "essay"))).toEqual(["sections: Add your key points."]);
    expect(messages(core([image(1)], "before-after"))).toEqual([
      "sections: A before and after needs at least 2 images.",
      "sections: Mark one image Before and one After.",
      "sections: Add what changed and why.",
    ]);
    expect(messages(core([image(1, "before"), image(2, "after"), findings()], "before-after"))).toEqual([]);
    expect(messages(core([], "event"))).toEqual(["sections: Add at least one picture, such as the poster.", "myRole: Say what your role was."]);
    expect(messages(core([image(1)], "event", { myRole: "Stage manager" }))).toEqual([]);
  });

  test("layoutNotes lists what each of the seven layouts still needs (step 7)", () => {
    const miss = (d: ExhbtDoc) => layoutNotes(d).missing.map((m) => (m.add ? `${m.text} [${m.add}]` : m.text));
    expect(miss(core([]))).toEqual([]);
    expect(miss(core([], "gallery"))).toEqual(["Add at least 2 images [image]"]);
    expect(miss(core([], "research"))).toEqual(["Add your aim or hypothesis [aim]", "Add your conclusion [conclusion]", "Add a graph or an image [graph]", "Add your results [findings]"]);
    expect(miss(core([], "build"))).toEqual(["Add an image or a link [image]"]);
    expect(miss(core([], "essay"))).toEqual(["Add your key points [findings]"]);
    expect(miss(core([image(1)], "before-after"))).toEqual(["Add at least 2 images [image]", "Mark one image Before and one After", "Add what changed and why [findings]"]);
    expect(miss(core([], "event"))).toEqual(["Add at least one picture, such as the poster [image]", "Say what your role was"]);
    expect(miss(core([image(1)], "event", { myRole: "Stage manager" }))).toEqual([]);
    expect(miss(core([{ ...findings(), items: [[], text("Sales held.")] } as ContentSection], "essay"))).toEqual(["Fill in or remove the empty findings"]);
  });

  test("pathOfNumber finds the first field on the page that holds a number", () => {
    const d = core([FLOW, findings(), graph(), aim()], "case-study", { title: "Cutting a 14,200-row queue", flow: [{ step: "Timed it", detail: "6 weeks" }, { step: "a" }, { step: "b" }] });
    expect(pathOfNumber(d, "14200")).toBe("title");
    expect(pathOfNumber(d, "6")).toBe("flow.0.detail");
    expect(pathOfNumber(d, "11")).toBe("sections.1.items.0");
    expect(pathOfNumber(d, "4")).toBe("sections.1.items.0");
    expect(pathOfNumber({ ...d, sections: [FLOW, graph()] }, "11")).toBe("sections.1.chart");
    expect(pathOfNumber(d, "999")).toBeNull();
    expect(pathOfNumber(d, "none")).toBeNull();
    // Not in a flowchart that is off the page.
    expect(pathOfNumber({ ...d, format: "gallery", sections: [findings()], flowOff: true }, "6")).toBeNull();
  });
});

/* ---------------- The engine ---------------- */

test.describe("The engine: adopt", () => {
  test("each fixture adopts to the order written beside it, and draws the rows written beside it", () => {
    for (const f of FIXTURES) {
      const d = docOf(f);
      expect(ids(adopt(d)), f.name).toEqual(f.adopt);
      expect(rows(d, skipOf(f)), f.name).toEqual(f.rows);
    }
  });

  test("adopting is a fixed point: once is enough, and the page drawn is the same", () => {
    for (const f of FIXTURES) {
      const d = docOf(f);
      const a = adopt(d);
      expect(adopt(a), f.name).toBe(a);
      expect(isArranged(a)).toBe(true);
      expect(itemIds(a), f.name).toEqual(itemIds(d));
      expect(rows(a), f.name).toEqual(rows(d));
      expect(structureKey(a), f.name).toBe(structureKey(d));
    }
  });

  test("with an image with no address left out, the graph pairs with the findings, findings first, as today", () => {
    const d = core([graph(), image(), findings()]);
    const noAddress = (s: ContentSection) => s.id === "image-1";
    expect(rows(d, noAddress)).toEqual(["flow", "found(findings, graph-1)"]);
    expect(rows(d)).toEqual(["flow", "graphs[graph-1]", "found(findings, image-1)"]);
    // Adopted, the doc keeps the order that draws every image (graph, findings, image). If the image then has
    // no address, the graph is a reversed pair: the page of adopt(doc) differs from today's only here.
    expect(rows(adopt(d), noAddress)).toEqual(["flow", "found~(graph-1, findings)"]);
  });

  test("the sections a layout keeps but doesn't draw stay after the section they followed", () => {
    expect(ids(adopt(core([aim(), graph(), conclusion(), findings()])))).toEqual(["aim-1", "flow", "findings", "graph-1", "conclusion-1"]);
    expect(ids(adopt(core([findings(), aim(), image(1), image(2)], "gallery")))).toEqual(["image-1", "flow", "findings", "aim-1", "image-2"]);
  });

  /*
   * The fixed point, by brute force: every order of the kinds, checked against frozen copies of
   * today's runsOf, GalleryMain and ResearchMain (e2e/fixtures/order-docs.ts), with and without an
   * image with no address (and, in research, an aim and a conclusion with no words). Each case
   * that differs is collected, so one failure lists them all.
   */
  const differs = (got: string[], want: string[]) => JSON.stringify(got) !== JSON.stringify(want);

  test("brute force: every case study of up to five sections draws today's runs", () => {
    const kinds = [findings, graph, image, quote];
    const wrong: string[] = [];
    let n = 0;
    for (const seq of sequences(kinds.length, 5)) {
      const count = new Map<number, number>();
      const sections = seq.map((k) => {
        const i = (count.get(k) ?? 0) + 1;
        count.set(k, i);
        return { ...kinds[k]!(i), id: `${kinds[k]!.name}-${i}` } as ContentSection;
      });
      const d = core(sections);
      const skips = [undefined, ...sections.filter((s) => s.kind === "image").map((im) => (s: ContentSection) => s.id === im.id)];
      for (const skip of skips) if (differs(rows(d, skip), todayCaseRows(sections.filter((s) => !skip?.(s))))) wrong.push(`${ids(d)} skip ${skip ? "an image" : "none"}`);
      const a = adopt(d);
      if (adopt(a) !== a || differs(rows(a), rows(d))) wrong.push(`${ids(d)} adopted`);
      n++;
    }
    expect(wrong).toEqual([]);
    expect(n).toBe(1364);
  });

  test("brute force: every gallery and research page within the caps draws today's parts", () => {
    const wrong: string[] = [];
    const gallery = { findings: 1, graph: 1, quote: 1, reflection: 1, image: 3, link: 2 };
    for (const sections of withinCaps(gallery, 5)) {
      const d = core(sections, "gallery");
      const firstImage = sections.find((s) => s.kind === "image");
      for (const skip of [undefined, firstImage && ((s: ContentSection) => s.id === firstImage.id)]) {
        if (differs(rows(d, skip), todayGalleryRows(sections.filter((s) => !skip?.(s))))) wrong.push(`gallery ${ids(d)}`);
      }
      if (differs(rows(adopt(d)), rows(d))) wrong.push(`gallery ${ids(d)} adopted`);
    }
    const research = { aim: 1, findings: 1, conclusion: 1, reflection: 1, quote: 1, graph: 2, image: 2, link: 2 };
    for (const sections of withinCaps(research, 5)) {
      const d = core(sections, "research");
      for (const skip of [undefined, (s: ContentSection) => s.kind === "aim" || s.kind === "conclusion"]) {
        if (differs(rows(d, skip), todayResearchRows(sections.filter((s) => !skip?.(s))))) wrong.push(`research ${ids(d)}`);
      }
      if (differs(rows(adopt(d)), rows(d))) wrong.push(`research ${ids(d)} adopted`);
    }
    expect(wrong).toEqual([]);
  });
});

test.describe("The engine: rows", () => {
  test("each of the seven layouts in its usual order", () => {
    expect(rows(core([FLOW, findings(), graph(1), graph(2), quote()]))).toEqual(["flow", "found(findings, graph-1)", "graphs[graph-2]", "quote-1"]);
    expect(rows(core([image(1), FLOW, findings(), graph(), image(2), image(3), quote(), next(), link(1), link(2)], "gallery"))).toEqual([
      "image-1:lead",
      "even(flow:stacked, happened[findings, graph-1])",
      "grid[image-2:tile, image-3:tile]",
      "quote-1",
      "reflection-1",
      "links[link-1, link-2]",
    ]);
    expect(rows(core([aim(), FLOW, graph(), image(), findings(), conclusion(), next(), quote(), link()], "research"))).toEqual([
      "key(method[aim-1, flow], graph-1:key)",
      "figures[image-1]",
      "even(findings:kicker, closing[conclusion-1, reflection-1])",
      "quote-1",
      "refs[link-1:listed]",
    ]);
    expect(rows(core([image(1), FLOW, findings(), graph(), image(2), image(3), quote(), next(), link(1), link(2)], "build"))).toEqual([
      "image-1:lead",
      "flow",
      "found(findings, graph-1)",
      "images[image-2, image-3]",
      "quote-1",
      "reflection-1",
      "buttons[link-1:button, link-2:button]",
    ]);
    expect(rows(core([FLOW, findings(), pull(), graph(), image(), quote(), next(), link(1), link(2)], "essay"))).toEqual([
      "flow",
      "found(findings, pullquote-1)",
      "graph-1",
      "image-1",
      "quote-1",
      "reflection-1",
      "refs[link-1:listed, link-2:listed]",
    ]);
    expect(rows(core([image(1, "before"), image(2, "after"), image(3), image(4), FLOW, findings(), graph(), quote(), next(), link()], "before-after"))).toEqual([
      "before-after[image-1:before, image-2:after]",
      "images[image-3, image-4]",
      "flow",
      "found(findings, graph-1)",
      "quote-1",
      "reflection-1",
      "link-1",
    ]);
    expect(rows(core([image(1), FLOW, findings(), graph(), image(2), quote(), next(), link()], "event"))).toEqual([
      "image-1:lead",
      "even(flow:stacked, happened[findings, graph-1])",
      "grid[image-2:tile]",
      "quote-1",
      "reflection-1",
      "links[link-1]",
    ]);
  });

  test("a pair is drawn in the doc's order, and forward wins", () => {
    // Reversed: the figure first, so the widths mirror.
    expect(rows(core([FLOW, graph(), findings(), quote()]))).toEqual(["flow", "found~(graph-1, findings)", "quote-1"]);
    // Forward wins: a figure on each side of the findings pairs with the one after.
    expect(rows(core([FLOW, graph(), findings(), image()]))).toEqual(["flow", "graphs[graph-1]", "found(findings, image-1)"]);
    // The same in a gallery's stack and in research's.
    expect(rows(core([image(1), findings(), graph(), FLOW], "gallery"))).toEqual(["image-1:lead", "even~(happened[findings, graph-1], flow:stacked)"]);
    expect(rows(core([graph(), FLOW, aim()], "research"))).toEqual(["key~(graph-1:key, method[flow, aim-1])"]);
  });

  test("a gallery with no findings or graph draws the flowchart alone; research with no figure, the method stack alone", () => {
    expect(rows(core([image(1), FLOW, image(2)], "gallery"))).toEqual(["image-1:lead", "flow", "grid[image-2:tile]"]);
    expect(rows(core([aim(), FLOW, findings()], "research"))).toEqual(["method[aim-1, flow]", "findings:kicker"]);
    // The lead never joins a group, and Build's pair never takes it.
    expect(rows(core([image(1), image(2), FLOW], "gallery"))).toEqual(["image-1:lead", "grid[image-2:tile]", "flow"]);
    expect(rows(core([image(1), findings(), FLOW], "build"))).toEqual(["image-1:lead", "findings", "flow"]);
  });
});

test.describe("The engine: applyTemplate and structureKey", () => {
  test("a layout switch adopts, sets the layout and sorts into its usual order", () => {
    const d = core([quote(), image(1), graph(), findings(), image(2), aim()]);
    const g = applyTemplate(d, "gallery");
    expect(g.format).toBe("gallery");
    expect(ids(g)).toEqual(["image-1", "flow", "findings", "graph-1", "image-2", "aim-1", "quote-1"]);
    const back = applyTemplate(g, "case-study");
    expect("format" in back).toBe(false);
    expect(ids(back)).toEqual(["flow", "findings", "graph-1", "image-1", "image-2", "aim-1", "quote-1"]);
    // Off in a gallery, and research always has one: it comes back, in its usual place.
    const off: ExhbtDoc = { ...core([findings(), aim()], "gallery"), flowOff: true };
    const r = applyTemplate(off, "research");
    expect(ids(r)).toEqual(["aim-1", "flow", "findings"]);
    expect("flowOff" in r).toBe(false);
    // Into a layout that lets it go, it stays off.
    expect(applyTemplate(off, "essay").flowOff).toBe(true);
  });

  test("structureKey changes on a move, an add, a stage and a layout, and not on typing", () => {
    const d = adopt(core([findings(), graph(), image(1)]));
    const key = structureKey(d);
    const typed = { ...d, sections: d.sections.map((s) => (s.kind === "findings" ? { ...s, items: [text("Something else entirely.")] } : s)) };
    expect(structureKey(typed)).toBe(key);
    expect(structureKey({ ...d, title: "Another title" })).toBe(key);
    expect(structureKey({ ...d, sections: [d.sections[0]!, d.sections[2]!, d.sections[1]!, d.sections[3]!] })).not.toBe(key);
    expect(structureKey({ ...d, sections: [...d.sections, quote()] })).not.toBe(key);
    expect(structureKey({ ...d, sections: d.sections.map((s) => (s.kind === "image" ? { ...s, stage: "before" as const } : s)) })).not.toBe(key);
    expect(structureKey(withFormat(d, "gallery"))).not.toBe(key);
  });
});

test.describe("The engine: structural changes (step 6b)", () => {
  test("restoreFlow puts a removed flowchart back, at its usual place or where it is asked for", () => {
    // A gallery with the flowchart off and its sections moved by hand.
    const off: ExhbtDoc = { ...core([findings(), image(1), quote(), image(2)], "gallery"), flowOff: true };
    expect(itemIds(off)).toEqual(["findings", "image-1", "quote-1", "image-2"]);
    // Its usual place: before the first item that comes after the flowchart in the layout's usual order.
    const back = restoreFlow(off);
    expect(ids(back)).toEqual(["flow", "findings", "image-1", "quote-1", "image-2"]);
    expect("flowOff" in back).toBe(false);
    expect(isArranged(back)).toBe(true);
    expect(back.flow).toEqual(off.flow);
    // With a place: before the last page item. Every other item keeps its order.
    const there = restoreFlow(off, 3);
    expect(itemIds(there)).toEqual(["findings", "image-1", "quote-1", "flow", "image-2"]);
    expect("flowOff" in there).toBe(false);
    expect(isArranged(there)).toBe(true);
    expect(itemIds(restoreFlow(off, 0))).toEqual(["flow", "findings", "image-1", "quote-1", "image-2"]);
    expect(itemIds(restoreFlow(off, 99))).toEqual(["findings", "image-1", "quote-1", "image-2", "flow"]);
    // A section the layout keeps but doesn't draw keeps its place in the stored order.
    const kept: ExhbtDoc = { ...off, sections: [findings(), aim(), image(1)] };
    expect(ids(restoreFlow(kept, 1))).toEqual(["findings", "aim-1", "flow", "image-1"]);
    // Nothing is after the flowchart's usual place: at the end.
    expect(ids(restoreFlow({ ...off, sections: [image(1)] }))).toEqual(["image-1", "flow"]);
    // Shown already: the same object.
    for (const d of [back, adopt(core([findings()], "gallery")), core([findings()], "gallery"), { ...core([findings()]), flowOff: true }]) expect(restoreFlow(d, 0)).toBe(d);
  });

  test("insertBlock with the flowchart is restoreFlow at that place, and null once it is on the page", () => {
    const off: ExhbtDoc = { ...core([findings(), image(1), quote(), image(2)], "gallery"), flowOff: true };
    const r = insertBlock(off, "flow", 3);
    expect(r).toEqual({ doc: restoreFlow(off, 3), id: "flow" });
    expect(insertBlock(r!.doc, "flow", 0)).toBeNull();
    expect(insertBlock(core([findings()]), "flow", 0)).toBeNull();
  });

  test("blockOptions: the layout's kinds in its order and words, each with its reason when full", () => {
    const opt = (d: ExhbtDoc) => blockOptions(d).map((o) => (o.full ? `${o.name}: ${o.full}` : o.name));
    expect(opt(core([findings(), graph(1), graph(2)]))).toEqual(["Findings: One findings section in a case study", "Graph: Up to 2 graphs in a case study", "Image", "Quote", "What I'd do next", "Link"]);
    expect(opt(core([quote(), image(1), image(2)], "gallery"))).toEqual(["What happened", "Graph", "Image", "Quote: One quote in a gallery", "What I'd do next", "Link"]);
    expect(opt(core([graph(1), image(1), image(2), aim()], "research"))).toEqual([
      "Aim or hypothesis: One aim or hypothesis in research",
      "Results",
      "Graph: Up to 3 graphs and images together in research",
      "Image: Up to 2 images in research",
      "Conclusion",
      "Quote",
      "Limitations and next steps",
      "Reference",
    ]);
    expect(opt(core([pull(), link(1), link(2), link(3), link(4)], "essay"))).toEqual(["Key points", "Pull quote: One pull quote in an essay", "Graph", "Image", "Quote", "What I'd look at next", "Source: Up to 4 sources in an essay"]);
    expect(opt(core([link(1), link(2)], "build"))).toEqual(["What it does", "Graph", "Image", "Quote", "What's next", "Link: Up to 2 links in a build"]);
    // The flowchart is offered only when it is off the page.
    expect(blockOptions({ ...core([image(1)], "gallery"), flowOff: true }).at(-1)).toEqual({ kind: "flow", name: "Flowchart" });
    for (const f of FORMATS) expect(blockOptions(core([], f)).some((o) => o.kind === "flow")).toBe(false);
    expect(blockOptions(core([])).every((o) => !("full" in o))).toBe(true);
  });

  test("insertBlock and insertImage: places count page items, a full kind is refused, the doc is left arranged", () => {
    const d = core([graph(), findings()]);
    const q = insertBlock(d, "quote", 1)!;
    expect(q.id).toBe("quote-1");
    expect(itemIds(q.doc)).toEqual(["flow", "quote-1", "findings", "graph-1"]);
    expect(isArranged(q.doc)).toBe(true);
    // Empty, not filled with sample words.
    expect(sectionsOf(q.doc, "quote")[0]).toEqual({ id: "quote-1", kind: "quote", text: "", name: "", role: "" });
    expect(itemIds(insertBlock(d, "link", 99)!.doc)).toEqual(["flow", "findings", "graph-1", "link-1"]);
    expect(insertBlock(core([findings(), graph(1), graph(2)]), "graph", 0)).toBeNull();
    // A kind the layout doesn't draw is not added.
    expect(insertBlock(core([findings()]), "aim", 0)).toBeNull();
    expect(insertBlock(core([findings()]), "pullquote", 0)).toBeNull();
    expect(insertBlock(core([findings()], "essay"), "pullquote", 1)!.doc.sections.map((s) => s.kind)).toEqual(["flow", "pullquote", "findings"]);
    const im = insertImage(d, { fileId: "f9", w: 800, h: 600 }, 0)!;
    expect(itemIds(im.doc)).toEqual(["image-1", "flow", "findings", "graph-1"]);
    expect(imagesOf(im.doc)[0]).toEqual({ id: "image-1", kind: "image", fileId: "f9", alt: "", caption: [], w: 800, h: 600 });
    expect(imagesOf(insertImage(d, { fileId: "f9" }, 0)!.doc)[0]).toEqual({ id: "image-1", kind: "image", fileId: "f9", alt: "", caption: [] });
    expect(insertImage(core([image(1), image(2)]), { fileId: "f9" }, 0)).toBeNull();
    // A case study with flowOff draws its flowchart first: a change writes the marker there.
    const pinned = insertBlock({ ...core([findings()]), flowOff: true }, "quote", 0)!.doc;
    expect(ids(pinned)).toEqual(["quote-1", "flow", "findings"]);
    expect("flowOff" in pinned).toBe(false);
  });

  test("moveItem: the place counts page items with the item taken out; a kept section stays put", () => {
    const d = core([graph(), aim(), findings()]);
    expect(ids(adopt(d))).toEqual(["flow", "findings", "graph-1", "aim-1"]);
    const m = moveItem(d, "graph-1", 0);
    expect(itemIds(m)).toEqual(["graph-1", "flow", "findings"]);
    expect(isArranged(m)).toBe(true);
    expect(ids(moveItem(d, "flow", 2))).toEqual(["findings", "graph-1", "flow", "aim-1"]);
    expect(ids(moveItem(d, "flow", 1))).toEqual(["findings", "flow", "graph-1", "aim-1"]);
    expect(itemIds(moveItem(d, "findings", 0))).toEqual(["findings", "flow", "graph-1"]);
    // Not a page item (unknown, or kept and not drawn): the doc as it was.
    expect(moveItem(d, "nothing", 0)).toBe(d);
    expect(moveItem(d, "aim-1", 0)).toBe(d);
  });

  test("removeItem: a section, or the flowchart where the layout lets it go", () => {
    const g = core([image(1), findings(), image(2)], "gallery");
    const off = removeItem(g, "flow");
    expect(off.flowOff).toBe(true);
    expect(hasMarker(off)).toBe(false);
    expect(off.flow).toEqual(g.flow);
    expect(itemIds(off)).toEqual(["image-1", "findings", "image-2"]);
    expect(removeItem(off, "flow")).toBe(off);
    // A case study and research always draw it.
    for (const d of [core([findings()]), core([findings()], "research")]) expect(removeItem(d, "flow")).toBe(d);
    const c = core([findings(), aim()]);
    const r = removeItem(c, "findings");
    expect(ids(r)).toEqual(["flow", "aim-1"]);
    expect(isArranged(r)).toBe(true);
    // A kept section can go too; an id the doc doesn't have changes nothing.
    expect(ids(removeItem(c, "aim-1"))).toEqual(["flow", "findings"]);
    expect(removeItem(c, "nothing")).toBe(c);
  });

  test("the published copy keeps the order of a doc arranged with moveItem, and structureKey follows each change", () => {
    for (const f of FIXTURES) {
      const d = docOf(f);
      const items = pageItems(d);
      for (const [id, place] of [
        [items[0]!.id, items.length - 1],
        [items[items.length - 1]!.id, 0],
      ] as const) {
        const moved = moveItem(d, id, place);
        expect(itemIds(publicDoc(moved)), f.name).toEqual(itemIds(moved));
        expect(hasMarker(publicDoc(moved)), f.name).toBe(true);
        expect(structureKey(moved), f.name).not.toBe(structureKey(d));
      }
    }
    const g = core([image(1), findings(), image(2)], "gallery");
    expect(structureKey(insertBlock(g, "quote", 0)!.doc)).not.toBe(structureKey(g));
    expect(structureKey(removeItem(g, "flow"))).not.toBe(structureKey(g));
    const pub = publicDoc(removeItem(g, "flow"));
    expect(pub.flowOff).toBe(true);
    expect(pub.flow).toEqual([]);
  });
});

/* ---------------- Generators for the brute force ---------------- */

/** Every sequence of 1 to `max` picks from `n` things. */
function* sequences(n: number, max: number): Generator<number[]> {
  const grow = function* (prefix: number[]): Generator<number[]> {
    if (prefix.length) yield prefix;
    if (prefix.length === max) return;
    for (let k = 0; k < n; k++) yield* grow([...prefix, k]);
  };
  yield* grow([]);
}

const MAKERS: Partial<Record<SectionKind, (n: number) => ContentSection>> = { findings, graph, image, quote, reflection: next, link, aim, conclusion };

/** Every order of up to `max` sections whose counts stay within `caps`. */
function* withinCaps(caps: Partial<Record<SectionKind, number>>, max: number): Generator<ContentSection[]> {
  const kinds = Object.keys(caps) as SectionKind[];
  const grow = function* (prefix: ContentSection[]): Generator<ContentSection[]> {
    if (prefix.length) yield prefix;
    if (prefix.length === max) return;
    for (const k of kinds) {
      const have = prefix.filter((s) => s.kind === k).length;
      if (have < caps[k]!) yield* grow([...prefix, MAKERS[k]!(have + 1)]);
    }
  };
  yield* grow([]);
}

