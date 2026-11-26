import { expect, test } from "@playwright/test";
import { toDoc, type Draft } from "../lib/ai/draft-answer";
import { findingsOf, plain, publicDoc, sectionsOf, text, wordCount, withHighlight, words, type RichText } from "../lib/exhbt/blocks";
import { EMPHASIS, emphasisRuns, unmarked } from "../lib/exhbt/emphasis";
import { saidIn } from "../lib/exhbt/references";
import { misquoted, numbersIn, unverifiedNumbers } from "../lib/exhbt/verify";
import { DRAFT_PROJECT, draftAndOpen, finding, findingsField, signInToDraft, startRewrite, waitEditor } from "./editor";
import * as classic from "./editor-classic-helpers";
import { freshName, READY, readStored, waitSaved } from "./page-editor";

/*
 * The AI marks what matters (decision 0029, "Emphasis inside the answer"; Rory, 25 Nov 2026): the draft and the rewrite
 * write **bold** and *italic* inline, and lib/exhbt/emphasis.ts turns the marks into runs in the formatted fields, within
 * its rules, and takes them out of every other field. The stand-in AI marks one word of its placeholder finding in bold,
 * its rewrite the rewrite's label, and with "stand-in: bad emphasis" in the notes it writes marks the rules refuse.
 */

const bolds = (rt: RichText) => rt.filter((r) => r.b).map((r) => r.t);
const italics = (rt: RichText) => rt.filter((r) => r.i).map((r) => r.t);
/** A phrase or a sentence without the quotes, brackets and punctuation round it. */
const bare = (x: string) => x.replace(/^[\s"'“”‘’([]+|[\s"'“”‘’)\].,;:!?]+$/gu, "").toLowerCase();

/** Material with an A* grade and a significance star, as students' material has. */
const SRC = "She got an A* in Maths. The effect was 0.42** for women. Missed appointments fell from 7.9% to 6.5%.";

test.describe("Emphasis: the rules", () => {
  test("a bold phrase and an italic one become runs; text with no marks is exactly as it was", () => {
    expect(emphasisRuns("Missed appointments fell **from 7.9% to 6.5%**.", SRC)).toEqual([{ t: "Missed appointments fell " }, { t: "from 7.9% to 6.5%", b: true }, { t: "." }]);
    expect(emphasisRuns("Read beside *The Wealth of Nations*, it holds.", SRC)).toEqual([{ t: "Read beside " }, { t: "The Wealth of Nations", i: true }, { t: ", it holds." }]);
    expect(emphasisRuns("Waits fell **by 7 minutes** in *week two*.", SRC)).toEqual([{ t: "Waits fell " }, { t: "by 7 minutes", b: true }, { t: " in " }, { t: "week two", i: true }, { t: "." }]);
    expect(emphasisRuns("Waits fell from 11 to 4 minutes.", SRC)).toEqual(text("Waits fell from 11 to 4 minutes."));
    expect(emphasisRuns("", SRC)).toEqual([]);
  });

  test("one bold phrase of at most six words and one italic of at most eight; never a whole sentence", () => {
    // A second bold phrase is past the limit: its marks go, its words stay.
    expect(emphasisRuns("Waits fell **by 7 minutes** and sales rose **by 3%**.", SRC)).toEqual([{ t: "Waits fell " }, { t: "by 7 minutes", b: true }, { t: " and sales rose by 3%." }]);
    expect(bolds(emphasisRuns(`It **${"w ".repeat(EMPHASIS.bold.words).trim()}** then.`, SRC))).toHaveLength(1);
    expect(emphasisRuns(`It **${"w ".repeat(EMPHASIS.bold.words + 1).trim()}** then.`, SRC)).toEqual(text(`It ${"w ".repeat(EMPHASIS.bold.words + 1).trim()} then.`));
    expect(italics(emphasisRuns(`See *${"w ".repeat(EMPHASIS.italic.words).trim()}* now.`, SRC))).toHaveLength(1);
    expect(emphasisRuns(`See *${"w ".repeat(EMPHASIS.italic.words + 1).trim()}* now.`, SRC)).toEqual(text(`See ${"w ".repeat(EMPHASIS.italic.words + 1).trim()} now.`));
    expect(emphasisRuns("Both *Hamlet* and *Macbeth* sold out.", SRC)).toEqual([{ t: "Both " }, { t: "Hamlet", i: true }, { t: " and Macbeth sold out." }]);
    // A whole sentence, with its full stop inside the marks or outside them, and in a field of two sentences.
    expect(emphasisRuns("**Sales held steady.**", SRC)).toEqual(text("Sales held steady."));
    expect(emphasisRuns("**Sales held steady**. Waits fell.", SRC)).toEqual(text("Sales held steady. Waits fell."));
    expect(emphasisRuns("Waits fell. *Sales held.*", SRC)).toEqual(text("Waits fell. Sales held."));
  });

  test("marks left open, nested or crossed are dropped and their words kept", () => {
    expect(emphasisRuns("Waits fell **from 11 to 4 minutes.", SRC)).toEqual(text("Waits fell from 11 to 4 minutes."));
    expect(emphasisRuns("Waits fell from 11 to 4 minutes**.", SRC)).toEqual(text("Waits fell from 11 to 4 minutes."));
    expect(emphasisRuns("**Waits *fell* a lot** today.", SRC)).toEqual(text("Waits fell a lot today."));
    expect(emphasisRuns("Waits **fell *a lot** today*.", SRC)).toEqual(text("Waits fell a lot today."));
    expect(emphasisRuns("***Waits*** fell a lot.", SRC)).toEqual(text("Waits fell a lot."));
  });

  test("an asterisk that is part of the words stays: inside a word, between spaces, or as the material has it", () => {
    expect(emphasisRuns("Computed 2 * 3 and x**2 here.", SRC)).toEqual(text("Computed 2 * 3 and x**2 here."));
    // An A* grade and a significance star are kept as written, because the material has them so ...
    expect(emphasisRuns("She got an A* in Maths and **fell by 7**.", SRC)).toEqual([{ t: "She got an A* in Maths and " }, { t: "fell by 7", b: true }, { t: "." }]);
    expect(emphasisRuns("The effect was 0.42** for women.", SRC)).toEqual(text("The effect was 0.42** for women."));
    // ... and where it doesn't, the star is a mark left open, and goes.
    expect(emphasisRuns("The effect was 0.31** for men.", SRC)).toEqual(text("The effect was 0.31 for men."));
  });

  test("a field that isn't formatted text gets the plain words", () => {
    expect(unmarked("Did **earlier** reminders cut *missed* appointments?", SRC)).toBe("Did earlier reminders cut missed appointments?");
    expect(unmarked("She got an A* in Maths", SRC)).toBe("She got an A* in Maths");
    expect(unmarked("No marks here.", SRC)).toBe("No marks here.");
  });

  test("random text: the words and the numbers never change, and the rules always hold", () => {
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
    const WORDS = ["Waits", "fell", "from", "11", "to", "4", "minutes", "sales", "rose", "by", "3%", "the", "A", "A*", "grade", "0.42", "0.42**", "£1,250", "and", "Hamlet", "staff", "said", "calmer", "x", "2"];
    const MARKS = ["", "", "", "", "*", "**", "***"];
    const ENDS = ["", "", "", ",", ".", ";", ":", "?", ")"];
    const broken: string[] = [];
    for (let seed = 1; seed <= 4000 && broken.length < 5; seed++) {
      const next = seeded(seed);
      const pick = <T,>(xs: T[]): T => xs[Math.floor(next() * xs.length)]!;
      const s = Array.from({ length: 1 + Math.floor(next() * 18) }, () => pick(MARKS) + pick(WORDS) + pick(MARKS) + pick(ENDS)).join(next() < 0.9 ? " " : " * ");
      const source = next() < 0.5 ? SRC : "Nothing here has a star.";
      const runs = emphasisRuns(s, source);
      const out = plain(runs);
      const must = (ok: boolean, rule: string) => {
        if (!ok) broken.push(`${rule} (seed ${seed}): ${JSON.stringify(s)} -> ${JSON.stringify(runs)}`);
      };
      // Only asterisks ever go: with every asterisk out of both, the text is the same, and so are its numbers.
      must(out.replace(/\*/g, "") === s.replace(/\*/g, ""), "the words changed");
      must(JSON.stringify(numbersIn(out)) === JSON.stringify(numbersIn(s)), "a number changed");
      // One bold phrase at most, of six words at most; one italic, of eight; never both on a run, never a whole sentence.
      const b = runs.filter((r) => r.b);
      const i = runs.filter((r) => r.i);
      must(b.length <= EMPHASIS.bold.max && b.every((r) => words(r.t) <= EMPHASIS.bold.words), "bold past the limit");
      must(i.length <= EMPHASIS.italic.max && i.every((r) => words(r.t) <= EMPHASIS.italic.words), "italic past the limit");
      must(runs.every((r) => !(r.b && r.i)), "bold and italic on one run");
      const sentences = out.split(/(?<=[.!?]["'”’)\]]?)\s+/u).map(bare);
      must([...b, ...i].every((r) => !sentences.includes(bare(r.t))), "a whole sentence marked");
      // Text with no asterisk comes back exactly as written; a plain field has the same words and no marks.
      if (!s.includes("*")) must(JSON.stringify(runs) === JSON.stringify(text(s)), "text with no marks changed");
      must(unmarked(s, source).replace(/\*/g, "") === s.replace(/\*/g, ""), "the plain words changed");
    }
    expect(broken).toEqual([]);
  });
});

/* ---------------- The draft's answer ---------------- */

const MATERIAL = [
  "Final-year project on GP appointment reminders at two practices. I cleaned 14,200 records.",
  "Missed appointments fell from 7.9% to 6.5% across all patients.",
  '"The new reminders made a real difference to our clinics." Priya Shah, Practice manager',
  "Notes in Markdown: the reminders were **sent at 3 hours** before the appointment.",
].join("\n");

/** An answer that marks every field, the right ones and the wrong ones. */
const answer = (over: Partial<Draft> = {}): Draft => ({
  format: "case-study",
  formatReason: "default",
  title: "Did **earlier** reminders cut missed appointments?",
  summary: "Missed appointments fell **from 7.9% to 6.5%**.",
  context: "Final-year *project*",
  whereWhen: "",
  skills: ["**Python**", "Regression"],
  gap: "Reminders went out a day before. **Nobody had tried 3 hours.**",
  gapHighlight: "**Nobody had tried 3 hours.**",
  flow: [
    { step: "**Cleaned** the records", detail: "*14,200* rows" },
    { step: "Fitted a model", detail: "" },
    { step: "Compared the rates", detail: "" },
  ],
  findings: ["Missed appointments fell **from 7.9% to 6.5%**.", "Read beside *the practice's own audit*, the drop held.", "**This one is a whole sentence.**"],
  charts: [{ kind: "bar", title: "**Missed** appointments", xTitle: "", yTitle: "", unit: "%", lowerIsBetter: true, series: [], rows: [{ label: "*Before*", values: [7.9] }, { label: "After", values: [6.5] }], cells: [] }],
  quote: { text: "The new reminders made a **real difference** to our clinics.", name: "Priya Shah", role: "Practice manager" },
  next: "Next I would run it for **a whole year**.",
  aim: "",
  aimIsHypothesis: false,
  conclusion: "",
  references: [],
  numbers: [],
  ...over,
});

test.describe("Emphasis in a drafted exhbt", () => {
  test("findings and what I'd do next keep their marks as runs; every other field gets the plain words", () => {
    const doc = toDoc(answer(), MATERIAL);
    expect(findingsOf(doc)).toEqual([
      [{ t: "Missed appointments fell " }, { t: "from 7.9% to 6.5%", b: true }, { t: "." }],
      [{ t: "Read beside " }, { t: "the practice's own audit", i: true }, { t: ", the drop held." }],
      text("This one is a whole sentence."),
    ]);
    expect(sectionsOf(doc, "reflection")[0]!.text).toEqual([{ t: "Next I would run it for " }, { t: "a whole year", b: true }, { t: "." }]);
    expect(doc.title).toBe("Did earlier reminders cut missed appointments?");
    expect(doc.summary).toBe("Missed appointments fell from 7.9% to 6.5%.");
    expect(doc.context).toBe("Final-year project");
    expect(doc.skills).toEqual(["Python", "Regression"]);
    expect(doc.flow).toEqual([{ step: "Cleaned the records", detail: "14,200 rows" }, { step: "Fitted a model" }, { step: "Compared the rates" }]);
    // The context line keeps its own meaning: its bold is the gap gapHighlight names, never the AI's marks.
    expect(doc.gap).toEqual(withHighlight("Reminders went out a day before. Nobody had tried 3 hours.", "Nobody had tried 3 hours."));
    const chart = sectionsOf(doc, "graph")[0]!.chart;
    expect(chart).toMatchObject({ kind: "bar", title: "Missed appointments", rows: [{ label: "Before", value: 7.9 }, { label: "After", value: 6.5 }] });
    // The quote is checked, and kept, as its plain words.
    expect(sectionsOf(doc, "quote")[0]).toMatchObject({ text: "The new reminders made a real difference to our clinics.", name: "Priya Shah", role: "Practice manager" });
    expect(JSON.stringify(doc)).not.toContain("*");
  });

  test("the marks never change what is said: the same words, the same count, the same numbers checked", () => {
    const strip = (v: unknown): unknown => (typeof v === "string" ? v.replace(/\*/g, "") : Array.isArray(v) ? v.map(strip) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, strip(x)])) : v);
    const marked = toDoc(answer(), MATERIAL);
    const unmarkedDoc = toDoc(strip(answer()) as Draft, MATERIAL);
    expect(wordCount(marked)).toBe(wordCount(unmarkedDoc));
    expect(findingsOf(marked).map(plain)).toEqual(findingsOf(unmarkedDoc).map(plain));
    expect(unverifiedNumbers(marked, MATERIAL)).toEqual([]);
    expect(unverifiedNumbers(marked, MATERIAL)).toEqual(unverifiedNumbers(unmarkedDoc, MATERIAL));
  });

  test("a quote is found in the material past its marks, and in Markdown material past the material's own", () => {
    expect(saidIn(MATERIAL, "the reminders were sent at 3 hours before the appointment")).toBe(true);
    expect(saidIn(MATERIAL, "the reminders were sent at 4 hours before the appointment")).toBe(false);
    // A number's source quote: a mark the AI added, or the material's own, never makes a true quote look made up.
    expect(misquoted([{ value: "**7.9%**", sourceQuote: "Missed appointments fell from **7.9%** to 6.5%" }], MATERIAL)).toEqual([]);
    expect(misquoted([{ value: "3", sourceQuote: "the reminders were **sent at 3 hours** before" }], MATERIAL)).toEqual([]);
    expect(misquoted([{ value: "3", sourceQuote: "the reminders were sent at 3 hours before" }], MATERIAL)).toEqual([]);
    // A quote that isn't there is still caught, and its number is given without marks.
    expect(misquoted([{ value: "**9%**", sourceQuote: "Missed appointments fell to **9%**" }], MATERIAL)).toEqual(["9%"]);
  });

  test("an essay's pull quote and a role are checked and kept as plain words", () => {
    const essayMaterial = `${MATERIAL}\nThis essay argues that a reform is only as strong as the next court that reads it.`;
    const essay = toDoc(answer({ format: "essay", findings: ["Courts read reforms **narrowly**."], pullquote: "A reform is only as strong as the **next court** that reads it." }), essayMaterial);
    expect(sectionsOf(essay, "pullquote")[0]?.text).toBe("A reform is only as strong as the next court that reads it.");
  });
});

/* ---------------- In the editors, on the page and in print ---------------- */

/** The stand-in's placeholder finding, as the draft stores it: one word in bold. */
const PLACEHOLDER = [{ t: "This finding is a " }, { t: "placeholder", b: true }, { t: "." }];

test.describe("A drafted finding shows its bold", () => {
  test("in the new editor, and the editor's own Bold button takes it off", async ({ page }) => {
    const id = await draftAndOpen(page, "emphnew");
    expect(findingsOf((await readStored(page, id)).working)[1]).toEqual(PLACEHOLDER);
    const f = finding(page, 2);
    await expect(f.locator("strong")).toHaveText("placeholder");
    // Double-click the bold word in the editor, as a person selects it, and press Bold. (A click just before would make
    // the double-click a triple one, which selects the whole finding.)
    await expect(f).toHaveAttribute("data-live", "true");
    const pm = f.locator(".ProseMirror");
    await pm.locator("strong").dblclick();
    await expect(pm).toBeFocused();
    const bold = f.getByRole("button", { name: "Bold" });
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await expect(f.locator("strong")).toHaveCount(0);
    await waitSaved(page, id);
    expect(findingsOf((await readStored(page, id)).working)[1]).toEqual(text("This finding is a placeholder."));
  });

  test("in the classic editor and its preview, and its Bold button takes it off", async ({ page }) => {
    const id = await classic.draftAndOpen(page, "emphclassic");
    expect(findingsOf((await readStored(page, id)).working)[1]).toEqual(PLACEHOLDER);
    const field = page.getByRole("textbox", { name: "Finding 2" });
    await expect(field.locator("strong")).toHaveText("placeholder");
    await expect(classic.previewArticle(page).locator('[data-part="findings"] li strong')).toHaveText("placeholder");
    await field.locator("strong").dblclick();
    const item = field.locator("xpath=ancestor::li[1]");
    await item.getByRole("button", { name: "Bold, on" }).click();
    await expect(item.getByRole("button", { name: "Bold", exact: true })).toBeVisible();
    await expect(field.locator("strong")).toHaveCount(0);
    await expect.poll(async () => findingsOf((await readStored(page, id)).working)[1]).toEqual(text("This finding is a placeholder."));
  });

  test("on the public page and in print, heavier than the words round it", async ({ page }) => {
    const id = await draftAndOpen(page, "emphpage");
    const working = (await readStored(page, id)).working;
    const res = await page.request.post("/dev/parity", { data: { username: freshName("emphpage"), slug: "drafted", doc: publicDoc(working), working } });
    expect(res.status(), await res.text()).toBe(200);
    await page.goto(((await res.json()) as { url: string }).url);
    const item = page.locator('article [data-part="findings"] li').nth(1);
    await expect(item.locator("strong")).toHaveText("placeholder");
    const weights = () => item.evaluate((li) => [Number(getComputedStyle(li.querySelector("strong")!).fontWeight), Number(getComputedStyle(li).fontWeight)]);
    const [onScreen, round] = await weights();
    expect(onScreen).toBeGreaterThan(round!);
    await page.emulateMedia({ media: "print" });
    const [inPrint, roundInPrint] = await weights();
    expect(inPrint).toBeGreaterThan(roundInPrint!);
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
  });

  test("marks the rules refuse come out as plain words", async ({ page }) => {
    await signInToDraft(page, "emphbad");
    const res = await page.request.post("/api/exhbts/draft", { data: { text: DRAFT_PROJECT, notes: "stand-in: bad emphasis" } });
    expect(res.status()).toBe(200);
    const { id } = (await res.json()) as { id: string };
    const doc = (await readStored(page, id)).working;
    // Marks in fields that take none, a mark left open, and a bold sentence with a pair inside it.
    expect(doc.title).toBe("Development preview: what would the AI draft from your files?");
    expect(doc.summary).toBe("A placeholder draft, made without an API key.");
    expect(doc.flow[0]!.step).toBe("Read the material");
    expect(findingsOf(doc)).toEqual([text("Final-year project on GP appointment reminders."), text("This finding is a placeholder.")]);
    expect(JSON.stringify(doc)).not.toContain("*");
    await page.goto(`/exhbts/${id}/edit`);
    await waitEditor(page);
    await expect(finding(page, 2)).toHaveText("This finding is a placeholder.");
    await expect(page.locator(`${READY} [data-kind="findings"]`).locator("strong, em")).toHaveCount(0);
  });

  test("a rewrite of the findings marks its bold too", async ({ page }) => {
    await draftAndOpen(page, "emphrewrite");
    await startRewrite(page, "findings");
    await page.getByRole("button", { name: "Rewrite the findings now" }).click();
    // The stand-in rewrite marks its label, as the model may mark a key result.
    await expect(findingsField(page).locator("strong")).toHaveText("Preview rewrite 1");
  });
});
