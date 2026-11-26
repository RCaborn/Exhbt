import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { draftIssues, markLayout, needsThePerson } from "../evals/exhbt-draft/marks";
import { DraftSchema, DraftSchemaSeven, leftOff, repairDraft, toDoc, type Draft } from "../lib/ai/draft-answer";
import { DRAFT_TARGETS } from "../lib/ai/draft-targets";
import { formatLimits, LIMITS, suggestionsFor, validateForPublish, wordCount, words, type ExhbtDoc } from "../lib/exhbt/blocks";
import { checkedReason, CLASSIC_REASONS, isLayoutReason, LAYOUT_REASONS, layoutSentence } from "../lib/exhbt/drafted";
import { CLASSIC_FORMATS, FORMAT_RULES, FORMATS, formatOf, type Format } from "../lib/exhbt/formats";
import { blockOptions } from "../lib/exhbt/layouts";
import { pullquoteFrom, unsupportedParts } from "../lib/exhbt/references";
import { beforeAfterDoc, buildDoc, essayDoc, eventDoc, openBankingDoc } from "../lib/exhbt/sample";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { addSection, framesOf, layoutGroup, openAddSectionMenu, openLayoutMenu, pressTool, previewArticle, signInAs, waitEditor } from "./editor";
import * as classicEditor from "./editor-classic-helpers";
import { docNow, frame, freshName, openDoc, READY, readStored, sampleDoc, waitSaved } from "./page-editor";

/*
 * The four layouts of decision 0028 (brief D): a fictional sample for each, near the 200-word cap
 * and as full as a real one, seeded by /dev/portfolio?with=layouts&plan=max&count=0. Each is
 * checked as a doc (publishable, within the cap), drawn in its usual order, printed on one A4
 * page in every look, axe-clean in every look, and without sideways scroll at 390px.
 *
 * Then release 4 (brief M), which offers them:
 *  - the AI draft's answer for seven layouts, read purely: its size against the API's limit, its repair,
 *    and that only what the person supplied reaches a doc (a pull quote, a source, a role, a link);
 *  - the line the editor says after a draft, for each new layout;
 *  - the draft eval's fixtures and marks (the eval itself is run by hand, with the owner's say-so);
 *  - with the stand-in AI: a draft of each new layout, by name and by cue, and what it makes up left off;
 *  - the layout menu's seven, and each new layout in the editor: its rows, its "+" and what it needs to publish;
 *  - the classic editor, which never offers the four and keeps an exhbt that is one.
 */

/** The four layouts of decision 0028. */
const NEW_FOUR = ["build", "essay", "before-after", "event"] as const satisfies readonly Format[];

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const ids = ["a", "b", "c", "d", "e", "f"];

type Sample = { format: string; slug: string; doc: ExhbtDoc; parts: string[] };
const SAMPLES: Sample[] = [
  { format: "build", slug: "shift-swap", doc: buildDoc(ids), parts: ["lead", "did", "findings", "graph", "image", "quote", "reflection", "link"] },
  { format: "essay", slug: "reform-act", doc: essayDoc("a"), parts: ["did", "findings", "pullquote", "graph", "image", "reflection", "references"] },
  { format: "before-after", slug: "cafe-checkout", doc: beforeAfterDoc(ids), parts: ["image", "did", "findings", "graph", "quote", "reflection", "link"] },
  { format: "event", slug: "the-crucible", doc: eventDoc(ids), parts: ["lead", "did", "happened", "findings", "graph", "grid", "quote", "reflection", "link"] },
];

test.describe("The samples as docs", () => {
  for (const s of SAMPLES) {
    test(`${s.format}: publishable and within the cap (${wordCount(s.doc)} of ${LIMITS.totalWords} words)`, () => {
      expect(validateForPublish(s.doc)).toEqual([]);
      expect(wordCount(s.doc)).toBeLessThanOrEqual(LIMITS.totalWords);
      expect(s.doc.format).toBe(s.format);
      // Stored with no flowchart marker, as an AI draft would be.
      expect(s.doc.sections.some((x) => x.kind === "flow")).toBe(false);
    });
  }

  test("an essay without its picture is still publishable", () => {
    expect(validateForPublish(essayDoc())).toEqual([]);
  });
});

const stamp = () => Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1000);

async function seed(page: Page, look = "") {
  const username = `ln${look.replace(/[^a-z]/g, "").slice(0, 6)}${stamp()}`;
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=max&count=0${look ? `&look=${look}` : ""}&with=layouts`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  return username;
}

const axe = async (page: Page, where: string) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

const pagesOf = async (page: Page) => {
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  return pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
};

/** Anything drawn past the article's own edges, or sideways scroll: cut off at this width. */
const overflowing = (page: Page) =>
  page.evaluate(() => {
    const art = document.querySelector("[data-exhbt-page]")!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll("[data-exhbt-page] *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // A graph's data table sits in a clipped, visually hidden wrapper: it is not drawn.
      if (el.closest(".sr-only")) continue;
      if (r.right > art.right + 1 || r.left < art.left - 1) out.push(`${el.tagName.toLowerCase()}${el.getAttribute("data-part") ? `[${el.getAttribute("data-part")}]` : ""}`);
    }
    return { sideways: document.documentElement.scrollWidth > window.innerWidth, out: [...new Set(out)].slice(0, 6) };
  });

test.describe("Each page in the usual order", () => {
  for (const s of SAMPLES) {
    test(`${s.format}: draws as article[data-format=${s.format}] with its parts in order`, async ({ page }) => {
      const u = await seed(page);
      await page.goto(`/p/${u}/${s.slug}`);
      await expect(page.locator(`article[data-format="${s.format}"]`)).toBeVisible();
      const all = await page.locator("[data-exhbt-page] [data-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-part")!));
      // Repeated names (several images or links) collapse to one, so the order is what is compared.
      expect(all.filter((p, i) => p !== all[i - 1])).toEqual(s.parts);
    });
  }
});

test.describe("Every look: one printed A4 page, axe, and no sideways scroll", () => {
  for (const t of PORTFOLIO_THEMES) {
    for (const s of SAMPLES) {
      test(`${t.id} ${s.format}: prints on one A4 page`, async ({ page }, info) => {
        const u = await seed(page, t.id);
        await page.goto(`/p/${u}/${s.slug}`);
        await expect(page.locator(`article[data-format="${s.format}"]`)).toBeVisible();
        const n = await pagesOf(page);
        info.annotations.push({ type: "pages", description: `${t.id} ${s.format}: ${n}` });
        console.log(`PAGES ${t.id} ${s.format} ${n}`);
        expect(n, `${t.id} ${s.format}`).toBe(1);
      });

      test(`${t.id} ${s.format}: axe finds nothing, nothing is cut off at 390px or 1440px`, async ({ page }) => {
        const u = await seed(page, t.id);
        await page.goto(`/p/${u}/${s.slug}`);
        await axe(page, `${t.id} ${s.format}`);
        const wide = await overflowing(page);
        expect(wide.sideways, `${t.id} ${s.format} 1440 sideways`).toBe(false);
        expect(wide.out, `${t.id} ${s.format} 1440`).toEqual([]);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/p/${u}/${s.slug}`);
        const narrow = await overflowing(page);
        expect(narrow.sideways, `${t.id} ${s.format} 390 sideways`).toBe(false);
        expect(narrow.out, `${t.id} ${s.format} 390`).toEqual([]);
      });
    }
  }
});

/* ---------------- The AI draft's answer for seven layouts (pure: no browser, no AI) ---------------- */

/** The material the pure tests draft from: everything the person supplied. */
const MATERIAL = [
  "This essay argues that the 1832 Reform Act kept the old order standing.",
  "A reform meant to close a door became the first step through it.",
  "Sources: Hartley, Reform and Its Limits (2004). Commons debates on the Reform Bill, 1831, https://example.com/commons-debates-1831.",
  "I built the rota app in React. The demo is at https://example.com/shift-swap-demo and the code at https://example.com/shift-swap-code.",
  "For the spring show I was the stage manager, and called four performances.",
].join("\n");

/** A seven-layout answer with nothing in the parts under test. */
const answer = (over: Partial<Draft> = {}): Draft => ({
  format: "essay",
  formatReason: "default",
  title: "Did the 1832 Reform Act protect the old order or end it?",
  summary: "It kept the old order standing.",
  context: "",
  whereWhen: "",
  skills: [],
  gap: "Historians split on what the Act was for.",
  gapHighlight: "",
  flow: [{ step: "Read the debates", detail: "" }],
  findings: ["Grey meant to preserve.", "Few gained the vote."],
  charts: [],
  quote: { text: "", name: "", role: "" },
  next: "",
  aim: "",
  aimIsHypothesis: false,
  conclusion: "",
  references: [],
  pullquote: "",
  myRole: "",
  numbers: [],
  ...over,
});
const kinds = (doc: ExhbtDoc) => doc.sections.map((s) => s.kind);
const linksOf = (doc: ExhbtDoc) => doc.sections.flatMap((s) => (s.kind === "link" ? [{ href: s.href, label: s.label }] : []));
const pullquoteOf = (doc: ExhbtDoc) => doc.sections.flatMap((s) => (s.kind === "pullquote" ? [s.text] : []));

/** How many fields a JSON schema has, counting every property at every depth, and how many are nullable: what the API's grammar limit counts (decision 0029). */
function sizeOf(schema: unknown): { fields: number; nullable: number } {
  const out = { fields: 0, nullable: 0 };
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null) return;
    const n = node as { type?: unknown; anyOf?: unknown[]; properties?: Record<string, unknown>; items?: unknown };
    if ((Array.isArray(n.type) && n.type.includes("null")) || n.anyOf?.some((a) => (a as { type?: unknown }).type === "null")) out.nullable++;
    out.fields += Object.keys(n.properties ?? {}).length;
    for (const v of Object.values(n.properties ?? {})) walk(v);
    walk(n.items);
    for (const a of n.anyOf ?? []) walk(a);
  };
  walk(schema);
  return out;
}

test.describe("The draft's answer shape stays inside the API's limit (decision 0029)", () => {
  // The API refuses an answer shape of about 52 to 56 fields, and a nullable field costs about two. A field
  // added to either shape changes these numbers: check the new count against that limit before changing them.
  test("three layouts: 39 fields, as before release 4; seven layouts: 41; neither has a nullable field", () => {
    expect(sizeOf(zodOutputFormat(DraftSchema).schema)).toEqual({ fields: 39, nullable: 0 });
    expect(sizeOf(zodOutputFormat(DraftSchemaSeven).schema)).toEqual({ fields: 41, nullable: 0 });
  });

  test("the seven-layout answer adds a pull quote and a role, and nothing else: sources and links are rows of references", () => {
    const three = Object.keys(DraftSchema.shape);
    const seven = Object.keys(DraftSchemaSeven.shape);
    expect(seven.filter((k) => !three.includes(k))).toEqual(["pullquote", "myRole"]);
    expect(three.filter((k) => !seven.includes(k))).toEqual([]);
    // The layout comes first, so everything after it is written knowing it; the numbers come last.
    expect(seven.slice(0, 2)).toEqual(["format", "formatReason"]);
    expect(seven.at(-1)).toBe("numbers");
    expect(DraftSchemaSeven.shape.format.options).toEqual([...FORMATS]);
    expect(DraftSchema.shape.format.options).toEqual([...CLASSIC_FORMATS]);
  });
});

test.describe("The seven-layout answer, repaired", () => {
  test("one of the four is kept in a seven-layout answer, and becomes a case study in a three-layout one", () => {
    for (const f of NEW_FOUR) {
      expect((repairDraft(answer({ format: f }), "seven") as Draft).format).toBe(f);
      expect(DraftSchemaSeven.safeParse(repairDraft(answer({ format: f }), "seven")).success).toBe(true);
      expect((repairDraft(answer({ format: f }), "three") as Draft).format).toBe("case-study");
      expect((repairDraft(answer({ format: f })) as Draft).format).toBe("case-study");
    }
  });

  test("a reason for one of the four is kept in a seven-layout answer, and says nothing in a three-layout one", () => {
    expect((repairDraft(answer({ formatReason: "built-thing" }), "seven") as Draft).formatReason).toBe("built-thing");
    expect((repairDraft(answer({ formatReason: "built-thing" }), "three") as Draft).formatReason).toBe("default");
    expect((repairDraft({ ...answer(), formatReason: "it reads like an essay" }, "seven") as Draft).formatReason).toBe("default");
  });

  test("a pull quote or a role that is missing or isn't text becomes none, and the draft is kept", () => {
    const raw: Record<string, unknown> = { ...answer(), pullquote: null };
    delete raw.myRole;
    expect(DraftSchemaSeven.safeParse(raw).success).toBe(false);
    const fixed = repairDraft(raw, "seven") as Draft;
    expect(fixed.pullquote).toBe("");
    expect(fixed.myRole).toBe("");
    expect(DraftSchemaSeven.safeParse(fixed).success).toBe(true);
  });
});

test.describe("Only what the person supplied reaches a drafted doc", () => {
  test("a pull quote is kept only when it is in the material word for word, and within its cap", () => {
    const kept = toDoc(answer({ pullquote: "“A reform meant to close a door became the first step through it.”" }), MATERIAL);
    expect(pullquoteOf(kept)).toEqual(["A reform meant to close a door became the first step through it."]);
    // The essay's usual order: the key points, then the pull quote.
    expect(kinds(kept)).toEqual(["findings", "pullquote"]);
    // Reworded, or written by the AI: none.
    expect(pullquoteOf(toDoc(answer({ pullquote: "A reform meant to close a door opened it." }), MATERIAL))).toEqual([]);
    expect(pullquoteOf(toDoc(answer({ pullquote: "Reform is a door that never closes." }), MATERIAL))).toEqual([]);
    // In the material, but over the AI's target (decision 0030): left off, never cut. A person may type a longer one.
    const long = Array.from({ length: DRAFT_TARGETS.pullquoteWords + 1 }, (_, i) => `word${i}`).join(" ");
    expect(pullquoteOf(toDoc(answer({ pullquote: long }), `${MATERIAL}\n${long}`))).toEqual([]);
    expect(pullquoteFrom(long.split(" ").slice(1).join(" "), long, DRAFT_TARGETS.pullquoteWords)).not.toBeNull();
  });

  test("a source with no address is kept only when its citation is in the material word for word", () => {
    const doc = toDoc(
      answer({
        references: [
          { label: "Hartley, Reform and Its Limits (2004)", url: "" },
          { label: "Invented, A. (2020) A book nobody cited", url: "" },
          { label: "Hartley, The Limits of Reform (2004)", url: "" },
        ],
      }),
      MATERIAL,
    );
    expect(linksOf(doc)).toEqual([{ href: "", label: "Hartley, Reform and Its Limits (2004)" }]);
  });

  test("a source with an address needs that https address in the material as written; a made-up address is taken off a real citation", () => {
    const doc = toDoc(
      answer({
        references: [
          { label: "Commons debates on the Reform Bill, 1831", url: "https://example.com/commons-debates-1831" },
          // A real citation with an address the material doesn't hold: the citation is kept, with no address.
          { label: "Hartley, Reform and Its Limits (2004)", url: "https://doi.org/10.1000/made-up" },
          // Neither the address nor the citation is in the material.
          { label: "A paper nobody cited", url: "https://example.com/nowhere" },
          { label: "Not https", url: "http://example.com/commons-debates-1831" },
        ],
      }),
      MATERIAL,
    );
    expect(linksOf(doc)).toEqual([
      { href: "https://example.com/commons-debates-1831", label: "Commons debates on the Reform Bill, 1831" },
      { href: "", label: "Hartley, Reform and Its Limits (2004)" },
    ]);
    expect(unsupportedParts(doc, MATERIAL)).toEqual([]);
  });

  test("an essay keeps at most four sources, and a source's label is cut to the essay's cap", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ label: `Source number ${i}`, url: "" }));
    const material = many.map((m) => m.label).join(". ");
    expect(linksOf(toDoc(answer({ references: many }), material))).toHaveLength(formatLimits("essay").sections.link);
    const long = "Hartley Reform and Its Limits a very long citation that runs on past the twelve words allowed";
    const [cut] = linksOf(toDoc(answer({ references: [{ label: long, url: "" }] }), long));
    expect(words(cut!.label)).toBe(formatLimits("essay").link.labelWords);
    expect(long.startsWith(cut!.label)).toBe(true);
  });

  test("My role is kept only when the material says it, and only on an event", () => {
    expect(toDoc(answer({ format: "event", myRole: "Stage manager" }), MATERIAL).myRole).toBe("Stage manager");
    // The material doesn't say it: empty, so the person types it.
    expect(toDoc(answer({ format: "event", myRole: "Director" }), MATERIAL).myRole).toBeUndefined();
    expect(toDoc(answer({ format: "event", myRole: "" }), MATERIAL).myRole).toBeUndefined();
    expect("myRole" in toDoc(answer({ format: "event", myRole: "" }), MATERIAL)).toBe(false);
    // Over the sidebar's cap: left off, never cut.
    const long = "stage manager and deputy lighting designer for every one of the four nights";
    expect(long.length).toBeGreaterThan(LIMITS.myRoleChars);
    expect(toDoc(answer({ format: "event", myRole: long }), `${MATERIAL} I was ${long}.`).myRole).toBeUndefined();
    // Another layout doesn't draft it, even when the material says it.
    expect(toDoc(answer({ format: "case-study", myRole: "Stage manager" }), MATERIAL).myRole).toBeUndefined();
  });

  test("a build's link is kept only when its https address is in the material, and there are at most two", () => {
    const doc = toDoc(
      answer({
        format: "build",
        references: [
          { label: "Try the demo", url: "https://example.com/shift-swap-demo" },
          { label: "A made-up link", url: "https://example.com/not-in-the-material" },
          { label: "Source code", url: "https://example.com/shift-swap-code" },
          { label: "A third real one", url: "https://example.com/commons-debates-1831" },
          // No address: a build has no use for a citation.
          { label: "Hartley, Reform and Its Limits (2004)", url: "" },
        ],
      }),
      MATERIAL,
    );
    expect(linksOf(doc)).toEqual([
      { href: "https://example.com/shift-swap-demo", label: "Try the demo" },
      { href: "https://example.com/shift-swap-code", label: "Source code" },
    ]);
    // A build's links come last, after what it does.
    expect(kinds(doc)).toEqual(["findings", "link", "link"]);
    expect(unsupportedParts(doc, MATERIAL)).toEqual([]);
  });

  test("Before and After marks are never drafted, and a part that belongs to another layout is left off", () => {
    for (const f of FORMATS) {
      const doc = toDoc(answer({ format: f, pullquote: "A reform meant to close a door became the first step through it.", myRole: "Stage manager", references: [{ label: "Try the demo", url: "https://example.com/shift-swap-demo" }] }), MATERIAL);
      // No picture is drafted at all, so none can carry a mark.
      expect(doc.sections.filter((s) => s.kind === "image"), f).toEqual([]);
      expect(JSON.stringify(doc), f).not.toContain('"stage"');
      expect(pullquoteOf(doc).length, f).toBe(f === "essay" ? 1 : 0);
      expect(doc.myRole, f).toBe(f === "event" ? "Stage manager" : undefined);
      expect(linksOf(doc).length, f).toBe(f === "essay" || f === "build" || f === "research" ? 1 : 0);
      expect(formatOf(doc), f).toBe(f);
    }
  });

  test("a three-layout answer, which has no pull quote or role, still becomes the same doc as before", () => {
    const three = answer({ format: "research", aim: "To test recall.", conclusion: "It helped.", references: [{ label: "Commons debates", url: "https://example.com/commons-debates-1831" }] });
    delete three.pullquote;
    delete three.myRole;
    const doc = toDoc(three, MATERIAL);
    expect(kinds(doc)).toEqual(["aim", "findings", "conclusion", "link"]);
    expect(Object.keys(doc)).toEqual(["schemaVersion", "format", "title", "context", "whereWhen", "summary", "skills", "gap", "flow", "sections"]);
  });

  test("unsupportedParts names each part a doc holds that its material doesn't", () => {
    const doc: ExhbtDoc = {
      ...toDoc(answer(), MATERIAL),
      myRole: "Director",
      sections: [
        { id: "pullquote-1", kind: "pullquote", text: "Reform is a door that never closes." },
        { id: "link-1", kind: "link", href: "", label: "Invented, A. (2020) A book nobody cited", description: "" },
        { id: "link-2", kind: "link", href: "https://example.com/nowhere", label: "A link", description: "" },
        { id: "link-3", kind: "link", href: "https://example.com/commons-debates-1831", label: "Commons debates", description: "" },
        { id: "link-4", kind: "link", href: "", label: "Hartley, Reform and Its Limits (2004)", description: "" },
      ],
    };
    expect(unsupportedParts(doc, MATERIAL)).toEqual([
      `My role isn't in the material: "Director"`,
      `The pull quote isn't in the material: "Reform is a door that never closes."`,
      `A source with no address isn't in the material: "Invented, A. (2020) A book nobody cited"`,
      "A link's address isn't in the material: https://example.com/nowhere",
    ]);
    // An address the material writes without its closing slash is the same address.
    expect(unsupportedParts({ sections: [{ kind: "link", href: "https://example.com/", label: "Home" }] }, "See https://example.com.")).toEqual([]);
  });

  test("leftOff says what the model wrote that the material didn't hold", () => {
    const essay = answer({ pullquote: "Reform is a door that never closes.", references: [{ label: "Invented, A. (2020)", url: "" }, { label: "Hartley, Reform and Its Limits (2004)", url: "" }] });
    expect(leftOff(essay, toDoc(essay, MATERIAL))).toEqual(["pull quote", "1 source"]);
    const event = answer({ format: "event", myRole: "Director" });
    expect(leftOff(event, toDoc(event, MATERIAL))).toEqual(["My role"]);
    const fine = answer({ format: "event", myRole: "stage manager" });
    expect(leftOff(fine, toDoc(fine, MATERIAL))).toEqual([]);
  });
});

test.describe("The line after a draft, for the four layouts", () => {
  const drafted = (over: Partial<Draft>) => toDoc(answer(over), MATERIAL);

  test("each new signal is said only when the draft bears it out", () => {
    // A built thing with what it does.
    expect(checkedReason(drafted({ format: "build" }), "built-thing")).toBe("built-thing");
    expect(checkedReason(drafted({ format: "build", findings: [] }), "built-thing")).toBe("default");
    // An argument with sources: key points, and a source the material holds.
    const sourced = { references: [{ label: "Hartley, Reform and Its Limits (2004)", url: "" }] };
    expect(checkedReason(drafted({ format: "essay", ...sourced }), "argument-sources")).toBe("argument-sources");
    expect(checkedReason(drafted({ format: "essay" }), "argument-sources")).toBe("default");
    expect(checkedReason(drafted({ format: "essay", references: [{ label: "Invented, A. (2020)", url: "" }] }), "argument-sources")).toBe("default");
    // A before and an after: what changed.
    expect(checkedReason(drafted({ format: "before-after" }), "before-and-after")).toBe("before-and-after");
    expect(checkedReason(drafted({ format: "before-after", findings: [] }), "before-and-after")).toBe("default");
    // An event with a role.
    expect(checkedReason(drafted({ format: "event", myRole: "stage manager" }), "event-role")).toBe("event-role");
    expect(checkedReason(drafted({ format: "event", myRole: "Director" }), "event-role")).toBe("default");
  });

  test("a signal never explains a layout it isn't for, and the notes must name the layout", () => {
    expect(checkedReason(drafted({ format: "essay" }), "built-thing")).toBe("default");
    expect(checkedReason(drafted({ format: "build" }), "aim-results")).toBe("default");
    for (const [f, notes] of [["build", "Lay it out as a build."], ["essay", "An essay, please."], ["before-after", "Use the before and after layout."], ["event", "It was an event."]] as const) {
      expect(checkedReason(drafted({ format: f }), "notes", { notes }), f).toBe("notes");
      expect(checkedReason(drafted({ format: f }), "notes", { notes: "No layout named here." }), f).toBe("default");
    }
  });

  test("the sentence for each is fixed wording, and none of it is the model's", () => {
    expect(layoutSentence("build", "built-thing")).toBe("Laid out as Build because your work is something you built, and says what it does.");
    expect(layoutSentence("essay", "argument-sources")).toBe("Laid out as Essay because your work makes an argument and names its sources.");
    expect(layoutSentence("before-after", "before-and-after")).toBe("Laid out as Before and after because your work says how something was and how it is now.");
    expect(layoutSentence("event", "event-role")).toBe("Laid out as Event or performance because your work is an event, and says what your part in it was.");
    expect(layoutSentence("event", "notes")).toBe("Laid out as Event or performance because your notes name this layout.");
    // A reason that doesn't fit the layout, or none, is left out.
    expect(layoutSentence("essay", "built-thing")).toBe("Laid out as Essay.");
    expect(layoutSentence("build", "default")).toBe("Laid out as Build.");
    // Every signal the draft may give is one the edit page will read from the address.
    for (const r of LAYOUT_REASONS) expect(isLayoutReason(r)).toBe(true);
    expect(CLASSIC_REASONS.every((r) => (LAYOUT_REASONS as readonly string[]).includes(r))).toBe(true);
  });
});

/* ---------------- The draft eval, made ready for seven layouts (nothing here calls the AI or runs the eval) ---------------- */

type AnswerKey = {
  fixture: string;
  files: string[];
  notesFile: string | null;
  expect: { layout?: string | string[] };
  keyFacts: { id: string; match: (string | string[])[] }[];
  sourceNumbers: string[];
};
const FIXTURES_DIR = join(process.cwd(), "evals/exhbt-draft/fixtures");
const answerKeys = (): AnswerKey[] =>
  readdirSync(FIXTURES_DIR)
    .filter((n) => n.endsWith(".facts.json"))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(FIXTURES_DIR, n), "utf8")) as AnswerKey);

test.describe("The draft eval's fixtures and marks for seven layouts", () => {
  test("two made-up pieces of work for each new layout, and decision 0028's three near misses, each naming the layout expected", () => {
    const keys = answerKeys();
    const near = keys.filter((k) => k.fixture.includes("-near-"));
    // Release 4's own fixtures are numbered from 12 (the older history essay, 06, is now expected to be an essay too).
    for (const f of NEW_FOUR) {
      const made = keys.filter((k) => k.expect.layout === f && !near.includes(k) && Number(k.fixture.slice(0, 2)) >= 12).map((k) => k.fixture);
      expect(made.length, `${f}: ${made.join(", ")}`).toBe(2);
    }
    // A humanities dissertation with survey data is research; a poster for an event with nothing about the
    // person's part is a gallery; a redesign that describes only the result is a case study.
    expect(Object.fromEntries(near.map((k) => [k.fixture, k.expect.layout]))).toEqual({
      "20-near-dissertation-survey": "research",
      "21-near-event-poster": "gallery",
      "22-near-redesign-result-only": "case-study",
    });
    for (const k of keys) {
      const where = k.fixture;
      for (const file of [...k.files, ...(k.notesFile ? [k.notesFile] : [])]) expect(existsSync(join(FIXTURES_DIR, file)), `${where}: ${file}`).toBe(true);
      expect(existsSync(join(FIXTURES_DIR, `${k.fixture}.facts.json`)), `${where}: the answer key is named after the fixture`).toBe(true);
      for (const l of k.expect.layout === undefined ? [] : [k.expect.layout].flat()) expect((FORMATS as readonly string[]).includes(l), `${where}: ${l}`).toBe(true);
    }
  });

  test("each new answer key asks only for what its material says, and lists the material's numbers", () => {
    const flat = (t: string) => t.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
    for (const k of answerKeys().filter((x) => Number(x.fixture.slice(0, 2)) >= 12)) {
      const material = flat(k.files.map((f) => readFileSync(join(FIXTURES_DIR, f), "utf8")).join("\n"));
      // At least one way of saying each key fact is in the material itself, so a faithful draft can score it.
      for (const fact of k.keyFacts) {
        const found = fact.match.some((alt) => [alt].flat().every((part) => material.includes(flat(part))));
        expect(found, `${k.fixture}: ${fact.id}`).toBe(true);
      }
      // `npm run eval:fixtures` wrote the material's numbers (an empty list here means it was not run).
      expect(k.sourceNumbers.length, k.fixture).toBeGreaterThan(0);
      for (const n of k.sourceNumbers) expect(material.includes(flat(n)), `${k.fixture}: ${n}`).toBe(true);
    }
  });

  test("a layout is marked right, wrong, or not at all when the answer key names none", () => {
    expect(markLayout({ format: "essay" }, "essay")).toEqual({ state: "ok", got: "essay", want: ["essay"] });
    expect(markLayout({ format: "research" }, "essay")).toEqual({ state: "wrong", got: "research", want: ["essay"] });
    // No format is a case study; a list means more than one is right.
    expect(markLayout({}, ["case-study", "research"]).state).toBe("ok");
    expect(markLayout({ format: "before-after" }, ["case-study", "research"]).state).toBe("wrong");
    expect(markLayout({ format: "gallery" }, undefined)).toEqual({ state: "n/a", got: "gallery", want: [] });
  });

  test("what only the person can clear (pictures, Before and After marks) is told apart from what a draft got wrong", () => {
    // A drafted before and after: no pictures yet, so nothing is marked. Its three points on what changed are there.
    const drafted = toDoc(answer({ format: "before-after", findings: ["The total is on one screen.", "Buttons are bigger.", "Repeat orders take two taps."] }), MATERIAL);
    // What a layout usually has is a suggestion to a person since decision 0032 and stops no one publishing. A draft
    // is still marked on it (draftIssues: what stops publishing, then the suggestions), so the marks mean what they did.
    expect(validateForPublish(drafted)).toEqual([]);
    const issues = draftIssues(drafted);
    const person = issues.filter((i) => needsThePerson(i, drafted)).map((i) => i.message);
    expect(person).toEqual(["A before and after works best with at least 2 images.", "Mark one image Before and one After."]);
    // Without its findings, the missing "what changed" is the draft's own failing.
    const thin = toDoc(answer({ format: "before-after", findings: [] }), MATERIAL);
    const thinIssues = draftIssues(thin).filter((i) => !needsThePerson(i, thin)).map((i) => i.message);
    expect(thinIssues).toContain("Add what changed and why.");
    // An event's poster is the person's to add; its role is the draft's to find in the material.
    const event = toDoc(answer({ format: "event", myRole: "" }), MATERIAL);
    const eventIssues = draftIssues(event);
    expect(eventIssues.filter((i) => needsThePerson(i, event)).map((i) => i.message)).toEqual(["Add at least one picture, such as the poster."]);
    expect(eventIssues.filter((i) => !needsThePerson(i, event)).map((i) => i.message)).toContain("Say what your role was.");
    // A gallery's two pictures, and a build's screenshot or link.
    const gallery = toDoc(answer({ format: "gallery" }), MATERIAL);
    expect(draftIssues(gallery).filter((i) => needsThePerson(i, gallery)).map((i) => i.message)).toEqual(["A gallery works best with at least 2 images."]);
    const build = toDoc(answer({ format: "build" }), MATERIAL);
    expect(draftIssues(build).filter((i) => needsThePerson(i, build)).map((i) => i.message)).toEqual(["Add a screenshot or a link, so people can see it working."]);
    // Research's key figure can be drafted from the material's figures, so it stays the draft's.
    const research = toDoc(answer({ format: "research", aim: "To test it.", conclusion: "It held." }), MATERIAL);
    expect(draftIssues(research).filter((i) => needsThePerson(i, research))).toEqual([]);
  });
});

/* ---------------- Drafted by the stand-in, in the new editor (this suite's server: EXHBT_EDITOR is "page") ---------------- */

/** Material with none of the stand-in's cues in it: on its own it drafts a case study. */
const PLAIN = "We timed lunchtime queues at the union cafe for two weeks, then tried a second till at the busiest hour. The queue fell, and staff said the rush felt calmer.";
/** Drafts through the API (the stand-in AI), as the draft page does. */
async function draftOf(page: Page, data: Record<string, string>) {
  const res = await page.request.post("/api/exhbts/draft", { data });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as { id: string; format: string; formatReason: string };
}
const stored = async (page: Page, id: string) => (await readStored(page, id)).working;

test.describe("A draft may choose any of the seven layouts in the new editor", () => {
  for (const f of NEW_FOUR) {
    test(`${f}: notes that name it draft it, and the editor opens on it and says so`, async ({ page }) => {
      await signInAs(page, freshName(`named${f}`), "max");
      const d = await draftOf(page, { text: PLAIN, notes: `stand-in: layout ${f}` });
      expect(d).toMatchObject({ format: f, formatReason: "notes" });
      await page.goto(`/exhbts/${d.id}/edit?drafted=${d.format}&why=${d.formatReason}`);
      await waitEditor(page);
      const said = `Laid out as ${FORMAT_RULES[f].name} because your notes name this layout.`;
      await expect(previewArticle(page)).toHaveAttribute("data-format", f);
      // Said once, aloud, and kept in the layout menu, where the layout is changed.
      await expect(page.locator("[data-said]")).toContainText(said);
      await openLayoutMenu(page);
      await expect(layoutGroup(page).getByRole("radio", { name: new RegExp(`^${FORMAT_RULES[f].name}`) })).toBeChecked();
      await expect(page.locator("[data-drafted]")).toContainText(said);
      await expect(page).toHaveURL(new RegExp(`/exhbts/${d.id}/edit$`));
    });
  }

  test("one plain cue each: a built thing, a redesign, an event with a role and an essay, each with its own reason and parts", async ({ page }) => {
    await signInAs(page, freshName("cues"), "max");
    const built = `${PLAIN} I built the timer as a small web app, and the code is at https://example.com/queue-timer.`;
    const build = await draftOf(page, { text: built });
    expect(build).toMatchObject({ format: "build", formatReason: "built-thing" });
    const buildStored = await stored(page, build.id);
    expect(linksOf(buildStored).map((l) => l.href)).toEqual(["https://example.com/queue-timer"]);
    expect(unsupportedParts(buildStored, built)).toEqual([]);

    const redesign = await draftOf(page, { text: `${PLAIN} We then redesigned the counter so the tills face the door.` });
    expect(redesign).toMatchObject({ format: "before-after", formatReason: "before-and-after" });
    // No picture is drafted, so nothing is marked Before or After.
    expect(JSON.stringify(await stored(page, redesign.id))).not.toContain('"stage"');

    const staged = `${PLAIN} My role was shift lead for the fortnight.`;
    const event = await draftOf(page, { text: staged });
    expect(event).toMatchObject({ format: "event", formatReason: "event-role" });
    const eventStored = await stored(page, event.id);
    expect(eventStored.myRole).toBe("shift lead for the fortnight");
    expect(unsupportedParts(eventStored, staged)).toEqual([]);

    const argued = `This essay argues that a second till pays for itself at lunchtime.\n${PLAIN}\nSource: Hartley, Queues and Their Limits (2004)`;
    const essay = await draftOf(page, { text: argued });
    expect(essay).toMatchObject({ format: "essay", formatReason: "argument-sources" });
    const essayStored = await stored(page, essay.id);
    expect(pullquoteOf(essayStored)).toEqual(["This essay argues that a second till pays for itself at lunchtime."]);
    expect(linksOf(essayStored)).toEqual([{ href: "", label: "Hartley, Queues and Their Limits (2004)" }]);
    expect(unsupportedParts(essayStored, argued)).toEqual([]);
  });

  test("what the AI makes up is left off the exhbt: a pull quote, a source with no address, a link and a role", async ({ page }) => {
    // "stand-in: invent": the stand-in writes one of each that the material doesn't hold, as a real model might.
    const INVENTED = ["A sentence the person never wrote.", "A book nobody cited", "not-in-the-material", "Director of everything"];
    await signInAs(page, freshName("invent"), "max");
    const essay = await draftOf(page, { text: `${PLAIN}\nSource: Hartley, Queues and Their Limits (2004)`, notes: "stand-in: layout essay. stand-in: invent" });
    expect(essay.format).toBe("essay");
    const essayStored = await stored(page, essay.id);
    expect(pullquoteOf(essayStored)).toEqual([]);
    expect(linksOf(essayStored)).toEqual([{ href: "", label: "Hartley, Queues and Their Limits (2004)" }]);

    const event = await draftOf(page, { text: PLAIN, notes: "stand-in: layout event. stand-in: invent" });
    expect(event.format).toBe("event");
    // My role is empty when the material doesn't say: the person types it, and the reason given is the notes', not a role's.
    expect((await stored(page, event.id)).myRole).toBeUndefined();
    expect(event.formatReason).toBe("notes");

    const build = await draftOf(page, { text: `${PLAIN} The code is at https://example.com/queue-timer.`, notes: "stand-in: layout build. stand-in: invent" });
    expect(build.format).toBe("build");
    expect(linksOf(await stored(page, build.id)).map((l) => l.href)).toEqual(["https://example.com/queue-timer"]);

    for (const d of [essay, event, build]) for (const made of INVENTED) expect(JSON.stringify(await stored(page, d.id)), made).not.toContain(made);
  });

  test("a person whose editor is the classic one is drafted one of the three, whatever the notes and the material say", async ({ page }) => {
    // Every cue the stand-in knows, and notes that name one of the four.
    const text = `This essay argues that a second till pays. I built a timer, we redesigned the counter, and my role was shift lead. ${PLAIN}`;
    await classicEditor.signInAs(page, freshName("classicdraft"), "max");
    const d = await draftOf(page, { text, notes: "stand-in: layout essay" });
    expect(d).toMatchObject({ format: "case-study", formatReason: "question-findings" });
    const doc = await stored(page, d.id);
    expect(doc.format).toBeUndefined();
    expect(kinds(doc).filter((k) => k === "pullquote" || k === "link")).toEqual([]);
    expect(doc.myRole).toBeUndefined();
    // The three still draft as they did: a gallery by name, research by its cue.
    expect((await draftOf(page, { text, notes: "stand-in: layout gallery" })).format).toBe("gallery");
    expect((await draftOf(page, { text: `${PLAIN} Our hypothesis was that a second till helps.` })).format).toBe("research");

    // It follows the person's editor, as the edit page decides it. An admin who turns the new editor on for themselves is drafted among seven...
    expect((await page.request.get("/dev/admin?role=admin")).status()).toBe(200);
    expect((await page.request.post("/api/exhbts/editor", { form: { kind: "page" } })).status()).toBe(200);
    expect((await draftOf(page, { text, notes: "stand-in: layout essay" })).format).toBe("essay");
    // ...and the same choice from a person who is not an admin counts for nothing.
    expect((await page.request.get("/dev/admin?role=user")).status()).toBe(200);
    expect((await draftOf(page, { text, notes: "stand-in: layout essay" })).format).toBe("case-study");
  });
});

test.describe("The layout menu offers seven", () => {
  /** "Laid out as ...", as the menu says it after a switch. */
  const AS: Record<Format, string> = { "case-study": "a case study", gallery: "a gallery", research: "research", build: "a build", essay: "an essay", "before-after": "a before and after", event: "an event" };

  test("each has its own line and sketch; each of the four can be chosen, is saved, and Undo gives the layout back", async ({ page }) => {
    const { id } = await openDoc(page, freshName("menuseven"), openBankingDoc);
    await openLayoutMenu(page);
    const group = layoutGroup(page);
    await expect(group.getByRole("radio")).toHaveCount(FORMATS.length);
    expect(await group.locator(".xe-layout-name").allTextContents()).toEqual(FORMATS.map((f) => FORMAT_RULES[f].name));
    // One short line each, at most 40 characters (a row stays on one line on a phone: e2e/editor-topbar.spec.ts), no two the same.
    const lines = await group.locator(".xe-layout-line").allTextContents();
    for (const l of lines) expect(l.length > 0 && l.length <= 40, l).toBe(true);
    expect(new Set(lines).size).toBe(FORMATS.length);
    // Research no longer says it is for essays: an essay has its own layout.
    expect(lines[FORMATS.indexOf("research")]).not.toMatch(/essay/i);
    const sketches = await group.locator("label svg").evaluateAll((els) => els.map((e) => e.innerHTML));
    expect(new Set(sketches).size).toBe(FORMATS.length);

    const undo = page.locator(`${READY} [data-topbar]`).getByRole("button", { name: /^Undo/ });
    for (const f of NEW_FOUR) {
      await openLayoutMenu(page);
      await group.getByRole("radio", { name: new RegExp(`^${FORMAT_RULES[f].name}`) }).check();
      await expect(previewArticle(page)).toHaveAttribute("data-format", f);
      await expect(page.locator("[data-layout-status]")).toContainText(`Laid out as ${AS[f]}. Undo restores your order.`);
      // The server stores it: all seven are offered to a person whose editor is the new one.
      await waitSaved(page, id);
      expect((await stored(page, id)).format).toBe(f);
      await page.keyboard.press("Escape");
      await expect(group).toHaveCount(0);
      await undo.click();
      await expect(previewArticle(page)).toHaveAttribute("data-format", "case-study");
    }
    await waitSaved(page, id);
    expect((await stored(page, id)).format).toBeUndefined();
  });
});

/* ---------------- Each new layout in the new editor: its rows, its "+" and what it needs to publish ---------------- */

test.describe("Each new layout in the editor", () => {
  /** The end "+" menu's kinds, as drawn: each with its name, and why it is full where it is. */
  async function plusMenu(page: Page) {
    await openAddSectionMenu(page);
    const got = await page
      .locator(`${READY} [data-xe-menu] button.xe-plus-item:not([data-block="figure"])`)
      .evaluateAll((els) => els.map((e) => ({ kind: e.getAttribute("data-block"), name: e.querySelector(".xe-plus-name")?.textContent ?? "", full: e.querySelector(".xe-plus-why")?.textContent ?? null, off: (e as HTMLButtonElement).disabled })));
    await page.keyboard.press("Escape");
    return got;
  }
  /** What the layout's rules say the "+" offers for the doc as it is now (blockOptions: the kinds it draws, each with its cap). */
  const offeredNow = async (page: Page) => blockOptions(await docNow(page)).map((o) => ({ kind: o.kind as string, name: o.name, full: o.full ?? null, off: Boolean(o.full) }));
  /**
   * What stops publishing, as "Things to fix before publishing" lists it once publishing has been tried (before
   * that it leaves out parts that are only empty). Nothing to fix: no button, and "".
   */
  /**
   * What the editor suggests for the page now, as the top bar's list words it ("" where it suggests nothing). What a
   * layout usually has is a suggestion since decision 0032; until then each was a thing to fix that stopped publishing.
   * None of them may be among the things that stop it, which this checks each time it is asked.
   */
  async function suggested(page: Page): Promise<string> {
    await page.evaluate(async () => {
      window.__exhbtUi!.setTried(true);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const now = await docNow(page);
    const stops = validateForPublish(now).map((i) => i.message);
    for (const s of suggestionsFor(now)) expect(stops, "a suggestion is never among what stops publishing").not.toContain(s.message);
    const button = page.locator(`${READY} .xe-suggest-button, ${READY} .xe-fix-button`).first();
    if ((await button.count()) === 0) return "";
    await button.click();
    const group = page.locator(`${READY} [data-suggestions]`);
    const words = (await group.count()) ? (await group.innerText()).replace(/\s+/g, " ") : "";
    await page.keyboard.press("Escape");
    return words;
  }
  const boxOf = async (page: Page, id: string) => (await frame(page, id).boundingBox())!;

  test("build: the lead screenshot, what it does beside the graph, the links as a row of buttons; it suggests a screenshot or a link", async ({ page }) => {
    await openDoc(page, freshName("rowsbuild"), sampleDoc("build"));
    const art = previewArticle(page);
    await expect(art).toHaveAttribute("data-format", "build");
    // The first image is the lead; "What it does" pairs with the graph beside it.
    await expect(art.locator('[data-part="lead"]')).toHaveCount(1);
    await expect(art.locator('[data-section-id="image-1"] [data-part="lead"], [data-part="lead"] [data-section-id="image-1"], [data-part="lead"][data-section-id="image-1"]')).toHaveCount(1);
    const pair = art.locator("[data-found]");
    await expect(pair.locator('[data-section-id="findings"]')).toHaveCount(1);
    await expect(pair.locator('[data-section-id="graph-1"]')).toHaveCount(1);
    // The demo and the code sit side by side, as buttons do.
    const [demo, code] = [await boxOf(page, "link-1"), await boxOf(page, "link-2")];
    expect(Math.abs(demo.y - code.y)).toBeLessThan(2);
    expect(code.x).toBeGreaterThanOrEqual(demo.x + demo.width);
    // Each one's "Web address" is under its line, not on it: on the line it took the press meant for the line's field.
    for (const id of ["link-1", "link-2"]) {
      const line = (await frame(page, id).locator('[data-path$=".description"]').boundingBox())!;
      const chip = (await frame(page, id).getByRole("button", { name: /^Web address/ }).boundingBox())!;
      expect(chip.y, id).toBeGreaterThanOrEqual(line.y + line.height);
    }

    // The "+" offers a build's kinds with a build's caps: two links and one graph are all it takes, and there is room for two more screenshots.
    const menu = await plusMenu(page);
    expect(menu).toEqual(await offeredNow(page));
    expect(menu.find((o) => o.kind === "link")).toMatchObject({ off: true, full: "Up to 2 links in a build" });
    expect(menu.find((o) => o.kind === "graph")).toMatchObject({ off: true, full: "One graph in a build" });
    expect(menu.find((o) => o.kind === "image")).toMatchObject({ off: false });
    expect(menu.map((o) => o.kind)).not.toContain("pullquote");

    // With no screenshot and no link, it suggests one, in its own words (it stopped publishing until decision 0032).
    const NEED = "Add a screenshot or a link, so people can see it working.";
    expect(await suggested(page)).not.toContain(NEED);
    await page.evaluate(() => ["image-1", "image-2", "link-1", "link-2"].forEach((id) => window.__exhbtEditor!.remove(id)));
    expect(await suggested(page)).toContain(NEED);
    // A link clears it (the link has its own things to fill in).
    await addSection(page, "Add a link");
    await expect(framesOf(page, "link")).toHaveCount(1);
    expect(await suggested(page)).not.toContain(NEED);
  });

  test("essay: the key points beside the pull quote, the sources as a list; it suggests its key points", async ({ page }) => {
    await openDoc(page, freshName("rowsessay"), sampleDoc("essay"));
    const art = previewArticle(page);
    await expect(art).toHaveAttribute("data-format", "essay");
    const pair = art.locator("[data-found]");
    await expect(pair.locator('[data-section-id="findings"]')).toHaveCount(1);
    await expect(pair.locator('[data-section-id="pullquote-1"]')).toHaveCount(1);
    // The sources are one list under their own heading, the one with no address among them.
    const sources = art.locator('section[data-part="references"]');
    await expect(sources).toHaveCount(1);
    await expect(sources.locator(".xp-label").first()).toHaveText("Sources");
    await expect(sources.locator("[data-section-id]")).toHaveCount(3);
    await expect(sources.locator('[data-section-id="link-3"]')).toContainText("Grey's letters, held in the university library");

    // One pull quote is all an essay takes; it has room for a fourth source, which it calls a source.
    const menu = await plusMenu(page);
    expect(menu).toEqual(await offeredNow(page));
    expect(menu.find((o) => o.kind === "pullquote")).toMatchObject({ off: true, full: "One pull quote in an essay" });
    expect(menu.find((o) => o.kind === "link")).toMatchObject({ off: false, name: "Source" });

    const NEED = "Add your key points.";
    expect(await suggested(page)).not.toContain(NEED);
    await page.evaluate(() => window.__exhbtEditor!.remove("findings"));
    expect(await suggested(page)).toContain(NEED);
    await openAddSectionMenu(page);
    await page.locator(`${READY} [data-xe-menu] [data-block="findings"]`).click();
    await expect(framesOf(page, "findings")).toHaveCount(1);
    expect(await suggested(page)).not.toContain(NEED);
  });

  test("before and after: two pictures become a labelled pair once one is marked Before and the other After, and until then the marks are suggested", async ({ page }) => {
    // The sample with no picture marked, as an AI draft with the person's pictures added would be.
    const sample = sampleDoc("before-after");
    const unmarked: ExhbtDoc = { ...sample, sections: sample.sections.map((s) => (s.kind === "image" ? { ...s, stage: undefined } : s)) };
    await openDoc(page, freshName("rowsba"), unmarked);
    const art = previewArticle(page);
    await expect(art).toHaveAttribute("data-format", "before-after");
    const pairs = art.getByRole("group", { name: "Before and after" });
    await expect(pairs).toHaveCount(0);
    const NEED = "Mark one image Before and one After.";
    expect(await suggested(page)).toContain(NEED);

    // The marks are the person's: Before on the first picture, After on the second.
    await pressTool(page, "Image 1", "Before");
    expect((await docNow(page)).sections.find((s) => s.id === "image-1")).toMatchObject({ stage: "before" });
    await expect(pairs).toHaveCount(0);
    await pressTool(page, "Image 2", "After");
    await expect(pairs).toHaveCount(1);
    await expect(pairs.locator("[data-section-id]")).toHaveCount(2);
    await expect(pairs.locator('[data-section-id="image-1"]')).toHaveCount(1);
    await expect(pairs.locator('[data-section-id="image-2"]')).toHaveCount(1);
    expect(await suggested(page)).not.toContain(NEED);

    // One link and one graph, and room for more pictures (it has four of six).
    const menu = await plusMenu(page);
    expect(menu).toEqual(await offeredNow(page));
    expect(menu.find((o) => o.kind === "link")).toMatchObject({ off: true, full: "One link in a before and after" });
    expect(menu.find((o) => o.kind === "image")).toMatchObject({ off: false });

    // What else it usually has, each in its own words: two pictures, and what changed.
    await page.evaluate(() => ["image-2", "image-3", "image-4", "findings"].forEach((id) => window.__exhbtEditor!.remove(id)));
    const fix = await suggested(page);
    expect(fix).toContain("A before and after works best with at least 2 images.");
    expect(fix).toContain("Add what changed and why.");
  });

  test("event: the poster as the lead, the other pictures in a grid, My role in the sidebar; it suggests a picture and a role", async ({ page }) => {
    await openDoc(page, freshName("rowsevent"), sampleDoc("event"));
    const art = previewArticle(page);
    await expect(art).toHaveAttribute("data-format", "event");
    await expect(art.locator('[data-part="lead"]')).toHaveCount(1);
    const grid = art.locator('ul[data-part="grid"]');
    await expect(grid.locator("[data-section-id]")).toHaveCount(2);
    const role = page.locator(`${READY} #myRole`);
    await expect(role).toHaveValue("Stage manager");

    const menu = await plusMenu(page);
    expect(menu).toEqual(await offeredNow(page));
    expect(menu.find((o) => o.kind === "link")).toMatchObject({ off: true, full: "Up to 2 links in an event" });
    expect(menu.find((o) => o.kind === "image")).toMatchObject({ off: false });

    // No role: it suggests one, and says so. Typing one clears it.
    const NEED = "Say what your role was.";
    expect(await suggested(page)).not.toContain(NEED);
    await role.fill("");
    await expect.poll(async () => (await docNow(page)).myRole ?? "").toBe("");
    expect(await suggested(page)).toContain(NEED);
    await role.fill("Producer");
    await expect.poll(async () => (await docNow(page)).myRole).toBe("Producer");
    expect(await suggested(page)).not.toContain(NEED);

    // And with no picture at all, its other suggestion.
    await page.evaluate(() => ["image-1", "image-2", "image-3"].forEach((id) => window.__exhbtEditor!.remove(id)));
    expect(await suggested(page)).toContain("Add at least one picture, such as the poster.");
  });
});

/* ---------------- The classic editor and the four layouts ---------------- */

// The classic editor has no way to edit what the four layouts add (My role, the pull quote, the Before and After
// marks, a source with no address), so a person there could pick one and never be able to publish. It therefore
// never offers them: its picker lists the three of decision 0024 (CLASSIC_FORMATS), plus the exhbt's own layout
// when that is already one of the four. Every test here pins the classic editor for its browser
// (/dev/editor?kind=classic stands in for EXHBT_EDITOR), which is the state the live site ships in (DEFAULT_EDITOR).
test.describe("The classic editor and the four layouts", () => {
  const CLASSIC_READY = '[data-editor="classic"] [data-ready=true]';
  const NEW_READY = '[data-editor="page"][data-ready="true"]';
  const WAY = "Open it in the new editor";
  const line = (f: Format) => `The ${FORMAT_RULES[f].name} layout is edited in the new editor. If you switch layout here, only the new editor can switch it back.`;

  /** What EXHBT_EDITOR says, for this browser. */
  async function sayVariable(page: Page, variable: "classic" | "page") {
    expect(await (await page.request.get(`/dev/editor?kind=${variable}`)).json()).toEqual({ editor: variable });
  }

  /** Stores a layout's sample for a fresh person, signs them in and returns the exhbt's id. */
  async function personWith(page: Page, tag: string, f: Format, opts: { admin?: boolean } = {}): Promise<string> {
    const username = freshName(tag);
    const res = await page.request.post("/dev/parity", { data: { username, slug: "kept", doc: sampleDoc(f) } });
    expect(res.status(), await res.text()).toBe(200);
    const { id } = (await res.json()) as { id: string };
    await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
    await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
    if (opts.admin) expect((await page.request.get("/dev/admin?role=admin")).status()).toBe(200);
    return id;
  }

  const layouts = (page: Page) => page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio");
  const names = (page: Page) => page.getByRole("radiogroup", { name: "Layout" }).locator("label span.font-semibold").allTextContents();

  test("a case study there is offered the three layouts and no more, whatever the new editor offers", async ({ page }) => {
    await sayVariable(page, "classic");
    const id = await personWith(page, "three", "case-study");
    await page.goto(`/exhbts/${id}/edit`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    expect(await names(page)).toEqual(CLASSIC_FORMATS.map((f) => FORMAT_RULES[f].name));
    await expect(page.locator("[data-new-editor-layout]")).toHaveCount(0);
  });

  for (const f of NEW_FOUR) {
    test(`${f}: opened there, it keeps its layout and all its data, is listed with the three, and says where it is edited`, async ({ page }) => {
      await sayVariable(page, "classic");
      const id = await personWith(page, `kept${f}`, f);
      const before = (await readStored(page, id)).working;
      await page.goto(`/exhbts/${id}/edit`);
      await expect(page.locator(CLASSIC_READY)).toBeAttached();

      // The three, then its own, which is the one selected.
      expect(await names(page)).toEqual([...CLASSIC_FORMATS, f].map((k) => FORMAT_RULES[k].name));
      await expect(layouts(page).nth(3)).toBeChecked();
      // One plain line, and no way to an editor this person can't use.
      const said = page.locator("[data-new-editor-layout]");
      await expect(said).toHaveText(line(f));
      await expect(page.getByText(WAY)).toHaveCount(0);

      // An edit is saved (the stored layout is let through), and nothing the classic editor can't edit is lost.
      await page.locator("#title").fill("A new title, typed in the classic editor");
      await classicEditor.waitForSaved(page);
      await expect.poll(async () => (await readStored(page, id)).working.title).toBe("A new title, typed in the classic editor");
      const after = (await readStored(page, id)).working;
      expect(after.format).toBe(f);
      expect(after.myRole).toBe(before.myRole);
      expect(after.sections).toEqual(before.sections);
      await expect(page.getByText("That layout isn't available yet.")).toHaveCount(0);
    });
  }

  test("an admin whose editor is the classic one gets the way there, and it opens the same exhbt in the new editor", async ({ page }) => {
    await sayVariable(page, "classic");
    const id = await personWith(page, "adminway", "essay", { admin: true });
    await page.goto(`/exhbts/${id}/edit`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    const said = page.locator("[data-new-editor-layout]");
    await expect(said).toContainText(line("essay"));
    await said.getByRole("button", { name: WAY, exact: true }).click();
    await expect(page.locator(NEW_READY)).toBeAttached();
    expect(new URL(page.url()).pathname).toBe(`/exhbts/${id}/edit`);
    expect((await readStored(page, id)).working.format).toBe("essay");
  });

  test("switching away from one of the four there is said to be one way, offers no Undo the server would refuse, and is saved", async ({ page }) => {
    await sayVariable(page, "classic");
    const id = await personWith(page, "oneway", "essay");
    const before = (await readStored(page, id)).working;
    await page.goto(`/exhbts/${id}/edit`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    await page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name: "Gallery" }).check();
    const status = page.locator("#card-layout [role=status]");
    await expect(status).toContainText("Switched to Gallery. Nothing was deleted.");
    await expect(status).toContainText("Only the new editor can switch it back to Essay.");
    await expect(status.getByRole("button", { name: /Undo/ })).toHaveCount(0);
    // The essay is no longer listed: this editor offers the three.
    expect(await names(page)).toEqual(CLASSIC_FORMATS.map((f) => FORMAT_RULES[f].name));
    await expect(page.locator("[data-new-editor-layout]")).toHaveCount(0);
    await classicEditor.waitForSaved(page);
    await expect.poll(async () => (await readStored(page, id)).working.format).toBe("gallery");
    // Nothing was deleted: the pull quote and the source with no address are kept, not shown.
    expect((await readStored(page, id)).working.sections).toEqual(before.sections);
  });

  test("a person whose editor is the new one, in the classic editor for a visit, gets a link back to it", async ({ page }) => {
    await sayVariable(page, "page");
    const id = await personWith(page, "visitway", "event");
    await page.goto(`/exhbts/${id}/edit?editor=classic`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    const said = page.locator("[data-new-editor-layout]");
    await expect(said).toContainText(line("event"));
    // The picker is the classic editor's own, so it still offers the three and this exhbt's layout.
    expect(await names(page)).toEqual([...CLASSIC_FORMATS, "event" as const].map((k) => FORMAT_RULES[k].name));
    await said.getByRole("link", { name: WAY, exact: true }).click();
    await expect(page.locator(NEW_READY)).toBeAttached();
    expect(new URL(page.url()).pathname).toBe(`/exhbts/${id}/edit`);
  });
});
