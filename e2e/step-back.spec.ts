import { expect, test } from "@playwright/test";
import { ExhbtDocSchema, normaliseDoc, publicDoc, richOf, SCHEMA_VERSION, text, validateForPublish, wordCount, type ContentSection, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import type { Format } from "../lib/exhbt/formats";
import { pageItems, removeItem } from "../lib/exhbt/layouts";
import { beforeAfterDoc, buildDoc, essayDoc, eventDoc, fullDoc, galleryDoc, libraryDoc, openBankingDoc, researchDoc, sampleDocs } from "../lib/exhbt/sample";
import { old, oldLayouts } from "./fixtures/reader-before-0032";

/*
 * A step back from decision 0032 (docs/decisions/0032-write-it-your-way.md, "A step back"). No page: the
 * build that was live before 0032 is frozen in e2e/fixtures/reader-before-0032 (lib/exhbt as on origin/main
 * at d277be7), and each test hands it a doc as this code saves or publishes it and reads what it makes of it.
 *
 * What a store on that build does (decision 0015): every read runs normaliseDoc, which keeps keys it does not
 * know; every save from a page runs ExhbtDocSchema, which keeps only the keys it knows. So formatting kept
 * beside a plain string and a title of the person's own are invisible to it and gone after its next save,
 * and the words are never lost, because the plain string was never moved.
 */

/** What reaches the database, and comes back: JSON. */
const stored = <T>(doc: T): T => JSON.parse(JSON.stringify(doc)) as T;
/** The old build's read of a stored doc (lib/store.ts runs normaliseDoc on every read). */
const oldRead = (doc: unknown): old.ExhbtDoc => old.normaliseDoc(stored(doc));
/** The old build's save: what its saveDraft keeps of a doc a page sends it. */
const oldSave = (doc: unknown): old.ExhbtDoc => old.ExhbtDocSchema.parse(stored(doc));

const FLOW = { id: "flow", kind: "flow" } as const;
const quote = (extra: Partial<Extract<ContentSection, { kind: "quote" }>> = {}): ContentSection => ({ id: "quote-1", kind: "quote", text: "Lunch is calmer now, and quicker.", name: "Priya Shah", role: "Manager", ...extra });
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

/** An essay with everything 0032 adds: formatting in the quote, the pull quote and a source's line; a title on each part that takes one. */
const formatted = (): ExhbtDoc => {
  const d = essayDoc();
  return {
    ...d,
    flowTitle: "How I argued it",
    refsTitle: "What I read",
    sections: d.sections.flatMap((s): Section[] => {
      if (s.kind === "findings") return [{ ...s, title: "The case in three points" }];
      if (s.kind === "pullquote") return [{ ...s, textRuns: [{ t: "A reform meant to close a door became " }, { t: "the first step through it", b: true }, { t: "." }] }];
      if (s.kind === "reflection") return [{ ...s, title: "" }, quote({ title: "What my tutor said", textRuns: [{ t: "Lunch is " }, { t: "calmer", i: true }, { t: " now, and quicker." }] })];
      if (s.kind === "link" && s.id === "link-2") return [{ ...s, descriptionRuns: [{ t: "Chapter four, on " }, { t: "the electorate", b: true }] }];
      return [s];
    }),
  };
};

const sectionOf = <K extends ContentSection["kind"]>(d: { sections: readonly { kind: string }[] }, kind: K) => d.sections.find((s) => s.kind === kind) as Extract<ContentSection, { kind: K }>;

test.describe("A step back from 0032: the build before it reads what this one writes", () => {
  test("this build keeps the formatting and the titles when it saves", () => {
    const saved = stored(ExhbtDocSchema.parse(formatted()));
    expect(sectionOf(saved, "pullquote").textRuns).toHaveLength(3);
    expect(sectionOf(saved, "quote").textRuns).toHaveLength(3);
    expect(saved.sections.find((s) => s.id === "link-2")).toMatchObject({ descriptionRuns: [{ t: "Chapter four, on " }, { t: "the electorate", b: true }] });
    expect([saved.flowTitle, saved.refsTitle, sectionOf(saved, "findings").title, sectionOf(saved, "quote").title, sectionOf(saved, "reflection").title]).toEqual(["How I argued it", "What I read", "The case in three points", "What my tutor said", ""]);
    // The plain words are where they always were: the runs are beside them, never in their place.
    expect(sectionOf(saved, "quote").text).toBe("Lunch is calmer now, and quicker.");
    expect(sectionOf(saved, "pullquote").text).toBe("A reform meant to close a door became the first step through it.");
  });

  test("the old build reads it: every word is there as a plain string, it counts the same words, and it would publish it", () => {
    const now = ExhbtDocSchema.parse(formatted());
    const read = oldRead(now);
    expect(old.ExhbtDocSchema.safeParse(read).success).toBe(true);
    // What its page draws: the plain strings it has always drawn.
    expect(sectionOf(read, "quote").text).toBe("Lunch is calmer now, and quicker.");
    expect(sectionOf(read, "pullquote").text).toBe("A reform meant to close a door became the first step through it.");
    expect((read.sections.find((s) => s.id === "link-2") as { description: string }).description).toBe("Chapter four, on the electorate");
    expect(typeof sectionOf(read, "quote").text).toBe("string");
    // The same words, counted the same way, and nothing it calls unreadable or unfinished.
    expect(old.wordCount(read)).toBe(wordCount(now));
    expect(old.validateForPublish(read)).toEqual([]);
    expect(validateForPublish(now)).toEqual([]);
  });

  test("its next save drops what it does not know, and this build then reads the plain words back", () => {
    const afterOldSave = oldSave(oldRead(ExhbtDocSchema.parse(formatted())));
    expect(JSON.stringify(afterOldSave)).not.toMatch(/textRuns|descriptionRuns|flowTitle|refsTitle/);
    expect(afterOldSave.sections.some((s) => "title" in s)).toBe(false);
    // Forward again: nothing is formatted, every heading is the layout's own, and no word is missing.
    const back = ExhbtDocSchema.parse(stored(afterOldSave));
    const q = sectionOf(back, "quote");
    expect(richOf(q.text, q.textRuns)).toEqual(text("Lunch is calmer now, and quicker."));
    expect(wordCount(back)).toBe(wordCount(formatted()));
    expect(validateForPublish(back)).toEqual([]);
  });

  test("words changed where the formatting was not understood are never drawn in the old formatting", () => {
    // A writer that keeps unknown keys but changes only the string (the old build's figure route saves a doc it has
    // only normalised; a copy kept in a browser by the old editor holds the page's doc as it read it).
    const read = oldRead(ExhbtDocSchema.parse(formatted()));
    const changed = { ...read, sections: read.sections.map((s) => (s.kind === "quote" ? { ...s, text: "Lunch is quieter now." } : s)) };
    const stale = sectionOf(stored(changed) as unknown as ExhbtDoc, "quote");
    expect(stale.textRuns).toBeDefined();
    // Read as it stands: the string wins, because the runs no longer spell it.
    expect(richOf(stale.text, stale.textRuns)).toEqual(text("Lunch is quieter now."));
    // And the store's read (normaliseDoc) takes the stale runs away, so the next save is clean.
    const again = sectionOf(normaliseDoc(stored(changed)), "quote");
    expect(again.text).toBe("Lunch is quieter now.");
    expect("textRuns" in again).toBe(false);
    // Runs that add nothing (none formatted) are not kept either.
    const plainRuns = normaliseDoc(core([quote({ textRuns: text("Lunch is calmer now, and quicker.") })]));
    expect("textRuns" in sectionOf(plainRuns, "quote")).toBe(false);
  });

  test("a page published with parts left empty: the published copy holds only what is shown, so the old page draws no empty part", () => {
    const working = core(
      [
        FLOW,
        { id: "findings", kind: "findings", items: [text("Waits fell from 11 to 4 minutes."), [], text("Sales held.")] },
        quote({ name: "", role: "Manager" }),
        { id: "reflection-1", kind: "reflection", text: [] },
        { id: "link-1", kind: "link", href: "", label: "", description: "" },
        { id: "graph-1", kind: "graph", chart: { kind: "bar", title: "", rows: [{ label: "", value: 0 }, { label: "", value: 0 }] } },
      ],
      undefined,
      { skills: ["Excel", " "], flow: [{ step: "Timed it" }, { step: "" }, { step: "Timed it again" }] },
    );
    expect(validateForPublish(working)).toEqual([]);
    const read = oldRead(publicDoc(working));
    expect(old.ExhbtDocSchema.safeParse(read).success).toBe(true);
    // No section with nothing in it, no empty finding, no empty box, no empty skill; the role went with the missing name.
    expect(read.sections.map((s) => s.id)).toEqual(["flow", "findings", "quote-1"]);
    expect(sectionOf(read, "findings").items).toHaveLength(2);
    expect(read.flow.map((b) => b.step)).toEqual(["Timed it", "Timed it again"]);
    expect(read.skills).toEqual(["Excel"]);
    expect(sectionOf(read, "quote")).toMatchObject({ text: "Lunch is calmer now, and quicker.", name: "", role: "" });
    // The old page's items are the new page's.
    expect(oldLayouts.pageItems(read).map((it) => it.id)).toEqual(pageItems(publicDoc(working)).map((it) => it.id));
  });

  test("a flowchart taken off a case study or research: this build draws none; the old one, which always drew one there, draws it again", () => {
    for (const format of ["case-study", "research"] as const) {
      const working = removeItem(core([FLOW, { id: "findings", kind: "findings", items: [text("Waits fell."), text("Sales held.")] }], format), "flow");
      expect(working.flowOff).toBe(true);
      expect(working.flow).toHaveLength(3);
      expect(pageItems(working).map((it) => it.id)).toEqual(["findings"]);
      expect(pageItems(publicDoc(working)).map((it) => it.id)).toEqual(["findings"]);
      // On the old build the working copy has its flowchart back, first, with its boxes: nothing is lost, and Remove is off there.
      const oldWorking = oldLayouts.pageItems(oldRead(working));
      expect(oldWorking.map((it) => it.id)).toEqual(["flow", "findings"]);
      expect(oldWorking[0]).toMatchObject({ kind: "flow", steps: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }] });
      // The live copy went out with no boxes, so the old page draws an empty flowchart there until it is published again:
      // nothing in a case study, the bare "Method" label in research (0032 says so under "A step back").
      const oldLive = oldLayouts.pageItems(oldRead(publicDoc(working)));
      expect(oldLive[0]).toMatchObject({ kind: "flow", steps: [] });
    }
    // In a layout that already let the flowchart go, both builds draw none.
    const gallery = removeItem(core([FLOW, { id: "findings", kind: "findings", items: [text("Waits fell.")] }], "gallery"), "flow");
    expect(oldLayouts.pageItems(oldRead(publicDoc(gallery))).map((it) => it.id)).toEqual(["findings"]);
  });

  test("an exhbt nobody has formatted or titled is the same doc on both builds", () => {
    const samples: ExhbtDoc[] = [
      ...sampleDocs,
      libraryDoc,
      openBankingDoc,
      fullDoc,
      galleryDoc(["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"]),
      researchDoc("r1"),
      buildDoc(["b1", "b2", "b3"]),
      essayDoc("e1"),
      beforeAfterDoc(["a1", "a2", "a3", "a4"]),
      eventDoc(["v1", "v2", "v3", "v4"]),
    ];
    for (const d of samples) {
      const now = stored(ExhbtDocSchema.parse(d));
      expect(now).toEqual(stored(old.ExhbtDocSchema.parse(d)));
      expect(stored(publicDoc(d))).toEqual(stored(old.publicDoc(d as old.ExhbtDoc)));
      expect(wordCount(d)).toBe(old.wordCount(d as old.ExhbtDoc));
      expect(pageItems(d).map((it) => it.id)).toEqual(oldLayouts.pageItems(d as old.ExhbtDoc).map((it) => it.id));
    }
  });
});
