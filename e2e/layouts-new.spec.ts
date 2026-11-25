import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LIMITS, validateForPublish, wordCount, type ExhbtDoc } from "../lib/exhbt/blocks";
import { CLASSIC_FORMATS, FORMAT_RULES, type Format } from "../lib/exhbt/formats";
import { beforeAfterDoc, buildDoc, essayDoc, eventDoc } from "../lib/exhbt/sample";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import * as classicEditor from "./editor-classic-helpers";
import { freshName, readStored, sampleDoc } from "./page-editor";

/*
 * The four layouts of decision 0028 (brief D): a fictional sample for each, near the 200-word cap
 * and as full as a real one, seeded by /dev/portfolio?with=layouts&plan=max&count=0. Each is
 * checked as a doc (publishable, within the cap), drawn in its usual order, printed on one A4
 * page in every look, axe-clean in every look, and without sideways scroll at 390px.
 *
 * Then release 4 (brief M): the classic editor never offers the four and keeps an exhbt that is one.
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
