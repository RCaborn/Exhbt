import { expect, type Locator, type Page } from "@playwright/test";
import { uniqueEmail } from "./helpers";

/**
 * Everything the browser tests know about the exhbt editor (`/exhbts/[id]/edit`, `components/editor/`).
 * Specs import from here and never reach for editor selectors themselves, so a rewrite of the editor
 * changes this file and nothing else. See docs/briefs/edit-on-page/test-contract.md for which of these
 * the new editor is meant to keep.
 *
 * This is the page object for the CLASSIC editor (`components/editor/`), kept unchanged for the specs that test
 * the way back to it (editor-classic*.spec.ts). `e2e/editor.ts` drives the new editor.
 */

/* ------------------------------------------------------------------------------------------------
 * SELECTORS: the one place the editor's field ids, roles, labels, text and test ids are written down.
 * Change a value here and every helper below follows. Helpers never repeat these literals.
 * ---------------------------------------------------------------------------------------------- */
export const SEL = {
  /** The page after /exhbts: the signed-in list with its heading and the button that makes a blank exhbt. */
  listHeading: { level: 1 as const, name: "Your exhbts" },
  startFromScratchButton: "Start from scratch",
  /** The draft page (/exhbts/new) and the editor page's own heading. */
  draftHeading: { level: 1 as const, name: "Draft an exhbt" },
  draftForm: "form[data-ready=true]",
  editHeading: { level: 1 as const, name: "Edit exhbt" },
  editUrl: /\/exhbts\/[0-9a-f-]{36}\/edit$/,
  editUrlId: /\/exhbts\/([0-9a-f-]{36})\/edit$/,
  /** Set once the editor has hydrated. */
  ready: "[data-ready=true]",
  /** Fields by id, label or accessible name. */
  titleField: "#title",
  contextField: { role: "textbox" as const, name: "Context" },
  boxLabel: (n: number) => `Box ${n}`,
  findingField: (n: number) => ({ role: "textbox" as const, name: `Finding ${n}` }),
  addSectionButton: "#add-section",
  addSectionMenuButton: "Add a section",
  imageInput: "input[aria-label='Choose an image']",
  /** The cards and the preview. */
  sectionsRegion: "Sections",
  previewRegion: "Preview",
  previewArticle: "article[data-exhbt-page]",
  sectionOrderList: 'ol[aria-label="Sections, in page order"] > li',
  sectionKindAttr: "data-kind",
  partAttr: "data-part",
  articlePart: "article [data-part]",
  /** The layout choice. */
  layoutGroup: "Layout",
  /** Save status text. */
  saving: "Saving…",
  saved: "Saved",
  /** The word bar. */
  wordBar: "[data-word-bar]",
  /** Publishing. */
  publishConfirm: "This is my work, and the numbers are true",
  publishButton: "Publish",
  liveText: "It's live.",
  liveOrChangedText: /^(It's live\.|Your changes are live\.)$/,
  /** The rewrite tools on a drafted exhbt: test ids on each card's tools, and the card names. */
  toolsTestId: (block: string) => `tools-${block}`,
  rewritesLeftTestId: "rewrites-left",
  rewriteThisBlock: "Rewrite this block",
  backToAiVersion: "Back to the AI version",
  cardMenuButton: (cardName: string) => `More actions for ${cardName}`,
  cards: { header: "Your question and details", skills: "Skills", gap: "Context", flow: "Process", findings: "Findings" } as Record<string, string>,
  /** The graph card: a group named "Graph N" with a radio per kind. */
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

/**
 * Release 3, milestone 0: `/exhbts/<id>/edit` now serves the new editor, and the specs still drive the
 * classic form cards. The development cookie from /dev/editor keeps this browser context on the classic
 * editor however a spec reaches /edit (a redirect, a link or a typed address). Call it once per browser
 * context, before the first visit to the editor. It goes when the specs move to the new editor (brief N,
 * milestone 1).
 */
export async function keepClassic(page: Page) {
  const res = await page.request.get("/dev/editor?kind=classic");
  expect(await res.json()).toEqual({ editor: "classic" });
}

/** Makes a dev user with a username on a plan and no exhbts, signs in as them and waits for the "Your exhbts" list. */
export async function signInAs(page: Page, username: string, plan: Plan = "premium") {
  await keepClassic(page);
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", SEL.listHeading)).toBeVisible();
}

/**
 * Presses "Start from scratch" on the list and waits for the editor; returns the new exhbt's id.
 * `waitForContext` (default true) also waits for the Context field, which loads in its own chunk after the page;
 * pass false for the tests that never waited for it.
 */
export async function startFromScratch(page: Page, opts: { waitForContext?: boolean } = {}): Promise<string> {
  await page.getByRole("button", { name: SEL.startFromScratchButton }).click();
  await page.waitForURL(SEL.editUrl);
  await expect(page.locator(SEL.ready)).toBeAttached();
  if (opts.waitForContext !== false) await expect(page.getByRole(SEL.contextField.role, { name: SEL.contextField.name, exact: true })).toBeVisible();
  return page.url().match(SEL.editUrlId)![1]!;
}

/** signInAs, then startFromScratch without waiting for the Context field (as the layout tests always did). */
export async function startEditor(page: Page, username: string) {
  await signInAs(page, username, "premium");
  await startFromScratch(page, { waitForContext: false });
}

/** Signs in as a new address and waits for the "Draft an exhbt" page and its form. */
export async function signInToDraft(page: Page, tag: string) {
  await keepClassic(page);
  await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(tag))}&next=/exhbts/new`);
  await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();
  await expect(page.locator(SEL.draftForm)).toBeAttached();
}

/**
 * Signs in, drafts through the API (the placeholder AI) and opens the editor; returns the new exhbt's id.
 * `waitForForm` (default true) waits for the draft form to hydrate before drafting, as the draft-tools tests do;
 * pass false for the tests that only waited for the heading.
 */
export async function draftAndOpen(page: Page, tag: string, opts: { waitForForm?: boolean } = {}): Promise<string> {
  if (opts.waitForForm !== false) await signInToDraft(page, tag);
  else {
    await keepClassic(page);
    await page.goto(`/auth/dev?email=${encodeURIComponent(uniqueEmail(tag))}&next=${encodeURIComponent("/exhbts/new")}`);
    await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();
  }
  const res = await page.request.post("/api/exhbts/draft", { data: { text: DRAFT_PROJECT } });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/exhbts/${id}/edit`);
  await expect(page.getByRole("heading", SEL.editHeading)).toBeVisible();
  await expect(page.locator(SEL.ready).first()).toBeAttached();
  return id;
}

/* ------------------------------------------------------------------------------------------------
 * Filling and saving
 * ---------------------------------------------------------------------------------------------- */

const contextField = (page: Page) => page.getByRole(SEL.contextField.role, { name: SEL.contextField.name, exact: true });
const box = (page: Page, n: number) => page.getByLabel(SEL.boxLabel(n), { exact: true });

/** Fills the title, the question and three process boxes (the lunch-queue text most tests use). */
export async function fillCore(page: Page, title: string) {
  await page.locator(SEL.titleField).fill(title);
  await contextField(page).fill("Lunch queues ran long. Would a second till help?");
  for (const [i, text] of ["Timed the queue", "Opened a second till", "Timed it again"].entries()) await box(page, i + 1).fill(text);
}

/** Fills the two findings. The default text is the longer pair the sections tests use. */
export async function fillFindings(page: Page, findings: [string, string] = ["Average wait fell from 11 to 4 minutes.", "Sales held steady, so the till paid for itself."]) {
  await page.getByRole(SEL.findingField(1).role, { name: SEL.findingField(1).name }).fill(findings[0]);
  await page.getByRole(SEL.findingField(2).role, { name: SEL.findingField(2).name }).fill(findings[1]);
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
  await page.locator(SEL.titleField).fill(title);
  await contextField(page).fill("Queues ran long at lunch. Would a second till help?");
  await box(page, 1).fill("Timed the queue");
  await box(page, 2).fill("Added a second till");
  await box(page, 3).fill("Waits fell");
  await fillFindings(page, ["Waits fell from 11 to 4 minutes.", "Sales held steady."]);
}

/** Waits for the autosave after the last change: "Saving…" must appear, then "Saved". Pass `mustSeeSaving: false` to wait for "Saved" only. */
export async function waitForSave(page: Page, opts: { mustSeeSaving?: boolean } = {}) {
  if (opts.mustSeeSaving !== false) await expect(page.getByText(SEL.saving)).toBeVisible();
  await expect(page.getByText(SEL.saved, { exact: true })).toBeVisible();
}

/** Waits for "Saved" without requiring "Saving…" to have shown (the save may already have landed). */
export const waitForSaved = (page: Page) => waitForSave(page, { mustSeeSaving: false });

/**
 * Ticks the confirmation, presses Publish and waits for the live message.
 * By default the button is exactly "Publish" and the message is "It's live."; pass `changes: true` to accept
 * "Publish changes" and "Your changes are live." too (a republish).
 */
export async function publish(page: Page, opts: { changes?: boolean } = {}) {
  await page.getByLabel(SEL.publishConfirm).check();
  if (opts.changes) {
    await page.getByRole("button", { name: /^Publish( changes)?$/ }).click();
    await expect(page.getByText(SEL.liveOrChangedText)).toBeVisible();
  } else {
    await page.getByRole("button", { name: SEL.publishButton, exact: true }).click();
    await expect(page.getByText(SEL.liveText)).toBeVisible();
  }
}

/* ------------------------------------------------------------------------------------------------
 * Layout, images, preview
 * ---------------------------------------------------------------------------------------------- */

/** Picks a layout radio by the start of its name. */
export const chooseLayout = (page: Page, name: "Case study" | "Gallery" | "Research") => page.getByRole("radio", { name: new RegExp(`^${name}`) }).check();

/** The radiogroup named "Layout". */
export const layoutGroup = (page: Page) => page.getByRole("radiogroup", { name: SEL.layoutGroup });

/** The Sections area of the editor (all the cards). */
export const sectionsArea = (page: Page) => page.getByRole("region", { name: SEL.sectionsRegion, exact: true });

/** One card inside the Sections area, by its name. */
export const card = (page: Page, name: string) => sectionsArea(page).getByRole("region", { name, exact: true });

/** The Preview region. */
export const previewRegion = (page: Page) => page.getByRole("region", { name: SEL.previewRegion });

/** The drawn exhbt inside the Preview region (carries data-format). */
export const previewArticle = (page: Page) => previewRegion(page).locator(SEL.previewArticle);

/** The hidden file inputs for images. */
export const images = (page: Page) => page.locator(SEL.imageInput);

/** Chooses image files as a person would: focus is in the sections (after "Add a section" > "Add an image") when they are picked. */
export async function pickImages(page: Page, files: Parameters<ReturnType<typeof images>["setInputFiles"]>[0]) {
  await page.locator(SEL.addSectionButton).focus();
  await images(page).setInputFiles(files);
}

/** The figure on the word bar ("N words ..."). */
export async function wordsOnBar(page: Page): Promise<number> {
  const t = await page.locator(SEL.wordBar).innerText();
  return Number(t.match(/^(\d+) words/)?.[1]);
}

/* ------------------------------------------------------------------------------------------------
 * Sections
 * ---------------------------------------------------------------------------------------------- */

/** Opens the "Add a section" menu. */
export const openAddSectionMenu = (page: Page) => page.getByRole("button", { name: SEL.addSectionMenuButton }).click();

/** Opens the menu and adds a section by its button name (for example "Add a quote"). */
export async function addSection(page: Page, name: string) {
  await openAddSectionMenu(page);
  await page.getByRole("button", { name, exact: true }).click();
}

/** The kinds in the editor's list of sections, in order (data-kind on each list item). */
export const listOrder = (page: Page) => page.locator(SEL.sectionOrderList).evaluateAll((lis, attr) => lis.map((li) => li.getAttribute(attr)), SEL.sectionKindAttr);

/** The parts of a drawn exhbt below the title, in order: the flowchart, then each section's kind (data-part, ProjectView). */
export const pageOrder = (scope: Locator) => scope.locator(SEL.articlePart).evaluateAll((els, attr) => els.map((e) => e.getAttribute(attr) ?? ""), SEL.partAttr);

/* ------------------------------------------------------------------------------------------------
 * Graph cards
 * ---------------------------------------------------------------------------------------------- */

/** The graph card, a group named "Graph N". */
export const graph = (page: Page, n: number) => page.getByRole("group", { name: SEL.graphGroup(n), exact: true });

/** Picks a kind in a graph's type picker by clicking its tile, then checks the radio took it. */
export async function pickGraphKind(g: Locator, kind: string) {
  const radio = g.getByRole("radio", { name: kind, exact: true });
  await g.locator("label", { has: g.page().getByRole("radio", { name: kind, exact: true }) }).click();
  await expect(radio).toBeChecked();
}

/** Opens "Add a section" and adds a graph (decision 0015). */
export async function addGraphSection(page: Page) {
  await openAddSectionMenu(page);
  await page.getByRole("button", { name: SEL.addGraphButton }).click();
}

/** Adds a graph section, picks its kind and gives it a title; returns the graph card. */
export async function addGraph(page: Page, n: number, kind: string, title: string): Promise<Locator> {
  await addGraphSection(page);
  const g = graph(page, n);
  await pickGraphKind(g, kind);
  await g.getByLabel("Title", { exact: true }).fill(title);
  return g;
}

/* ------------------------------------------------------------------------------------------------
 * AI rewrite tools (a drafted exhbt)
 * ---------------------------------------------------------------------------------------------- */

/** The Finding 1 field. */
export const findingsField = (page: Page) => page.getByRole(SEL.findingField(1).role, { name: SEL.findingField(1).name });

/** The "N of M rewrites left" line inside a block's tools (visible once the card's menu is open). */
export const rewritesLeft = (page: Page, block: string) => page.getByTestId(SEL.toolsTestId(block)).getByTestId(SEL.rewritesLeftTestId);

/** The "More actions for <card>" button on a drafted block's card. */
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
