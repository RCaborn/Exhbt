import { expect, test } from "@playwright/test";
import { cardWords } from "../components/editor/model";
import {
  emptyDoc,
  ExhbtDocSchema,
  formatLimits,
  LIMITS,
  normaliseDoc,
  publicDoc,
  text,
  validateForPublish,
  wordCount,
  type ExhbtDoc,
  type Section,
} from "../lib/exhbt/blocks";
import { applyBlock } from "../lib/exhbt/draft-blocks";
import { formatOf, FORMATS, hiddenSections, shownSections, withFormat } from "../lib/exhbt/formats";
import { fitCaption } from "../lib/figures/rules";
import { keyFigureOf } from "../lib/portfolio-home";
import { referencesFrom } from "../lib/exhbt/references";
import { fullDoc, galleryDoc, libraryDoc, openBankingDoc, researchDoc, sampleDocs, sampleSeeds } from "../lib/exhbt/sample";
import { firstOfKinds, layoutNotes, leadRatio, imageRatio, sectionLabel, withKeyFigure } from "../lib/exhbt/sections";
import { unverifiedNumbers } from "../lib/exhbt/verify";

// Exhbt layouts (decision 0024): case study, gallery and research. One optional field, `format`;
// no migration; a doc without one (or with one this code doesn't know) is a case study.

/* ---------------- The model (pure) ---------------- */

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const IDS = Array.from({ length: 8 }, (_, i) => ID(i + 1));
const gallery = () => galleryDoc(IDS);
const research = () => researchDoc(ID(1));
const messages = (d: ExhbtDoc) => validateForPublish(d).map((i) => `${i.path}: ${i.message}`);
const pathsOf = (d: ExhbtDoc) => validateForPublish(d).map((i) => i.path);
const image = (n: number, over: Partial<Extract<Section, { kind: "image" }>> = {}): Section => ({ id: `image-${n}`, kind: "image", fileId: ID(n), alt: `Picture ${n}`, caption: [], ...over });
const nWords = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test.describe("model: old docs are unchanged", () => {
  // Read on origin/phase-2 before this change: gp 110, library 71, open banking 146, full 196, none with issues.
  const before: [string, ExhbtDoc, number][] = [
    ["gp (old shape)", sampleDocs[0]!, 110],
    ["library", sampleDocs[1]!, 71],
    ["open banking", openBankingDoc, 146],
    ["full", fullDoc, 196],
  ];
  for (const [name, doc, n] of before) {
    test(`${name}: a case study, same words, nothing to fix`, () => {
      expect(formatOf(doc)).toBe("case-study");
      expect(shownSections(doc).map((x) => x.s)).toEqual(doc.sections);
      expect(hiddenSections(doc)).toEqual([]);
      expect(wordCount(doc)).toBe(n);
      expect(validateForPublish(doc)).toEqual([]);
    });
  }

  test("a new case study has no format key", () => {
    expect("format" in emptyDoc()).toBe(false);
    for (const seed of sampleSeeds) expect("format" in ExhbtDocSchema.parse(seed)).toBe(false);
  });

  test("case study messages are as they were", () => {
    const d: ExhbtDoc = { ...libraryDoc, sections: [libraryDoc.sections[0]!, image(1), image(2), image(3)] };
    expect(messages(d)).toContain("sections: Up to 2 images.");
    const two: ExhbtDoc = { ...libraryDoc, sections: [...libraryDoc.sections, { id: "link-1", kind: "link", href: "https://a.co", label: "A", description: "" }, { id: "link-2", kind: "link", href: "https://b.co", label: "B", description: "" }] };
    expect(messages(two)).toContain("sections: Only one link.");
  });

  test("formatLimits of a case study is LIMITS", () => {
    const L = formatLimits("case-study");
    expect(L.findings).toEqual(LIMITS.findings);
    expect(L.images).toEqual(LIMITS.images);
    expect(L.sections).toEqual(LIMITS.sections);
    expect(L.gapWords).toBe(LIMITS.gapWords);
    expect(L.targetWords).toBe(LIMITS.targetWords);
    expect(L.totalWords).toBe(200);
  });
});

test.describe("model: the layout field", () => {
  test("the schema keeps the layout, the aim, the conclusion and image sizes", () => {
    const r = ExhbtDocSchema.parse(research());
    expect(r.format).toBe("research");
    const aim = r.sections.find((s) => s.kind === "aim");
    expect(aim && aim.kind === "aim" && aim.heading).toBe("hypothesis");
    expect(r.sections.some((s) => s.kind === "conclusion")).toBe(true);
    const g = ExhbtDocSchema.parse(gallery());
    const im = g.sections.find((s) => s.kind === "image");
    expect(im && im.kind === "image" && [im.w, im.h]).toEqual([1200, 1600]);
  });

  test("a layout this code doesn't know reads as a case study and nothing else is lost", () => {
    const d = normaliseDoc({ ...research(), format: "build" });
    expect("format" in d).toBe(false);
    expect(d.sections).toHaveLength(research().sections.length);
    expect(d.title).toBe(research().title);
    const parsed = ExhbtDocSchema.parse({ ...gallery(), format: 42 });
    expect(formatOf(parsed)).toBe("case-study");
    expect(() => normaliseDoc({ format: "build" })).not.toThrow();
    expect(() => normaliseDoc(null)).not.toThrow();
  });

  test("a doc without a layout parses without one", () => {
    expect("format" in ExhbtDocSchema.parse(libraryDoc)).toBe(false);
    expect("format" in ExhbtDocSchema.parse(sampleSeeds[0])).toBe(false);
  });

  test("switching layout changes the layout and nothing else, and back is exact", () => {
    for (const doc of [...sampleDocs, openBankingDoc, fullDoc, gallery(), research()]) {
      const there = withFormat(withFormat(doc, "gallery"), "research");
      expect(there.sections).toEqual(doc.sections);
      expect(there.flow).toEqual(doc.flow);
      expect(withFormat(there, "case-study")).toEqual(withFormat(doc, "case-study"));
    }
    for (const doc of sampleDocs) expect(withFormat(withFormat(withFormat(doc, "case-study"), "gallery"), "case-study")).toEqual(doc);
    expect(FORMATS).toEqual(["case-study", "gallery", "research"]);
  });
});

test.describe("model: words and what's shown", () => {
  test("an aim counts in research and not in a case study", () => {
    const base = withFormat(libraryDoc, "research");
    const aim: Section = { id: "aim-1", kind: "aim", text: text("One two three four five.") };
    const inResearch = { ...base, sections: [...base.sections, aim] };
    expect(wordCount(inResearch)).toBe(wordCount(base) + 5);
    expect(wordCount(withFormat(inResearch, "case-study"))).toBe(wordCount(base));
  });

  test("the samples fit the 200 words", () => {
    expect(wordCount(gallery())).toBeLessThanOrEqual(200);
    expect(wordCount(research())).toBeLessThanOrEqual(200);
    expect(wordCount(research())).toBe(193);
    expect(wordCount(gallery())).toBe(144);
  });

  test("each card's words add up to the page's", () => {
    const withAim: ExhbtDoc = { ...libraryDoc, sections: [...libraryDoc.sections, { id: "aim-1", kind: "aim", text: text("A hidden aim of six words.") }] };
    for (const doc of [libraryDoc, fullDoc, gallery(), research(), withAim]) {
      const c = cardWords(doc);
      const total = Object.values(c).reduce<number>((n, v) => n + (v ?? 0), 0);
      // The card words don't include the headline or evidence twice: they are the same parts as wordCount.
      expect(total).toBe(wordCount(doc));
    }
    expect(cardWords(withAim)["section-1"]).toBe(0);
  });

  test("publicDoc leaves out what the layout doesn't draw, and the working copy keeps it", () => {
    const r = research();
    const asCase = withFormat(r, "case-study");
    const pub = publicDoc(asCase);
    expect(pub.sections.some((s) => s.kind === "aim" || s.kind === "conclusion")).toBe(false);
    expect(asCase.sections.some((s) => s.kind === "aim")).toBe(true);
    expect(publicDoc(r).sections.some((s) => s.kind === "aim")).toBe(true);
  });

  test("the number check still reads a hidden aim", () => {
    const d: ExhbtDoc = { ...libraryDoc, sections: [...libraryDoc.sections, { id: "aim-1", kind: "aim", text: text("We expect 91% of them to agree.") }] };
    expect(unverifiedNumbers(d, "nothing here")).toContain("91%");
  });
});

test.describe("model: publishing", () => {
  test("the samples pass", () => {
    expect(messages(gallery())).toEqual([]);
    expect(messages(research())).toEqual([]);
  });

  test("gallery rules", () => {
    const g = gallery();
    const keep = (n: number) => ({ ...g, sections: [...g.sections.filter((s) => s.kind !== "image"), ...g.sections.filter((s) => s.kind === "image").slice(0, n)] });
    expect(pathsOf(keep(1))).toContain("sections");
    expect(messages(keep(1))).toContain("sections: A gallery needs at least 2 images.");
    expect(messages(keep(2))).toEqual([]);
    // A missing alt fails at that image.
    const noAlt = { ...g, sections: g.sections.map((s) => (s.id === "image-3" && s.kind === "image" ? { ...s, alt: "" } : s)) };
    const at = noAlt.sections.findIndex((s) => s.id === "image-3");
    expect(pathsOf(noAlt)).toContain(`sections.${at}.alt`);
    // Nine images fail.
    expect(messages({ ...g, sections: [...g.sections, image(9)] })).toContain("sections: Up to 8 images.");
    // Findings are optional.
    expect(messages({ ...g, sections: g.sections.filter((s) => s.kind !== "findings") })).toEqual([]);
    // A caption over the gallery cap fails, though 15 words would pass in a case study.
    const long = { ...g, sections: g.sections.map((s) => (s.id === "image-2" && s.kind === "image" ? { ...s, caption: text(nWords(11)) } : s)) };
    const n = long.sections.findIndex((s) => s.id === "image-2");
    expect(pathsOf(long)).toContain(`sections.${n}.caption`);
    // One graph only.
    const graph = (k: number): Section => ({ id: `graph-${k}`, kind: "graph", chart: { kind: "bar", title: "T", unit: "%", rows: [{ label: "A", value: 1 }, { label: "B", value: 2 }] } });
    expect(messages({ ...g, sections: [...g.sections, graph(1), graph(2)] })).toContain("sections: Only one graph.");
  });

  test("research rules", () => {
    const r = research();
    const without = (kinds: string[]) => ({ ...r, sections: r.sections.filter((s) => !kinds.includes(s.kind)) });
    expect(pathsOf(without(["aim"]))).toContain("sections");
    expect(messages(without(["aim"]))).toContain("sections: Add your aim or hypothesis.");
    expect(messages(without(["conclusion"]))).toContain("sections: Add your conclusion.");
    expect(messages(without(["graph", "image"]))).toContain("sections: Add a graph or an image: the key figure.");
    expect(messages(without(["findings"]))).toContain("sections: Add your results.");
    const four = { ...r, sections: [...r.sections, image(2), image(3)] };
    expect(messages(four)).toContain("sections: Up to 3 figures, graphs and images together.");
    const aimIndex = r.sections.findIndex((s) => s.kind === "aim");
    const over = { ...r, sections: r.sections.map((s) => (s.kind === "aim" ? { ...s, text: text(nWords(LIMITS.aim.words + 1)) } : s)) };
    expect(pathsOf(over)).toContain(`sections.${aimIndex}.text`);
    // Research asks for two to three results of fifteen words.
    expect(formatLimits("research").findings).toMatchObject({ min: 2, max: 3, wordsEach: 15 });
  });

  test("a case study holding an empty aim and conclusion passes: they are hidden, not checked", () => {
    const d: ExhbtDoc = { ...libraryDoc, sections: [...libraryDoc.sections, { id: "aim-1", kind: "aim", text: [] }, { id: "conclusion-1", kind: "conclusion", text: [] }] };
    expect(validateForPublish(d)).toEqual([]);
  });

  test("eight images switched to a case study fail with the old message, and nothing is hidden", () => {
    const asCase = withFormat(gallery(), "case-study");
    expect(messages(asCase)).toContain("sections: Up to 2 images.");
    expect(asCase.sections.filter((s) => s.kind === "image")).toHaveLength(8);
  });

  test("gallery wording for the brief", () => {
    const blank = withFormat(emptyDoc(), "gallery");
    expect(messages(blank)).toContain("gap: Add the brief: what you were asked to do, and for whom.");
  });
});

test.describe("model: placing a picked figure", () => {
  const fig = { fileId: ID(9), alt: "A chart" };
  test("a case study: straight after the findings (unchanged)", () => {
    const d = withKeyFigure(libraryDoc, fig);
    expect(d.sections.map((s) => s.kind)).toEqual(["findings", "image"]);
    expect("format" in d).toBe(false);
  });
  test("a gallery: before the first image, and last when there is none", () => {
    const g = gallery();
    const d = withKeyFigure({ ...g, sections: g.sections.filter((s) => s.kind !== "image" || s.id !== "image-8") }, fig);
    const at = d.sections.findIndex((s) => s.kind === "image");
    expect(d.sections[at]!.kind === "image" && (d.sections[at] as { fileId: string }).fileId).toBe(ID(9));
    const none = withKeyFigure({ ...g, sections: g.sections.filter((s) => s.kind !== "image") }, fig);
    expect(none.sections.at(-1)!.kind).toBe("image");
  });
  test("a full gallery is unchanged", () => {
    const g = gallery();
    expect(withKeyFigure(g, fig)).toBe(g);
  });
  test("research: before the first figure", () => {
    const r = research();
    const d = withKeyFigure(r, fig);
    const kinds = d.sections.map((s) => s.kind);
    expect(kinds.indexOf("image")).toBeLessThan(kinds.indexOf("graph"));
  });
});

test.describe("model: names, shapes and the home page", () => {
  test("lead image and key figure labels; the case study is unchanged", () => {
    const g = gallery();
    const i1 = g.sections.findIndex((s) => s.id === "image-1");
    const i2 = g.sections.findIndex((s) => s.id === "image-2");
    expect(sectionLabel(g.sections, i1, "gallery")).toBe("Lead image");
    expect(sectionLabel(g.sections, i2, "gallery")).toBe("Image 2");
    const r = research();
    const gi = r.sections.findIndex((s) => s.kind === "graph");
    const ii = r.sections.findIndex((s) => s.kind === "image");
    expect(sectionLabel(r.sections, gi, "research")).toBe("Key figure");
    expect(sectionLabel(r.sections, ii, "research")).toBe("Image 1");
    expect(sectionLabel(fullDoc.sections, 1)).toBe("Graph 1");
    expect(sectionLabel(fullDoc.sections, 0)).toBe("Findings");
  });

  test("the key figure on the home page", () => {
    const g = gallery();
    const k = keyFigureOf(g);
    expect(k.kind === "image" && k.fileId).toBe(IDS[0]);
    expect(keyFigureOf(research()).kind).toBe("chart");
    expect(keyFigureOf(openBankingDoc).kind).toBe("chart");
    expect(keyFigureOf(libraryDoc).kind).toBe("flow");
  });

  test("image shapes", () => {
    expect(imageRatio({})).toBeCloseTo(4 / 3);
    expect(imageRatio({ w: 1080, h: 1920 })).toBe(0.5625);
    expect(imageRatio({ w: 2400, h: 800 })).toBe(2.4);
    expect(leadRatio({ w: 1200, h: 1600 })).toBeCloseTo(4 / 3);
    expect(leadRatio({ w: 2400, h: 800 })).toBe(2.2);
  });

  test("firstOfKinds", () => {
    const r = research();
    expect(firstOfKinds(r.sections, ["graph", "image"])).toBe(r.sections.findIndex((s) => s.kind === "graph"));
    expect(firstOfKinds(r.sections, ["quote"])).toBe(-1);
  });
});

test.describe("model: references, captions, notes", () => {
  const source = "See https://example.com/paper and (https://example.com/other). Also http://plain.example/x and javascript:alert(1).";
  test("referencesFrom keeps only https addresses that are in the source", () => {
    const refs = [
      { label: "Paper", url: "https://example.com/paper" },
      { label: "Made up", url: "https://example.com/not-there" },
      { label: "Plain", url: "http://plain.example/x" },
      { label: "Script", url: "javascript:alert(1)" },
      { label: "  ", url: "https://example.com/other" },
      { label: "Other", url: "https://example.com/other" },
    ];
    expect(referencesFrom(refs, source, 5).map((r) => r.label)).toEqual(["Paper", "Other"]);
    expect(referencesFrom(refs, source, 1)).toHaveLength(1);
  });

  test("fitCaption takes a cap", () => {
    expect(fitCaption(nWords(30), 10).split(" ")).toHaveLength(10);
    expect(fitCaption(nWords(30)).split(" ")).toHaveLength(15);
  });

  test("going back to the AI version never changes the layout", () => {
    const r = research();
    const d = applyBlock(r, "header", { title: "New title", context: "c", whereWhen: "w", summary: "s" } as never);
    expect(formatOf(d)).toBe("research");
    expect(d.title).toBe("New title");
  });

  test("layoutNotes for a blank doc switched to a gallery", () => {
    const n = layoutNotes(withFormat(emptyDoc(), "gallery"));
    expect(n.missing.map((m) => m.text)).toEqual(["Add at least 2 images", "Fill in or remove the empty findings"]);
    expect(n.missing[0]!.add).toBe("image");
    expect(n.hidden).toEqual([]);
  });

  test("layoutNotes names hidden kinds and over-cap kinds", () => {
    const n = layoutNotes(withFormat(research(), "case-study"));
    expect(n.hidden).toEqual(["Aim or hypothesis", "Conclusion"]);
    const g = layoutNotes(withFormat(gallery(), "case-study"));
    expect(g.over[0]).toBe("This layout shows up to 2 images; you have 8. Remove some before you publish, or switch back.");
  });
});
