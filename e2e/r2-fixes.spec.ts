import { expect, test, type Page } from "@playwright/test";
import { aiVersionOf, applyBlock, readAiVersion } from "../lib/exhbt/draft-blocks";
import { emptyDoc, SCHEMA_VERSION, text, words, type Chart, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { CLASSIC_FORMATS, mayCarryFormat, OFFERED_FORMATS, offeredIn } from "../lib/exhbt/formats";
import { withWorkVisual } from "../lib/exhbt/sections";
import { pathOfNumber, unverifiedNumbers } from "../lib/exhbt/verify";
import { fitCaption } from "../lib/figures/rules";
import * as classicEditor from "./editor-classic-helpers";
import { fillValid, openPublishSheet, publishSheet, signInAs, startFromScratch, waitForSaved } from "./editor";
import { uniqueEmail } from "./helpers";
import { READY } from "./page-editor";

// The fixes from the release 2 review: the server holds the layout line (model-1), the figure route is
// safe to call at any time (figure-1), the alt text's numbers are checked (figure-2), a pick is counted
// before the AI call and given back when the service never answered (figure-3, then its second review),
// the scan wording (figure-5), captions are cut without changing what they say (job 1, item 6, then
// caption-cut-early-clause) and the findings go after the flowchart's marker (model-2). The key order
// the live database hands docs back in has its own spec, key-order.spec.ts.

const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const chartA: Chart = { kind: "bar", title: "Missed appointments", rows: [{ label: "Before", value: 7.9 }, { label: "After", value: 6.5 }] };
const chartB: Chart = { kind: "bar", title: "By practice", rows: [{ label: "North", value: 11.2 }, { label: "South", value: 8.4 }] };
const graph = (id: string, chart: Chart): Section => ({ id, kind: "graph", chart });
const flowMarker = { id: "flow", kind: "flow" } as const;

/* ---------------- Pure ---------------- */

// The rule is at the top of lib/figures/caption.ts. These tests were written for the first cut at a
// clause, which kept anything from three words up; the second review (caption-cut-early-clause) showed
// that leaves "Sales for 2019" and "Sales rose by approx.", and one caption empty. They now assert the
// rule that replaced it: two thirds of the limit, or the cut at the limit with an ellipsis.
test.describe("A caption is cut to its limit without changing what it says", () => {
  /** Each caption, then what it is cut to at 10 words (a gallery) and at 15 (a case study, and the pick itself). */
  const REVIEW_CASES: [caption: string, at10: string, at15: string][] = [
    // A comma inside a list is not the end of a clause.
    [
      "Wireframes for the login, sign-up and checkout screens drawn in the first design sprint",
      "Wireframes for the login, sign-up and checkout screens drawn in…",
      "Wireframes for the login, sign-up and checkout screens drawn in the first design sprint",
    ],
    [
      "Sales for 2019, 2020 and 2021 across all four regions of the north of England and Wales",
      "Sales for 2019, 2020 and 2021 across all four regions…",
      "Sales for 2019, 2020 and 2021 across all four regions of the north of England…",
    ],
    [
      "Scores for Group A, Group B and Group C before and after the six-week programme of extra tuition",
      "Scores for Group A, Group B and Group C before…",
      "Scores for Group A, Group B and Group C before and after the six-week programme…",
    ],
    [
      "Posters for the autumn, winter and spring shows at the students' union theatre",
      "Posters for the autumn, winter and spring shows at the…",
      "Posters for the autumn, winter and spring shows at the students' union theatre",
    ],
    // A colon early on keeps too little, and the comma after it is a list's.
    [
      "Mean recall by condition: control, spaced practice and massed practice groups over the four weekly test sessions",
      "Mean recall by condition: control, spaced practice and massed practice…",
      "Mean recall by condition: control, spaced practice and massed practice groups over the four weekly…",
    ],
    // The full stop of an abbreviation, with a number after it, and the full stop of an initial.
    [
      "Sales rose by approx. 12,000 units in the first quarter after the new till opened in March",
      "Sales rose by approx. 12,000 units in the first quarter…",
      "Sales rose by approx. 12,000 units in the first quarter after the new till opened…",
    ],
    [
      "Photograph of the finished installation by J. Smith and R. Patel at the degree show in the old library",
      "Photograph of the finished installation by J. Smith and R.…",
      "Photograph of the finished installation by J. Smith and R. Patel at the degree show…",
    ],
    // A bracket opened in the first words: cutting back to it would keep nothing, or one word, so the cut at the limit stands.
    [
      "(Left to right: the first prototype, the second prototype and the final build shown at the summer degree show",
      "(Left to right: the first prototype, the second prototype and…",
      "(Left to right: the first prototype, the second prototype and the final build shown at…",
    ],
    // The same bracket, closed after both limits: its closing mark is past the cut, so it is left open in the same way.
    [
      "(Left to right: the first prototype, the second prototype and the final build of the sensor housing)",
      "(Left to right: the first prototype, the second prototype and…",
      "(Left to right: the first prototype, the second prototype and the final build of the…",
    ],
    [
      "Results (mean and standard deviation across all twelve participants in each of the three conditions tested) by week",
      "Results (mean and standard deviation across all twelve participants in…",
      "Results (mean and standard deviation across all twelve participants in each of the three conditions…",
    ],
    // Nowhere a clause ends: the cut at the limit, shown as shortened.
    [
      "Mean reaction time in milliseconds for each of the four groups across both sessions of the spring term study",
      "Mean reaction time in milliseconds for each of the four…",
      "Mean reaction time in milliseconds for each of the four groups across both sessions of…",
    ],
  ];
  /** The two captions the last real-AI run wrote, each one word over the pick's limit. */
  const REAL_CAPTIONS: [caption: string, at10: string, at15: string][] = [
    [
      "Mean number of words recalled out of 40, by condition (n = 24 in each group).",
      // The comma ends a clause and keeps 8 of 10 words. At 15 it keeps too little, so the cut goes back to before the open bracket: 10 of 15.
      "Mean number of words recalled out of 40…",
      "Mean number of words recalled out of 40, by condition…",
    ],
    [
      "Figure 1. The parts of the booking system, shown as a flow of four connected boxes.",
      "Figure 1. The parts of the booking system…",
      "Figure 1. The parts of the booking system, shown as a flow of four connected…",
    ],
  ];

  test("every case from the review, and the two captions from the real run, at 10 and at 15 words", () => {
    for (const [caption, at10, at15] of [...REVIEW_CASES, ...REAL_CAPTIONS]) {
      expect(fitCaption(caption, 10), `${caption} (10)`).toBe(at10);
      expect(fitCaption(caption, 15), `${caption} (15)`).toBe(at15);
      for (const cut of [at10, at15]) {
        expect(cut, caption).not.toBe("");
        expect(words(cut), cut).toBeLessThanOrEqual(15);
        // Only words from the start, as they were written.
        expect(caption.startsWith(cut.replace(/…$/, "")), cut).toBe(true);
      }
      expect(words(at10), at10).toBeLessThanOrEqual(10);
    }
  });

  test("a caption that fits is left alone, at any limit it fits", () => {
    expect(fitCaption("  Missed   appointments, by month. ", 15)).toBe("Missed appointments, by month.");
    expect(fitCaption("Missed appointments, by month", 4)).toBe("Missed appointments, by month");
    // Even one that ends in something a cut would tidy away: nothing was cut.
    expect(fitCaption("Missed appointments, by month:", 15)).toBe("Missed appointments, by month:");
    expect(fitCaption("", 15)).toBe("");
    expect(fitCaption("   ", 15)).toBe("");
  });

  test("exactly the limit, one word and nothing at all, at 10 and at 15 words", () => {
    const ten = "Missed appointments at the two practices before and after reminders";
    const fifteen = "Mean number of words recalled out of 40 by each group in the spring term";
    expect(words(ten)).toBe(10);
    expect(words(fifteen)).toBe(15);
    // Exactly the limit: nothing is cut, so nothing is tidied away and no ellipsis is added.
    expect(fitCaption(ten, 10)).toBe(ten);
    expect(fitCaption(ten, 15)).toBe(ten);
    expect(fitCaption(fifteen, 15)).toBe(fifteen);
    expect(fitCaption("one two three four five six seven eight nine ten,", 10)).toBe("one two three four five six seven eight nine ten,");
    // The same fifteen words at ten: no end of a clause to go back to, so the cut at the limit.
    expect(fitCaption(fifteen, 10)).toBe("Mean number of words recalled out of 40 by each…");
    for (const max of [10, 15]) {
      expect(fitCaption("Sales", max)).toBe("Sales");
      expect(fitCaption("", max)).toBe("");
      expect(fitCaption(" \n ", max)).toBe("");
    }
  });

  test("an earlier end is taken only when it keeps two thirds of the limit: 10 words of 15, 7 of 10", () => {
    // A sentence ends at word 11 of 15: taken, and nothing says it was shortened, because it wasn't cut inside a sentence.
    expect(fitCaption("Mean number of words recalled out of 40 in each condition. Error bars show one standard deviation", 15)).toBe(
      "Mean number of words recalled out of 40 in each condition.",
    );
    // A sentence ends exactly at the limit.
    expect(fitCaption("one two three four five six seven eight nine ten. Eleven twelve", 10)).toBe("one two three four five six seven eight nine ten.");
    // A semicolon and a comma end a clause: the mark goes and the ellipsis shows more followed.
    expect(fitCaption("Recall by group in each of the four weekly test sessions; error bars show one standard deviation either side", 15)).toBe(
      "Recall by group in each of the four weekly test sessions…",
    );
    expect(fitCaption("Time on task: mean of 24 participants in each of the two conditions, measured in seconds per page", 15)).toBe(
      "Time on task: mean of 24 participants in each of the two conditions…",
    );
    // The same sentence end at word 9 of 15 keeps too little: the cut at the limit stands.
    expect(fitCaption("Recall after one week, by group and by condition. Error bars show one standard deviation either side", 15)).toBe(
      "Recall after one week, by group and by condition. Error bars show one standard deviation…",
    );
    // 9 of 15 is under two thirds; 9 of 12 is not.
    expect(fitCaption("Recall after one week, by group and by condition. Error bars show one standard deviation either side", 12)).toBe(
      "Recall after one week, by group and by condition.",
    );
  });

  test("what is not the end of a clause: a list, an abbreviation, an initial, a number or a small letter next", () => {
    // A long list, with its "and" past the limit: every comma is the list's.
    expect(fitCaption("Posters, flyers, tickets, programmes, banners, badges, stickers, menus, maps, signs, bags, mugs, pens, shirts, caps and hats", 10)).toBe(
      "Posters, flyers, tickets, programmes, banners, badges, stickers, menus, maps, signs…",
    );
    // A comma before a number is not an end; the one after the numbers is.
    expect(fitCaption("Mean score in each of the four years measured, 2019 to 2022, for every group in the study", 15)).toBe(
      "Mean score in each of the four years measured, 2019 to 2022…",
    );
    // "Dr." before a name, "A." as a label, "U.K.", and a full stop with a small letter after it.
    expect(fitCaption("Sales in the north and the south for the year as counted by Dr. Patel and the team", 15)).toBe(
      "Sales in the north and the south for the year as counted by Dr. Patel…",
    );
    expect(fitCaption("Scores before and after the programme for the pupils in Group A. Group B took no part", 15)).toBe(
      "Scores before and after the programme for the pupils in Group A. Group B took…",
    );
    expect(fitCaption("Results for the U.K. Sample sizes are in brackets after each of the group names shown", 10)).toBe(
      "Results for the U.K. Sample sizes are in brackets after…",
    );
    expect(fitCaption("The mean score for each of the three groups at week 4. n = 24 in every group tested", 15)).toBe(
      "The mean score for each of the three groups at week 4. n = 24…",
    );
    // Numbers are never split: the comma and the point inside them are part of the word.
    expect(fitCaption("Rows cleaned rose from 12,270 to 14,200 and the error rate fell from 3.5 to 1.2 per cent", 10)).toBe(
      "Rows cleaned rose from 12,270 to 14,200 and the error…",
    );
  });

  test("a bracket or a quote left open is cut back to when that keeps two thirds, and nothing is left hanging", () => {
    expect(fitCaption('Feedback on the first prototype of the booking screen, which testers called "cluttered and hard to read on a phone"', 15)).toBe(
      "Feedback on the first prototype of the booking screen, which testers called…",
    );
    expect(fitCaption("Waits at the till before and after the second till opened (weekday lunchtimes, 12 to 2, over four weeks) and sales", 15)).toBe(
      "Waits at the till before and after the second till opened…",
    );
    // Cutting back to the bracket would keep 6 of 10 words, under two thirds: the cut at the limit stands, bracket and all.
    expect(fitCaption("one two three four five six (seven eight nine ten eleven twelve", 10)).toBe("one two three four five six (seven eight nine ten…");
    // A bracket that is closed within the limit is kept whole.
    expect(fitCaption("The parts of the booking system (requests, confirmations and reminders) as four connected boxes with arrows between them", 10)).toBe(
      "The parts of the booking system (requests, confirmations and reminders)…",
    );
    // A dash on its own at the cut goes; a comma at the cut goes.
    expect(fitCaption("Before and after the second till opened at the campus shop – weekday lunchtimes only, over four weeks", 12)).toBe(
      "Before and after the second till opened at the campus shop…",
    );
    expect(fitCaption("a b c d e f g h i, j k l", 9)).toBe("a b c d e f g h i…");
  });

  test("one ellipsis, joined to the last word, so the caption is never a word over; never empty", () => {
    const cut = fitCaption("a b c d e f g h i j k l m n o p q", 15);
    expect(cut).toBe("a b c d e f g h i j k l m n o…");
    expect(words(cut)).toBe(15);
    expect(fitCaption("Sales rose", 1)).toBe("Sales…");
    // A limit under one word is read as one word: a caption that had words never comes back empty.
    expect(fitCaption("Sales rose", 0)).toBe("Sales…");
    expect(fitCaption("Sales", 0)).toBe("Sales");
    // A caption that already trails off where it is cut gets no second ellipsis.
    expect(fitCaption("one two three four five six seven eight nine ten… eleven", 10)).toBe("one two three four five six seven eight nine ten…");
    expect(fitCaption("one two three four five six seven eight nine ten... eleven", 10)).toBe("one two three four five six seven eight nine ten...");
  });

  test("cut twice, as it is in a gallery: the pick cuts at 15 and the figure route cuts what it is sent at 10", () => {
    // For the review's cases the second cut reads the same as one cut at 10.
    for (const [caption, at10] of REVIEW_CASES) expect(fitCaption(fitCaption(caption, 15), 10), caption).toBe(at10);
    // The first cut can leave a caption that already fits the second limit: it is then left alone, ellipsis and all.
    expect(fitCaption(fitCaption(REAL_CAPTIONS[0]![0], 15), 10)).toBe("Mean number of words recalled out of 40, by condition…");
    expect(fitCaption(fitCaption(REAL_CAPTIONS[1]![0], 15), 10)).toBe("Figure 1. The parts of the booking system…");
    // A list whose "and" the first cut took away: its comma can no longer be told from a clause's. The ellipsis still says more followed.
    const hidden = "one two three four five six seven, eight nine ten eleven twelve thirteen fourteen fifteen sixteen and seventeen";
    expect(fitCaption(hidden, 10)).toBe("one two three four five six seven, eight nine ten…");
    expect(fitCaption(fitCaption(hidden, 15), 10)).toBe("one two three four five six seven…");
  });

  test("random captions: always the start of what was written, never over the limit, never empty", () => {
    /** A small seeded generator (mulberry32), so a failure can be run again. */
    const seeded = (seed: number) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    // Plain words, joining words, every mark the rule reads, numbers, abbreviations, initials, brackets, quotes, dashes, and marks on their own.
    const VOCAB = [
      "Mean", "recall", "by", "condition", "the", "of", "in", "group", "week", "sales", "Sales", "The", "Error", "bars", "show", "for", "each", "across", "after", "before",
      "and", "or", "and", "or", "&",
      "condition,", "week,", "2019,", "2020", "north,", "south;", "condition:", "group.", "tested.", "week!", "why?", "40,", "40.", "12,000", "3.5", "12,000,", "24", "n", "=",
      "approx.", "e.g.", "i.e.", "Fig.", "No.", "vs.", "etc.", "Dr.", "St.", "e.g.,", "etc.,", "A.", "J.", "U.K.", "B,",
      "(n", "24)", "(mean", "tested)", "(Left", "group).", "group),", "[1]", "{x", "y}",
      '"cluttered', 'phone"', '"cluttered,"', '"clear."', "“easy", "use”", "students'", "it's", '12"', '"12"',
      "–", "—", "-", "pre-", "six-week", "more…", "etc...", "…", ",", ";", ":", ".", "café,", "Zürich.", "naïve",
    ];
    const SPACE = [" ", " ", " ", "  ", "\t", "\n", " \n "];
    /** The cut without the ellipsis the cut added (one the caption had already is part of what was written). */
    const written = (norm: string, cut: string) => (cut.endsWith("…") && !norm.startsWith(cut) ? cut.slice(0, -1) : cut);
    /** The first few cuts that break a rule, each with the seed and limit to run it again. Plain checks, so the loop is quick. */
    const broken: string[] = [];
    let checked = 0;
    for (let seed = 1; seed <= 20_000 && broken.length < 5; seed++) {
      const next = seeded(seed);
      const pick = <T,>(from: T[]): T => from[Math.floor(next() * from.length)]!;
      const count = 1 + Math.floor(next() * 30);
      let caption = next() < 0.2 ? pick(SPACE) : "";
      for (let i = 0; i < count; i++) caption += (i ? pick(SPACE) : "") + pick(VOCAB);
      if (next() < 0.2) caption += pick(SPACE);
      const norm = caption.replace(/\s+/g, " ").trim();
      const must = (ok: boolean, rule: string, limit: string, cut: string) => {
        if (!ok) broken.push(`${rule} (seed ${seed}, ${limit}): ${JSON.stringify(caption)} -> ${JSON.stringify(cut)}`);
      };
      for (const max of [1, 2, 3, 7, 10, 15, 20]) {
        const cut = fitCaption(caption, max);
        const limit = `limit ${max}`;
        // Never over the limit, counted as publishing counts it; never empty.
        must(words(cut) <= max, "over the limit", limit, cut);
        must(cut !== "", "empty", limit, cut);
        // One that fits is as it was written, spaces apart.
        must(words(norm) > max || cut === norm, "a caption that fits was changed", limit, cut);
        // The start of what was written: no word added or changed, and none cut in half. Only a comma, semicolon,
        // colon or a dash on its own may be missing from the end, and one ellipsis may be added.
        const core = written(norm, cut);
        must(norm.startsWith(core), "not the start of what was written", limit, cut);
        must(/^(?:\s*[,;:]+|\s+[–—-]+(?=\s|$))*(?:\s|$)/.test(norm.slice(core.length)), "a word was cut in half", limit, cut);
        must(!/……|\.\.\.…/.test(cut), "two ellipses", limit, cut);
        // Nothing left hanging at the end of a cut, when the caption starts with a real word.
        must(!(words(norm) > max && /[\p{L}\p{N}]/u.test(norm.split(" ")[0]!) && /[\s,;:]$/.test(core)), "a mark left hanging", limit, cut);
        // Cutting it again changes nothing.
        must(fitCaption(cut, max) === cut, "changed when cut again", limit, cut);
        checked++;
      }
      // The pick's cut at 15, then a gallery's at 10: still the start of what was first written.
      const twice = fitCaption(fitCaption(caption, 15), 10);
      must(words(twice) <= 10 && twice !== "" && norm.startsWith(written(norm, twice)) && !/……|\.\.\.…/.test(twice), "cut at 15 and then at 10", "limit 10", twice);
    }
    expect(broken).toEqual([]);
    expect(checked).toBe(140_000);
  });
});

test.describe("The server holds the layout line", () => {
  test("only a layout the person's editor offers, or the one already stored, may be saved or published", () => {
    expect(OFFERED_FORMATS).toEqual(["case-study", "gallery", "research"]);
    const classic = offeredIn("classic");
    expect(classic).toEqual(["case-study", "gallery", "research"]);
    expect(classic).toBe(CLASSIC_FORMATS);
    for (const f of ["build", "essay", "before-after", "event"] as const) {
      // The classic editor can't edit these, so a person whose editor it is may not store one...
      expect(mayCarryFormat(f, "case-study", classic)).toBe(false);
      expect(mayCarryFormat(f, "gallery", classic)).toBe(false);
      // ...unless the exhbt is already stored as that layout (made in the new editor): it keeps working.
      expect(mayCarryFormat(f, f, classic)).toBe(true);
    }
    expect(mayCarryFormat("gallery", "case-study", classic)).toBe(true);
    expect(mayCarryFormat("case-study", "essay", classic)).toBe(true);
  });
});

test.describe("Findings go after the flowchart's marker", () => {
  const items = [text("Waits fell from 11 to 4 minutes.")];
  test("with a marker: straight after it. Without one: first, as before", () => {
    const arranged: ExhbtDoc = { ...emptyDoc(), sections: [flowMarker, graph("graph-1", chartA)] };
    expect(applyBlock(arranged, "findings", items).sections.map((s) => s.kind)).toEqual(["flow", "findings", "graph"]);
    const plain: ExhbtDoc = { ...emptyDoc(), sections: [graph("graph-1", chartA)] };
    expect(applyBlock(plain, "findings", items).sections.map((s) => s.kind)).toEqual(["findings", "graph"]);
    // A marker the person moved down stays where it is: the findings follow it.
    const moved: ExhbtDoc = { ...emptyDoc(), sections: [graph("graph-1", chartA), flowMarker] };
    expect(applyBlock(moved, "findings", items).sections.map((s) => s.kind)).toEqual(["graph", "flow", "findings"]);
  });
});

test.describe("Graphs the draft drew, and the alt text's numbers", () => {
  test("the AI version keeps the graphs the draft drew, and reads them back", () => {
    const doc: ExhbtDoc = { ...emptyDoc(), sections: [graph("graph-1", chartA), graph("graph-2", chartB)] };
    const ai = aiVersionOf(doc, "source text");
    expect(ai.drafted).toEqual([chartA, chartB]);
    const back = readAiVersion(JSON.stringify(ai));
    expect(back.drafted).toEqual([chartA, chartB]);
    // An AI version kept before this has none: nothing then counts as drawn by the draft.
    expect(readAiVersion(JSON.stringify({ blocks: {}, unverified: {} })).drafted).toBeUndefined();
  });

  test("a number in a picked figure's alt text is flagged when it isn't in the material, and found at its field", () => {
    const doc: ExhbtDoc = {
      ...emptyDoc(),
      sections: [{ id: "image-1", kind: "image", fileId: "f1", alt: "A line chart: recall falls from about 200 to about 61", caption: [] }],
    };
    expect(unverifiedNumbers(doc, "Recall was measured out of 40 words.")).toEqual(["200", "61"]);
    expect(unverifiedNumbers(doc, "Scores went from 200 to 61.")).toEqual([]);
    expect(pathOfNumber(doc, "61")).toBe("sections.0.alt");
  });

  test("keepGraphs places the figure and removes nothing, even for a picked graph", () => {
    const doc: ExhbtDoc = { ...emptyDoc(), sections: [{ id: "findings", kind: "findings", items: [text("One"), text("Two")] }, graph("graph-1", chartA)] };
    const visual = { fileId: "f1", kind: "graph" as const, alt: "A chart", caption: "", picked: { from: "r.pdf", page: 2, shareOk: false } };
    expect(withWorkVisual(doc, visual).doc.sections.map((s) => s.kind)).toEqual(["findings", "image"]);
    const kept = withWorkVisual(doc, visual, { keepGraphs: true });
    expect(kept.removed).toEqual([]);
    expect(kept.doc.sections.map((s) => s.kind)).toEqual(["findings", "image", "graph"]);
  });
});

/* ---------------- The figure route ---------------- */

const seedFigureExhbt = async (page: Page, drafted: Chart[], opts: { extra?: string[] } = {}) => {
  const username = unique("figroute");
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    title: "Does a later reminder cut missed appointments?",
    context: "Final-year project",
    skills: [],
    gap: [{ t: "Missed appointments cost the practice time." }],
    flow: [{ step: "Collected the figures" }, { step: "Changed the reminder time" }, { step: "Compared the two" }],
    sections: [{ id: "findings", kind: "findings", items: [[{ t: "Missed appointments fell." }], [{ t: "Two practices took part." }]] }, graph("graph-1", chartA), graph("graph-2", chartB)],
  };
  const res = await page.request.post("/dev/parity", {
    data: { username, slug: "reminders", doc, extraFiles: opts.extra ?? ["fig-a", "fig-b"], aiVersion: { blocks: {}, unverified: {}, drafted } },
  });
  expect(res.status(), await res.text()).toBe(200);
  const seeded = (await res.json()) as { id: string; files: Record<string, string> };
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  return seeded;
};
type Stored = { working: { sections: Section[]; unverified?: string[] }; aiVersion: { graphs?: Chart[] } };
const stored = async (page: Page, id: string) => (await (await page.request.get(`/dev/parity?id=${id}`)).json()) as Stored;
const kinds = (s: Stored) => s.working.sections.map((x) => x.kind);
const place = (page: Page, id: string, data: Record<string, unknown>) =>
  page.request.post(`/api/exhbts/${id}/figure`, { data: { alt: "A chart", caption: "", picked: { from: "report.pdf", page: 2 }, ...data } });

test.describe("The figure route is safe to call at any time", () => {
  test("a fresh draft: the graphs the draft drew are taken off and kept with the AI version", async ({ page }) => {
    const { id, files } = await seedFigureExhbt(page, [chartA, chartB]);
    expect((await place(page, id, { fileId: files["fig-a"], kind: "graph" })).status()).toBe(204);
    const after = await stored(page, id);
    expect(kinds(after)).toEqual(["findings", "image"]);
    expect(after.aiVersion.graphs).toEqual([chartA, chartB]);
  });

  test("an edited exhbt: a graph the person made is never taken off, and the figure goes beside it", async ({ page }) => {
    // Graph 2 is not one the draft drew (the person typed it, or changed it).
    const { id, files } = await seedFigureExhbt(page, [chartA]);
    expect((await place(page, id, { fileId: files["fig-a"], kind: "graph" })).status()).toBe(204);
    const after = await stored(page, id);
    expect(kinds(after).sort()).toEqual(["findings", "graph", "graph", "image"]);
    expect(after.aiVersion.graphs).toBeUndefined();
    // An exhbt whose AI version never recorded the draft's graphs counts as edited too.
    const bare = await seedFigureExhbt(page, []);
    expect((await place(page, bare.id, { fileId: bare.files["fig-a"], kind: "table" })).status()).toBe(204);
    expect(kinds(await stored(page, bare.id)).filter((k) => k === "graph")).toHaveLength(2);
  });

  test("never two picked figures: the second is refused unless the request says it replaces the first", async ({ page }) => {
    const { id, files } = await seedFigureExhbt(page, [chartA, chartB]);
    expect((await place(page, id, { fileId: files["fig-a"], kind: "other" })).status()).toBe(204);
    // The same picture again is left alone; another is refused.
    expect((await place(page, id, { fileId: files["fig-a"], kind: "other" })).status()).toBe(204);
    expect((await place(page, id, { fileId: files["fig-b"], kind: "graph" })).status()).toBe(409);
    let now = await stored(page, id);
    expect(now.working.sections.filter((s) => s.kind === "image")).toHaveLength(1);
    expect(kinds(now).filter((k) => k === "graph")).toHaveLength(2);
    // Replaces: the old one goes, the new one is the only picked figure, and no graph is taken off.
    expect((await place(page, id, { fileId: files["fig-b"], kind: "graph", replaces: true })).status()).toBe(204);
    now = await stored(page, id);
    const images = now.working.sections.filter((s) => s.kind === "image");
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ fileId: files["fig-b"], picked: { shareOk: false } });
    expect(kinds(now).filter((k) => k === "graph")).toHaveLength(2);
  });

  test("a new figure's caption is cut to the layout's limit; a caption already on the exhbt is left as it is", async ({ page }) => {
    // A gallery, where a caption has ten words, holding the person's own picture with a caption already over that.
    const own = "My own caption, typed before the limit came down, which runs past ten words and is mine to shorten";
    const username = unique("figcaption");
    const doc = {
      schemaVersion: SCHEMA_VERSION,
      format: "gallery",
      title: "Posters for the students' union shows",
      context: "Society project",
      skills: [],
      gap: [{ t: "The shows had no shared look." }],
      flow: [{ step: "Sketched" }, { step: "Printed" }, { step: "Put up" }],
      sections: [
        { id: "findings", kind: "findings", items: [[{ t: "Three shows sold out." }]] },
        { id: "image-1", kind: "image", fileId: "seeded", alt: "The poster wall", caption: [{ t: own }] },
      ],
    };
    const res = await page.request.post("/dev/parity", { data: { username, slug: "posters", doc, extraFiles: ["fig-a"] } });
    expect(res.status(), await res.text()).toBe(200);
    const { id, files } = (await res.json()) as { id: string; files: Record<string, string> };
    await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
    const placed = await place(page, id, {
      fileId: files["fig-a"],
      kind: "other",
      caption: "Sales for 2019, 2020 and 2021 across all four regions of the north of England and Wales",
    });
    expect(placed.status()).toBe(204);
    const images = (await stored(page, id)).working.sections.flatMap((s) => (s.kind === "image" ? [s] : []));
    expect(images).toHaveLength(2);
    const captionOf = (fileId: string) => images.find((s) => s.fileId === fileId)!.caption.map((r) => r.t).join("");
    // The new one: cut at the gallery's ten words, not back to "Sales for 2019", and shown as shortened.
    expect(captionOf(files["fig-a"]!)).toBe("Sales for 2019, 2020 and 2021 across all four regions…");
    // The person's own, already stored: not a word of it touched.
    expect(captionOf(files["image-1"]!)).toBe(own);
  });

  test("numbers in the alt text are flagged for the person to confirm, as the caption's are", async ({ page }) => {
    const { id, files } = await seedFigureExhbt(page, [chartA, chartB]);
    const placed = await place(page, id, {
      fileId: files["fig-a"],
      kind: "other",
      alt: "A line chart: recall falls from about 200 to about 61",
      caption: "Recall fell over the term",
    });
    expect(placed.status()).toBe(204);
    expect((await stored(page, id)).working.unverified).toEqual(expect.arrayContaining(["200", "61"]));
  });
});

// The stand-in reads the file's name (lib/ai/figure-pick.ts): "pick-fails" fails as a call the service never
// answered does, "pick-unusable" as one it answered with nothing usable, and "pick-slow" takes two seconds.
test.describe("A pick is counted before the AI call, and given back when the service never answered", () => {
  const ask = (page: Page, name: string) =>
    page.request.post("/api/exhbts/figure-pick", {
      multipart: { label: name, image: { name: "image-1.png", mimeType: "image/png", buffer: PNG } },
    });
  /** A new person on the free plan, which has one draft and two spare picks: three picks. */
  const signIn = (page: Page, tag: string) => page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(tag))}&next=/exhbts/new`);

  test("a call that failed before the service answered is given back", async ({ page }) => {
    await signIn(page, "pickfail");
    // Each is counted before its call and given back after it. Had they stayed counted, the fourth would have been refused.
    for (let i = 0; i < 5; i++) expect((await ask(page, "report-pick-fails.pdf, page 3")).status()).toBe(502);
    const ok = await ask(page, "report-with-chart.pdf, page 3");
    expect(ok.status()).toBe(200);
    expect(((await ok.json()) as { pick: { alt: string } }).pick.alt).toContain("report-with-chart.pdf, page 3");
    // Successes are counted: this was the first of three.
    expect((await ask(page, "x")).status()).toBe(200);
    expect((await ask(page, "x")).status()).toBe(200);
    expect((await ask(page, "x")).status()).toBe(429);
    // At the limit nothing is called, so there is nothing to give back: a request that would have failed is refused too.
    expect((await ask(page, "report-pick-fails.pdf, page 3")).status()).toBe(429);
  });

  test("a call the service answered with nothing usable stays counted", async ({ page }) => {
    await signIn(page, "pickunusable");
    for (let i = 0; i < 3; i++) expect((await ask(page, "report-pick-unusable.pdf, page 3")).status()).toBe(502);
    // Three calls were made and paid for, so the three picks are spent.
    expect((await ask(page, "report-with-chart.pdf, page 3")).status()).toBe(429);
  });

  test("requests that overlap can't all pass the check: the limit holds", async ({ page }) => {
    await signIn(page, "pickoverlap");
    // The dev server builds the route on its first request. This one is refused before anything is counted.
    expect((await page.request.post("/api/exhbts/figure-pick", { multipart: { label: "report-pick-slow.pdf, page 3" } })).status()).toBe(400);
    // Eight requests a tenth of a second apart, against a stand-in that takes two seconds to answer, so the last is
    // sent while the first is still being answered. Counted after the call, as picks were, all eight passed the check.
    const sent: number[] = [];
    const calls: Promise<{ status: number; back: number }>[] = [];
    for (let i = 0; i < 8; i++) {
      sent.push(Date.now());
      calls.push(ask(page, "report-pick-slow.pdf, page 3").then((res) => ({ status: res.status(), back: Date.now() })));
      await page.waitForTimeout(100);
    }
    const answers = await Promise.all(calls);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 200, 200, 429, 429, 429, 429, 429]);
    // They did overlap: the last was sent before the first of the three came back.
    const firstBack = Math.min(...answers.filter((a) => a.status === 200).map((a) => a.back));
    expect(Math.max(...sent)).toBeLessThan(firstBack);
    // The three stay counted once they are answered, and a refusal gives nothing back.
    expect((await ask(page, "report-with-chart.pdf, page 3")).status()).toBe(429);
  });
});

/* ---------------- The server actions ---------------- */

// Each test runs in both editors: the edit-on-page editor, which this suite's server serves (EXHBT_EDITOR in
// playwright.config.ts), and the classic editor, which is what everyone gets until the new one is switched on
// (DEFAULT_EDITOR in lib/editor-kind.ts). e2e/editor.ts drives the new editor and e2e/editor-classic-helpers.ts the
// classic one, whose signInAs keeps the browser on it.
//
// What is refused depends on the person's editor (layoutAllowed in app/(app)/exhbts/[id]/actions.ts). A layout name
// this code doesn't know is refused for everyone. One of the four of decision 0028 is refused for a person whose
// editor is the classic one, which can't edit them, unless the exhbt already has that layout (that case, and the
// classic editor's picker, are in e2e/layouts-new.spec.ts).
test.describe("A hand-built save or publish can't store a layout nothing offers", () => {
  const REFUSED = "That layout isn't available yet. Choose another layout and try again.";
  /** A layout name no editor offers. In a stored doc it would read as a case study; asked for by a save or a publish, it is refused. */
  const UNKNOWN = "zine";
  /** Rewrites the body of the next server action that carries an exhbt doc so its layout is `format`. */
  async function forceFormat(page: Page, format: string) {
    const seen = { rewritten: 0 };
    await page.route("**/exhbts/*/edit", async (route) => {
      const req = route.request();
      const body = req.postData();
      if (req.method() !== "POST" || !body || !req.headers()["next-action"]) return route.continue();
      try {
        const args = JSON.parse(body) as unknown[];
        const doc = args.find((a) => typeof a === "object" && a !== null && "schemaVersion" in a) as Record<string, unknown> | undefined;
        if (!doc) return route.continue();
        doc.format = format;
        seen.rewritten++;
        return route.continue({ postData: JSON.stringify(args) });
      } catch {
        return route.continue();
      }
    });
    return seen;
  }
  const storedFormat = async (page: Page, id: string) => ((await (await page.request.get(`/dev/parity?id=${id}`)).json()) as { working: { format?: string } }).working.format;

  /**
   * Records what the page's live regions say from now on (role status or alert, or aria-live): each region's words,
   * every time they change. A region drawn with its words already in it counts as said too.
   */
  async function listen(page: Page) {
    await page.evaluate(() => {
      const LIVE = '[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]';
      const said: string[] = [];
      const last = new WeakMap<Element, string>();
      const wordsOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
      for (const region of document.querySelectorAll(LIVE)) last.set(region, wordsOf(region));
      new MutationObserver(() => {
        for (const region of document.querySelectorAll(LIVE)) {
          const words = wordsOf(region);
          if (words === (last.get(region) ?? "")) continue;
          last.set(region, words);
          if (words) said.push(words);
        }
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
      (window as unknown as { __said: string[] }).__said = said;
    });
  }
  /** Everything said since `listen` that holds `words`. */
  const said = (page: Page, words: string) => page.evaluate((w) => (window as unknown as { __said: string[] }).__said.filter((s) => s.includes(w)), words);

  test.describe("in the new editor", () => {
    test("saving a layout nothing offers is refused and nothing is stored; the same request as a gallery is kept", async ({ page }) => {
      await signInAs(page, unique("layoutsave"), "premium");
      const id = await startFromScratch(page);
      await expect(page.locator('[data-editor="page"]')).toBeAttached();
      await listen(page);
      const seen = await forceFormat(page, UNKNOWN);
      await page.locator("#title").fill("A title that triggers a save");
      // The reason is drawn in the top bar, beside "Not saved. Retry". It is found by its own class, because the bar's
      // hidden live region holds the same words: that is where they are said, once.
      const bar = page.locator(`${READY} [data-topbar]`);
      await expect(bar.locator(".xe-save-words")).toHaveText(`Kept in this browser. ${REFUSED}`, { timeout: 15_000 });
      await expect(bar.locator(".xe-save-words")).toBeVisible();
      await expect(bar.getByRole("button", { name: "Not saved. Retry" })).toBeVisible();
      await expect.poll(() => said(page, REFUSED)).toEqual([`Not saved. Kept in this browser. ${REFUSED}`]);
      expect(seen.rewritten).toBeGreaterThan(0);
      expect(await storedFormat(page, id)).toBeUndefined();
      // An offered layout goes through the same path.
      await page.unroute("**/exhbts/*/edit");
      await forceFormat(page, "gallery");
      await page.locator("#title").fill("A second title");
      await waitForSaved(page);
      expect(await storedFormat(page, id)).toBe("gallery");
      // The refusal was said the once, and not again by the save that worked.
      expect(await said(page, REFUSED)).toEqual([`Not saved. Kept in this browser. ${REFUSED}`]);
    });

    test("publishing a layout nothing offers is refused, and the reason is shown where Publish was pressed", async ({ page }) => {
      await signInAs(page, unique("layoutpub"), "premium");
      const id = await startFromScratch(page);
      await expect(page.locator('[data-editor="page"]')).toBeAttached();
      await fillValid(page, "A page that could go live");
      await waitForSaved(page);
      await forceFormat(page, UNKNOWN);
      // The tick and Publish are in the "Review and publish" sheet.
      await openPublishSheet(page);
      const sheet = publishSheet(page);
      await listen(page);
      await sheet.getByLabel("This is my work, and the numbers are true").check();
      const publish = sheet.getByRole("button", { name: "Publish", exact: true });
      await publish.click();
      await expect(page.getByText("That layout isn't available yet.")).toBeVisible({ timeout: 15_000 });
      // The whole reason, in the sheet, under the button that was pressed and on screen with it; said once, by the sheet's own status region.
      const reason = sheet.getByRole("status").getByText(REFUSED, { exact: true });
      await expect(reason).toBeVisible();
      await expect(reason).toBeInViewport({ ratio: 1 });
      await expect(publish).toBeInViewport({ ratio: 1 });
      expect((await reason.boundingBox())!.y).toBeGreaterThan((await publish.boundingBox())!.y);
      expect(await said(page, REFUSED)).toEqual([REFUSED]);
      expect(await storedFormat(page, id)).toBeUndefined();
      // Nothing went live, and the save status was not touched: the words are in the sheet and nowhere else.
      await expect(sheet.getByText("It's live.")).toHaveCount(0);
      await expect(page.locator(`${READY} [data-topbar] .xe-save`)).toHaveText("Saved");
      expect(await said(page, REFUSED)).toEqual([REFUSED]);
    });
  });

  // A person whose editor is the classic one: the four layouts it can't edit are refused by hand too.
  test.describe("in the classic editor", () => {
    test("saving an essay layout is refused and nothing is stored; the same request as a gallery is kept", async ({ page }) => {
      await classicEditor.signInAs(page, unique("layoutsave"), "premium");
      const id = await classicEditor.startFromScratch(page);
      await expect(page.locator('[data-editor="classic"]')).toBeAttached();
      const seen = await forceFormat(page, "essay");
      await page.locator("#title").fill("A title that triggers a save");
      await expect(page.getByText("That layout isn't available yet.")).toBeVisible({ timeout: 15_000 });
      expect(seen.rewritten).toBeGreaterThan(0);
      expect(await storedFormat(page, id)).toBeUndefined();
      // An offered layout goes through the same path.
      await page.unroute("**/exhbts/*/edit");
      await forceFormat(page, "gallery");
      await page.locator("#title").fill("A second title");
      await classicEditor.waitForSaved(page);
      expect(await storedFormat(page, id)).toBe("gallery");
    });

    test("saving a layout nothing offers is refused there too", async ({ page }) => {
      await classicEditor.signInAs(page, unique("layoutzine"), "premium");
      const id = await classicEditor.startFromScratch(page);
      await expect(page.locator('[data-editor="classic"]')).toBeAttached();
      const seen = await forceFormat(page, UNKNOWN);
      await page.locator("#title").fill("A title that triggers a save");
      await expect(page.getByText("That layout isn't available yet.")).toBeVisible({ timeout: 15_000 });
      expect(seen.rewritten).toBeGreaterThan(0);
      expect(await storedFormat(page, id)).toBeUndefined();
    });

    test("publishing a build layout is refused", async ({ page }) => {
      await classicEditor.signInAs(page, unique("layoutpub"), "premium");
      const id = await classicEditor.startFromScratch(page);
      await expect(page.locator('[data-editor="classic"]')).toBeAttached();
      await classicEditor.fillValid(page, "A page that could go live");
      await classicEditor.waitForSaved(page);
      await forceFormat(page, "build");
      await page.getByLabel("This is my work, and the numbers are true").check();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(page.getByText("That layout isn't available yet.")).toBeVisible({ timeout: 15_000 });
      expect(await storedFormat(page, id)).toBeUndefined();
    });
  });
});
