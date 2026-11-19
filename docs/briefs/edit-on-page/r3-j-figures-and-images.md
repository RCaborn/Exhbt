# Brief J: graphs, pictures, links and the figure from the report

| | |
|---|---|
| Release | 3, the editor |
| Model | Opus |
| Branch | `phase-2-r3-j-figures`, made from `phase-2-r3` after G's first milestone is merged |
| Port | 3310 |
| Starts when | G's first milestone is merged |

## Goal

Build what sits round a graph, a picture and a link while editing: a graph's figures in a side sheet, a picture's description and its picked-figure strip, a link's address. Then make the key visual work by hand in the new editor: take a figure from the report when none was picked, and get the drafted chart back when a picked graph is removed.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("What the page does not draw", "The key visual, and pictures by hand", "Saving, and what may delete a file"), `docs/decisions/0025-key-visual-from-the-work.md` (all of it: "The rule", "Safeguards kept", "To confirm with Rory") and `docs/decisions/0017-auto-figure.md` ("Safeguards"). On your base: `components/exhbt-editor/figures/` (G's stubs), `store.ts`, `context.ts`, `files.ts`, `ui/Sheet.tsx`; `components/editor/ChartEditor.tsx` and `PickedFigure.tsx` (you reuse both), the image, graph and link cards in `components/editor/Sections.tsx` (the labels to keep); `lib/exhbt/sections.ts` (`withKeyFigure`, `withWorkVisual`, `replacesDraftedGraph`); `app/api/exhbts/[id]/figure/route.ts`; `lib/exhbt/draft-blocks.ts` and `lib/draft-tools.ts` (the AI version kept with an exhbt); `app/(app)/exhbts/[id]/draft-tools-actions.ts` (how a server action here checks the owner and the source).

## You own

- `components/exhbt-editor/figures/` (every file in it), `components/exhbt-editor/css/figures.css`
- `app/(app)/exhbts/[id]/figure-actions.ts` (new)
- `components/editor/PickedFigure.tsx` and `ChartEditor.tsx`: you may add the word `export` to things they already define, and nothing else. Their behaviour must not change (the classic editor uses them)
- `e2e/editor-figures.spec.ts` (new)

## You must not touch

Anything else. The section toolbar (Make lead image, Make key figure, Before, After, Remove) is G's. Adding pictures by hand is G's (`useFiles().pick` and `.addImages`) and F's ("+" then Image). The "+" menu is F's: it calls your `canTakeFigure` and opens your sheet.

## What you build against

```ts
// components/exhbt-editor/store.ts  ("use client")
import type { ContentSection, ExhbtDoc, RichText } from "@/lib/exhbt/blocks";
import type { Format } from "@/lib/exhbt/formats";
import type { BlockKind } from "@/lib/exhbt/layouts";
import type { FieldPath } from "@/components/portfolio/page-ctx";

export type EditorStore = {
  get(): ExhbtDoc;
  subscribe(fn: () => void): () => void;

  /** Typing: sets the value at a field path. Never an undo entry. */
  setAt(path: FieldPath, value: string | RichText): void;
  /** A change inside one section that is not typing (a graph's numbers, a tick, before or after). With `undo`, it is one undo entry with that name, holding the before and after of the fields `fn` changed and nothing else. */
  patch(id: string, fn: (s: ContentSection) => ContentSection, undo?: string): void;
  /** A change outside the sections (the work, the card's summary, a skill, a confirmed number, an AI rewrite). With `undo`, one entry holding the before and after of the sections' fields and the top-level keys `fn` changed, and nothing else. */
  patchDoc(fn: (d: ExhbtDoc) => ExhbtDoc, undo?: string): void;

  /** Structural changes: each adopts the doc first and is one undo entry. `at` and `place` count page items (pageItems in lib/exhbt/layouts.ts). */
  move(id: string, place: number): void;
  /** Returns the new section's id, or null when the layout has no room (blockOptions says why). */
  insert(kind: Exclude<BlockKind, "image">, at: number): string | null;
  insertImage(image: { fileId: string; w?: number; h?: number }, at: number): string | null;
  /** Never prunes the numbers to check: Undo may bring the section back. */
  remove(id: string): void;
  setLayout(f: Format): void;

  /** The flowchart's boxes. A box has no stored id, so each gets a key that lasts for the visit. */
  flowKeys(): readonly string[];
  flowAdd(at: number): string | null;
  flowRemove(key: string): void;
  flowMove(key: string, to: number): void;

  /** Writes back only what the last entry changed, so typing done since in other fields is kept. The numbers to check come back as the list now joined with the list before, limited to numbers on the page after the undo. */
  undo(): void;
  /** "remove graph 1", or null when there is nothing to undo. */
  undoLabel(): string | null;
};

export function useStore(): EditorStore;
/** One slice of the doc. `select` must return the same object while its slice has not changed. */
export function useDoc<T>(select: (d: ExhbtDoc) => T): T;
/** One section by id, fresh on every change to it and to nothing else. */
export function useSection(id: string): ContentSection | undefined;
/** Counts a unit's renders on window.__exhbtRenders[unit], for e2e/editor-smooth.spec.ts. Units: "shell", "flow", and each section's id. */
export function useRenderCount(unit: string): void;
```

```ts
// components/exhbt-editor/context.ts  ("use client")
import type { Issue } from "@/lib/exhbt/blocks";
import type { FieldPath } from "@/components/portfolio/page-ctx";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { EditorProps } from "@/components/editor/Editor";

/** What the edit page passes: the classic editor's props, plus the person's look and the stored reports a figure can be taken from. */
export type PageEditorProps = EditorProps & {
  theme: PortfolioTheme;
  /** The person's stored PDFs for this exhbt, for "Take a figure from my report" when nothing was picked. */
  reportFiles: { fileId: string; name: string; url: string }[];
};

export type SheetName = "publish" | "card" | "work" | "chart" | "figure" | "reorder";
export type Ui = {
  /** The sheet that is open, if any. `sectionId` for the chart and figure sheets. */
  sheet: { name: SheetName; sectionId?: string } | null;
  open(name: SheetName, sectionId?: string): void;
  close(): void;
  /** Scrolls to the field for an issue path and puts the cursor in it, opening its sheet first when it lives in one. */
  jumpTo(path: FieldPath): void;
  /** Says something in the polite live region. */
  say(text: string): void;
  /** The view: editing, or "See as a visitor". */
  visitor: boolean;
  setVisitor(on: boolean): void;
  /** The publish tick ("This is my work, and the numbers are true"). The page draws its "Confirmed by" check from it. */
  confirmed: boolean;
  setConfirmed(on: boolean): void;
};

/** The formatted field that has the cursor, if one does: what its buttons do and which are on. For the phone's bar. */
/** `toggleLink()` with no link on opens the field's own address prompt (as the classic editor's formatted field does, with its error for an address that is not https); with one on, it removes it. */
export type ActiveRich = { highlight: boolean; bold: boolean; italic: boolean; link: boolean; toggleBold(): void; toggleItalic(): void; toggleLink(): void };
export function useActiveRich(): ActiveRich | null;

export function useUi(): Ui;
export function useEnv(): PageEditorProps;
/** Every issue that stops publishing (validateForPublish), and the ones worth showing now (visibleIssues in components/editor/model.ts). */
export function useIssues(): { all: Issue[]; shown: Issue[]; at(path: FieldPath): Issue[]; tried: boolean; setTried(v: boolean): void };
/** Autosave, as components/editor/useAutosave.ts returns it. */
export function useSave(): { status: { state: "saved" | "waiting" | "saving" | "retrying" | "error"; error?: string }; flush(): Promise<void>; settled(): Promise<void>; markSaved(d: ExhbtDoc): void };

// components/exhbt-editor/files.ts  ("use client")
export type Files = {
  /** A stored file's address for this visit (a signed link, or an object URL for one just uploaded). */
  url(fileId: string): string | null;
  /** Opens the picture picker (several at once) and puts what is chosen on the page from `at`. The input is named "Choose an image". */
  pick(at: number): void;
  /** Uploads pictures and puts them on the page from `at`, in the order they were picked. */
  addImages(files: File[], at: number): Promise<void>;
  replaceImage(sectionId: string, file: File, picked: Picked, opts: { describeAgain: boolean }): Promise<void>;
  attachWork(file: File): Promise<void>;
  removeWork(): void;
  /** Publishing worked: this doc is now the live copy, so files only the old live copy used can go. */
  markPublished(doc: ExhbtDoc): void;
  busy: { image: boolean; work: boolean };
  /** What went wrong with the last upload, in words to show. */
  error: { image?: string; work?: string };
  /** "Uploading 2 of 5", then "3 images added. Each one needs a description for people who can't see it." */
  status: string;
};
export function useFiles(): Files;
```

G (the editor's core) makes each of these files in its first milestone with the signature shown and a body that works in the plainest way. From the moment that milestone is merged the file belongs to the owner named, who replaces the body. The signature does not change. All are `"use client"` and take what they need from the hooks (`useStore`, `useDoc`, `useUi`, `useEnv`, `useIssues`, `useSave`, `useFiles`), never from props G would have to thread.

| File in `components/exhbt-editor/` | Export | Owner | G's stub does |
|---|---|---|---|
| `topbar/TopBar.tsx` | `TopBar(): ReactNode` | H | back link, the heading "Edit exhbt", the save status, a plain Publish button that opens the publish sheet |
| `sheets/PublishSheet.tsx` | `PublishSheet(): ReactNode` | I | the tick and the Publish button, calling `publishExhbt` |
| `sheets/CardSheet.tsx` | `CardSheet(): ReactNode` | I | nothing |
| `sheets/WorkPanel.tsx` | `WorkPanel(): ReactNode` | I | nothing |
| `sheets/WorkButton.tsx` | `WorkButton(): ReactNode` (what `edit.work()` returns) | I | the button, drawn as "See the work" is, opening the work sheet |
| `figures/ImageExtras.tsx` | `ImageExtras(props: ExtraSlot): ReactNode` | J | below: the description field (`image-N-alt`) in a strip over the foot of the picture; above: nothing |
| `figures/LinkExtras.tsx` | `LinkExtras(props: ExtraSlot): ReactNode` | J | a "Web address" button over the link's corner, opening a popover that holds the field |
| `figures/GraphExtras.tsx` | `GraphExtras(props: ExtraSlot): ReactNode` | J | an "Edit figures" button that opens the chart sheet |
| `figures/ChartSheet.tsx` | `ChartSheet(): ReactNode` | J | the existing `ChartEditor` (`bare`) for `ui.sheet.sectionId` |
| `figures/FigureSheet.tsx` | `FigureSheet(): ReactNode` | J | nothing |
| `figures/DraftedGraph.tsx` | `DraftedGraph(): ReactNode` (drawn under the page) | J | nothing |
| `figures/take.ts` | `canTakeFigure(doc: ExhbtDoc, reportFiles: { fileId: string }[]): boolean` | J | returns false |
| `flow/FlowEdit.tsx` | `useFlowEdit(): FlowEdit` | K | `list` returns its children; `box` returns the `<li>` with a lasting key; `tools` and `add` return null |
| `drag/index.ts` | `DragBoard(props: { children: ReactNode }): ReactNode`; `useBoard(): Board` | F | `DragBoard` returns its children; `useBoard` moves and removes through the store with no motion |
| `drag/options.ts` | `SECTION_STYLE`, `FLOW_SECTION_STYLE`, `FLOW_BOX_STYLE`, each `"slide" \| "line"` | F (K reads `FLOW_BOX_STYLE` and never edits the file) | the three constants: `"slide"`, `"line"`, `"line"` |
| `Insert.tsx` | `Insert(props: InsertSlot): ReactNode` | F | a "+" button listing `blockOptions(doc)` and adding the chosen kind there |
| `Tray.tsx` | `Tray(): ReactNode` | F | nothing |
| `phone/PhoneBar.tsx` | `PhoneBar(): ReactNode` | L | nothing |
| `phone/ReorderSheet.tsx` | `ReorderSheet(): ReactNode` | L | nothing |

```ts
// components/exhbt-editor/drag/index.ts
export type Board = {
  /** Props for a section's grip button: the drag sensors, the keyboard handler, the ref. Spread onto the <button data-grip>. */
  grip(id: string): Record<string, unknown>;
  /** Move up (-1) or down (1) one place, with the motion and the words read out; keeps the focus on the button pressed. */
  moveBy(id: string, by: -1 | 1): void;
  /** Take a section off the page, with the motion, the words read out and the focus moved to what took its place. */
  remove(id: string): void;
  /** Add a block at a place, with the motion and the focus put in it. Returns its id, or null when there is no room. A graph then opens its figures sheet (`ui.open("chart", id)`); an image opens the picture picker instead and is placed when the pictures are chosen. */
  add(kind: BlockKind, at: number): string | null;
  /** The section the focus was last in, for "add after the section you were last in". */
  lastFocus(): string | null;
};
```

The buttons in a section's toolbar carry `data-grip`, or `data-tool` with one of `up`, `down`, `action`, `more`, `remove`, so another agent's CSS and tests can find them.

Each owner's CSS goes in its own file in `components/exhbt-editor/css/` (`core.css` G, `drag.css` F, `flow.css` K, `topbar.css` H, `sheets.css` I, `figures.css` J, `phone.css` L), imported at the top of that owner's own component, in `@layer components`, using only the page's `--xp-*` variables for anything drawn on the page and the app's own tokens for the top bar and sheets. Class names start `xe-`.

```ts
// components/portfolio/page-ctx.ts
export type ExtraSlot = { sectionId: string; kind: SectionKind; where: "above" | "below" | "over" };
```

Already there since release 2 (the figure route saves the graphs a figure replaced):

```ts
// lib/exhbt/draft-blocks.ts
export type AiVersion = {
  blocks: { [K in DraftBlock]?: BlockValues[K] };
  unverified: { [K in DraftBlock]?: string[] };
  /** The graphs the draft drew that a figure from the work took the place of (decision 0025), newest draft only. */
  graphs?: Chart[];
};
```

What you add:

```ts
// app/(app)/exhbts/[id]/figure-actions.ts  ("use server")
/** The drafted graph at `index`, with the numbers on it that are not in the person's source text. The owner only. */
export async function draftedGraph(id: string, index: number): Promise<{ ok: true; chart: Chart; flags: string[] } | { ok: false; error: string }>;
```

`useEnv().draftTools?.aiVersion.graphs` is how many there are to offer, already loaded by the edit page.

## Steps

Commit and push after each.

1. **`GraphExtras` and `ChartSheet`.** `GraphExtras` (`where: "over"`) is a button over the graph's corner, "Edit figures" (named "Edit figures: Graph 1"); a click on the graph itself does the same: `ui.open("chart", sectionId)`. `ChartSheet` holds the existing `ChartEditor` with `bare`, for that section: the group named "Graph N" with its kind radios, as now. Each change goes to `store.patch(id, …)` with no undo name, so the graph on the page redraws behind the sheet as you type. Issues at `sections.N.chart.*` are passed in. A graph just added opens its sheet at once. `ui.jumpTo` on a chart path opens the sheet (G's jump does this; check it lands on the field).
2. **`ImageExtras`, below the picture:** the description, labelled "Image n: describe it for people who can't see it" with the id `image-<n-1>-alt` (n counts images, from 1), `data-path="sections.N.alt"`, and a small "Needs a description" mark until it has words. It is in the editor only and must not shift the picture: the box-for-box test in `e2e/editor-inplace.spec.ts` allows this field's own height and nothing else.
3. **`ImageExtras`, above the picture:** when the image has `picked`, the existing `PickedFigure` strip: where it came from, the tick "I may share this figure on my portfolio" (`store.patch`), Crop and Choose another page (`useFiles().replaceImage`; the source link from `useEnv().figureSources`). The issue at `sections.N.picked.shareOk` shows there.
4. **`LinkExtras`:** "Web address", `data-path="sections.N.href"`, under the link; "(optional)" beside the label where `formatLimits(f).link.hrefOptional`.
5. **Take a figure from my report.**
   - `canTakeFigure(doc, reportFiles)`: true when the layout takes something from the work (`FORMAT_RULES[f].fromWork` is not `"none"`), there is at least one stored report, no image on the exhbt has `picked`, and there is room for an image.
   - `FigureSheet` (`ui.sheet.name === "figure"`): choose the report if there are several; its first 30 pages as thumbnails, drawn in the browser from the stored PDF as `PickedFigure`'s "Choose another page" does; a click takes that page whole; then the crop. No AI call. On confirm: upload the picture (`uploadForExhbt`), then one `store.patchDoc` named "take a figure" that places it with `withKeyFigure` and `picked: { from, sourceFileId, page, box, shareOk: false }`. It removes no graph: the person chose it by hand. The cursor then goes to its description.
6. **The drafted chart back.**
   - The graphs are already kept: since release 2 the figure route saves what `withWorkVisual` removed in the AI version's `graphs`. An exhbt drafted before release 2 has none, and gets no offer.
   - `draftedGraph(id, index)`: the owner only (follow `draft-tools-actions.ts`); reads the AI version and the kept source text; returns the chart and the numbers on it that are not in the source (`unverifiedNumbers` on a doc holding just that graph). If the source is gone, return the chart with every number flagged.
   - `DraftedGraph`: a quiet line under the page, shown when there is a kept graph, the exhbt has no graph section, and the layout has room for one: "The chart drafted from your numbers is kept." and a button, "Put it back". It calls the action, adds a graph section where the layout wants its figure with that chart, and adds the flags to the doc's numbers to check, as one `store.patchDoc` named "put the drafted chart back". Say what happened ("The drafted chart is back. Check the 2 numbers flagged at the top.").

## Tests

`e2e/editor-figures.spec.ts`, using `e2e/page-editor.ts` (read it, do not edit it) and the fixtures `e2e/auto-figure.spec.ts` already uses (`e2e/fixtures/report-with-chart.pdf`):
- a new graph opens its sheet; typing a value redraws the graph on the page with the sheet open; the kind can be changed; an issue in the chart jumps into the sheet at its field;
- an image's description is typed under it, saved at `sections.N.alt`, and "Needs a description" goes; publishing is blocked without it and the entry in "Things to fix" lands in that field;
- an exhbt drafted from the chart report: the strip shows on the picked figure; the tick clears the issue; Crop and Choose another page work with no AI call;
- a link's address is typed under it and stored; a bad address shows its issue;
- an exhbt drafted from a report whose pick failed (make the pick request fail): the "+" offers "Take a figure from my report"; choosing page 3 and a crop puts the figure where the layout wants it, unticked, with no AI call made; Undo takes it off and its file is kept until it cannot come back;
- removing a picked graph: "Put it back" returns the drafted chart with its numbers, and a number not in the source is in the numbers to check; the stored doc never held the parked graph meanwhile (read it back);
- axe with the chart sheet and the figure sheet open.

Run: `e2e/editor-figures.spec.ts`, `e2e/auto-figure.spec.ts`, `e2e/editor-inplace.spec.ts`.

## Done looks like

The checks above pass; `e2e/auto-figure.spec.ts` still passes untouched; the classic editor's graph and picked-figure cards behave as before.

## Report back

The branch head; each `export` you added in `components/editor/`; whether stored reports were there to take a figure from (G's `reportFiles`); anything about a results table against a drafted chart you think Rory should see (0025 leaves it open); the specs you ran and their results.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `phase-2`, `main` or a release branch (`phase-2-r2`, `phase-2-r3`, `phase-2-r4`, `phase-2-r5`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with your own attribution lines, then the line `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`.
8. **House rules that bite here:** colours and corners on the exhbt page come only from the `--xp-*` variables; buttons in app chrome are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose; Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
10. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
