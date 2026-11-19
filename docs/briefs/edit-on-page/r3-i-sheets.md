# Brief I: the publish sheet, the card details sheet and the work

| | |
|---|---|
| Release | 3, the editor |
| Model | Sonnet |
| Branch | `phase-2-r3-i-sheets`, made from `phase-2-r3` after G's first milestone is merged |
| Port | 3309 |
| Starts when | G's first milestone is merged |

## Goal

Build the three places where the new editor edits things the page does not draw as words: publishing, the portfolio card's summary and headline number, and the work (the file or link behind "See the work"). Each is a port of a card in today's editor into a sheet.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("What the page does not draw", "Saving, and what may delete a file", "Accessibility"). `DESIGN.md`. On your base: `components/exhbt-editor/sheets/` (G's stubs), `ui/Sheet.tsx`, `store.ts`, `context.ts`, `files.ts`; and, to port from, `components/editor/Editor.tsx`: `publish()` and the "Publish" section, the "One-sentence summary" and "Headline number" fields in the first card, and the "The work" card. Also `components/exhbt/ExhbtTile.tsx` (the portfolio tile).

## You own

`components/exhbt-editor/sheets/` (every file in it), `components/exhbt-editor/css/sheets.css`, `e2e/editor-sheets.spec.ts` (new).

## You must not touch

Anything else. `ui/Sheet.tsx` is G's: if it lacks something, report it. The server actions (`publishExhbt`, `unpublishExhbt`) are unchanged: call them as the classic editor does.

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

`ui/Sheet.tsx` gives you the sheet itself (a native dialog, at the side on a desktop and full screen on a phone, with a title, Escape to close and the focus given back). Each of your components renders its sheet only while `useUi().sheet?.name` is its own.

## Steps

Commit and push after each. Keep every label and message below exactly: the migrated tests look for them.

1. **`PublishSheet`** (`ui.sheet.name === "publish"`), titled "Review and publish". Port the classic editor's publish section and `publish()`:
   - a plan that cannot publish: "This exhbt is a preview only: nobody else can see it." and the existing `UpgradePrompt`;
   - no username: "You need a username to publish." with the link "Choose one";
   - when there are issues: "3 things to fix before this can go live." and a button, "Show me", which closes the sheet and calls `ui.jumpTo` on the first issue's path;
   - the tick, labelled exactly "This is my work, and the numbers are true", bound to `ui.confirmed` and `ui.setConfirmed`;
   - the button "Publish", or "Publish changes" when it is live. On press: `useIssues().setTried(true)`; `await useSave().settled()`; `publishExhbt(id, store.get(), ui.confirmed)`. On success: `useSave().markSaved(doc)`, `useFiles().markPublished(doc)`, and the live panel: "It's live." or "Your changes are live.", the address, "View it", the existing `CopyLink`, "Back to your exhbts". On failure: the reasons, in a `role="status"` list;
   - when it is live and nothing is in progress: "Live at <address>".
2. **`CardSheet`** (`"card"`), titled "Card and link details". Two columns on a desktop: the fields, and beside them the portfolio tile (`ExhbtTile`) drawn from the doc as it is typed.
   - "One-sentence summary", id `summary`, `data-path="summary"`, with its word limit and the hint "What you found, in one sentence. Shown on your portfolio's cards.";
   - "Headline number" and "What the number measures" (`data-path="headline"`), "(optional, shown on job links)".
   Write through `store.patchDoc` with no undo name (it is typing). Show the issue at `summary` under its field.
3. **`WorkButton`**: what the page's sidebar shows in place of "See the work" while editing. Drawn as that button is, reading "The work: <name>" or "Add the work", `data-path="evidence"`. It opens the work sheet.
4. **`WorkPanel`** (`"work"`), titled "The work". Port the classic editor's card: "Link to the work" (id `evidence-href`) and "Name on the button" (id `evidence-label`); "Attach a file instead" and, with a file, "Replace the file" and "Remove" (`useFiles().attachWork`, `.removeWork`); the hidden file input named "Choose a file"; the upload's progress and error from `useFiles()`; the hint with the plan's size limit (`useEnv().maxFileMb`). A link is written with `store.patchDoc`. The issue at `evidence` shows under the link field.

## Tests

`e2e/editor-sheets.spec.ts`, using `e2e/page-editor.ts` (read it, do not edit it):
- publishing a complete exhbt: tick, "Publish", "It's live.", and the live address opens the page; then a change and "Publish changes" gives "Your changes are live.";
- publishing an incomplete one: the reasons show, "Show me" lands the cursor in the first field to fix, and the page's "Confirmed by" check is hollow until the tick is made;
- a Free plan sees the preview-only words and no Publish button;
- the summary typed in the sheet shows on the tile beside it at once, is saved, and an over-long one shows its issue; `ui.jumpTo("summary")` (through "Things to fix", if H has landed, or by calling it in the page) opens the sheet with the cursor in the field;
- the work: a link and its name appear on the sidebar button; a file can be attached, replaced and removed; removing it and pressing Undo brings it back with its file still there;
- each sheet traps focus, closes on Escape and returns focus to what opened it; at 390px it fills the screen;
- axe with each sheet open.

Run: `e2e/editor-sheets.spec.ts`, `e2e/editor-inplace.spec.ts`.

## Done looks like

The checks above pass; nothing outside your folder changed; the labels in this brief are exact.

## Report back

The branch head; anything you needed from `ui/Sheet.tsx` or a hook that was not there; anything in the classic editor's publish flow you could not carry over; the specs you ran and their results.

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
