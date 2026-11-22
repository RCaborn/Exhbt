import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SCHEMA_VERSION, text, type ContentSection, type ExhbtDoc, type Section } from "../lib/exhbt/blocks";
import type { Format } from "../lib/exhbt/formats";
import { tileFromDoc } from "../lib/exhbt/headline";
import { ExhbtTile } from "../components/exhbt/ExhbtTile";
import { SEL, waitForSave } from "./editor-classic-helpers";

// The classic editor keeps what it does not edit (docs/briefs/edit-on-page/r2-e-classic-editor.md): a flowchart
// that has been moved or removed, a pull quote, a before or after mark, My role, a link with no address and a
// layout the picker no longer offers all open, take an edit and save without losing any of it.
//
// Each test seeds its exhbt with POST /dev/parity (a fresh username each), then signs in with /auth/dev, never
// with signInAs (it clears the user's exhbts). `?editor=classic` keeps the spec on the classic editor once the
// edit page can serve the other one (release 3).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const FLOW = { id: "flow", kind: "flow" } as const;

const findings = (): ContentSection => ({ id: "findings", kind: "findings", items: [text("Waits fell from 11 to 4 minutes."), text("Sales held steady.")] });
const quote = (): ContentSection => ({ id: "quote-1", kind: "quote", text: "Lunch is calmer now.", name: "Priya Shah", role: "Manager" });
const reflection = (): ContentSection => ({ id: "reflection-1", kind: "reflection", text: text("Time the evening queue too.") });
const image = (n: number, stage?: "before" | "after"): ContentSection => ({ id: `image-${n}`, kind: "image", fileId: "x", alt: `Picture ${n}`, caption: text(`Caption ${n}`), w: 1200, h: 800, ...(stage ? { stage } : {}) });

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

type Stored = ExhbtDoc & Record<string, unknown>;

/** Stores the exhbt for a fresh user, signs in as them and opens the classic editor on it. */
async function open(page: Page, tag: string, doc: ExhbtDoc): Promise<{ id: string; username: string }> {
  const username = `${tag}${Math.random().toString(36).slice(2, 7)}`;
  const res = await page.request.post("/dev/parity", { data: { username, slug: "queues", doc } });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", SEL.listHeading)).toBeVisible();
  await page.goto(`/exhbts/${id}/edit?editor=classic`);
  await expect(page.getByRole("heading", SEL.editHeading)).toBeVisible();
  await expect(page.locator(SEL.ready).first()).toBeAttached();
  // The rich text fields load in their own chunk after the page; the gap card is called Context, The brief and so on by layout.
  await expect(page.locator("[role=textbox]").first()).toBeVisible();
  return { id, username };
}

async function stored(request: APIRequestContext, id: string): Promise<Stored> {
  const res = await request.get(`/dev/parity?id=${id}`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { working: Stored }).working;
}

/** The parts of the preview that matter here, in page order. */
async function previewParts(page: Page, names: string[]): Promise<string[]> {
  const all = await page.locator(`${SEL.previewArticle} [data-part]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-part") ?? ""));
  return all.filter((p) => names.includes(p));
}

const ids = (d: { sections: Section[] }) => d.sections.map((s) => s.id);
const FLOW_PART = ['article [data-part="process"]', 'article [data-part="did"]'].join(", ");

/** Types a new title, waits for the save and returns the stored doc. The title is the only edit. */
async function retitle(page: Page, id: string, title: string): Promise<{ before: Stored; after: Stored }> {
  const before = await stored(page.request, id);
  await page.locator(SEL.titleField).fill(title);
  await waitForSave(page);
  return { before, after: await stored(page.request, id) };
}

test.describe("a flowchart that has been moved", () => {
  const sections = (): Section[] => [findings(), quote(), FLOW, reflection()];

  test("it is drawn where it is, listed as a Flowchart row, and survives a save", async ({ page }) => {
    const { id } = await open(page, "mv", core(sections()));
    expect(await previewParts(page, ["findings", "quote", "process", "reflection"])).toEqual(["findings", "quote", "process", "reflection"]);

    const rows = page.locator(SEL.sectionOrderList);
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(2)).toHaveAttribute("data-kind", "flow");
    await expect(rows.nth(2).getByRole("heading", { name: "Flowchart" })).toBeVisible();
    await expect(rows.nth(2).getByText("Edit its boxes in the card above.")).toBeVisible();
    await expect(rows.nth(2).getByRole("button", { name: /^Remove/ })).toHaveCount(0);
    await expect(rows.nth(2).locator("input, textarea, [role=textbox]")).toHaveCount(0);
    // The other cards keep their names and numbering.
    await expect(rows.nth(3).getByRole("heading", { name: "What I'd do next" })).toBeVisible();

    const { before, after } = await retitle(page, id, "Shorter lunch queues");
    expect(ids(after)).toEqual(["findings", "quote-1", "flow", "reflection-1"]);
    expect(after).toEqual({ ...before, title: "Shorter lunch queues" });
  });

  test("moving the row moves the flowchart on the page and in the stored doc", async ({ page }) => {
    const { id } = await open(page, "mu", core(sections()));
    await page.getByRole("button", { name: "Move flowchart up" }).click();
    await waitForSave(page);
    expect(await previewParts(page, ["findings", "quote", "process", "reflection"])).toEqual(["findings", "process", "quote", "reflection"]);
    expect(ids(await stored(page.request, id))).toEqual(["findings", "flow", "quote-1", "reflection-1"]);

    await page.getByRole("button", { name: "Move flowchart down" }).click();
    await page.getByRole("button", { name: "Move flowchart down" }).click();
    await waitForSave(page);
    expect(await previewParts(page, ["findings", "quote", "process", "reflection"])).toEqual(["findings", "quote", "reflection", "process"]);
    expect(ids(await stored(page.request, id))).toEqual(["findings", "quote-1", "reflection-1", "flow"]);
  });

  test("Arrange sections is not offered on an arranged exhbt, and still is on an untouched case study", async ({ page }) => {
    await open(page, "ar", core(sections()));
    await expect(page.getByRole("region", { name: SEL.previewRegion })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arrange sections" })).toHaveCount(0);
  });

  test("an untouched case study still offers Arrange sections", async ({ page }) => {
    await open(page, "un", core([findings(), quote(), reflection()]));
    await expect(page.getByRole("button", { name: "Arrange sections" })).toBeVisible();
  });
});

test.describe("a flowchart taken off the page", () => {
  // The person's own order: not the gallery's usual one (image, flowchart, what happened, more pictures, the rest).
  const sections = (): Section[] => [image(1), reflection(), findings(), image(2)];
  const doc = () => core(sections(), "gallery", { flowOff: true });

  test("is off the preview, says so, and Put the flowchart back puts it at its usual place and keeps the order", async ({ page }) => {
    const { id } = await open(page, "fo", doc());
    await expect(page.locator(`${SEL.previewArticle}`)).toBeVisible();
    await expect(page.locator(FLOW_PART)).toHaveCount(0);
    await expect(page.getByText("The flowchart is off the page.")).toBeVisible();
    // Its boxes stay editable.
    await expect(page.getByLabel(SEL.boxLabel(1), { exact: true })).toHaveValue("Timed it");
    const rows = page.locator(SEL.sectionOrderList);
    await expect(rows).toHaveCount(4);
    const order = async () => (await previewParts(page, ["lead", "did", "process", "happened", "findings", "reflection", "grid", "image"])).filter((p) => p !== "process");

    const orderBefore = await order();
    await page.getByRole("button", { name: "Put the flowchart back" }).click();
    await waitForSave(page);

    await expect(page.getByText("The flowchart is off the page.")).toHaveCount(0);
    await expect(page.locator(FLOW_PART)).toHaveCount(1);
    await expect(rows).toHaveCount(5);
    const after = await stored(page.request, id);
    // Straight after the lead image: the flowchart's place in a gallery's usual order.
    expect(ids(after)).toEqual(["image-1", "flow", "reflection-1", "findings", "image-2"]);
    expect("flowOff" in after).toBe(false);
    // Everything else is in the order it was in.
    expect(ids(after).filter((s) => s !== "flow")).toEqual(["image-1", "reflection-1", "findings", "image-2"]);
    expect((await order()).filter((p) => p !== "did")).toEqual(orderBefore.filter((p) => p !== "did"));
  });

  test("an edit while it is off keeps it off and keeps the order", async ({ page }) => {
    const { id } = await open(page, "fk", doc());
    const { before, after } = await retitle(page, id, "Freshers' Week campaign");
    expect(after.flowOff).toBe(true);
    expect(ids(after)).toEqual(ids(before));
    expect(after).toEqual({ ...before, title: "Freshers' Week campaign" });
  });

  test("the flowchart row and the note pass axe", async ({ page }) => {
    await open(page, "ax", doc());
    await expect(page.getByText("The flowchart is off the page.")).toBeVisible();
    let { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `off ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);

    await page.getByRole("button", { name: "Put the flowchart back" }).click();
    await expect(page.locator(SEL.sectionOrderList).nth(1)).toHaveAttribute("data-kind", "flow");
    ({ violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze());
    expect(violations.map((v) => `row ${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("a card for it draws no empty methodology strip", () => {
    const off = tileFromDoc(core(sections(), "gallery", { flowOff: true }));
    const on = tileFromDoc(core(sections(), "gallery"));
    // ExhbtTile has no hooks, so it is called as a function and its element tree searched (Playwright compiles JSX
    // to its own objects, which React's renderer cannot draw).
    const tile = (e: typeof off) => ExhbtTile({ exhbt: e, href: "/p/amara/queues", position: 1 });
    const hasStrip = (node: unknown, depth = 0): boolean => {
      if (!node || typeof node !== "object" || depth > 40) return false;
      if (Array.isArray(node)) return node.some((n) => hasStrip(n, depth + 1));
      const props = (node as { props?: Record<string, unknown> }).props;
      if (props?.["aria-label"] === "Methodology") return true;
      return props ? hasStrip(props.children, depth + 1) : false;
    };
    expect(hasStrip(tile(off))).toBe(false);
    expect(hasStrip(tile(on))).toBe(true);
  });
});

test.describe("My role", () => {
  test("is not offered on a case study that has none", async ({ page }) => {
    await open(page, "r0", core([findings()]));
    await expect(page.locator("#whereWhen")).toBeVisible();
    await expect(page.locator("#myRole")).toHaveCount(0);
    await expect(page.getByLabel("My role (optional)")).toHaveCount(0);
  });

  test("is offered where the exhbt already has one", async ({ page }) => {
    await open(page, "r1", core([findings()], undefined, { myRole: "Lead analyst" }));
    await expect(page.getByLabel("My role (optional)")).toHaveValue("Lead analyst");
  });

  test("is offered in an event, with a count of its characters", async ({ page }) => {
    await open(page, "r2", core([image(1), findings()], "event"));
    await expect(page.getByLabel("My role (optional)")).toBeVisible();
    await expect(page.getByLabel("My role (optional)")).toHaveValue("");
  });
});

test.describe("what the other layouts write survives a visit", () => {
  test("an essay: a pull quote and a source with no address", async ({ page }) => {
    const doc = core(
      [
        findings(),
        { id: "pullquote-1", kind: "pullquote", text: "The law moved before the people did." },
        { id: "link-1", kind: "link", href: "", label: "Hansard, 3 March 1965", description: "" },
      ],
      "essay",
    );
    const { id } = await open(page, "es", doc);
    // The picker lists the layout in use even though it is not offered yet.
    await expect(page.getByRole("radio", { name: /^Essay/ })).toBeChecked();
    await expect(page.getByRole("heading", { name: "Pull quote" })).toBeVisible();
    await expect(page.getByLabel("Web address (optional)")).toHaveValue("");

    const { before, after } = await retitle(page, id, "Did the law lead?");
    expect(after).toEqual({ ...before, title: "Did the law lead?" });
    expect(after.format).toBe("essay");
    const sections = after.sections as Section[];
    expect(sections.find((s) => s.kind === "pullquote")).toMatchObject({ text: "The law moved before the people did." });
    expect(sections.find((s) => s.kind === "link")).toMatchObject({ href: "", label: "Hansard, 3 March 1965" });

    // Its minimal field is editable, and a source can be left with no address.
    await page.getByLabel("The pull quote").fill("Courts follow, they rarely lead.");
    await waitForSave(page);
    const edited = await stored(page.request, id);
    expect((edited.sections as Section[]).find((s) => s.kind === "pullquote")).toMatchObject({ text: "Courts follow, they rarely lead." });
    expect((edited.sections as Section[]).find((s) => s.kind === "link")).toMatchObject({ href: "" });
  });

  test("a before and after: each image's mark", async ({ page }) => {
    const doc = core([image(1, "before"), image(2, "after"), findings()], "before-after");
    const { id } = await open(page, "ba", doc);
    const mark = (n: number) => page.getByRole("group", { name: `Image ${n}: before or after` });
    await expect(mark(1).getByRole("radio", { name: "Before" })).toBeChecked();
    await expect(mark(2).getByRole("radio", { name: "After" })).toBeChecked();

    const { before, after } = await retitle(page, id, "The booking page, redesigned");
    expect(after).toEqual({ ...before, title: "The booking page, redesigned" });
    const stages = (d: Stored) => (d.sections as Section[]).flatMap((s) => (s.kind === "image" ? [s.stage ?? null] : []));
    expect(stages(after)).toEqual(["before", "after"]);

    // The choice is editable: swap them, then take one off.
    await mark(1).getByRole("radio", { name: "After" }).check();
    await mark(2).getByRole("radio", { name: "Before" }).check();
    await waitForSave(page);
    expect(stages(await stored(page.request, id))).toEqual(["after", "before"]);
    await mark(1).getByRole("radio", { name: "Neither" }).check();
    await waitForSave(page);
    expect(stages(await stored(page.request, id))).toEqual([null, "before"]);
  });

  test("an event: My role", async ({ page }) => {
    const doc = core([image(1), findings()], "event", { myRole: "Producer" });
    const { id } = await open(page, "ev", doc);
    await expect(page.getByLabel("My role (optional)")).toHaveValue("Producer");
    const { before, after } = await retitle(page, id, "Spring concert");
    expect(after).toEqual({ ...before, title: "Spring concert" });
    expect(after.myRole).toBe("Producer");

    await page.getByLabel("My role (optional)").fill("Stage manager");
    await waitForSave(page);
    expect((await stored(page.request, id)).myRole).toBe("Stage manager");
    // Cleared, the field stays and the value is an empty string.
    await page.getByLabel("My role (optional)").fill("");
    await waitForSave(page);
    await expect(page.getByLabel("My role (optional)")).toBeVisible();
    expect((await stored(page.request, id)).myRole).toBe("");
  });

  test("one exhbt with every new thing in it keeps them all", async ({ page }) => {
    const doc = core(
      [
        image(1, "before"),
        FLOW,
        image(2, "after"),
        { id: "pullquote-1", kind: "pullquote", text: "Used and not wanted." },
        findings(),
        { id: "link-1", kind: "link", href: "", label: "Notes", description: "" },
      ],
      "before-after",
      { myRole: "Designer" },
    );
    const { id } = await open(page, "al", doc);
    const { before, after } = await retitle(page, id, "Room booking, redesigned");
    expect(after).toEqual({ ...before, title: "Room booking, redesigned" });
    expect(ids(after)).toEqual(["image-1", "flow", "image-2", "pullquote-1", "findings", "link-1"]);
  });
});
