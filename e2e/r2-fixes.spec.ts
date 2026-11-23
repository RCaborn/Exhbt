import { expect, test, type Page } from "@playwright/test";
import { aiVersionOf, applyBlock, readAiVersion } from "../lib/exhbt/draft-blocks";
import { emptyDoc, SCHEMA_VERSION, text, type Chart, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import { mayCarryFormat, OFFERED_FORMATS } from "../lib/exhbt/formats";
import { withWorkVisual } from "../lib/exhbt/sections";
import { pathOfNumber, unverifiedNumbers } from "../lib/exhbt/verify";
import { fitCaption } from "../lib/figures/rules";
import { fillValid, signInAs, startFromScratch, waitForSaved } from "./editor";
import { uniqueEmail } from "./helpers";

// The fixes from the release 2 review: the server holds the layout line (model-1), the figure route is
// safe to call at any time (figure-1), the alt text's numbers are checked (figure-2), a failed pick
// isn't counted (figure-3), the scan wording and the neutral label (figure-5), captions are cut at a
// clause (job 1, item 6) and the findings go after the flowchart's marker (model-2).

const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const chartA: Chart = { kind: "bar", title: "Missed appointments", rows: [{ label: "Before", value: 7.9 }, { label: "After", value: 6.5 }] };
const chartB: Chart = { kind: "bar", title: "By practice", rows: [{ label: "North", value: 11.2 }, { label: "South", value: 8.4 }] };
const graph = (id: string, chart: Chart): Section => ({ id, kind: "graph", chart });
const flowMarker = { id: "flow", kind: "flow" } as const;

/* ---------------- Pure ---------------- */

test.describe("Captions are cut where a clause ends", () => {
  test("the two captions the real run cut mid-phrase", () => {
    const a = fitCaption("Mean number of words recalled out of 40, by condition (n = 24 in each condition)", 15);
    expect(a).toBe("Mean number of words recalled out of 40");
    const b = fitCaption("Figure 1. The parts of the booking system, shown as a flow of four connected steps from request to confirmation", 15);
    expect(b).toBe("Figure 1. The parts of the booking system");
    for (const c of [a, b]) {
      expect(c).not.toMatch(/[,;:]$/);
      expect((c.match(/\(/g) ?? []).length).toBe((c.match(/\)/g) ?? []).length);
    }
  });

  test("a caption that fits is left alone, words are only taken away, and nothing hangs open", () => {
    expect(fitCaption("  Missed   appointments, by month. ", 15)).toBe("Missed appointments, by month.");
    const long = "Waits at the till before and after the second till opened (weekday lunchtimes, 12 to 2, over four weeks) and sales";
    const cut = fitCaption(long, 15);
    expect(long.startsWith(cut)).toBe(true);
    expect(cut.split(" ").length).toBeLessThanOrEqual(15);
    expect((cut.match(/\(/g) ?? []).length).toBe((cut.match(/\)/g) ?? []).length);
    // No clause to stop at: cut at the limit, still never into an open bracket.
    expect(fitCaption("one two three four five six (seven eight nine ten eleven twelve", 10)).toBe("one two three four five six");
    expect(fitCaption("a b c d e f g h i j k l m n o p q", 15).split(" ")).toHaveLength(15);
  });
});

test.describe("The server holds the layout line", () => {
  test("only an offered layout, or the one already stored, may be saved or published", () => {
    expect(OFFERED_FORMATS).toEqual(["case-study", "gallery", "research"]);
    for (const f of ["build", "essay", "before-after", "event"] as const) {
      expect(mayCarryFormat(f, "case-study")).toBe(false);
      expect(mayCarryFormat(f, "gallery")).toBe(false);
      // Already stored as that layout: kept working (a seed, or a draft made when it was offered).
      expect(mayCarryFormat(f, f)).toBe(true);
    }
    expect(mayCarryFormat("gallery", "case-study")).toBe(true);
    expect(mayCarryFormat("case-study", "essay")).toBe(true);
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

test.describe("A pick that fails isn't counted", () => {
  const ask = (page: Page, name: string) =>
    page.request.post("/api/exhbts/figure-pick", {
      multipart: { label: "File 1, page 3", hint: name, image: { name: "image-1.png", mimeType: "image/png", buffer: PNG } },
    });

  test("failures leave the allowance alone, and the label is neutral", async ({ page }) => {
    await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail("pickfail"))}&next=/exhbts/new`);
    // A free plan has one draft and two spare picks. Five failures would have used them all, and more.
    for (let i = 0; i < 5; i++) expect((await ask(page, "report-pick-fails.pdf, File 1, page 3")).status()).toBe(502);
    const ok = await ask(page, "report-with-chart.pdf, File 1, page 3");
    expect(ok.status()).toBe(200);
    // The stand-in's description names only the neutral label it was given, never the file.
    const answer = (await ok.json()) as { pick: { alt: string } };
    expect(answer.pick.alt).toContain("File 1, page 3");
    expect(answer.pick.alt).not.toContain("report-with-chart");
    // Successes are counted: this was the first of three.
    expect((await ask(page, "x")).status()).toBe(200);
    expect((await ask(page, "x")).status()).toBe(200);
    expect((await ask(page, "x")).status()).toBe(429);
  });
});

/* ---------------- The server actions ---------------- */

test.describe("A hand-built save or publish can't store a layout nothing offers", () => {
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

  test("saving an essay layout is refused and nothing is stored; the same request as a gallery is kept", async ({ page }) => {
    await signInAs(page, unique("layoutsave"), "premium");
    const id = await startFromScratch(page);
    const seen = await forceFormat(page, "essay");
    await page.locator("#title").fill("A title that triggers a save");
    await expect(page.getByText("That layout isn't available yet.")).toBeVisible({ timeout: 15_000 });
    expect(seen.rewritten).toBeGreaterThan(0);
    expect(await storedFormat(page, id)).toBeUndefined();
    // An offered layout goes through the same path.
    await page.unroute("**/exhbts/*/edit");
    await forceFormat(page, "gallery");
    await page.locator("#title").fill("A second title");
    await waitForSaved(page);
    expect(await storedFormat(page, id)).toBe("gallery");
  });

  test("publishing an essay layout is refused", async ({ page }) => {
    await signInAs(page, unique("layoutpub"), "premium");
    const id = await startFromScratch(page);
    await fillValid(page, "A page that could go live");
    await waitForSaved(page);
    await forceFormat(page, "build");
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("That layout isn't available yet.")).toBeVisible({ timeout: 15_000 });
    expect(await storedFormat(page, id)).toBeUndefined();
  });
});
