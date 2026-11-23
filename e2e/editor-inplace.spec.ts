import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { emptyDoc, plain, text, type ExhbtDoc, type RichText, type Section } from "../lib/exhbt/blocks";
import { FORMAT_RULES, formatOf } from "../lib/exhbt/formats";
import { flowShown, hasMarker, pageItems } from "../lib/exhbt/layouts";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { createFiles } from "../components/exhbt-editor/files";
import { createStore } from "../components/exhbt-editor/store-core";
import { undoneWords } from "../components/exhbt-editor/undo";
import { ORDER_FIXTURES } from "./fixtures/order-docs";
import {
  allowEditOnly,
  boxes,
  differences,
  docNow,
  field,
  frame,
  freshName,
  full,
  jump,
  offered,
  openDoc,
  openNew,
  openSeeded,
  openTiming,
  pageOrder,
  png,
  READY,
  readStored,
  sampleDoc,
  textbox,
  seeAsVisitor,
  settle,
  toolbarClashes,
  typeIn,
  undoLabel,
  waitLive,
  waitReady,
  waitSaved,
} from "./page-editor";

/*
 * The edit-on-page editor, typed in where the words sit (decision 0026): every field of 0026's table
 * is stored at its path; formatting survives; every kind of issue path lands on its target; Undo
 * reverses actions and keeps typing and the numbers to check; publishing keeps the order; a hidden
 * page keeps Undo working; the editing page is the visitor's box for box but for what 0026 allows by
 * name; the loading view is the editor's first view; the status line; a stale editor says so; axe.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _browser, ...PIXEL_7 } = devices["Pixel 7"];

/** What is stored at a path: a string, or a formatted text's words. */
function storedAt(doc: ExhbtDoc, path: string): string {
  const v = path.split(".").reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string, unknown>)[k] : undefined), doc);
  return Array.isArray(v) ? plain(v as RichText) : String(v ?? "");
}

/** The fields of 0026's table this doc's page has, by path. */
function fieldsOf(doc: ExhbtDoc): string[] {
  const out = ["title", "gap", "context", "whereWhen", "myRole"];
  if (flowShown(doc)) doc.flow.forEach((_, i) => out.push(`flow.${i}.step`, `flow.${i}.detail`));
  for (const it of pageItems(doc)) {
    if (it.kind === "flow") continue;
    const p = `sections.${it.index}`;
    const s = it.s;
    if (s.kind === "findings") s.items.forEach((_, k) => out.push(`${p}.items.${k}`));
    else if (s.kind === "image") out.push(`${p}.caption`);
    else if (s.kind === "quote") out.push(`${p}.text`, `${p}.name`, `${p}.role`);
    else if (s.kind === "reflection" || s.kind === "aim" || s.kind === "conclusion" || s.kind === "pullquote") out.push(`${p}.text`);
    else if (s.kind === "link") out.push(`${p}.label`, `${p}.description`);
  }
  return out;
}

/** axe on the editor, WCAG 2.1 A and AA. */
const scan = async (page: Page) => (await new AxeBuilder({ page }).include('[data-editor="page"]').withTags(WCAG).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);

/** Drafts an exhbt with the placeholder AI (so the parts it drafted have "More actions"), opens its editor, and returns its id. */
async function openDrafted(page: Page, tag: string, notes?: string): Promise<string> {
  await page.goto(`/auth/dev?email=${freshName(tag)}@example.com&next=/exhbts/new`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft an exhbt" })).toBeVisible();
  const res = await page.request.post("/api/exhbts/draft", {
    data: { text: "Final-year project on lunch queues. I timed the queue for two weeks, added a second till, and timed it again. Waits fell from 11 to 4 minutes.", notes },
  });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/exhbts/${id}/edit`);
  await waitReady(page);
  return id;
}

const pressUndo = async (page: Page) => {
  // The cursor out of any field: Ctrl or Cmd and Z is the editor's Undo there.
  await page.locator(`${READY} h1`).focus();
  await page.keyboard.press("ControlOrMeta+z");
};
const fileExists = async (page: Page, fileId: string) => (await page.request.get(`/dev/files/${fileId}`)).status() === 200;
/** A section's toolbar button, by name, with the pointer on the section; where the toolbar is the compact pair (23 Nov), from its More actions. */
const toolOf = async (page: Page, id: string, name: string) => {
  await frame(page, id).hover();
  if ((await frame(page, id).locator(":scope > .xe-tools").getAttribute("data-place")) === "compact") await frame(page, id).getByRole("button", { name: /^More actions for / }).click();
  return frame(page, id).getByRole("button", { name });
};
const removeVia = async (page: Page, id: string, label: string) => {
  await (await toolOf(page, id, `Remove ${label}`)).click();
};

test.describe("a new exhbt in the new editor", () => {
  test("opens in the new editor; the title, a box, a finding and the context line are typed in place, saved, and there after a reload", async ({ page }) => {
    const id = await openNew(page, freshName("inplace"));
    await expect(page.locator(READY)).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeVisible();

    await typeIn(page, "title", "Would a second till cut lunchtime queues?");
    await typeIn(page, "flow.0.step", "Timed the queue");
    await typeIn(page, "sections.0.items.0", "Waits fell from 11 to 4 minutes.");
    await typeIn(page, "gap", "Lunch queues ran past ten minutes.");
    await waitSaved(page, id);

    const stored = (await readStored(page, id)).working;
    expect(stored.title).toBe("Would a second till cut lunchtime queues?");
    expect(stored.flow[0]!.step).toBe("Timed the queue");
    expect(stored.sections[0]).toMatchObject({ kind: "findings", items: [[{ t: "Waits fell from 11 to 4 minutes." }], []] });
    expect(stored.gap).toEqual([{ t: "Lunch queues ran past ten minutes." }]);
    // Typing alone never writes the flowchart's marker (decision 0027).
    expect(hasMarker(stored)).toBe(false);
    expect(stored.flowOff).toBeUndefined();

    await page.reload();
    await waitReady(page);
    await expect(field(page, "title")).toHaveValue("Would a second till cut lunchtime queues?");
    await expect(field(page, "flow.0.step")).toHaveValue("Timed the queue");
    await expect(textbox(page, "sections.0.items.0")).toHaveText("Waits fell from 11 to 4 minutes.");
    await expect(textbox(page, "gap")).toHaveText("Lunch queues ran past ten minutes.");
  });

  test("Move down writes the marker; Undo puts the order back and takes the marker out", async ({ page }) => {
    const id = await openNew(page, freshName("undo"));
    const before = await docNow(page);
    expect(await pageOrder(page)).toEqual(["flow", "findings"]);

    await (await toolOf(page, "flow", "Move Flowchart down")).click();
    expect(await pageOrder(page)).toEqual(["findings", "flow"]);
    await waitSaved(page, id);
    const moved = (await readStored(page, id)).working;
    expect(hasMarker(moved)).toBe(true);
    expect(pageItems(moved).map((it) => it.id)).toEqual(["findings", "flow"]);
    expect(await undoLabel(page)).toBe("move flowchart");

    await pressUndo(page);
    expect(await pageOrder(page)).toEqual(["flow", "findings"]);
    await waitSaved(page, id);
    const undone = (await readStored(page, id)).working;
    expect(hasMarker(undone)).toBe(false);
    expect(undone.sections).toEqual(before.sections);
    expect(await undoLabel(page)).toBeNull();
  });

  test("text typed in the Add a skill box is kept as a skill when the person moves on, and stored", async ({ page }) => {
    const id = await openNew(page, freshName("skillblur"));
    const box = page.locator(`${READY} #skill-new`);
    await box.fill("Python");
    // No Enter, no comma: the focus just moves to the title.
    await page.locator(`${READY} [data-path="title"]`).first().click();
    await expect(box).toHaveValue("");
    await expect.poll(async () => (await docNow(page)).skills).toContain("Python");
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.skills).toContain("Python");
    // There is no Add button with a mouse: it is for touch screens.
    await expect(page.locator(`${READY} [data-path="skills"] button`, { hasText: /^Add/ })).toBeHidden();
  });

  test("a picture can be added: it goes on the page and is stored", async ({ page }) => {
    const id = await openNew(page, freshName("picture"));
    await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles({ name: "queue.png", mimeType: "image/png", buffer: png(4, 3) });
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(1);
    await expect(page.getByText("1 image added. Each one needs a description for people who can't see it.")).toBeVisible();
    await waitSaved(page, id);
    const images = (await readStored(page, id)).working.sections.filter((s) => s.kind === "image");
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ kind: "image", alt: "", w: 4, h: 3 });
    // Its description field is under it, named for the picture, with the cursor in it.
    await expect(page.getByRole("textbox", { name: "Image 1: describe it for people who can't see it" })).toBeFocused();
  });
});

for (const f of offered()) {
  test(`${FORMAT_RULES[f].name}: every field of 0026's table is typed in place and stored at its path`, async ({ page }) => {
    const { id } = await openDoc(page, freshName("fields"), full(sampleDoc(f)));
    const paths = fieldsOf(await docNow(page));
    expect(paths.length).toBeGreaterThan(10);
    for (const [i, path] of paths.entries()) await typeIn(page, path, `Words ${i + 1} typed`);
    await waitSaved(page, id);
    const stored = (await readStored(page, id)).working;
    for (const [i, path] of paths.entries()) expect(storedAt(stored, path), path).toBe(`Words ${i + 1} typed`);
  });
}

test("formatting survives: a finding with bold and a link keeps both after typing in it and after a reload", async ({ page }) => {
  const runs: RichText = [{ t: "Waits " }, { t: "fell", b: true }, { t: " (see " }, { t: "the log", href: "https://example.com/log" }, { t: ")" }];
  const doc: ExhbtDoc = { ...emptyDoc(), title: "Shorter queues", sections: [{ id: "findings", kind: "findings", items: [runs, text("Sales held steady.")] }] };
  const { id } = await openDoc(page, freshName("format"), doc);
  await typeIn(page, "sections.0.items.0", " today", { append: true });
  await waitSaved(page, id);
  const check = (items: RichText) => {
    expect(plain(items)).toBe("Waits fell (see the log) today");
    expect(items.find((r) => r.t === "fell")?.b).toBe(true);
    expect(items.find((r) => r.t === "the log")?.href).toBe("https://example.com/log");
  };
  check(((await readStored(page, id)).working.sections[0] as { items: RichText[] }).items[0]!);
  await page.reload();
  await waitReady(page);
  const f0 = field(page, "sections.0.items.0");
  await expect(f0.locator("strong", { hasText: "fell" })).toBeVisible();
  await expect(f0.locator('a[href="https://example.com/log"]')).toHaveText("the log");
  check(((await readStored(page, id)).working.sections[0] as { items: RichText[] }).items[0]!);
});

test.describe("each kind of issue path lands on its target", () => {
  const graphChart = { kind: "bar", title: "Queue time (%)", unit: "%", rows: [{ label: "Before", value: 40 }, { label: "After", value: 20 }] };
  const doc = (): ExhbtDoc => ({
    ...full({ ...emptyDoc(), title: "Shorter queues", skills: ["Excel"] }),
    flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
    sections: [
      { id: "findings", kind: "findings", items: [text("Waits fell."), text("Sales held.")] },
      { id: "graph-1", kind: "graph", chart: graphChart } as Section,
      { id: "image-1", kind: "image", fileId: "x", alt: "", caption: text("The queue"), w: 1200, h: 800 },
      { id: "link-1", kind: "link", href: "", label: "Model code", description: "On GitHub" },
    ],
  });
  const focused = (page: Page) => page.evaluate(() => ({ id: document.activeElement?.id ?? "", path: document.activeElement?.closest("[data-path]")?.getAttribute("data-path") ?? "", tag: document.activeElement?.tagName ?? "" }));

  test("fields on the page, in a popover and in a sheet, and the anchors for paths with no field", async ({ page }) => {
    await openDoc(page, freshName("jump"), doc());
    await jump(page, "title");
    expect((await focused(page)).id).toBe("title");
    await jump(page, "gap");
    await expect.poll(async () => (await focused(page)).path).toBe("gap");
    await jump(page, "flow.1.step");
    expect((await focused(page)).id).toBe("flow-box-1");
    await jump(page, "sections.0.items.1");
    await expect.poll(async () => (await focused(page)).path).toBe("sections.0.items.1");
    await jump(page, "sections.2.alt");
    expect((await focused(page)).id).toBe("image-0-alt");
    // A link's address is in a popover: it opens first.
    await jump(page, "sections.3.href");
    await expect(page.locator(`${READY} [popover]:popover-open input[data-path="sections.3.href"]`)).toBeFocused();
    await page.keyboard.press("Escape");
    // A graph's figures are in the chart sheet: it opens first.
    await jump(page, "sections.1.chart.rows.0.value");
    await expect(page.getByRole("dialog", { name: "Edit figures" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Paths with no field of their own land on their anchors.
    await jump(page, "skills");
    expect((await focused(page)).id).toBe("skill-new");
    await jump(page, "sections.0.items");
    await expect(page.locator(`${READY} [data-path="sections.0.items"] button`)).toBeFocused();
    await jump(page, "sections.1");
    await expect.poll(async () => (await focused(page)).path).toBe("sections.1");
    await jump(page, "sections");
    await expect(page.locator(`${READY} [data-path="sections"] button`)).toBeFocused();
    // Each jump says where it landed.
    const heard = await page.evaluate(
      () =>
        new Promise<string>((done) => {
          document.addEventListener("xe-jump", (e) => done((e as CustomEvent<{ path: string }>).detail.path), { once: true });
          window.__exhbtUi!.jumpTo("title");
        }),
    );
    expect(heard).toBe("title");
  });
});

test.describe("the store, in-process: a flowchart box's and a finding's actions, each undone after typing elsewhere", () => {
  const start = (): ExhbtDoc => ({
    ...emptyDoc(),
    title: "Queues",
    flow: [{ step: "One" }, { step: "Two" }, { step: "Three" }],
    sections: [{ id: "findings", kind: "findings", items: [text("First."), text("Second."), text("Third.")] }],
  });
  const steps = (d: ExhbtDoc) => d.flow.map((s) => s.step);
  const items = (d: ExhbtDoc) => (d.sections[0] as { items: RichText[] }).items.map(plain);

  test("a flowchart box added, removed and moved: Undo puts the boxes back and keeps the words typed since", () => {
    const s = createStore(start());
    const key = s.flowAdd(1)!;
    expect(steps(s.get())).toEqual(["One", "", "Two", "Three"]);
    expect(s.flowKeys()[1]).toBe(key);
    s.setAt("flow.0.step", "One, typed");
    s.undo();
    expect(steps(s.get())).toEqual(["One, typed", "Two", "Three"]);

    const two = s.flowKeys()[1]!;
    s.flowRemove(two);
    s.setAt("flow.1.step", "Three, typed");
    s.undo();
    expect(steps(s.get())).toEqual(["One, typed", "Two", "Three, typed"]);
    expect(s.flowKeys()[1]).toBe(two);

    const one = s.flowKeys()[0]!;
    s.flowMove(one, 2);
    expect(steps(s.get())).toEqual(["Two", "Three, typed", "One, typed"]);
    s.setAt("flow.0.step", "Two, typed");
    s.undo();
    expect(steps(s.get())).toEqual(["One, typed", "Two, typed", "Three, typed"]);
    expect(s.flowKeys()[0]).toBe(one);
    expect(s.undoLabel()).toBeNull();
  });

  test("a finding added, removed and moved: Undo puts them back and keeps the words typed since", () => {
    const s = createStore(start());
    s.listAdd("findings", 3);
    expect(items(s.get())).toEqual(["First.", "Second.", "Third.", ""]);
    s.setAt("sections.0.items.0", text("First, typed."));
    s.undo();
    expect(items(s.get())).toEqual(["First, typed.", "Second.", "Third."]);

    s.listRemove("findings", 1);
    s.setAt("sections.0.items.1", text("Third, typed."));
    s.undo();
    expect(items(s.get())).toEqual(["First, typed.", "Second.", "Third, typed."]);

    s.listMove("findings", 0, 2);
    s.setAt("sections.0.items.0", text("Second, typed."));
    s.undo();
    expect(items(s.get())).toEqual(["First, typed.", "Second, typed.", "Third, typed."]);
    expect(s.undoLabel()).toBeNull();
  });

  test("a structural undo writes back only the structure; a named patch only the fields it changed", () => {
    const s = createStore({ ...start(), sections: [...start().sections, { id: "quote-1", kind: "quote", text: "Calmer.", name: "Sam", role: "" }] });
    s.remove("quote-1");
    s.setAt("title", "Queues, typed");
    s.undo();
    expect([s.get().title, s.get().sections.some((x) => x.id === "quote-1"), hasMarker(s.get())]).toEqual(["Queues, typed", true, false]);
    s.patch("quote-1", (q) => (q.kind === "quote" ? { ...q, role: "Manager" } : q), "the role");
    s.setAt("sections.1.text", "Calmer, typed.");
    s.undo();
    expect(s.get().sections[1]).toMatchObject({ text: "Calmer, typed.", role: "" });
  });

  // The review's data-safety-5: "Back to the AI version" (or a rewrite) of the flowchart changes the number of boxes.
  const toTheAi = (s: ReturnType<typeof createStore>, steps: string[]) => s.patchDoc((d) => ({ ...d, flow: steps.map((step) => ({ step })) }), "back to the AI version of the method");

  test("a box added, then the flowchart put back to the AI version with fewer boxes: Undo puts the boxes back, then takes the added one out", () => {
    const s = createStore(start());
    const added = s.flowAdd(3)!;
    s.setAt("flow.3.step", "Four");
    toTheAi(s, ["A", "B"]);
    s.undo();
    expect(steps(s.get())).toEqual(["One", "Two", "Three", "Four"]);
    expect(s.flowKeys()[3]).toBe(added);
    expect(s.undoLabel()).toBe("add box 4");
    s.undo();
    expect(steps(s.get())).toEqual(["One", "Two", "Three"]);
    expect(s.undoLabel()).toBeNull();
  });

  test("a box moved to the end, then the flowchart rewritten to fewer boxes and to more: each Undo puts back what it should", () => {
    const s = createStore({ ...start(), flow: [{ step: "One" }, { step: "Two" }, { step: "Three" }, { step: "Four" }] });
    const one = s.flowKeys()[0]!;
    s.flowMove(one, 3);
    expect(steps(s.get())).toEqual(["Two", "Three", "Four", "One"]);
    toTheAi(s, ["A", "B", "C"]);
    toTheAi(s, ["A", "B", "C", "D", "E"]);
    s.undo();
    s.undo();
    expect(steps(s.get())).toEqual(["Two", "Three", "Four", "One"]);
    expect(s.flowKeys()[3]).toBe(one);
    s.undo();
    expect(steps(s.get())).toEqual(["One", "Two", "Three", "Four"]);
    expect(s.flowKeys()[0]).toBe(one);
  });

  test("an undo that can no longer be done is skipped, and Undo says so", () => {
    const s = createStore({ ...start(), sections: [...start().sections, { id: "quote-1", kind: "quote", text: "Calmer.", name: "Sam", role: "" }] });
    s.move("quote-1", 0);
    const moved = s.undoLabel()!;
    s.flowAdd(3);
    // The boxes change in number with no undo entry (nothing in the editor does this now): the added box's key goes.
    s.patchDoc((d) => ({ ...d, flow: d.flow.slice(0, 2) }));
    // Undo names what it will do, not the entry it has to skip.
    expect(s.undoLabel()).toBe(moved);
    const r = s.undo();
    expect(r).toEqual({ undone: moved, skipped: ["add box 4"], words: `Undone: ${moved}. Add box 4 can't be undone any more, so Undo skipped it.` });
    expect(s.get().sections.map((x) => x.id)).toEqual(["findings", "quote-1"]);
    expect(s.undoLabel()).toBeNull();
    expect(undoneWords({ undone: "remove quote", skipped: [] })).toBe("Undone: remove quote.");
    expect(undoneWords({ undone: null, skipped: ["add box 4", "move box 2"] })).toBe("Add box 4 and move box 2 can't be undone any more, so Undo skipped them.");
  });
});

test.describe("the files, in-process: an upload still waiting to be placed is never deleted (the review's data-safety-1)", () => {
  // The browser's fetch and createImageBitmap, stood in for: each upload gets the next id, and every DELETE is noted.
  const g = globalThis as unknown as Record<string, unknown>;
  let before: Record<string, unknown> = {};
  let deleted: string[] = [];
  let n = 0;
  test.beforeEach(() => {
    before = { fetch: g.fetch, createImageBitmap: g.createImageBitmap };
    deleted = [];
    n = 0;
    g.fetch = async (url: string, init?: RequestInit) => {
      if (url === "/api/files/upload-url") return Response.json({ fileId: `new-${++n}`, uploadUrl: "/put", headers: {} });
      if (init?.method === "DELETE") deleted.push(decodeURIComponent(url.split("/api/files/")[1]!));
      return Response.json({});
    };
  });
  test.afterEach(() => void Object.assign(g, before));
  const picture = (): ExhbtDoc => ({ ...emptyDoc(), sections: [{ id: "image-1", kind: "image", fileId: "old", alt: "The queue", caption: [] }] });
  const filesFor = (store: ReturnType<typeof createStore>, doc: ExhbtDoc) => createFiles({ store, exhbtId: "e", maxFileMb: 10, imageUrls: {}, liveFileIds: [], initialDoc: doc });

  test("a replaced picture: a save that lands while its size is read deletes neither file; the old one goes once the save without it lands", async () => {
    let sized: ((v: unknown) => void) | null = null;
    g.createImageBitmap = () => new Promise((r) => (sized = r));
    const doc = picture();
    const store = createStore(doc);
    const files = filesFor(store, doc);
    const done = files.replaceImage("image-1", new File([new Uint8Array(png(40, 10))], "b.png", { type: "image/png" }), { from: "report.pdf", page: 2, shareOk: false }, { describeAgain: false });
    // Uploaded, and its size being read: it is not on the page yet when this save lands.
    await expect.poll(() => sized !== null).toBe(true);
    files.noteSaved(store.get());
    expect(deleted).toEqual([]);
    sized!({ width: 40, height: 10, close() {} });
    await done;
    expect(store.get().sections[0]).toMatchObject({ fileId: "new-1", w: 40, h: 10 });
    files.noteSaved(store.get());
    expect(deleted).toEqual(["old"]);
  });

  test("a figure from the report: kept from its upload until it is placed; one that is never placed goes once it is let go", () => {
    const doc = emptyDoc();
    const store = createStore(doc);
    const files = filesFor(store, doc);
    files.addUploaded("figure", new Blob([new Uint8Array(png(40, 10))], { type: "image/png" }));
    // A save lands before the figure is on the page.
    files.noteSaved(store.get());
    expect(deleted).toEqual([]);
    expect(store.insertImage({ fileId: "figure", w: 40, h: 10 }, 0)).toBeTruthy();
    files.release("figure");
    files.noteSaved(store.get());
    expect(deleted).toEqual([]);
    // Taken, but there was no room for it after all: let go, the rule deletes it.
    files.addUploaded("spare", new Blob([new Uint8Array(png(40, 10))], { type: "image/png" }));
    files.settle();
    expect(deleted).toEqual([]);
    files.release("spare");
    files.settle();
    expect(deleted).toEqual(["spare"]);
  });
});

test.describe("undo", () => {
  test("remove and put back a quote: it comes back with its words, in its place", async ({ page }) => {
    const { id } = await openDoc(page, freshName("quote"), sampleDoc("case-study"));
    const order = await pageOrder(page);
    const quote = (await docNow(page)).sections.find((s) => s.kind === "quote")!;
    await removeVia(page, quote.id, "Quote");
    expect(await pageOrder(page)).not.toContain(quote.id);
    expect(await undoLabel(page)).toBe("remove quote");
    await pressUndo(page);
    expect(await pageOrder(page)).toEqual(order);
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.sections.find((s) => s.id === quote.id)).toEqual(quote);
  });

  test("remove and put back the flowchart, where the layout lets it go", async ({ page }) => {
    const gallery = sampleDoc("gallery");
    const { id } = await openDoc(page, freshName("flowoff"), gallery);
    const order = await pageOrder(page);
    await removeVia(page, "flow", "Flowchart");
    expect(await pageOrder(page)).not.toContain("flow");
    await waitSaved(page, id);
    const off = (await readStored(page, id)).working;
    expect([off.flowOff, hasMarker(off)]).toEqual([true, false]);
    // The boxes are kept while it is off the page.
    expect(off.flow).toEqual(gallery.flow);
    await pressUndo(page);
    expect(await pageOrder(page)).toEqual(order);
    await waitSaved(page, id);
    const back = (await readStored(page, id)).working;
    // Undoing the first structural change leaves the doc untouched again: no marker, no flowOff.
    expect([back.flowOff, hasMarker(back)]).toEqual([undefined, false]);
    expect(back.sections.map((s) => s.id)).toEqual(gallery.sections.map((s) => s.id));
  });

  test("a picture: its file is not deleted while Undo can bring it back, and is once it cannot", async ({ page }) => {
    const working: ExhbtDoc = { ...sampleDoc("case-study"), sections: [...sampleDoc("case-study").sections, { id: "image-1", kind: "image", fileId: "x", alt: "The queue", caption: text("Lunch"), w: 1200, h: 800 }] };
    // The published copy never had the picture, so only this editor's rule decides about its file.
    const { id, files } = await openDoc(page, freshName("file"), sampleDoc("case-study"), { working });
    const fileId = files["image-1"]!;
    expect(await fileExists(page, fileId)).toBe(true);
    await removeVia(page, "image-1", "Image");
    await waitSaved(page, id);
    // Saved without it, but Undo could still bring it back: the file stays.
    await page.waitForTimeout(500);
    expect(await fileExists(page, fileId)).toBe(true);
    await pressUndo(page);
    await expect(frame(page, "image-1")).toBeVisible();
    await removeVia(page, "image-1", "Image");
    // Thirty more steps push the removal off the end of the undo list: now nothing can bring it back.
    await page.evaluate(() => {
      const s = window.__exhbtEditor!;
      for (let i = 0; i < 30; i++) s.move("flow", i % 2);
    });
    await waitSaved(page, id);
    await expect.poll(() => fileExists(page, fileId)).toBe(false);
  });

  test("a layout switch and its Undo give back the layout and the order", async ({ page }) => {
    const doc = sampleDoc("case-study");
    const { id } = await openDoc(page, freshName("layout"), doc);
    const order = await pageOrder(page);
    await page.evaluate(() => window.__exhbtEditor!.setLayout("gallery"));
    await expect(page.locator(`${READY} article[data-format="gallery"]`)).toBeVisible();
    await waitSaved(page, id);
    expect(formatOf((await readStored(page, id)).working)).toBe("gallery");
    await pressUndo(page);
    await expect(page.locator(`${READY} article[data-format="case-study"]`)).toBeVisible();
    expect(await pageOrder(page)).toEqual(order);
    await waitSaved(page, id);
    const back = (await readStored(page, id)).working;
    expect([formatOf(back), hasMarker(back), back.sections.map((s) => s.id)]).toEqual(["case-study", false, doc.sections.map((s) => s.id)]);
  });

  test("the stand-in AI rewrites the method, without a keystroke: the flowchart's toolbar checks the new words against itself, and covers none of them", async ({ page }) => {
    // Research, so the flowchart's boxes run down its column and its toolbar has a clear place for any words the stand-in writes.
    await openDrafted(page, "rewrite", "stand-in: layout research");
    const tools = frame(page, "flow").locator(":scope > .xe-tools");
    // The flowchart's toolbar lies over its section (its row on its edge, or the compact pair), so its words are checked whenever they change.
    expect(["edge", "compact"]).toContain(await tools.getAttribute("data-place"));
    const checked = () => page.evaluate(() => (window as unknown as { __exhbtPlace: { checked: number } }).__exhbtPlace.checked);
    const before = await checked();
    // The AI's own More actions for the flowchart ("Method" in research), from the toolbar's More actions where it is the compact pair.
    await (await toolOf(page, "flow", "More actions for Method")).click();
    await frame(page, "flow").getByRole("button", { name: "Rewrite this block" }).click();
    await frame(page, "flow").getByRole("button", { name: "Rewrite the method now" }).click();
    await expect.poll(async () => (await docNow(page)).flow[0]?.step ?? "").toMatch(/^Preview rewrite/);
    await expect.poll(checked).toBeGreaterThan(before);
    // A press outside closes the menus; the flowchart's toolbar, where it is drawn now, covers none of the new words, nor anything else.
    await page.mouse.click(4, 400);
    await expect(tools).not.toHaveAttribute("data-open", "");
    expect((await toolbarClashes(page)).filter((c) => /^(Drag Flowchart|Move Flowchart|Remove Flowchart|More actions for Flowchart)/.test(c))).toEqual([]);
  });

  test("undo keeps typing and the numbers to check: back to the AI version, type in the title, Undo", async ({ page }) => {
    // A drafted exhbt (the placeholder AI), so "More actions" has an AI version to go back to.
    const id = await openDrafted(page, "flags");
    const findingsId = (await docNow(page)).sections.find((s) => s.kind === "findings")!.id;
    // The findings now hold a number nobody checked: "18%", flagged.
    await page.evaluate((fid) => {
      const s = window.__exhbtEditor!;
      s.patchDoc((d) => ({ ...d, unverified: ["18%"], sections: d.sections.map((x) => (x.id === fid && x.kind === "findings" ? { ...x, items: [[{ t: "Waits fell by 18%." }], ...x.items.slice(1)] } : x)) }));
    }, findingsId);
    await frame(page, findingsId).hover();
    await frame(page, findingsId).getByRole("button", { name: /^More actions for/ }).click();
    await frame(page, findingsId).getByRole("button", { name: "Back to the AI version" }).click();
    // The AI's findings have no "18%", so the flag went with it.
    await expect.poll(async () => (await docNow(page)).unverified ?? []).toEqual([]);
    await typeIn(page, "title", "A title typed after the rewrite");
    await pressUndo(page);
    const now = await docNow(page);
    expect(now.title).toBe("A title typed after the rewrite");
    expect(plain((now.sections.find((s) => s.id === findingsId) as { items: RichText[] }).items[0]!)).toBe("Waits fell by 18%.");
    expect(now.unverified).toEqual(["18%"]);
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.unverified).toEqual(["18%"]);
  });

  test("undo of the first move: the order fixture comes back untouched, box for box", async ({ page }) => {
    const fixture = ORDER_FIXTURES.find((x) => x.name === "order-figure-before-findings")!;
    const { id } = await openDoc(page, freshName("first"), fixture.doc as ExhbtDoc);
    await settle(page);
    const before = await boxes(page);
    const stored = (await readStored(page, id)).working;
    await frame(page, "flow").hover();
    // Its three boxes in one row: the toolbar's row would cover the last box's words, so it is the compact pair (23 Nov), and Move down is in More actions.
    await expect(frame(page, "flow").locator(":scope > .xe-tools")).toHaveAttribute("data-place", "compact");
    await frame(page, "flow").getByRole("button", { name: "More actions for Flowchart" }).click();
    await frame(page, "flow").getByRole("button", { name: "Move Flowchart down" }).click();
    await waitSaved(page, id);
    expect(hasMarker((await readStored(page, id)).working)).toBe(true);
    await pressUndo(page);
    await waitSaved(page, id);
    const back = (await readStored(page, id)).working;
    expect(hasMarker(back)).toBe(false);
    expect(back.sections).toEqual(stored.sections);
    await settle(page);
    expect(differences(before, await boxes(page))).toEqual([]);
  });

  test("a hidden page keeps Undo working: remove a picture, save, hide and show, Undo", async ({ page }) => {
    const working: ExhbtDoc = { ...sampleDoc("case-study"), sections: [...sampleDoc("case-study").sections, { id: "image-1", kind: "image", fileId: "x", alt: "The queue", caption: text("Lunch"), w: 1200, h: 800 }] };
    const { id, files } = await openDoc(page, freshName("hidden"), sampleDoc("case-study"), { working });
    await removeVia(page, "image-1", "Image");
    await waitSaved(page, id);
    const flip = (state: "hidden" | "visible") =>
      page.evaluate((s) => {
        Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await flip("hidden");
    await page.waitForTimeout(300);
    await flip("visible");
    await pressUndo(page);
    const img = frame(page, "image-1").locator("img");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await fileExists(page, files["image-1"]!)).toBe(true);
  });
});

test("publishing keeps the order: an arranged doc goes live with its parts in the editor's order", async ({ page }) => {
  const base = sampleDoc("case-study");
  // The flowchart below the findings, a figure before the findings: an arranged doc.
  const graph = base.sections.find((s) => s.kind === "graph")!;
  const rest = base.sections.filter((s) => s.kind !== "graph" && s.kind !== "findings");
  const arranged: ExhbtDoc = { ...base, sections: [graph, base.sections.find((s) => s.kind === "findings")!, { id: "flow", kind: "flow" }, ...rest] };
  const username = freshName("live");
  const { url } = await openDoc(page, username, arranged, { slug: "arranged" });
  const parts = () => page.locator("article[data-exhbt-page] [data-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-part")));
  const editing = await parts();
  await page.getByRole("button", { name: "Review and publish" }).click();
  await page.getByLabel("This is my work, and the numbers are true").check();
  await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
  await expect(page.getByText(/^(It's live\.|Your changes are live\.)$/)).toBeVisible();
  await page.goto(url);
  expect(await parts()).toEqual(editing);
});

test.describe("box for box", () => {
  for (const look of PORTFOLIO_THEMES) {
    for (const f of offered()) {
      test(`a full ${FORMAT_RULES[f].name.toLowerCase()} in ${look.name || look.id}, at 1440 wide: the editing page is the visitor's but for the two edit-only fields`, async ({ page }) => {
        await openTiming(page, f, { full: true, look: look.id });
        await waitLive(page);
        await settle(page);
        // Each description is the last thing in its picture's figure, and adds exactly its own line to it.
        const figures = () => page.evaluate(() => [...document.querySelectorAll('[data-editor="page"] article figure')].map((fig) => fig.getBoundingClientRect().height));
        const own = await page.evaluate(() =>
          [...document.querySelectorAll('[data-editor="page"] article figure')].map((fig) => {
            const el = fig.querySelector(':scope > [data-edit-only="image-description"]');
            return el && fig.lastElementChild === el ? el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginTop) : 0;
          }),
        );
        const withThem = await figures();
        await allowEditOnly(page, "always");
        await settle(page);
        const without = await figures();
        withThem.forEach((h, i) => expect(Math.abs(h - without[i]! - own[i]!), `picture ${i + 1} grows by its description's line`).toBeLessThanOrEqual(0.5));
        const editing = await boxes(page);
        await seeAsVisitor(page, true);
        await settle(page);
        expect(differences(await boxes(page), editing)).toEqual([]);
      });
    }
  }

  test.describe("on a Pixel 7", () => {
    // The Pixel 7 profile without its browser type, which a describe group may not set (it is Chromium either way).
    test.use(PIXEL_7);
    for (const look of PORTFOLIO_THEMES) {
      for (const f of offered()) {
        test(`a full ${FORMAT_RULES[f].name.toLowerCase()} in ${look.name || look.id}: the editing page is the visitor's but for the two edit-only fields`, async ({ page }) => {
          await openTiming(page, f, { full: true, look: look.id });
          await waitLive(page);
          await allowEditOnly(page, "always");
          await settle(page);
          const editing = await boxes(page);
          await seeAsVisitor(page, true);
          await settle(page);
          expect(differences(await boxes(page), editing)).toEqual([]);
        });
      }
    }
  });

  test("a full page on the real edit page (signed in), at 1440 wide", async ({ page }) => {
    await openDoc(page, freshName("realbox"), full(sampleDoc("gallery")));
    await waitLive(page);
    await allowEditOnly(page, "always");
    await settle(page);
    const editing = await boxes(page);
    await seeAsVisitor(page, true);
    await settle(page);
    expect(differences(await boxes(page), editing)).toEqual([]);
  });

  test("a sparse page: on a new exhbt every difference is a part on EDIT_ONLY_IN_FLOW", async ({ page }) => {
    await openNew(page, freshName("sparse"));
    await waitLive(page);
    const taken = await allowEditOnly(page, "all");
    test.info().annotations.push({ type: "in the flow in the editor only", description: taken.join("; ") });
    await settle(page);
    const editing = await boxes(page);
    await seeAsVisitor(page, true);
    await settle(page);
    expect(differences(await boxes(page), editing), `with these taken out: ${taken.join("; ")}`).toEqual([]);
  });

  for (const which of ["a new exhbt", "the gallery's sample"] as const) {
    test(`the loading view is the editor's first view, box for box: ${which}`, async ({ page }) => {
      const doc = which === "a new exhbt" ? emptyDoc() : sampleDoc("gallery");
      const username = freshName("standin");
      const res = await page.request.post("/dev/parity", { data: { username, slug: "standin", doc } });
      const { id } = (await res.json()) as { id: string };
      // Hold the editor's chunk back, so the loading view stays up to be measured.
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await page.route(/EditorShell/, async (route) => {
        await held;
        await route.continue();
      });
      await page.goto(`/auth/dev?email=${username}@example.com&next=${encodeURIComponent(`/exhbts/${id}/edit`)}`);
      await expect(page.locator('[data-editor="page"][data-loading]')).toBeAttached();
      await settle(page);
      const loading = await boxes(page);
      release();
      await waitReady(page);
      await waitLive(page);
      await settle(page);
      expect(differences(loading, await boxes(page))).toEqual([]);
    });
  }
});

test.describe("the status line", () => {
  test("three pictures picked at once say Uploading 1 of 3 at once, then land in the order picked", async ({ page }) => {
    // A gallery with room for them, and no pictures yet.
    const { id } = await openDoc(page, freshName("three"), { ...sampleDoc("gallery"), sections: sampleDoc("gallery").sections.filter((s) => s.kind !== "image") });
    // The first picture's upload is held back, so the others finish first.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/files/upload-url", async (route) => {
      if ((route.request().postDataJSON() as { name: string }).name === "a.png") await held;
      await route.continue();
    });
    await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: png(30, 10) },
      { name: "b.png", mimeType: "image/png", buffer: png(40, 10) },
      { name: "c.png", mimeType: "image/png", buffer: png(50, 10) },
    ]);
    await expect(page.locator(`${READY} .xe-status [role=status]`)).toHaveText("Uploading 1 of 3");
    // The others finish meanwhile, but nothing lands before the first picture.
    await expect(page.locator(`${READY} .xe-status [role=status]`)).toHaveText(/^Uploading [23] of 3$/);
    await page.waitForTimeout(800);
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(0);
    release();
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(3);
    await expect(page.locator(`${READY} .xe-status [role=status]`)).toHaveText("3 images added. Each one needs a description for people who can't see it.");
    await waitSaved(page, id);
    const widths = (await readStored(page, id)).working.sections.flatMap((s) => (s.kind === "image" ? [s.w] : []));
    expect(widths).toEqual([30, 40, 50]);
  });

  test("pictures that finish uploading out of order: the save after the first is placed deletes none of those still waiting, and all three are kept", async ({ page }) => {
    const { id } = await openDoc(page, freshName("order"), { ...sampleDoc("gallery"), sections: sampleDoc("gallery").sections.filter((s) => s.kind !== "image") });
    // Each upload's file id, by its file's name, and every file the editor asks to delete.
    const ids: Record<string, string> = {};
    page.on("response", async (res) => {
      if (!res.url().endsWith("/api/files/upload-url")) return;
      ids[(res.request().postDataJSON() as { name: string }).name] = ((await res.json()) as { fileId: string }).fileId;
    });
    const deleted: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes("/api/files/")) deleted.push(req.url());
    });
    // The second picture's upload is held back: the first is placed, and the third finishes and waits for the second.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/files/upload-url", async (route) => {
      if ((route.request().postDataJSON() as { name: string }).name === "b.png") await held;
      await route.continue();
    });
    await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: png(30, 10) },
      { name: "b.png", mimeType: "image/png", buffer: png(40, 10) },
      { name: "c.png", mimeType: "image/png", buffer: png(50, 10) },
    ]);
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(1);
    await expect.poll(() => ids["c.png"] ?? null).not.toBeNull();
    // Placing the first is a change, so it is saved, with nothing typed. The third is uploaded but not placed.
    await waitSaved(page, id);
    await page.waitForTimeout(500);
    expect(deleted).toEqual([]);
    expect(await fileExists(page, ids["c.png"]!)).toBe(true);
    release();
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(3);
    await waitSaved(page, id);
    const stored = (await readStored(page, id)).working.sections.flatMap((s) => (s.kind === "image" ? [s.fileId] : []));
    expect(stored).toEqual([ids["a.png"], ids["b.png"], ids["c.png"]]);
    await page.reload();
    await waitReady(page);
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(3);
    expect(deleted).toEqual([]);
  });

  test("pictures added with the focus left on the tray's button or on a '+': the cursor goes to the first new picture's description", async ({ page }) => {
    await openDoc(page, freshName("adds"), { ...sampleDoc("gallery"), sections: sampleDoc("gallery").sections.filter((s) => s.kind !== "image") });
    // From the tray: the button keeps the focus while the picker is open.
    const block = page.locator(`${READY} [data-xe-tray] [data-block="image"]`);
    const chooser = page.waitForEvent("filechooser");
    await block.click();
    await expect(block).toBeFocused();
    await (await chooser).setFiles({ name: "a.png", mimeType: "image/png", buffer: png(30, 10) });
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(1);
    await expect(page.locator("#image-0-alt")).toBeFocused();
    // With the focus on the "+" at the end of the page.
    const plus = page.locator(`${READY} [data-path="sections"] button`).first();
    await plus.focus();
    await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles({ name: "b.png", mimeType: "image/png", buffer: png(40, 10) });
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(2);
    await expect(page.locator("#image-1-alt")).toBeFocused();
  });

  test("a picture over the size limit says why in the alert, and adds nothing", async ({ page }) => {
    const id = await openNew(page, freshName("big"), "free");
    // A GIF is never shrunk in the browser, so one over the plan's limit stays over it.
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    const big = Buffer.concat([gif, Buffer.alloc(11 * 1024 * 1024)]);
    await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles({ name: "huge.gif", mimeType: "image/gif", buffer: big });
    await expect(page.locator(`${READY} .xe-status [role=alert]`)).toContainText("huge.gif: That file is over 10 MB, the limit for each file on your plan.");
    await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(0);
    expect((await readStored(page, id)).working.sections.some((s) => s.kind === "image")).toBe(false);
  });
});

/** The stale editor's words as the top bar's save status draws them (its live region says them too, out of sight). */
const staleWords = (page: Page) => page.locator(`${READY} .xe-save-words`, { hasText: "The editor was updated. Reload to carry on; your changes are kept in this browser." });

test("a stale editor: a save that fails for another reason than the network says to reload", async ({ page }) => {
  await openDoc(page, freshName("stale"), sampleDoc("case-study"), { query: "?save=stale" });
  await typeIn(page, "title", "A change that cannot be saved");
  await expect(staleWords(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});

test.describe("a save the server fails (the review's data-safety-2)", () => {
  const EDIT = /\/exhbts\/[0-9a-f-]{36}\/edit/;
  const STALE = "The editor was updated. Reload to carry on; your changes are kept in this browser.";

  test("a server error and a bad answer are tried again, and the save lands with no word about reloading", async ({ page }) => {
    const { id } = await openDoc(page, freshName("blip"), sampleDoc("case-study"));
    let posts = 0;
    await page.route(EDIT, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      // A server error as the action's own words, then a gateway's page: neither is a stale editor.
      if (posts === 1) return route.fulfill({ status: 500, contentType: "text/plain", body: "An error occurred in the Server Components render." });
      if (posts === 2) return route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" });
      return route.continue();
    });
    await typeIn(page, "title", "Saved after a blip");
    await waitSaved(page, id);
    expect(posts).toBe(3);
    expect((await readStored(page, id)).working.title).toBe("Saved after a blip");
    await expect(page.getByText(STALE)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reload" })).toHaveCount(0);
  });

  test("an action the server no longer has is a stale editor: it says to reload, and is not tried again", async ({ page }) => {
    await openDoc(page, freshName("gone"), sampleDoc("case-study"));
    let posts = 0;
    await page.route(EDIT, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      // What Next answers for a server action it does not have (after a deploy or a rollback).
      return route.fulfill({ status: 404, headers: { "x-nextjs-action-not-found": "1" }, contentType: "text/plain", body: "Server action not found." });
    });
    await typeIn(page, "title", "A change for an older editor");
    await expect(staleWords(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await page.waitForTimeout(3000);
    expect(posts).toBe(1);
  });
});

test.describe("axe", () => {

  test("at rest, while typing, and with a sheet open", async ({ page }) => {
    await openDoc(page, freshName("axe"), sampleDoc("case-study"));
    await waitLive(page);
    expect(await scan(page), "at rest").toEqual([]);
    const findings = (await docNow(page)).sections.findIndex((s) => s.kind === "findings");
    await typeIn(page, `sections.${findings}.items.0`, " and more", { append: true });
    expect(await scan(page), "while typing").toEqual([]);
    await page.getByRole("button", { name: "Review and publish" }).click();
    await expect(page.getByRole("dialog", { name: "Review and publish" })).toBeVisible();
    expect(await scan(page), "with a sheet open").toEqual([]);
  });

  for (const look of PORTFOLIO_THEMES) {
    test(`at rest on a new exhbt and on a full one, in ${look.name || look.id}`, async ({ page }) => {
      // On a new exhbt the placeholders are all there is to read.
      await openTiming(page, "new", { look: look.id });
      await waitLive(page);
      expect(await scan(page), "a new exhbt").toEqual([]);
      await openTiming(page, "case-study", { look: look.id, full: true });
      await waitLive(page);
      expect(await scan(page), "a full one").toEqual([]);
    });
  }
});

test("a drafted exhbt: More actions on each part the AI drafted, the page box for box with the visitor's, and axe", async ({ page }) => {
  await openDrafted(page, "drafted");
  await waitLive(page);
  for (const block of ["header", "gap", "skills", "flow", "findings"]) await expect(page.getByTestId(`tools-${block}`), `tools-${block}`).toHaveCount(1);
  expect(await scan(page)).toEqual([]);
  const taken = await allowEditOnly(page, "all");
  await settle(page);
  const editing = await boxes(page);
  await seeAsVisitor(page, true);
  await settle(page);
  expect(differences(await boxes(page), editing), `with these taken out: ${taken.join("; ")}`).toEqual([]);
});

test.describe("a formatted field's buttons, and an issue on the page", () => {
  const doc = (): ExhbtDoc => ({ ...emptyDoc(), title: "Shorter queues", sections: [{ id: "findings", kind: "findings", items: [text("Waits fell a lot."), text("Sales held steady.")] }] });

  test("Bold is stored; Link asks for an https address, says when it is not one, and stores it", async ({ page }) => {
    const { id } = await openDoc(page, freshName("buttons"), doc());
    const f = field(page, "sections.0.items.0");
    await f.click();
    await expect(f.locator(".ProseMirror")).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.press("Shift+Home");
    await f.getByRole("button", { name: "Bold" }).click();
    await waitSaved(page, id);
    expect(((await readStored(page, id)).working.sections[0] as { items: RichText[] }).items[0]).toEqual([{ t: "Waits fell a lot.", b: true }]);

    await page.keyboard.press("End");
    await page.keyboard.press("Shift+Home");
    await f.getByRole("button", { name: "Link" }).click();
    const address = f.getByLabel("Link address (starting https://)");
    await expect(address).toBeFocused();
    await address.fill("http://example.com/log");
    await address.press("Enter");
    await expect(f.getByRole("alert")).toHaveText("Links must start with https://.");
    await address.fill("https://example.com/log");
    await address.press("Enter");
    await waitSaved(page, id);
    expect(((await readStored(page, id)).working.sections[0] as { items: RichText[] }).items[0]).toEqual([{ t: "Waits fell a lot.", b: true, href: "https://example.com/log" }]);
  });

  test("a finding over its cap is outlined and marked invalid, its message shows only while it has the focus, and nothing moves", async ({ page }) => {
    await openDoc(page, freshName("issue"), doc());
    const words = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(" ");
    await typeIn(page, "sections.0.items.0", words);
    const pm = field(page, "sections.0.items.0").locator(".ProseMirror");
    await expect(pm).toHaveAttribute("aria-invalid", "true");
    const note = page.locator(`${READY} #${await pm.getAttribute("aria-describedby")}`);
    await expect(note).not.toHaveText("");
    const shown = () => note.evaluate((el) => getComputedStyle(el).opacity);
    expect(await shown()).toBe("1");
    const focusedBoxes = await boxes(page, { frames: true });
    await field(page, "title").focus();
    await expect.poll(shown).toBe("0");
    // Still read out: the field stays tied to its message.
    await expect(pm).toHaveAttribute("aria-describedby", /issue$/);
    expect(differences(focusedBoxes, await boxes(page, { frames: true }))).toEqual([]);
  });
});

test("pictures dropped onto the page go in after the section they were dropped on", async ({ page }) => {
  const { id } = await openDoc(page, freshName("drop"), { ...emptyDoc(), title: "Queues", flow: [{ step: "One" }, { step: "Two" }, { step: "Three" }], sections: [{ id: "findings", kind: "findings", items: [text("A."), text("B.")] }] });
  expect(await pageOrder(page)).toEqual(["flow", "findings"]);
  const pictures = [png(30, 10), png(40, 10)].map((b) => b.toString("base64"));
  await page.evaluate((list) => {
    const dt = new DataTransfer();
    list.forEach((b64, i) => dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], `drop-${i + 1}.png`, { type: "image/png" })));
    const target = document.querySelector('[data-editor="page"] [data-section-id="flow"] .xp-flow-box')!;
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, pictures);
  await expect(page.locator(`${READY} [data-kind="image"]`)).toHaveCount(2);
  expect(await pageOrder(page)).toEqual(["flow", "image-1", "image-2", "findings"]);
  await waitSaved(page, id);
  expect((await readStored(page, id)).working.sections.flatMap((s) => (s.kind === "image" ? [s.w] : []))).toEqual([30, 40]);
});

test("the live status: publishing from the sheet turns the chip to Live, and Unpublish from the menu turns it back, with no reload", async ({ page }) => {
  await openNew(page, freshName("chip"), "max");
  const chip = page.locator(`${READY} .xe-chip-state`);
  await expect(chip).toHaveText("Draft");
  // A draft with every part a case study needs to go live.
  await page.evaluate((d) => window.__exhbtEditor!.patchDoc(() => d), sampleDoc("case-study"));
  await page.getByRole("button", { name: "Review and publish" }).click();
  await page.getByLabel("This is my work, and the numbers are true").check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("It's live.")).toBeVisible();
  await expect(chip).toHaveText("Live");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.getByRole("button", { name: "Yes, unpublish" }).click();
  await expect(chip).toHaveText("Draft");
});

test("a sheet's paths: from the open publish sheet, a jump opens the card or the work sheet with the cursor in its field, and it stays open", async ({ page }) => {
  await openDoc(page, freshName("sheetjump"), sampleDoc("case-study"));
  for (const [path, sheet, id] of [
    ["summary", "Card and link details", "summary"],
    ["headline.value", "Card and link details", ""],
    ["evidence", "The work", "evidence-href"],
  ] as const) {
    await page.getByRole("button", { name: "Review and publish" }).click();
    await expect(page.getByRole("dialog", { name: "Review and publish" })).toBeVisible();
    await jump(page, path);
    const dialog = page.getByRole("dialog", { name: sheet });
    await expect(dialog).toBeVisible();
    if (id) await expect(page.locator(`#${id}`)).toBeFocused();
    else await expect(dialog.getByRole("textbox", { name: "Headline number" })).toBeFocused();
    // The publish sheet's late close neither shut this one nor took the focus back.
    await page.waitForTimeout(300);
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Review and publish" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("a copy kept in this browser that never reached the server is offered back; Restore puts it on the page and saves it", async ({ page }) => {
  // A stale editor: the change is kept in this browser, and the server never gets it.
  const { id } = await openDoc(page, freshName("backup"), sampleDoc("case-study"), { query: "?save=stale" });
  await typeIn(page, "title", "Words the server never got");
  await expect(staleWords(page)).toBeVisible();
  // Leaving asks first while something is unsaved: say yes.
  page.on("dialog", (d) => void d.accept());
  await page.goto(`/exhbts/${id}/edit`);
  await waitReady(page);
  await expect(page.getByText(/^We kept changes from .+ that never reached the server\.$/)).toBeVisible();
  expect((await readStored(page, id)).working.title).not.toBe("Words the server never got");
  await page.getByRole("button", { name: "Restore them" }).click();
  await expect(field(page, "title")).toHaveValue("Words the server never got");
  await expect(page.getByText(/^We kept changes from/)).toHaveCount(0);
  await waitSaved(page, id);
  expect((await readStored(page, id)).working.title).toBe("Words the server never got");
});

test.describe("the copy kept in this browser (the review's data-safety-3)", () => {
  type Kept = { doc: ExhbtDoc; at: number };
  /** Writes a copy of exhbt `id` into this browser's storage, as the editor keeps one. */
  const keep = (page: Page, id: string, copy: Kept) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [`exhbt-backup:${id}`, JSON.stringify(copy)] as const);
  const keptNow = (page: Page, id: string): Promise<Kept | null> => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as Kept | null, `exhbt-backup:${id}`);
  const OFFER = /^We kept changes from .+ that never reached the server\.$/;
  /** Opens a case study, then reloads it with a copy in this browser, newer than the server's, whose title is `title`. */
  async function withCopy(page: Page, tag: string, title: string) {
    const doc = sampleDoc("case-study");
    const { id } = await openDoc(page, freshName(tag), doc);
    const at = Date.now() + 60_000;
    await keep(page, id, { doc: { ...doc, title }, at });
    await page.reload();
    await waitReady(page);
    await expect(page.getByText(OFFER)).toBeVisible();
    return { id, doc, at };
  }

  test("a change made first hides the offer, so the older copy can no longer be put over newer work", async ({ page }) => {
    const { id } = await withCopy(page, "newer", "From an older visit");
    await typeIn(page, "title", "Typed since");
    await expect(page.getByText(OFFER)).toHaveCount(0);
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.title).toBe("Typed since");
    await page.reload();
    await waitReady(page);
    await expect(field(page, "title")).toHaveValue("Typed since");
    await expect(page.getByText(OFFER)).toHaveCount(0);
  });

  test("Restore is one undo entry: Undo puts back what the server had, and saves it", async ({ page }) => {
    const { id, doc } = await withCopy(page, "restore", "From an older visit");
    await page.getByRole("button", { name: "Restore them" }).click();
    await expect(field(page, "title")).toHaveValue("From an older visit");
    await expect(page.getByText(OFFER)).toHaveCount(0);
    expect(await undoLabel(page)).toBe("restore the kept changes");
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.title).toBe("From an older visit");
    await pressUndo(page);
    await expect(field(page, "title")).toHaveValue(doc.title);
    await waitSaved(page, id);
    expect((await readStored(page, id)).working.title).toBe(doc.title);
  });

  test("Discard takes out only the copy it offered: a copy written since is kept", async ({ page }) => {
    const { id, doc } = await withCopy(page, "discard", "From an older visit");
    // Nothing the editor does by itself on opening (its formatted fields starting in idle moments) takes the offer away.
    await page.waitForTimeout(2500);
    await expect(page.getByText(OFFER)).toBeVisible();
    // Another tab of this exhbt keeps a newer copy meanwhile.
    const newer = { doc: { ...doc, title: "From the other tab" }, at: Date.now() + 120_000 };
    await keep(page, id, newer);
    await page.getByRole("button", { name: "Discard them" }).click();
    await expect(page.getByText(OFFER)).toHaveCount(0);
    expect((await keptNow(page, id))?.at).toBe(newer.at);
    // The copy offered is the one there: Discard takes it out.
    await page.reload();
    await waitReady(page);
    await expect(page.getByText(OFFER)).toBeVisible();
    await page.getByRole("button", { name: "Discard them" }).click();
    expect(await keptNow(page, id)).toBeNull();
    await expect(field(page, "title")).toHaveValue(doc.title);
  });

  test("publishing with nothing changed clears the copy, and the offer goes with it", async ({ page }) => {
    const { id } = await withCopy(page, "publish", "From an older visit");
    await page.getByRole("button", { name: "Review and publish" }).click();
    await page.getByLabel("This is my work, and the numbers are true").check();
    await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
    await expect(page.getByText(/^(It's live|Your changes are live)\.$/)).toBeVisible();
    await expect(page.getByText(OFFER)).toHaveCount(0);
    expect(await keptNow(page, id)).toBeNull();
    expect((await readStored(page, id)).working.title).not.toBe("From an older visit");
  });
});

test.describe("deleting takes this browser's copies out (the review's security-2)", () => {
  /** Keeps a copy of exhbt `id`, and of another one, in this browser, as the editor does when saves fail. */
  const keepCopies = (page: Page, id: string) =>
    page.evaluate((mine) => {
      for (const k of [`exhbt-backup:${mine}`, "exhbt-backup:another-exhbt"]) localStorage.setItem(k, JSON.stringify({ doc: { title: "Unsent words" }, at: Date.now() }));
      localStorage.setItem("exhbt-guide-hidden", "1");
    }, id);
  const keys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("exhbt-")).sort());

  test("from the editor's menu: that exhbt's copy goes, another exhbt's stays", async ({ page }) => {
    const { id } = await openDoc(page, freshName("menudel"), sampleDoc("case-study"));
    await keepCopies(page, id);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Delete this exhbt" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await page.waitForURL(/\/exhbts$/);
    expect(await keys(page)).toEqual(["exhbt-backup:another-exhbt", "exhbt-guide-hidden"]);
  });

  test("from the list of exhbts: that exhbt's copy goes, another exhbt's stays", async ({ page }) => {
    const { id } = await openDoc(page, freshName("listdel"), sampleDoc("case-study"));
    await page.goto("/exhbts");
    await keepCopies(page, id);
    const row = page.locator(`li:has(a[href="/exhbts/${id}/edit"])`);
    await row.getByRole("button", { name: /^Delete / }).click();
    await row.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.locator(`a[href="/exhbts/${id}/edit"]`)).toHaveCount(0);
    await expect.poll(() => keys(page)).toEqual(["exhbt-backup:another-exhbt", "exhbt-guide-hidden"]);
  });

  test("deleting the account takes every copy and the editor's own keys out of this browser", async ({ page }) => {
    const { id } = await openDoc(page, freshName("acctdel"), sampleDoc("case-study"));
    await page.goto("/account");
    await keepCopies(page, id);
    await page.getByLabel("I understand this deletes everything.").check();
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.waitForURL(/\/\?deleted=1$/);
    expect(await keys(page)).toEqual([]);
  });
});

test("sections a layout keeps but does not draw are listed under the page; Remove takes one out and Undo puts it back", async ({ page }) => {
  await openDoc(page, freshName("kept"), sampleDoc("research"));
  await expect(page.getByRole("region", { name: "Kept, not shown in this layout" })).toHaveCount(0);
  // A case study does not draw research's aim or conclusion: they are kept, not shown.
  await page.evaluate(() => window.__exhbtEditor!.setLayout("case-study"));
  const kept = page.getByRole("region", { name: "Kept, not shown in this layout" });
  await expect(kept.getByRole("listitem")).toHaveCount(2);
  await expect(kept).toContainText("Aim or hypothesis");
  await expect(kept).toContainText("Conclusion");
  // Not on the visitor's page.
  await seeAsVisitor(page, true);
  await expect(page.getByRole("region", { name: "Kept, not shown in this layout" })).toHaveCount(0);
  await seeAsVisitor(page, false);
  await kept.getByRole("button", { name: "Remove Aim or hypothesis" }).click();
  await expect(kept.getByRole("listitem")).toHaveCount(1);
  expect((await docNow(page)).sections.some((s) => s.kind === "aim")).toBe(false);
  await pressUndo(page);
  await expect(kept.getByRole("listitem")).toHaveCount(2);
  expect((await docNow(page)).sections.some((s) => s.kind === "aim")).toBe(true);
});

test("openSeeded opens a sample published by /dev/portfolio", async ({ page }) => {
  await openSeeded(page, freshName("seeded"), "gallery", "freshers-campaign");
  await expect(page.locator(`${READY} article[data-format="gallery"]`)).toBeVisible();
  expect((await pageOrder(page)).length).toBeGreaterThan(5);
});

test("a picture removed and saved: its file goes when the visit ends, as no Undo can bring it back then", async ({ page }) => {
  const working: ExhbtDoc = { ...sampleDoc("case-study"), sections: [...sampleDoc("case-study").sections, { id: "image-1", kind: "image", fileId: "x", alt: "The queue", caption: text("Lunch"), w: 1200, h: 800 }] };
  const { id, files } = await openDoc(page, freshName("leave"), sampleDoc("case-study"), { working });
  await removeVia(page, "image-1", "Image");
  await waitSaved(page, id);
  expect(await fileExists(page, files["image-1"]!)).toBe(true);
  // Leaving by the app's own link: the editor unmounts and the visit, with its undo list, is over.
  await page.getByRole("link", { name: "Your exhbts" }).first().click();
  await page.waitForURL(/\/exhbts$/);
  await expect.poll(() => fileExists(page, files["image-1"]!)).toBe(false);
});
