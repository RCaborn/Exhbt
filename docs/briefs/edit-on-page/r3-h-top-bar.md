# Brief H: the top bar, the layout menu and "Things to fix"

| | |
|---|---|
| Release | 3, the editor |
| Model | Sonnet |
| Branch | `phase-2-r3-h-topbar`, made from `phase-2-r3` after G's first milestone is merged |
| Port | 3308 |
| Starts when | G's first milestone is merged |

## Goal

Build the one row at the top of the new editor: where you are, the layout, Undo, the word count, what needs fixing, the visitor's view, the save status and the way to publish. Everything it does goes through hooks G has already built; you write no editing logic of your own.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("The chrome", "What the page does not draw", "Undo", "The classic editor", "Accessibility") and `docs/decisions/0027-layout-engine.md` ("Layouts are starting templates"). `DESIGN.md`. On your base: `components/exhbt-editor/topbar/TopBar.tsx` (G's stub), `store.ts`, `context.ts`, `ui/Sheet.tsx`; and, to port from, `components/editor/Editor.tsx` (the sticky bar, `WordBar`, the list of problems, the numbers to check), `LayoutPicker.tsx` (the radios, the sketches, the notes after a switch, the line after a draft), `model.ts` (`labelOf`, `unverifiedOf`, `confirmNumber`).

## You own

`components/exhbt-editor/topbar/` (every file in it), `components/exhbt-editor/css/topbar.css`, `e2e/editor-topbar.spec.ts` (new).

## You must not touch

Anything else. `components/editor/` is frozen: import from it, and copy the three layout sketches out of `LayoutPicker.tsx` (it is deleted in release 5). The publish sheet and the card sheet are I's: you only open them.

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
  /** A change inside one section that is not typing (a graph's numbers, a tick, before or after). With `undo`, it is one undo entry with that name. */
  patch(id: string, fn: (s: ContentSection) => ContentSection, undo?: string): void;
  /** A change outside the sections (the work, the card's summary, a skill, a confirmed number, an AI rewrite). */
  patchDoc(fn: (d: ExhbtDoc) => ExhbtDoc, undo?: string): void;

  /** Structural changes: each adopts the doc first and is one undo entry. `at` and `place` count page items (pageItems in lib/exhbt/layouts.ts). */
  move(id: string, place: number): void;
  /** Returns the new section's id, or null when the layout has no room (blockOptions says why). */
  insert(kind: Exclude<BlockKind, "image">, at: number): string | null;
  insertImage(image: { fileId: string; w?: number; h?: number }, at: number): string | null;
  remove(id: string): void;
  setLayout(f: Format): void;

  /** The flowchart's boxes. A box has no stored id, so each gets a key that lasts for the visit. */
  flowKeys(): readonly string[];
  flowAdd(at: number): string | null;
  flowRemove(key: string): void;
  flowMove(key: string, to: number): void;

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

The store tells its subscribers about every change, the undo list included: read the undo label with `useSyncExternalStore(store.subscribe, store.undoLabel)`.

From the model: `OFFERED_FORMATS`, `FORMAT_RULES[f].name` and `.bestFor` (`lib/exhbt/formats.ts`); `formatLimits(f)` and `wordCount(doc)` (`lib/exhbt/blocks.ts`); `layoutNotes(doc)` (`lib/exhbt/sections.ts`); `pathOfNumber(doc, n)` (`lib/exhbt/verify.ts`); the wording after a draft, from whatever `LayoutPicker.tsx` uses on your base.

G makes each of these files in its first milestone with the signature shown and a body that works in the plainest way. From the moment that milestone is merged the file belongs to the owner named, who replaces the body. The signature does not change. All are `"use client"` and take what they need from the hooks (`useStore`, `useDoc`, `useUi`, `useEnv`, `useIssues`, `useSave`, `useFiles`), never from props G would have to thread.

| File in `components/exhbt-editor/` | Export | Owner | G's stub does |
|---|---|---|---|
| `topbar/TopBar.tsx` | `TopBar(): ReactNode` | H | back link, the heading "Edit exhbt", the save status, a plain Publish button that opens the publish sheet |
| `sheets/PublishSheet.tsx` | `PublishSheet(): ReactNode` | I | the tick and the Publish button, calling `publishExhbt` |
| `sheets/CardSheet.tsx` | `CardSheet(): ReactNode` | I | nothing |
| `sheets/WorkPanel.tsx` | `WorkPanel(): ReactNode` | I | nothing |
| `sheets/WorkButton.tsx` | `WorkButton(): ReactNode` (what `edit.work()` returns) | I | the button, drawn as "See the work" is, opening the work sheet |
| `figures/ImageExtras.tsx` | `ImageExtras(props: ExtraSlot): ReactNode` | J | below: the description field (`image-N-alt`); above: nothing |
| `figures/LinkExtras.tsx` | `LinkExtras(props: ExtraSlot): ReactNode` | J | the "Web address" field |
| `figures/GraphExtras.tsx` | `GraphExtras(props: ExtraSlot): ReactNode` | J | an "Edit figures" button that opens the chart sheet |
| `figures/ChartSheet.tsx` | `ChartSheet(): ReactNode` | J | the existing `ChartEditor` (`bare`) for `ui.sheet.sectionId` |
| `figures/FigureSheet.tsx` | `FigureSheet(): ReactNode` | J | nothing |
| `figures/DraftedGraph.tsx` | `DraftedGraph(): ReactNode` (drawn under the page) | J | nothing |
| `figures/take.ts` | `canTakeFigure(doc: ExhbtDoc, reportFiles: { fileId: string }[]): boolean` | J | returns false |
| `flow/FlowEdit.tsx` | `useFlowEdit(): FlowEdit` | K | `list` returns its children; `box` returns the `<li>` with a lasting key; `tools` and `add` return null |
| `drag/index.ts` | `DragBoard(props: { children: ReactNode }): ReactNode`; `useBoard(): Board` | F | `DragBoard` returns its children; `useBoard` moves and removes through the store with no motion |
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
  /** Add a block at a place, with the motion and the focus put in it. Returns its id, or null when there is no room. */
  add(kind: BlockKind, at: number): string | null;
  /** The section the focus was last in, for "add after the section you were last in". */
  lastFocus(): string | null;
};
```

The buttons in a section's toolbar carry `data-grip`, or `data-tool` with one of `up`, `down`, `action`, `more`, `remove`, so another agent's CSS and tests can find them.

Each owner's CSS goes in its own file in `components/exhbt-editor/css/` (`core.css` G, `drag.css` F, `flow.css` K, `topbar.css` H, `sheets.css` I, `figures.css` J, `phone.css` L), imported at the top of that owner's own component, in `@layer components`, using only the page's `--xp-*` variables for anything drawn on the page and the app's own tokens for the top bar and sheets. Class names start `xe-`.

## Steps

Commit and push after each. Buttons are Astryx Buttons through `components/ui/Button.tsx`. The bar is app chrome: the app's own tokens, not the page's.

1. **The row.** One sticky row: a link back, "Your exhbts"; the heading "Edit exhbt" at level 1 (small, or visually hidden) and the chip (Draft, Live, or Preview only when the plan cannot publish); then the parts below; "Review and publish" last, opening the publish sheet (`ui.open("publish")`). Under 48rem keep the back link, the word count, the things to fix, the save status and "Review and publish"; the rest go into the menu.
2. **The layout menu.** A button showing the layout's name opens a panel holding `role="radiogroup" aria-label="Layout"`: one radio for each of `OFFERED_FORMATS`, and one for the doc's own layout if it is not among them, each with its sketch and its "best for" line, the radio's name starting with the layout's name. Choosing one calls `store.setLayout(f)` and says, in a `role="status"` line that stays until the next change: "Laid out as a gallery. Undo restores your order.", then anything from `layoutNotes(doc)` (what is kept and not shown; what is over the layout's caps, in the error colour). Right after an AI draft, show once the same line the classic editor shows under its layout choice.
3. **Undo.** A button named "Undo: <label>" from `store.undoLabel()`, off when there is nothing to undo. It calls `store.undo()` and says what it undid.
4. **The word bar.** Port `WordBar` as it is: `[data-word-bar]`, `data-over` when over, text beginning "N words".
5. **Things to fix.** A button, "3 things to fix" (hidden at none), opens a panel: `role="region" aria-label="Things to fix before publishing"`. It lists `useIssues().shown` (all of them once publishing has been tried), each as a button reading "<label>: <message>" (`labelOf`), which calls `ui.jumpTo(path)` and closes the panel. Above them, each number the AI could not find in the person's files: "Check this number: 18%", with "That's right" (named "That's right: 18%"; `store.patchDoc((d) => confirmNumber(d, n), "confirm 18%")`) and "Show me" (`ui.jumpTo(pathOfNumber(doc, n))`, or nothing if it returns null). Focus goes into the panel when it opens and back to the button when it closes.
6. **See as a visitor.** A button with `aria-pressed`, calling `ui.setVisitor`.
7. **The save status.** `role="status"`: "Saved" or "Saving…". On an error: a button, "Not saved. Retry" (`useSave().flush()`), and "Kept in this browser." with the reason.
8. **Card and link details**: a button, `ui.open("card")`.
9. **The menu** at the end: "Unpublish" (only when live; the existing `ConfirmAction` with `unpublishExhbt`), "Delete this exhbt" (`ConfirmAction` with `deleteExhbt`), and "Use the classic editor": wait for `useSave().flush()`, then go to the same address with `?editor=classic`.

## Tests

`e2e/editor-topbar.spec.ts`, using `e2e/page-editor.ts` (G's; read it, do not edit it):
- the heading, the chip, the back link;
- the layout menu lists three; choosing Gallery changes `article[data-format]` and the order, says the line, and Undo gives back the layout and the order exactly;
- the word bar counts as you type and turns over past the cap;
- an empty title and a box with too many words show in "Things to fix"; each entry puts the cursor in its exact field; a number to check can be confirmed, and "Show me" finds it;
- "See as a visitor" shows a region named "Preview" with no fields in it, and pressing again brings the fields back;
- "Saving…" then "Saved" after a change;
- "Use the classic editor" lands on `[data-editor="classic"]` with the change made just before it saved;
- at 390px wide the row does not scroll sideways and every control is at least 44px;
- axe with each panel open.

Run: `e2e/editor-topbar.spec.ts`, `e2e/editor-inplace.spec.ts`.

## Done looks like

The checks above pass; nothing outside your folder changed; the selectors `[data-word-bar]`, the radiogroup "Layout", the region "Things to fix before publishing" and the status words are exactly as written here, because the migrated tests look for them.

## Report back

The branch head; anything you needed from a hook that was not there; anything in `components/editor/` you had to copy; the specs you ran and their results.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `phase-2`, `main` or a release branch (`phase-2-r2`, `phase-2-r3`, `phase-2-r4`, `phase-2-r5`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip or delete a test to make it pass.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with your own attribution lines, then the line `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`.
8. **House rules that bite here:** colours and corners on the exhbt page come only from the `--xp-*` variables; buttons in app chrome are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose; Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
