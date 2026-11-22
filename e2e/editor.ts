import { expect, type Locator, type Page } from "@playwright/test";
import { uniqueEmail } from "./helpers";
import { focusedPath, READY, seeAsVisitor as seeAsVisitorDev, textbox, waitSaved as waitSavedNow } from "./page-editor";

export { keepClassic } from "./editor-classic-helpers";

/**
 * Everything the browser tests know about the exhbt editor (`/exhbts/[id]/edit`, `components/exhbt-editor/`:
 * the edit-on-page editor, decision 0026). Specs import from here and never reach for editor selectors
 * themselves, so a change to the editor changes this file and nothing else. The classic editor's page object
 * is `e2e/editor-classic-helpers.ts`; the new editor's own page object is `e2e/page-editor.ts` (G's, reused here).
 *
 * The page IS the editor: there are no form cards and no preview pane. A part is found by its `data-path`, a
 * section by its frame (`data-section-id`, `data-kind`), and what the classic editor called a card is that frame.
 */

/* ------------------------------------------------------------------------------------------------
 * SELECTORS: the one place the editor's field ids, roles, labels, text and test ids are written down.
 * ---------------------------------------------------------------------------------------------- */
export const SEL = {
  listHeading: { level: 1 as const, name: "Your exhbts" },
  startFromScratchButton: "Start from scratch",
  draftHeading: { level: 1 as const, name: "Draft an exhbt" },
  draftForm: "form[data-ready=true]",
  /** The editor's h1 (visually hidden until a wide window). */
  editHeading: { level: 1 as const, name: "Edit exhbt" },
  editUrl: /\/exhbts\/[0-9a-f-]{36}\/edit$/,
  editUrlId: /\/exhbts\/([0-9a-f-]{36})\/edit$/,
  /** The editor, ready. */
  ready: READY,
  titleField: "#title",
  /** The "What it is" field in the sidebar. */
  whatItIsField: "#context",
  /** The context line, a formatted field (named "Context" in a case study). */
  gapPath: "gap",
  boxLabel: (n: number) => `Box ${n}`,
  addSectionButton: "#add-section",
  imageInput: "input[aria-label='Choose an image']",
  /** The page being edited: the article, and the visitor's view of it. */
  editingArticle: `${READY} article[data-exhbt-page]`,
  previewRegion: "Preview",
  previewArticle: "article[data-exhbt-page]",
  sectionKindAttr: "data-kind",
  partAttr: "data-part",
  articlePart: "article [data-part]",
  layoutGroup: "Layout",
  saving: "Saving…",
  saved: "Saved",
  wordBar: "[data-word-bar]",
  publishConfirm: "This is my work, and the numbers are true",
  publishButton: "Publish",
  liveText: "It's live.",
  liveOrChangedText: /^(It's live\.|Your changes are live\.)$/,
  toolsTestId: (block: string) => `tools-${block}`,
  rewritesLeftTestId: "rewrites-left",
  rewriteThisBlock: "Rewrite this block",
  backToAiVersion: "Back to the AI version",
  cardMenuButton: (cardName: string) => `More actions for ${cardName}`,
  cards: { header: "Your question and details", skills: "Skills", gap: "Context", flow: "Process", findings: "Findings" } as Record<string, string>,
  graphGroup: (n: number) => `Graph ${n}`,
  addGraphButton: "Add a graph",
};

/** The text the draft tests send to the placeholder AI. */
export const DRAFT_PROJECT = [
  "Final-year project on GP appointment reminders.",
  "The question was whether sending the reminder 3 hours before an appointment cut missed appointments compared with 24 hours before.",
  "I cleaned 14,200 appointment records from two practices in Python with pandas and fitted a logistic regression.",
  "Missed appointments fell from 7.9% to 6.5% across all patients, and from 11.2% to 8.4% for patients under 30.",
].join("\n");

/* ------------------------------------------------------------------------------------------------
 * Getting to the editor
 * ---------------------------------------------------------------------------------------------- */

export type Plan = "free" | "premium" | "max";

/** Makes a dev user with a username on a plan and no exhbts, signs in as them and waits for the "Your exhbts" list. */
export async function signInAs(page: Page, username: string, plan: Plan = "premium") {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", SEL.listHeading)).toBeVisible();
}

/** Waits for the new editor to be up (the loading view has no `data-ready`). */
export const waitEditor = (page: Page) => expect(page.locator(READY)).toBeAttached();

/**
 * Presses "Start from scratch" on the list and waits for the editor; returns the new exhbt's id.
 * `waitForContext` (default true) also waits for the context line's field.
 */
export async function startFromScratch(page: Page, opts: { waitForContext?: boolean } = {}): Promise<string> {
  await page.getByRole("button", { name: SEL.startFromScratchButton }).click();
  await page.waitForURL(SEL.editUrl);
  await waitEditor(page);
  if (opts.waitForContext !== false) await expect(contextField(page)).toBeVisible();
  return page.url().match(SEL.editUrlId)![1]!;
}

/** signInAs, then startFromScratch without waiting for the context line (as the layout tests always did). */
export async function startEditor(page: Page, username: string) {
  await signInAs(page, username, "premium");
  await startFromScratch(page, { waitForContext: false });
}

/** Signs in as a new address and waits for the "Draft an exhbt" page and its form. */
export async function signInToDraft(page: Page, tag: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(tag))}&next=${encodeURIComponent("/exhbts/new")}`);
  await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();
  await expect(page.locator(SEL.draftForm)).toBeAttached();
}

/**
 * Signs in, drafts through the API (the placeholder AI) and opens the editor; returns the new exhbt's id.
 * `waitForForm` (default true) waits for the draft form to hydrate before drafting.
 */
export async function draftAndOpen(page: Page, tag: string, opts: { waitForForm?: boolean } = {}): Promise<string> {
  if (opts.waitForForm !== false) await signInToDraft(page, tag);
  else {
    await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(tag))}&next=${encodeURIComponent("/exhbts/new")}`);
    await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();
  }
  const res = await page.request.post("/api/exhbts/draft", { data: { text: DRAFT_PROJECT } });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/exhbts/${id}/edit`);
  await expect(page.getByRole("heading", SEL.editHeading)).toBeAttached();
  await waitEditor(page);
  return id;
}

/* ------------------------------------------------------------------------------------------------
 * Fields: finding them, filling them, reading them
 * ---------------------------------------------------------------------------------------------- */

/** The editor's root. */
export const editorRoot = (page: Page) => page.locator(READY);

/** The element that carries a field path. */
export const fieldAt = (page: Page, path: string) => page.locator(`${READY} [data-path="${path}"]`);

/** The context line (path "gap"): the formatted field, whatever its words are now. */
export const contextField = (page: Page) => textbox(page, "gap");

/** The process box `n` (1-based): the plain field named "Box n". */
export const box = (page: Page, n: number) => page.locator(`${READY}`).getByLabel(SEL.boxLabel(n), { exact: true });

/** The first finding is path `sections.<findings>.items.0`: the field named "Finding n" (1-based), whatever the findings' section index. */
export const finding = (page: Page, n: number) => page.locator(`${READY} [data-kind="findings"] [data-path$=".items.${n - 1}"]`).first();

/** The findings field with the cursor in it as a person would: its words, replaced with `words` (a formatted field starts its editor on a click). */
export async function fillRich(page: Page, f: Locator, words: string) {
  await f.scrollIntoViewIfNeeded();
  await f.click();
  const editor = f.locator(".ProseMirror");
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  if (words) await page.keyboard.type(words);
}

/** Fills a plain field (a textarea or an inline span) by clicking in, selecting and typing: the same for both. */
export async function fillPlain(page: Page, f: Locator, words: string) {
  await f.scrollIntoViewIfNeeded();
  await f.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  if (words) await page.keyboard.type(words);
}

/** The words in a field now: a textarea's value, or a formatted/inline field's text. */
export async function wordsIn(f: Locator): Promise<string> {
  const target = f.locator("textarea").or(f.locator(".ProseMirror"));
  const inner = (await target.count()) ? target.first() : f;
  const tag = await inner.evaluate((e) => e.tagName);
  return tag === "TEXTAREA" ? ((await inner.inputValue()) ?? "") : ((await inner.innerText()) ?? "");
}

/** Which field has the cursor, by path. */
export { focusedPath };

/** Fills the title. */
export const fillTitle = (page: Page, words: string) => fillPlain(page, page.locator(`${READY} ${SEL.titleField}`), words);

/** Fills the context line. */
export const fillContext = (page: Page, words: string) => fillRich(page, fieldAt(page, "gap"), words);

/** Fills process box `n`. */
export const fillBox = (page: Page, n: number, words: string) => fillPlain(page, box(page, n), words);

/** Fills finding `n`. */
export const fillFinding = (page: Page, n: number, words: string) => fillRich(page, finding(page, n), words);

/** Adds a skill by its box: types it and presses Enter. */
export async function addSkill(page: Page, words: string) {
  const f = page.locator(`${READY} #skill-new`);
  await f.scrollIntoViewIfNeeded();
  await f.click();
  await page.keyboard.type(words);
  await page.keyboard.press("Enter");
}

/** The skills' pills. */
export const skillsList = (page: Page) => page.getByRole("list", { name: "Skills used", exact: true });

/** Fills the title, the question and three process boxes (the lunch-queue text most tests use). */
export async function fillCore(page: Page, title: string) {
  await fillTitle(page, title);
  await fillContext(page, "Lunch queues ran long. Would a second till help?");
  for (const [i, text] of ["Timed the queue", "Opened a second till", "Timed it again"].entries()) await fillBox(page, i + 1, text);
}

/** Fills the two findings. The default text is the longer pair the sections tests use. */
export async function fillFindings(page: Page, findings: [string, string] = ["Average wait fell from 11 to 4 minutes.", "Sales held steady, so the till paid for itself."]) {
  await fillFinding(page, 1, findings[0]);
  await fillFinding(page, 2, findings[1]);
}

/** startFromScratch, then fillCore (the sections tests' start). */
export async function startWithCore(page: Page, title: string) {
  await startFromScratch(page);
  await fillCore(page, title);
}

/** startWithCore, then the short findings the graph tests use. */
export async function startWithBasics(page: Page, title: string) {
  await startWithCore(page, title);
  await fillFindings(page, ["Waits fell.", "Sales held steady."]);
}

/** Fills everything a publish needs, apart from images and the work (title, question, three boxes, two findings). */
export async function fillValid(page: Page, title: string) {
  await fillTitle(page, title);
  await fillContext(page, "Queues ran long at lunch. Would a second till help?");
  await fillBox(page, 1, "Timed the queue");
  await fillBox(page, 2, "Added a second till");
  await fillBox(page, 3, "Waits fell");
  await fillFindings(page, ["Waits fell from 11 to 4 minutes.", "Sales held steady."]);
}

/**
 * Waits for the autosave after the last change. The status words are "Saving…" then "Saved" (a `role=status`);
 * the save can land before the first looks, so `mustSeeSaving` defaults to false here.
 */
export async function waitForSave(page: Page, opts: { mustSeeSaving?: boolean } = {}) {
  if (opts.mustSeeSaving) await expect(page.locator(`${READY} [role=status]`, { hasText: SEL.saving })).toBeVisible();
  await waitSavedNow(page);
}

/** Waits for "Saved". */
export const waitForSaved = (page: Page) => waitForSave(page, { mustSeeSaving: false });

/* ------------------------------------------------------------------------------------------------
 * Publishing: "Review and publish", a sheet
 * ---------------------------------------------------------------------------------------------- */

/** The top bar's "Review and publish" button. */
export const reviewButton = (page: Page) => page.getByRole("button", { name: "Review and publish" });

/** The publish sheet. */
export const publishSheet = (page: Page) => page.locator('dialog[data-sheet="publish"]');

/** Opens the publish sheet (if it is not open). */
export async function openPublishSheet(page: Page) {
  if (!(await publishSheet(page).evaluate((d) => (d as HTMLDialogElement).open))) await reviewButton(page).click();
  await expect(publishSheet(page)).toBeVisible();
}

/**
 * Opens "Review and publish", ticks the confirmation, presses Publish and waits for the live message.
 * By default the button is exactly "Publish" and the message is "It's live."; pass `changes: true` to accept
 * "Publish changes" and "Your changes are live." too (a republish).
 */
export async function publish(page: Page, opts: { changes?: boolean } = {}) {
  await openPublishSheet(page);
  const sheet = publishSheet(page);
  await sheet.getByLabel(SEL.publishConfirm).check();
  if (opts.changes) {
    await sheet.getByRole("button", { name: /^Publish( changes)?$/ }).click();
    await expect(sheet.getByText(SEL.liveOrChangedText)).toBeVisible();
  } else {
    await sheet.getByRole("button", { name: SEL.publishButton, exact: true }).click();
    await expect(sheet.getByText(SEL.liveText)).toBeVisible();
  }
}

/* ------------------------------------------------------------------------------------------------
 * Layout, images, the visitor's view
 * ---------------------------------------------------------------------------------------------- */

/** The top bar's layout button ("Layout: Case study"). */
export const layoutButton = (page: Page) => page.getByRole("button", { name: /^Layout:/ });

/** Opens the layout menu (it is a popover) if it is not open. */
export async function openLayoutMenu(page: Page) {
  if (!(await layoutGroup(page).isVisible())) await layoutButton(page).click();
  await expect(layoutGroup(page)).toBeVisible();
}

/** Picks a layout radio by the start of its name (opens the layout menu first). */
export async function chooseLayout(page: Page, name: "Case study" | "Gallery" | "Research") {
  await openLayoutMenu(page);
  await layoutGroup(page).getByRole("radio", { name: new RegExp(`^${name}`) }).check();
}

/** The radiogroup named "Layout" (in the layout menu: open it first with openLayoutMenu). */
export const layoutGroup = (page: Page) => page.getByRole("radiogroup", { name: SEL.layoutGroup });

/** The page's main column: where the classic editor had the Sections area. The page's sections are its frames. */
export const sectionsArea = (page: Page) => page.locator(`${READY} article[data-exhbt-page]`);

/** The frame of a section, by its name on the page's toolbar ("Findings", "Graph 1", "Quote"). */
export const card = (page: Page, name: string) =>
  page.locator(`${READY} [data-section-id]`).filter({ has: page.getByRole("toolbar", { name: `${name}: tools`, exact: true }) });

/** Every frame, in page order. */
export const frames = (page: Page) => page.locator(`${READY} article [data-section-id]`);

/** "See as a visitor" on or off. */
export async function seeAsVisitor(page: Page, on = true) {
  const open = await page.locator(`${READY} section[aria-label="Preview"]`).count();
  if (Boolean(open) === on) return;
  await seeAsVisitorDev(page, on);
}

/**
 * Where the classic editor drew the page as a visitor sees it (the Preview region). The editing page draws the same
 * page, so this is the editing page's main column: text in a field is a field's value, not text on the page, so
 * a test that reads words off the page uses `visitorRegion` after `seeAsVisitor`.
 */
export const previewRegion = (page: Page) => page.locator(`${READY} article[data-exhbt-page]`).locator("xpath=..");

/** The drawn exhbt (carries data-format) on the editing page. */
export const previewArticle = (page: Page) => page.locator(`${READY} ${SEL.previewArticle}`).first();

/** The visitor's view: the region named "Preview", once "See as a visitor" is on. */
export const visitorRegion = (page: Page) => page.getByRole("region", { name: SEL.previewRegion });

/** The hidden file inputs for images. */
export const images = (page: Page) => page.locator(SEL.imageInput);

/** Chooses image files as a person would: through the picker's file input (it is added to the end of the page). */
export async function pickImages(page: Page, files: Parameters<ReturnType<typeof images>["setInputFiles"]>[0]) {
  await images(page).first().setInputFiles(files);
}

/** The figure on the word bar ("N words ..."). */
export async function wordsOnBar(page: Page): Promise<number> {
  const t = await page.locator(`${READY} ${SEL.wordBar}`).innerText();
  return Number(t.match(/^(\d+) words/)?.[1]);
}

/* ------------------------------------------------------------------------------------------------
 * Sections
 * ---------------------------------------------------------------------------------------------- */

/** Opens the end "+" ("Add a section") menu. */
export async function openAddSectionMenu(page: Page) {
  const plus = page.locator(`${READY} ${SEL.addSectionButton}`);
  await plus.scrollIntoViewIfNeeded();
  if ((await plus.getAttribute("aria-expanded")) !== "true") await plus.click();
  await expect(page.locator(`${READY} [data-xe-menu]`)).toBeVisible();
}

/** The block kinds the classic editor's "Add a ..." buttons stood for, as the menu names them (`data-block`). */
const BLOCK_OF_BUTTON: Record<string, string> = {
  "Add a graph": "graph",
  "Add a quote": "quote",
  "A quote": "quote",
  "Add what I'd do next": "reflection",
  "Add a link": "link",
  "Add an image": "image",
  "Add a pull quote": "pullquote",
};

/** One entry of the open menu by its classic button name ("Add a quote") or by its words in the menu. */
export function menuItem(page: Page, name: string): Locator {
  const kind = BLOCK_OF_BUTTON[name];
  const menu = page.locator(`${READY} [data-xe-menu]`);
  return kind ? menu.locator(`[data-block="${kind}"]`) : menu.locator("button.xe-plus-item", { hasText: name.replace(/^Add (a |an )?/, "") });
}

/** Opens the end "+" menu and adds a section (for example "Add a quote"). */
export async function addSection(page: Page, name: string) {
  await openAddSectionMenu(page);
  await menuItem(page, name).click();
}

/** The kinds of the page's sections, in page order, leaving out the flowchart (the classic list had no card for it). */
export const listOrder = async (page: Page): Promise<string[]> => (await frames(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-kind") ?? ""))).filter((k) => k !== "flow");

/** The parts of a drawn exhbt below the title, in order: the flowchart, then each section's kind (data-part, ProjectView). */
export const pageOrder = (scope: Locator) => scope.locator(SEL.articlePart).evaluateAll((els, attr) => els.map((e) => e.getAttribute(attr) ?? ""), SEL.partAttr);

/* ------------------------------------------------------------------------------------------------
 * Graphs: the figures sheet
 * ---------------------------------------------------------------------------------------------- */

/** The figures sheet (a native dialog). */
export const chartSheet = (page: Page) => page.locator('dialog[data-sheet="chart"]');

/** The graph's group "Graph N", in the open figures sheet. */
export const graph = (page: Page, n: number) => chartSheet(page).getByRole("group", { name: SEL.graphGroup(n), exact: true });

/** Opens the figures sheet of the graph section `id`-th graph (1-based) by its "Edit figures" button, if it is not open. */
export async function openFigures(page: Page, n: number) {
  if (await chartSheet(page).evaluate((d) => (d as HTMLDialogElement).open)) return;
  await page.locator(`${READY} [data-kind="graph"]`).nth(n - 1).getByRole("button", { name: /^Edit figures/ }).click();
  await expect(chartSheet(page)).toBeVisible();
}

/** Picks a kind in a graph's type picker by clicking its tile, then checks the radio took it. */
export async function pickGraphKind(g: Locator, kind: string) {
  const radio = g.getByRole("radio", { name: kind, exact: true });
  await g.locator("label", { has: g.page().getByRole("radio", { name: kind, exact: true }) }).click();
  await expect(radio).toBeChecked();
}

/** Adds a graph through the end "+" (a graph just added opens its figures sheet). */
export async function addGraphSection(page: Page) {
  await addSection(page, SEL.addGraphButton);
  await expect(chartSheet(page)).toBeVisible();
}

/** Adds a graph section, picks its kind and gives it a title; returns the graph's group in the open sheet. */
export async function addGraph(page: Page, n: number, kind: string, title: string): Promise<Locator> {
  await addGraphSection(page);
  const g = graph(page, n);
  await pickGraphKind(g, kind);
  await g.getByLabel("Title", { exact: true }).fill(title);
  return g;
}

/** Closes the open sheet (its "Close" button). */
export async function closeSheet(page: Page) {
  await page.locator("dialog[open] button.xe-sheet-close").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

/* ------------------------------------------------------------------------------------------------
 * AI rewrite tools (a drafted exhbt)
 * ---------------------------------------------------------------------------------------------- */

/** The first finding's field (Finding 1). */
export const findingsField = (page: Page) => finding(page, 1);

/** The "N of M rewrites left" line inside a block's tools (visible once its "More actions" is open). */
export const rewritesLeft = (page: Page, block: string) => page.getByTestId(SEL.toolsTestId(block)).getByTestId(SEL.rewritesLeftTestId);

/** The "More actions for <block's name>" button on a drafted block. */
export const cardMenuButton = (page: Page, block: string) => page.getByRole("button", { name: SEL.cardMenuButton(SEL.cards[block]!) });

/** Opens a block's "More actions" menu. */
export const openCardMenu = (page: Page, block: string) => cardMenuButton(page, block).click();

/** Opens the block's menu and presses "Rewrite this block". */
export async function startRewrite(page: Page, block: string) {
  await openCardMenu(page, block);
  await page.getByTestId(SEL.toolsTestId(block)).getByRole("button", { name: SEL.rewriteThisBlock }).click();
}

/** The "Back to the AI version" button inside a block's tools. */
export const backToAiVersion = (page: Page, block: string) => page.getByTestId(SEL.toolsTestId(block)).getByRole("button", { name: SEL.backToAiVersion });
