import { expect, test, type Page } from "@playwright/test";
import { emptyDoc, ExhbtDocSchema, formatLimits, publicDoc, text, validateForPublish, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { checkedReason, figureSentence, layoutSentence } from "../lib/exhbt/drafted";
import { FORMAT_RULES, fromWorkOf, OFFERED_FORMATS } from "../lib/exhbt/formats";
import { roomFor, sectionLabel, withKeyFigure, withWorkVisual } from "../lib/exhbt/sections";
import { imageSize } from "../lib/figures/image-size";
import { FIGURE, boxFromPixels, clampBox, fitCaption, mayHoldFigure, pixelsFromBox, withMargin } from "../lib/figures/rules";
import { uniqueEmail } from "./helpers";

// The figure picked from an upload (decisions 0017 and 0025): the PDF's pages drawn in the browser,
// the stand-in AI's pick (the first page that draws shapes, with a box that covers the chart in the
// fixture, and a kind read from the file's name), the figure cut out and put on the exhbt in place
// of the graph the draft drew, the share tick that publishing waits for, cropping again, another
// page, removing it, scans, drafts that end up with no figure, and the line that says what happened.
// The PDFs are e2e/fixtures/*.pdf, made by e2e/fixtures/make-figure-pdfs.mjs.

const CHART_PDF = "e2e/fixtures/report-with-chart.pdf";
const TEXT_PDF = "e2e/fixtures/report-text-only.pdf";
const DIAGRAM_PDF = "e2e/fixtures/report-with-diagram.pdf";
const SCAN_PDF = "e2e/fixtures/scan-report.pdf";
const PRINTED_ESSAY_PDF = "evals/figure-pick/fixtures/08-text-only.pdf";
const LONG_TEXT_PDF = "e2e/fixtures/report-long-text.pdf";
const WARNING = "Picked from your report. Check you're allowed to share it.";
const TICK = "I may share this figure on my portfolio";
const NEEDS_TICK = "Tick that you may share this figure, or remove it.";
const CASE_STUDY_LINE = "Laid out as Case study because your work sets out a question and what you found.";

const kindsOf = (d: ExhbtDoc) => d.sections.map((s) => s.kind);
const bar = (id: string, values: number[]): Section => ({ id, kind: "graph", chart: { kind: "bar", title: "Missed appointments", rows: values.map((value, i) => ({ label: `Group ${i + 1}`, value })) } });
const image = (id: string, fileId: string): Section => ({ id, kind: "image", fileId, alt: "A picture", caption: [] });
const picked = { from: "report.pdf", sourceFileId: "src", page: 3, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, shareOk: false };
const visual = (kind: "graph" | "table" | "other") => ({ fileId: "f1", kind, alt: "A bar chart", caption: "Missed appointments", picked });

/** Drafts as lib/ai/exhbt-draft.ts makes them: findings, then the graphs, then the rest. */
const caseDraft = (): ExhbtDoc => ({
  ...emptyDoc(),
  title: "Does a later reminder cut missed appointments?",
  sections: [
    { id: "findings", kind: "findings", items: [text("Missed appointments fell from 7.9% to 6.5%."), text("Two practices took part.")] },
    bar("graph-1", [7.9, 6.5]),
    bar("graph-2", [11.2, 8.4, 19.6]),
    { id: "reflection-1", kind: "reflection", text: text("Next time I would run it for a full term.") },
  ],
  // 19.6 is only on the second graph; 6.5% is in the findings too.
  unverified: ["19.6", "6.5%"],
});
const researchDraft = (): ExhbtDoc => ({
  ...caseDraft(),
  format: "research",
  sections: [
    { id: "aim-1", kind: "aim", text: text("To test whether a later reminder cuts missed appointments.") },
    { id: "findings", kind: "findings", items: [text("Missed appointments fell from 7.9% to 6.5%."), text("Two practices took part.")] },
    bar("graph-1", [7.9, 6.5]),
    bar("graph-2", [11.2, 8.4, 19.6]),
    { id: "conclusion-1", kind: "conclusion", text: text("The later reminder helped.") },
    { id: "link-1", kind: "link", href: "https://example.com/paper", label: "A paper", description: "" },
  ],
});
const galleryDraft = (): ExhbtDoc => ({
  ...caseDraft(),
  format: "gallery",
  title: "Reminder campaign for two practices",
  sections: [{ id: "findings", kind: "findings", items: [text("Missed appointments fell from 7.9% to 6.5%.")] }, bar("graph-1", [7.9, 6.5]), { id: "reflection-1", kind: "reflection", text: text("Next time I would test two posters.") }],
});

test.describe("Picked figure rules", () => {
  const base = (): ExhbtDoc => ({
    ...emptyDoc(),
    sections: [
      { id: "findings", kind: "findings", items: [text("One"), text("Two")] },
      { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "x", rows: [] } as never },
    ],
  });

  test("goes straight after the findings, and publishing waits for the tick", () => {
    const doc = withKeyFigure(base(), { fileId: "f1", alt: "A bar chart", caption: "Missed appointments", picked });
    expect(doc.sections.map((s) => s.kind)).toEqual(["findings", "image", "graph"]);
    const issue = validateForPublish(doc).find((i) => i.path === "sections.1.picked.shareOk");
    expect(issue?.message).toBe(NEEDS_TICK);
    const ticked = { ...doc, sections: doc.sections.map((s) => (s.kind === "image" ? { ...s, picked: { ...picked, shareOk: true } } : s)) };
    expect(validateForPublish(ticked).some((i) => i.path.endsWith("picked.shareOk"))).toBe(false);
    // Employers never see where it came from.
    expect(JSON.stringify(publicDoc(ticked))).not.toContain("report.pdf");
    expect(publicDoc(ticked).sections[1]).toMatchObject({ kind: "image", fileId: "f1", alt: "A bar chart" });
  });

  test("boxes stay on the page, captions within the limit, plain text pages are never sent", () => {
    expect(clampBox({ x: -1, y: 0.2, w: 3, h: 0.5 })).toEqual({ x: 0, y: 0.2, w: 1, h: 0.5 });
    expect(clampBox({ x: 0.5, y: 0.5, w: 0.01, h: 0.5 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(withMargin({ x: 0.01, y: 0.5, w: 0.98, h: 0.2 })).toEqual({ x: 0, y: 0.48, w: 1, h: expect.closeTo(0.24, 5) });
    expect(fitCaption("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen").split(" ")).toHaveLength(15);
    expect(mayHoldFigure({ shapes: 0, pictures: 0 })).toBe(false);
    expect(mayHoldFigure({ shapes: FIGURE.minShapes - 1, pictures: 0 })).toBe(false);
    expect(mayHoldFigure({ shapes: FIGURE.minShapes, pictures: 0 })).toBe(true);
    expect(mayHoldFigure({ shapes: 0, pictures: 1 })).toBe(true);
  });

  test("the AI's box in pixels becomes fractions of the page, kept on the page", () => {
    const size = { width: 543, height: 768 };
    const box = boxFromPixels({ left: 54, top: 77, right: 489, bottom: 384 }, size);
    expect(box.x).toBeCloseTo(54 / 543, 6);
    expect(box.y).toBeCloseTo(77 / 768, 6);
    expect(box.w).toBeCloseTo(435 / 543, 6);
    expect(box.h).toBeCloseTo(307 / 768, 6);
    // Edges the wrong way round are put right; edges off the image are brought back onto it.
    expect(boxFromPixels({ left: 489, top: 384, right: 54, bottom: 77 }, size)).toEqual(box);
    expect(boxFromPixels({ left: -20, top: 77, right: 900, bottom: 384 }, size)).toMatchObject({ x: 0, w: 1 });
    // An answer in fractions after all is read as fractions.
    expect(boxFromPixels({ left: 0.1, top: 0.2, right: 0.6, bottom: 0.7 }, size)).toEqual({ x: 0.1, y: 0.2, w: expect.closeTo(0.5, 6), h: expect.closeTo(0.5, 6) });
    // A thin figure (a one-row diagram, a short table) is real: its short side is widened a
    // little about its middle, not swapped for the whole page.
    const thin = boxFromPixels({ left: 60, top: 300, right: 480, bottom: 330 }, size);
    expect(thin.w).toBeCloseTo(420 / 543, 6);
    expect(thin.h).toBeCloseTo(0.06, 6);
    expect(thin.y + thin.h / 2).toBeCloseTo(315 / 768, 6);
    expect(boxFromPixels({ left: 60, top: 0, right: 480, bottom: 30 }, size)).toMatchObject({ y: 0, h: expect.closeTo(0.06, 6) });
    // Nothing sensible is the whole page, never a sliver.
    const whole = { x: 0, y: 0, w: 1, h: 1 };
    expect(boxFromPixels(null, size)).toEqual(whole);
    expect(boxFromPixels({ left: 10, top: 10, right: 12, bottom: 400 }, size)).toEqual(whole);
    expect(boxFromPixels({ left: 10, top: 10, right: Number.NaN, bottom: 400 }, size)).toEqual(whole);
    expect(boxFromPixels({ left: 10, top: 10, right: 300, bottom: 400 }, { width: 0, height: 768 })).toEqual(whole);
    // And back again, for the stand-in.
    expect(pixelsFromBox({ x: 0.06, y: 0.05, w: 0.88, h: 0.48 }, size)).toEqual({ left: 33, top: 38, right: 510, bottom: 407 });
  });

  test("an image's size is read from the file, not taken on trust", () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    expect(imageSize(new Uint8Array(png))).toEqual({ width: 1, height: 1 });
    // A JPEG: start of image, an APP0 segment, then the frame header with the height (768) and the width (543).
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x00, 0x02, 0x1f, 0x03, 0x01, 0x22, 0x00]);
    expect(imageSize(jpeg)).toEqual({ width: 543, height: 768 });
    // A progressive JPEG keeps its size in SOF2; a Huffman table before it is skipped.
    const progressive = new Uint8Array([0xff, 0xd8, 0xff, 0xc4, 0x00, 0x03, 0x00, 0xff, 0xc2, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 0x01, 0x22, 0x00]);
    expect(imageSize(progressive)).toEqual({ width: 200, height: 100 });
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x00, 0x00, 0x00]))).toBeNull();
    expect(imageSize(new TextEncoder().encode("not a picture at all"))).toBeNull();
  });
});

test.describe("The work's own graph wins (decision 0025)", () => {
  test("every layout says what it takes from the work, and today each takes a visual", () => {
    expect(OFFERED_FORMATS.map((f) => [f, FORMAT_RULES[f].fromWork])).toEqual([
      ["case-study", "figure"],
      ["gallery", "pictures"],
      ["research", "figure"],
    ]);
    expect(fromWorkOf({})).toBe("figure");
    expect(fromWorkOf({ format: "something-later" })).toBe("figure");
  });

  test("a case study: a picked graph takes the place of the drafted graphs", () => {
    const draft = caseDraft();
    const r = withWorkVisual(draft, visual("graph"));
    expect(r.placed).toBe(true);
    expect(kindsOf(r.doc)).toEqual(["findings", "image", "reflection"]);
    expect(r.removed.map((s) => s.id)).toEqual(["graph-1", "graph-2"]);
    expect(r.doc.sections[1]).toMatchObject({ kind: "image", fileId: "f1", picked: { ...picked, kind: "graph", shareOk: false } });
    // A number flagged to check that was only on a graph it removed is no longer on the page.
    expect(r.doc.unverified).toEqual(["6.5%"]);
    // The safeguards are as they were: publishing waits for the tick.
    expect(validateForPublish(r.doc).map((i) => i.path)).toContain("sections.1.picked.shareOk");
    expect(draft.sections).toHaveLength(4);
  });

  test("a results table counts as the work's own figure too", () => {
    const r = withWorkVisual(caseDraft(), visual("table"));
    expect(kindsOf(r.doc)).toEqual(["findings", "image", "reflection"]);
    expect(r.doc.sections[1]).toMatchObject({ picked: { kind: "table" } });
  });

  test("a case study drafted with a graph and no findings can still be published when the work's graph takes its place", () => {
    const NEEDS = "Add findings or a graph, so the exhbt shows what came of the work.";
    const messages = (d: ExhbtDoc) => validateForPublish(d).map((i) => i.message);
    const draft: ExhbtDoc = { ...caseDraft(), sections: [bar("graph-1", [7.9, 6.5])], unverified: [] };
    expect(messages(draft)).not.toContain(NEEDS);
    for (const kind of ["graph", "table"] as const) {
      const r = withWorkVisual(draft, visual(kind));
      expect(kindsOf(r.doc)).toEqual(["image"]);
      // The work's own graph or table shows what came of the work, as the drafted graph did.
      expect(messages(r.doc)).not.toContain(NEEDS);
    }
    // A picture that isn't the work's results doesn't count: a photo alone, or a figure whose kind
    // went when the person chose another page.
    const placed = withWorkVisual(draft, visual("graph")).doc;
    const rekind = (kind?: "other") =>
      ({ ...placed, sections: placed.sections.map((s) => (s.kind === "image" ? { ...s, picked: { ...picked, ...(kind ? { kind } : {}) } } : s)) }) as ExhbtDoc;
    expect(messages(rekind("other"))).toContain(NEEDS);
    expect(messages(rekind())).toContain(NEEDS);
    expect(messages({ ...placed, sections: [] })).toContain(NEEDS);
  });

  test("a case study: another visual keeps the drafted graphs", () => {
    const r = withWorkVisual(caseDraft(), visual("other"));
    expect(kindsOf(r.doc)).toEqual(["findings", "image", "graph", "graph", "reflection"]);
    expect(r.removed).toEqual([]);
    expect(r.doc.unverified).toEqual(["19.6", "6.5%"]);
    expect(r.doc.sections[1]).toMatchObject({ picked: { kind: "other" } });
  });

  test("research: a picked graph becomes the key figure where the drafted graph was", () => {
    const r = withWorkVisual(researchDraft(), visual("graph"));
    expect(kindsOf(r.doc)).toEqual(["aim", "findings", "image", "conclusion", "link"]);
    expect(sectionLabel(r.doc.sections, 2, "research")).toBe("Key figure");
    expect(r.removed).toHaveLength(2);
    // Research needs a figure to publish: the picked one is it.
    expect(validateForPublish(r.doc).map((i) => i.message)).not.toContain("Add a graph or an image: the key figure.");
  });

  test("research: the drafted graph stays the key figure and another visual follows it, up to the cap on figures", () => {
    const r = withWorkVisual(researchDraft(), visual("other"));
    expect(kindsOf(r.doc)).toEqual(["aim", "findings", "graph", "image", "graph", "conclusion", "link"]);
    expect(sectionLabel(r.doc.sections, 2, "research")).toBe("Key figure");
    expect(r.doc.sections[2]).toMatchObject({ kind: "graph", id: "graph-1" });
    expect(r.doc.sections[3]).toMatchObject({ kind: "image", fileId: "f1", picked: { kind: "other" } });
    expect(r.removed).toEqual([]);
    expect(roomFor(r.doc.sections, "image", "research")).toBe(0);
    expect(validateForPublish(r.doc).some((i) => /figures, graphs and images together/.test(i.message))).toBe(false);
  });

  test("research: when room is short the picked visual is kept and the last graph goes", () => {
    const draft = researchDraft();
    const full: ExhbtDoc = { ...draft, sections: [...draft.sections, image("image-1", "mine")] };
    expect(formatLimits("research").maxFigures).toBe(3);
    expect(roomFor(full.sections, "image", "research")).toBe(0);
    const r = withWorkVisual(full, visual("other"));
    expect(r.placed).toBe(true);
    expect(r.removed.map((s) => s.id)).toEqual(["graph-2"]);
    // The graph that stays is still the key figure, and the picked visual follows it.
    expect(kindsOf(r.doc)).toEqual(["aim", "findings", "graph", "image", "conclusion", "link", "image"]);
    expect(r.doc.sections[3]).toMatchObject({ kind: "image", fileId: "f1" });
    // The person's own picture is still there, and the number that was only on the graph that went is off the list.
    expect(r.doc.sections.at(-1)).toMatchObject({ kind: "image", fileId: "mine" });
    expect(r.doc.unverified).toEqual(["6.5%"]);
    // With no graph on the exhbt, the picked visual is the key figure.
    const bare: ExhbtDoc = { ...draft, sections: draft.sections.filter((s) => s.kind !== "graph") };
    const alone = withWorkVisual(bare, visual("other")).doc;
    const at = alone.sections.findIndex((s) => s.kind === "image");
    expect(sectionLabel(alone.sections, at, "research")).toBe("Key figure");
  });

  test("a layout whose images are full is left as it was, graphs and all", () => {
    const draft = caseDraft();
    const full: ExhbtDoc = { ...draft, sections: [...draft.sections, image("image-1", "a"), image("image-2", "b")] };
    for (const kind of ["graph", "other"] as const) {
      const r = withWorkVisual(full, visual(kind));
      expect(r.doc).toBe(full);
      expect(r).toMatchObject({ placed: false, why: "no-room", removed: [] });
    }
  });

  test("a gallery: a picked graph leads and the drafted graph goes; another visual keeps it", () => {
    const g = withWorkVisual(galleryDraft(), visual("graph"));
    expect(kindsOf(g.doc)).toEqual(["findings", "image", "reflection"]);
    expect(sectionLabel(g.doc.sections, 1, "gallery")).toBe("Lead image");
    const o = withWorkVisual(galleryDraft(), visual("other"));
    expect(kindsOf(o.doc)).toEqual(["findings", "graph", "reflection", "image"]);
    expect(o.removed).toEqual([]);
    // With pictures already there, it goes before the first: the lead.
    const draft = galleryDraft();
    const withPicture: ExhbtDoc = { ...draft, sections: [...draft.sections, image("image-1", "mine")] };
    expect(kindsOf(withWorkVisual(withPicture, visual("graph")).doc)).toEqual(["findings", "reflection", "image", "image"]);
  });

  test("a layout that takes nothing from the work gets nothing: no layout does yet", () => {
    for (const draft of [caseDraft(), researchDraft(), galleryDraft()]) {
      for (const kind of ["graph", "table", "other"] as const) {
        const r = withWorkVisual(draft, visual(kind), { wants: "none" });
        expect(r.doc).toBe(draft);
        expect(r).toMatchObject({ placed: false, why: "not-wanted", removed: [] });
      }
    }
  });

  test("the same picture twice is left alone", () => {
    const once = withWorkVisual(caseDraft(), visual("graph")).doc;
    const again = withWorkVisual(once, visual("graph"));
    expect(again.doc).toBe(once);
    expect(again).toMatchObject({ placed: false, why: "already" });
  });

  test("the kind is kept with the figure, and a kind this code doesn't know reads as none", () => {
    const doc = withWorkVisual(caseDraft(), visual("graph")).doc;
    expect(ExhbtDocSchema.parse(doc).sections[1]).toMatchObject({ picked: { kind: "graph" } });
    const later = { ...doc, sections: doc.sections.map((s) => (s.kind === "image" ? { ...s, picked: { ...s.picked, kind: "hologram" } } : s)) };
    const read = ExhbtDocSchema.parse(later).sections[1] as { picked?: { kind?: string; from: string } };
    expect(read.picked?.kind).toBeUndefined();
    expect(read.picked?.from).toBe("report.pdf");
    expect(JSON.stringify(publicDoc(doc))).not.toContain("picked");
  });
});

test.describe("What the editor says after a draft (decision 0025)", () => {
  test("a reason is only said when the draft bears it out", () => {
    const research = researchDraft();
    expect(checkedReason(research, "aim-results")).toBe("aim-results");
    // The draft holds an aim, so that's what is said, whichever of the two the AI gave.
    expect(checkedReason(research, "hypothesis-results")).toBe("aim-results");
    const hypothesis: ExhbtDoc = { ...research, sections: research.sections.map((s) => (s.kind === "aim" ? { ...s, heading: "hypothesis" as const } : s)) };
    expect(checkedReason(hypothesis, "aim-results")).toBe("hypothesis-results");
    // No aim in the draft: it can't be claimed. No results either: no reason at all.
    const noAim: ExhbtDoc = { ...research, sections: research.sections.filter((s) => s.kind !== "aim") };
    expect(checkedReason(noAim, "aim-results")).toBe("study");
    expect(checkedReason({ ...noAim, sections: noAim.sections.filter((s) => s.kind !== "findings") }, "aim-results")).toBe("default");
    // The notes must name the layout.
    expect(checkedReason(research, "notes", { notes: "Please use the research layout." })).toBe("notes");
    expect(checkedReason(research, "notes", { notes: "It went well." })).toBe("default");
    expect(checkedReason(caseDraft(), "notes", { notes: "A case study, please." })).toBe("notes");
    // A reason for another layout, or one that isn't on the list, is no reason.
    expect(checkedReason(caseDraft(), "aim-results")).toBe("default");
    expect(checkedReason(caseDraft(), "because I say so")).toBe("default");
    expect(checkedReason(caseDraft(), "question-findings")).toBe("question-findings");
    expect(checkedReason({ ...caseDraft(), title: "Reminders" }, "question-findings")).toBe("default");
    // "Mostly pictures" needs the upload counts to say so.
    const gallery = galleryDraft();
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 4, pdfPages: 0, pdfPicturePages: 0 } })).toBe("mostly-pictures");
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 0, pdfPages: 10, pdfPicturePages: 6 } })).toBe("mostly-pictures");
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 0, pdfPages: 10, pdfPicturePages: 1 } })).toBe("visual-work");
    // One photo beside a 40-page report isn't most of the upload, and exactly half isn't most either.
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 1, pdfPages: 40, pdfPicturePages: 2 } })).toBe("visual-work");
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 0, pdfPages: 10, pdfPicturePages: 5 } })).toBe("visual-work");
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 12, pdfPages: 10, pdfPicturePages: 0 } })).toBe("mostly-pictures");
    expect(checkedReason(gallery, "mostly-pictures", { signals: { imageFiles: 0, pdfPages: 0, pdfPicturePages: 0 } })).toBe("visual-work");
    expect(checkedReason(gallery, "mostly-pictures")).toBe("visual-work");
  });

  test("the layout sentence is fixed wording, and a reason that doesn't fit is left out", () => {
    expect(layoutSentence("research", "aim-results")).toBe("Laid out as Research because your work has an aim and results.");
    expect(layoutSentence("research", "hypothesis-results")).toBe("Laid out as Research because your work has a hypothesis and results.");
    expect(layoutSentence("gallery", "notes")).toBe("Laid out as Gallery because your notes name this layout.");
    expect(layoutSentence("case-study", "question-findings")).toBe(CASE_STUDY_LINE);
    expect(layoutSentence("case-study", "default")).toBe("Laid out as Case study.");
    expect(layoutSentence("case-study", undefined)).toBe("Laid out as Case study.");
    expect(layoutSentence("case-study", "aim-results")).toBe("Laid out as Case study.");
  });

  test("the figure sentence reads the figure from the exhbt, and says so when there is none", () => {
    const placed = withWorkVisual(caseDraft(), visual("graph")).doc;
    expect(figureSentence(placed, undefined)).toBe("The figure is from page 3 of report.pdf. Tick that you may share it before you publish.");
    // The address can't talk a figure away, or one into being.
    expect(figureSentence(placed, "none")).toBe("The figure is from page 3 of report.pdf. Tick that you may share it before you publish.");
    const ticked: ExhbtDoc = { ...placed, sections: placed.sections.map((s) => (s.kind === "image" && s.picked ? { ...s, picked: { ...s.picked, shareOk: true } } : s)) };
    expect(figureSentence(ticked, undefined)).toBe("The figure is from page 3 of report.pdf.");
    const clean: ExhbtDoc = { ...caseDraft(), unverified: [] };
    expect(figureSentence(clean, "none")).toBe("No figure was found in your files, so the graph uses numbers from your files and notes.");
    // A number in the draft is flagged as not found in the material: nothing is said about where the graph's numbers came from.
    expect(figureSentence(caseDraft(), "none")).toBe("No figure was found in your files.");
    expect(figureSentence({ ...clean, sections: [] }, "none")).toBe("No figure was found in your files.");
    // Not every page was looked at: nothing is claimed about the whole of the files.
    expect(figureSentence(clean, "partial")).toBe("No figure was found in the pages we looked at. We look at up to 30 pages of your files.");
    expect(FIGURE.maxPages).toBe(30);
    expect(FIGURE.maxImages).toBe(30);
    expect(figureSentence(caseDraft(), "failed")).toBe("We couldn't look for a figure in your files this time. You can add an image yourself.");
    expect(figureSentence(caseDraft(), "unread")).toBe("We take a figure from a PDF, a Word or PowerPoint file, or a PNG or JPEG picture, and none of your files was one.");
    expect(figureSentence(caseDraft(), "chart")).toBe("We couldn't lift the chart from this file. Save it as a PDF and we'll take it from that.");
    expect(figureSentence(caseDraft(), undefined)).toBeNull();
  });
});

/** A dev user with a username on Premium (so they can publish), signed in on the draft page. */
async function signInPremium(page: Page, username: string) {
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft an exhbt" })).toBeVisible();
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** A new dev user on the Free plan, signed in on the draft page. */
async function signInFree(page: Page, name: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(name))}&next=/exhbts/new`);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
}

/** Adds a file on the draft page and waits until it is read and uploaded. */
async function addFile(page: Page, path: string) {
  await page.locator("#files").setInputFiles(path);
  await expect(page.getByTestId("file-status")).toContainText("uploaded");
}

/** Drafts and waits for the editor. The editor takes what the draft page passed on off the address once it has read it. */
async function draft(page: Page) {
  await page.getByRole("button", { name: "Draft my exhbt" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 60_000 });
  await expect(page.locator("[data-ready=true]")).toBeAttached();
}

const sectionKinds = (page: Page) => page.locator("li[data-section-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
/** The one line under the layout choice, right after a draft. */
const draftedLine = (page: Page) => page.locator("[data-drafted]");
const countPicks = (page: Page) => {
  const seen = { picks: 0 };
  page.on("request", (r) => {
    if (r.url().includes("/api/exhbts/figure-pick")) seen.picks++;
  });
  return seen;
};

test.describe("Draft from a PDF with a chart", () => {
  test("the chart is picked and takes the place of the drafted graph; publishing waits for the share tick", async ({ page }) => {
    // Drafts, publishes and opens the live page: three pages compiled for the first time in dev.
    test.setTimeout(180_000);
    const username = `fig${Date.now().toString(36)}`;
    await signInPremium(page, username);
    await addFile(page, CHART_PDF);

    const pickedResponse = page.waitForResponse((r) => r.url().includes("/api/exhbts/figure-pick"));
    const placed = page.waitForResponse((r) => /\/api\/exhbts\/[0-9a-f-]{36}\/figure$/.test(r.url()));
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    // Beside the draft, its own step.
    await expect(page.getByTestId("drafting").getByText("Picking a figure from your report")).toBeVisible();
    const pick = await pickedResponse;
    expect(pick.status()).toBe(200);
    // Only the chart page was sent (the text pages draw nothing besides text): the stand-in
    // picks the first image it gets and names it in its placeholder description. A graph, by its file's name.
    const answer = (await pick.json()) as { pick: { image: number; kind: string; alt: string; box: { x: number; y: number; w: number; h: number } } };
    expect(answer.pick.image).toBe(1);
    expect(answer.pick.kind).toBe("graph");
    expect(answer.pick.alt).toContain("File 1, page 3");
    expect(answer.pick.alt).not.toContain("report-with-chart");
    // The stand-in's box went out in pixels of the page image and came back as fractions of it.
    expect(answer.pick.box.x).toBeCloseTo(0.06, 2);
    expect(answer.pick.box.w).toBeCloseTo(0.88, 2);
    expect(answer.pick.box.h).toBeCloseTo(0.48, 2);
    expect((await placed).status()).toBe(204);
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator("[data-ready=true]")).toBeAttached();

    // In the editor: the picked figure straight after the findings, and no graph drawn by the AI.
    const kinds = await sectionKinds(page);
    expect(kinds.slice(0, 2)).toEqual(["findings", "image"]);
    expect(kinds).not.toContain("graph");
    const note = page.locator("[data-picked]");
    await expect(note.getByText(WARNING)).toBeVisible();
    await expect(note.getByText("From report-with-chart.pdf, page 3.", { exact: false })).toBeVisible();
    await expect(note.getByLabel(TICK)).not.toBeChecked();
    await expect(page.getByLabel("Image 1: describe it for people who can't see it")).toHaveValue(/Development preview/);

    // One quiet line: the layout and why, a way to change it, and where the figure came from.
    const line = draftedLine(page);
    await expect(line).toContainText(CASE_STUDY_LINE);
    await expect(line).toContainText("The figure is from page 3 of report-with-chart.pdf. Tick that you may share it before you publish.");
    await line.getByRole("link", { name: "Change layout" }).click();
    await expect(page.getByRole("radio", { name: /^Case study/ })).toBeFocused();

    // In the preview, the figure shares a row with the findings, cut out of the page (wider than tall).
    const figure = page.getByRole("region", { name: "Preview" }).locator("[data-found] [data-part=image] img");
    await expect(figure).toBeVisible();
    const size = await figure.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    expect(size.w).toBeGreaterThan(1000);
    expect(size.w).toBeGreaterThan(size.h);

    // Publishing is blocked until the tick, and the problem links to the card.
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const problem = page.getByRole("link", { name: `Image 1: ${NEEDS_TICK}` });
    await expect(problem).toBeVisible();
    await expect(problem).toHaveAttribute("href", "#card-section-1");
    await expect(page.getByText("It's live.")).toHaveCount(0);

    await note.getByLabel(TICK).check();
    // Ticked: the line no longer asks for it.
    await expect(line).toContainText("The figure is from page 3 of report-with-chart.pdf.");
    await expect(line).not.toContainText("Tick that you may share it");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It's live.")).toBeVisible();
    // Publishing saves and renders the page again on the server, with nothing left in the address:
    // the line stays for this visit all the same.
    await expect(line).toContainText(CASE_STUDY_LINE);
    await expect(line).toContainText("The figure is from page 3 of report-with-chart.pdf.");

    // The live page shows the figure beside the findings, and nothing about where it came from.
    const href = await page.getByRole("link", { name: new RegExp(`^/p/${username}/`) }).getAttribute("href");
    await page.goto(href!);
    await expect(page.locator("[data-found] [data-part=image] img")).toBeVisible();
    await expect(page.getByText(WARNING)).toHaveCount(0);
  });

  test("another page, a new crop, and removing it; no AI call for any of them", async ({ page }) => {
    await signInPremium(page, `fig${Date.now().toString(36)}b`);
    await addFile(page, CHART_PDF);
    await draft(page);
    const note = page.locator("[data-picked]");
    await expect(note.getByText(WARNING)).toBeVisible();
    const seen = countPicks(page);
    const imageSrc = () => page.locator("li[data-kind=image] img").first().getAttribute("src");
    const first = await imageSrc();

    // The page picker: every page of the report, the one in use marked.
    await note.getByRole("button", { name: "Choose another page" }).click();
    const picker = page.getByTestId("page-picker");
    await expect(picker.getByRole("button", { name: /^Page \d/ })).toHaveCount(4);
    await expect(picker.getByRole("button", { name: "Page 3, in use now" })).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Page 1", exact: true }).click();
    await expect(note.getByText("Page 1 is in. Crop it to the figure, then describe it.")).toBeVisible();
    await expect(note.getByText("From report-with-chart.pdf, page 1.", { exact: false })).toBeVisible();
    // Another figure: the tick and the description start again.
    await expect(note.getByLabel(TICK)).not.toBeChecked();
    await expect(page.getByLabel("Image 1: describe it for people who can't see it")).toHaveValue("");
    const swapped = await imageSrc();
    expect(swapped).not.toBe(first);
    // The line follows the figure: it reads the page from the exhbt.
    await expect(draftedLine(page)).toContainText("The figure is from page 1 of report-with-chart.pdf.");

    // Crop: the bottom edge moved up to half way.
    await note.getByRole("button", { name: "Crop", exact: true }).click();
    const cropper = page.getByTestId("cropper");
    await expect(cropper.getByRole("img", { name: "Page 1 of report-with-chart.pdf" })).toBeVisible();
    await cropper.getByLabel("Bottom edge").fill("50");
    await cropper.getByRole("button", { name: "Use this crop" }).click();
    await expect(note.getByText("Cropped.")).toBeVisible();
    await expect.poll(imageSrc).not.toBe(swapped);
    const cropped = page.locator("li[data-kind=image] img").first();
    const size = await cropped.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    expect(size.w).toBeGreaterThan(size.h);

    // The saved doc keeps the new page and box. What the draft page passed on is said once, so not after a reload.
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-picked]").getByText("page 1.", { exact: false })).toBeVisible();
    await expect(draftedLine(page)).toHaveCount(0);

    // Remove: the card's own button. The drafted graph went when the figure took its place, so no graph comes back.
    await page.getByRole("button", { name: "Remove image 1" }).click();
    await expect(page.locator("[data-picked]")).toHaveCount(0);
    const kinds = await sectionKinds(page);
    expect(kinds[0]).toBe("findings");
    expect(kinds).not.toContain("image");
    expect(kinds).not.toContain("graph");
    expect(seen.picks).toBe(0);
  });

  test("a picked visual that isn't a graph sits beside the findings and the drafted graph stays", async ({ page }) => {
    await signInFree(page, "figdiagram");
    await addFile(page, DIAGRAM_PDF);
    const pickedResponse = page.waitForResponse((r) => r.url().includes("/api/exhbts/figure-pick"));
    await draft(page);
    // The stand-in reads "diagram" in the file's name as a visual that isn't a graph.
    const answer = (await (await pickedResponse).json()) as { pick: { kind: string; alt: string } };
    expect(answer.pick.kind).toBe("other");
    expect(answer.pick.alt).toContain("File 1, page 2");
    expect((await sectionKinds(page)).slice(0, 3)).toEqual(["findings", "image", "graph"]);
    await expect(page.locator("[data-picked]").getByText("From report-with-diagram.pdf, page 2.", { exact: false })).toBeVisible();
    await expect(draftedLine(page)).toContainText("The figure is from page 2 of report-with-diagram.pdf. Tick that you may share it before you publish.");
  });
});

test.describe("Draft a research exhbt from a PDF with a diagram", () => {
  test("the drafted graph stays the key figure and the picked diagram follows it", async ({ page }) => {
    await signInFree(page, "figresearch");
    await addFile(page, DIAGRAM_PDF);
    await page.locator("#notes").fill("stand-in: layout research");
    const pickedResponse = page.waitForResponse((r) => r.url().includes("/api/exhbts/figure-pick"));
    await draft(page);
    expect(((await (await pickedResponse).json()) as { pick: { kind: string } }).pick.kind).toBe("other");
    await expect(page.getByRole("radio", { name: /^Research/ })).toBeChecked();
    const kinds = await sectionKinds(page);
    expect(kinds).toContain("graph");
    expect(kinds).toContain("image");
    // Research's key figure is its first graph or image: the results graph, with the diagram straight after it.
    expect(kinds.indexOf("image")).toBe(kinds.indexOf("graph") + 1);
    const keyFigure = page.getByRole("region", { name: "Key figure", exact: true });
    await expect(keyFigure).toBeVisible();
    await expect(keyFigure.locator("[data-picked]")).toHaveCount(0);
    await expect(page.locator("[data-picked]").getByText("From report-with-diagram.pdf, page 2.", { exact: false })).toBeVisible();
    const line = draftedLine(page);
    await expect(line).toContainText("Laid out as Research because your notes name this layout.");
    await expect(line).toContainText("The figure is from page 2 of report-with-diagram.pdf.");
  });
});

test.describe("Drafts with no figure", () => {
  test("a PDF longer than the pages looked at: the line doesn't speak for the pages nobody saw", async ({ page }) => {
    await signInFree(page, "figlong");
    const seen = countPicks(page);
    await addFile(page, LONG_TEXT_PDF);
    await draft(page);
    // Thirty of its 31 pages were drawn, none draws anything but text, so nothing was sent.
    expect(seen.picks).toBe(0);
    const line = draftedLine(page);
    await expect(line).toContainText("No figure was found in the pages we looked at. We look at up to 30 pages of your files.");
    await expect(line).not.toContainText("No figure was found in your files");
  });

  test("a draft with a number flagged to check: the line doesn't say where the graph's numbers came from", async ({ page }) => {
    await signInFree(page, "figflag");
    await addFile(page, TEXT_PDF);
    // The stand-in then adds a total it worked out to its graph, which isn't in the report.
    await page.locator("#notes").fill("stand-in: add a figure to check");
    await draft(page);
    expect(await sectionKinds(page)).toContain("graph");
    await expect(page.getByRole("list", { name: "Numbers to check" })).toBeVisible();
    const line = draftedLine(page);
    await expect(line).toContainText("No figure was found in your files.");
    await expect(line).not.toContainText("so the graph uses numbers");
  });

  test("a PDF of plain text: no pick, the drafted graph stays, and the line says none was found", async ({ page }) => {
    await signInFree(page, "nofig");
    const seen = countPicks(page);
    await addFile(page, TEXT_PDF);
    await draft(page);
    expect(seen.picks).toBe(0);
    const kinds = await sectionKinds(page);
    expect(kinds).not.toContain("image");
    expect(kinds).toContain("graph");
    await expect(page.locator("[data-picked]")).toHaveCount(0);
    // Said quietly, in the same line as the layout: not an error (Next's route announcer is always there, and says nothing here).
    const line = draftedLine(page);
    await expect(line).toContainText(CASE_STUDY_LINE);
    await expect(line).toContainText("No figure was found in your files, so the graph uses numbers from your files and notes.");
    await expect(line).toHaveClass(/text-graphite/);
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toHaveCount(0);

    // A figure placed with a caption and no kind: nothing is taken off, and its numbers get the
    // draft's check. 2.3% isn't in the report, so it is flagged to confirm; 30 is, so it isn't.
    const exhbtId = new URL(page.url()).pathname.split("/")[2]!;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const ticket = (await (await page.request.post("/api/files/upload-url", { data: { name: "figure.png", mime: "image/png", bytes: png.length, kind: "image" } })).json()) as {
      fileId: string;
      uploadUrl: string;
      headers: Record<string, string>;
    };
    expect((await page.request.put(ticket.uploadUrl, { headers: ticket.headers, data: png })).ok()).toBe(true);
    const body = { fileId: ticket.fileId, alt: "A bar chart", caption: "Missed appointments fell to 2.3% for patients under 30", picked: { from: "report-text-only.pdf", page: 2 } };
    // A kind that isn't on the list is refused, like any other value that makes no sense.
    expect((await page.request.post(`/api/exhbts/${exhbtId}/figure`, { data: { ...body, kind: "hologram" } })).status()).toBe(400);
    const placed = await page.request.post(`/api/exhbts/${exhbtId}/figure`, { data: body });
    expect(placed.status()).toBe(204);
    // Sent again: it is there already, and nothing changes.
    expect((await page.request.post(`/api/exhbts/${exhbtId}/figure`, { data: body })).status()).toBe(204);
    await page.reload();
    await expect(page.locator("[data-ready=true]")).toBeAttached();
    expect((await sectionKinds(page)).slice(0, 3)).toEqual(["findings", "image", "graph"]);
    const toCheck = page.getByRole("list", { name: "Numbers to check" });
    await expect(toCheck.getByText("2.3%", { exact: true })).toBeVisible();
    await expect(toCheck.getByText("30", { exact: true })).toHaveCount(0);
    await expect(page.locator("[data-picked]").getByText("From report-text-only.pdf, page 2.", { exact: false })).toBeVisible();
  });

  test("a pick that fails leaves the draft as it is, and the line says it couldn't look", async ({ page }) => {
    await page.route("**/api/exhbts/figure-pick", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "We couldn't pick a figure just now." }) }));
    await signInFree(page, "figfail");
    await addFile(page, CHART_PDF);
    await draft(page);
    const kinds = await sectionKinds(page);
    expect(kinds).not.toContain("image");
    // The fallback is ready: the graph the draft drew.
    expect(kinds).toContain("graph");
    await expect(page.getByText("We couldn't pick a figure just now.")).toHaveCount(0);
    const line = draftedLine(page);
    await expect(line).toContainText("We couldn't look for a figure in your files this time. You can add an image yourself.");
    await expect(line).not.toContainText("No figure was found");
    await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toHaveCount(0);
  });

  test("a text-only PDF printed by a browser: its clipping paths and page background are not figures, so nothing is sent", async ({ page }) => {
    // The essay from the figure eval, printed to PDF by Chromium: every page has clipping paths
    // round the text and a white page background, as PDFs from browsers and Word do, and no figure.
    await signInFree(page, "figclip");
    const seen = countPicks(page);
    await addFile(page, PRINTED_ESSAY_PDF);
    await draft(page);
    expect(seen.picks).toBe(0);
    expect(await sectionKinds(page)).not.toContain("image");
    await expect(draftedLine(page)).toContainText("No figure was found in your files");
  });

  test("a file we can't take a figure from: nothing is sent, and the line says which files we can", async ({ page }) => {
    await signInFree(page, "fignopdf");
    const seen = countPicks(page);
    const report = "Final-year project on GP appointment reminders. Missed appointments fell from 7.9% to 6.5% across all patients, and from 11.2% to 8.4% for patients under 30, over six weeks at two practices in Leeds.";
    await page.locator("#files").setInputFiles({ name: "report.txt", mimeType: "text/plain", buffer: Buffer.from(report) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await draft(page);
    expect(seen.picks).toBe(0);
    expect(await sectionKinds(page)).toContain("graph");
    await expect(draftedLine(page)).toContainText("We take a figure from a PDF, a Word or PowerPoint file, or a PNG or JPEG picture, and none of your files was one.");
    await expect(draftedLine(page)).not.toContainText("only be taken from a PDF");
  });
});

test.describe("A scanned PDF", () => {
  const NOTES = "Final-year project on GP appointment reminders at two practices in Leeds. Missed appointments fell from 7.9% to 6.5% across all patients after the reminder moved.";

  test("kept without reading: its pages are never sent for a figure", async ({ page }) => {
    await signInFree(page, "scankept");
    const seen = countPicks(page);
    await page.locator("#files").setInputFiles(SCAN_PDF);
    await expect(page.getByText("That PDF looks like a scan, so we can't read it on your device.")).toBeVisible();
    // The consent covers both things the scan would be sent for.
    await expect(page.getByText("We can send it to our AI reader to turn it into text and to look for a figure, such as a graph, for your exhbt.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Keep it without reading" }).click();
    await page.locator("#notes").fill(NOTES);
    await draft(page);
    expect(seen.picks).toBe(0);
    const kinds = await sectionKinds(page);
    expect(kinds).not.toContain("image");
    expect(kinds).toContain("graph");
    // Nothing was looked at, so nothing is said about a figure.
    await expect(draftedLine(page)).toContainText(CASE_STUDY_LINE);
    await expect(page.locator("[data-drafted-figure]")).toHaveCount(0);
  });

  test("sent to be read: only then are its pages sent, and the figure takes the place of the drafted graph", async ({ page }) => {
    await signInFree(page, "scanread");
    const seen = countPicks(page);
    await page.locator("#files").setInputFiles(SCAN_PDF);
    await expect(page.getByText("That PDF looks like a scan, so we can't read it on your device.")).toBeVisible();
    await page.locator("#notes").fill(NOTES);
    // Asked, not yet answered: nothing has gone anywhere.
    expect(seen.picks).toBe(0);
    await page.getByRole("button", { name: "Read it for me" }).click();
    await expect(page.getByTestId("file-status")).toContainText("words");
    expect(seen.picks).toBe(0);

    const pickedResponse = page.waitForResponse((r) => r.url().includes("/api/exhbts/figure-pick"));
    await draft(page);
    // Every page of a scan is a picture, so both pages went; the stand-in takes the first.
    const answer = (await (await pickedResponse).json()) as { pick: { image: number; kind: string; alt: string }; debug: { sizes: { width: number; height: number }[] } };
    expect(seen.picks).toBe(1);
    expect(answer.debug.sizes).toHaveLength(2);
    expect(Math.max(answer.debug.sizes[0]!.width, answer.debug.sizes[0]!.height)).toBe(FIGURE.thumbEdge);
    expect(answer.pick.alt).toContain("File 1, page 1");
    expect(answer.pick.alt).not.toContain("scan-report");
    const kinds = await sectionKinds(page);
    expect(kinds.slice(0, 2)).toEqual(["findings", "image"]);
    expect(kinds).not.toContain("graph");
    await expect(page.locator("[data-picked]").getByText("From scan-report.pdf, page 1.", { exact: false })).toBeVisible();
    await expect(draftedLine(page)).toContainText("The figure is from page 1 of scan-report.pdf. Tick that you may share it before you publish.");
  });
});
