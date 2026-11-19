# Brief F: dragging sections, the "+" and the tray

| | |
|---|---|
| Release | 3, the editor |
| Model | Opus |
| Branch | `phase-2-r3-f-drag`, made from `phase-2-r3` after G's first milestone is merged |
| Port | 3306 |
| Starts when | G's first milestone is merged |

## Goal

Rebuild the prototype's drag on the real editor: sections slide to make room, the flowchart is carried over a still page with a line, and nothing flickers or shifts. Build the "+" between sections and the desktop tray on the same rules. This is the part Rory most wants and asked to be "super smooth", and its exact checks gate CI.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("Dragging", "The chrome", "Smoothness", "Not sure, and risky"). The prototype's report, `docs/briefs/edit-on-page/drag-prototype.md`, all of it. The prototype's code, which proved the method and which you build again against the real store and rows, not paste in: `git show origin/phase-2-lab:components/lab/Board.tsx`, `drag-plan.ts`, `layout.ts`, `blocks.ts`, `Tray.tsx`, `options.ts`, `lab.css`, and `git show origin/phase-2-lab:e2e/lab-editor.spec.ts` (the checks to carry over). Then, on your base: `components/exhbt-editor/store.ts`, `Frame.tsx`, `drag/index.ts`, `Insert.tsx`, `Tray.tsx` (G's stubs), `lib/exhbt/layouts.ts`, `components/portfolio/layout-rows.ts`, `LayoutMain.tsx`, and DESIGN.md's Dragging rule.

## You own

`components/exhbt-editor/drag/` (all of it, from G's stub on), `components/exhbt-editor/Insert.tsx`, `components/exhbt-editor/Tray.tsx`, `components/exhbt-editor/css/drag.css`, `e2e/editor-drag.spec.ts` (new), `scripts/editor-timing.mjs` (new).

## You must not touch

The rest of `components/exhbt-editor/` (`Frame.tsx` and `store.ts` are G's), `components/exhbt-editor/flow/` (K drags the boxes inside the flowchart; you drag the flowchart as a section), the page parts, `lib/exhbt/`, `app/globals.css`, `playwright.config.ts` (A made it, G owns it: a `touch` project on a Pixel 7 runs `editor-drag`, `editor-flow` and `editor-phone`; report if you need a change).

## What you build against

```ts
// lib/exhbt/layouts.ts  (pure and server-safe: no React, no DOM)
import type { ContentSection, ExhbtDoc, FlowStep, SectionKind } from "./blocks";
import type { Format, PageKind } from "./formats";

/** One thing the page draws in the main column, in page order. `index` is its place in doc.sections as stored (for issue paths); -1 for a flowchart with no marker. */
export type PageItem =
  | { id: "flow"; kind: "flow"; index: number; steps: FlowStep[] }
  | { id: string; kind: SectionKind; index: number; s: ContentSection };

/** How one item is drawn. "plain" is the item on its own row. */
export type ItemAs = "plain" | "lead" | "key" | "tile" | "stacked" | "kicker" | "before" | "after" | "button" | "listed";
export type ItemCell = { cell: "item"; item: PageItem; as: ItemAs };
/** Items one under another in one column of a pair, or on a row of their own. */
export type StackName = "happened" | "method" | "closing";
export type StackCell = { cell: "stack"; name: StackName; items: ItemCell[] };
export type Cell = ItemCell | StackCell;
/** "found": findings beside a figure. "even": two equal columns. "key": a narrow column beside the key figure. */
export type PairRatio = "found" | "even" | "key";
export type GroupOf = "graphs" | "images" | "figures" | "grid" | "links" | "refs" | "buttons" | "before-after";
export type Row =
  | { row: "one"; cell: Cell }
  /** `left` and `right` are in the doc's order. `reversed` is true when the usual right-hand part comes first, so the column widths mirror. */
  | { row: "pair"; ratio: PairRatio; reversed: boolean; left: Cell; right: Cell }
  | { row: "group"; of: GroupOf; items: ItemCell[] };

export function hasMarker(doc: ExhbtDoc): boolean;
/** Touched by the edit-on-page editor: it has the marker, or the flowchart has been taken off. */
export function isArranged(doc: ExhbtDoc): boolean;
/** False only when the layout lets the flowchart go and the doc says it has gone (flowOff, and no marker). */
export function flowShown(doc: ExhbtDoc): boolean;
/** The same page with the order written down: the marker put in, the sections in the order they are drawn. The same object when already arranged. */
export function adopt(doc: ExhbtDoc): ExhbtDoc;
/** A layout switch in the new editor: adopt, set the layout, sort the sections into its usual order (a stable sort). */
export function applyTemplate(doc: ExhbtDoc, to: Format): ExhbtDoc;
/**
 * What the main column draws, in order: the items of adopt(doc) that the layout shows, each with its index in `doc` as given.
 * `skip` leaves sections out before the order is worked out (the read-only page skips an image with no address and an aim
 * or conclusion with no words, as today's page does before it pairs anything). The editor never passes it.
 */
export function pageItems(doc: ExhbtDoc, skip?: (s: ContentSection) => boolean): PageItem[];
/** Sections the layout keeps but does not draw. */
export function keptItems(doc: ExhbtDoc): PageItem[];
export function rowsFor(items: PageItem[], f: Format): Row[];
/** Changes exactly when the layout of the page could: the layout, flowOff, and each item's id, kind and image stage, in order. */
export function structureKey(doc: ExhbtDoc): string;

export type BlockKind = PageKind;
/** `full` is why it cannot be added ("Up to 2 graphs in a case study"); undefined when there is room. */
export type BlockOption = { kind: BlockKind; name: string; full?: string };
/** What the "+" menu and the tray offer: the layout's kinds in its own order and words, then the flowchart when it is off the page. */
export function blockOptions(doc: ExhbtDoc): BlockOption[];

/** Structural changes. Each adopts the doc first. `at` and `place` count page items (pageItems), not doc.sections. */
export function insertBlock(doc: ExhbtDoc, kind: Exclude<BlockKind, "image">, at: number): { doc: ExhbtDoc; id: string } | null;
export function insertImage(doc: ExhbtDoc, image: { fileId: string; w?: number; h?: number }, at: number): { doc: ExhbtDoc; id: string } | null;
/** `place`: the item's index among the page items with the item itself taken out (0 is first). */
export function moveItem(doc: ExhbtDoc, id: string, place: number): ExhbtDoc;
/** Takes a section out. For the flowchart: removes the marker and sets flowOff; the boxes stay in doc.flow. */
export function removeItem(doc: ExhbtDoc, id: string): ExhbtDoc;
/** Puts a removed flowchart back: the marker goes in before the first page item whose place in the layout's usual order comes after the flowchart's (at the end if none), every other item keeps its place, and flowOff is deleted. The doc stays arranged. The same object when the flowchart is shown. */
export function restoreFlow(doc: ExhbtDoc): ExhbtDoc;
```

From `components/portfolio/layout-rows.ts`: `rowClass(row, f, first)` and `stackClass(name, f)` give the classes the page's own wrappers carry. Lay out your hidden measuring copy with them and with nothing else, so pairs, grids and gaps are the page's real CSS.

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

What you fill in. The signatures are fixed; G's frame and toolbar already call them.

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

## The rules, as Rory decided them

- A section **slides**: the others move aside by transform and a dashed box shows the room made.
- The flowchart, moved as a section, is **carried with a line** over a still page.
- These are constants in `drag/options.ts`, one line each, which G made and you now own: `SECTION_STYLE: "slide"`, `FLOW_SECTION_STYLE: "line"`. `FLOW_BOX_STYLE: "line"` in the same file is for the boxes inside the flowchart; K reads it. Do not rename any of the three.
- The grip is the only thing that drags.

## Steps

Commit and push after each.

1. **`drag/plan.ts`**: the prototype's `drag-plan.ts` on the real rows. Pure: `makePlan` from the frozen boxes, `placeAt` with the 10px margin, `lineFor`. Places count page items with the lifted one taken out, the same as `store.move`.
2. **`drag/measure.ts`**: lays out `rowsFor(items with the lifted one at a place)` as empty boxes in a hidden copy of the column, pairs, stacks and groups included, using `rowClass` and `stackClass`, and reads where each lands. A box keeps the height it had; one whose width changes takes the height it would roughly have (a picture keeps its shape, words keep their area).
3. **`drag/Board.tsx`**: `DragBoard` and `useBoard`. Freeze at pick-up; follow the pointer yourself (dnd-kit for the sensors and the press delay only: mouse after 6px, touch after a 150ms press with 8px of tolerance); slide by transform or draw the line; the lifted copy on a card with the pack shadow and an outline in the look's link colour, never scaled, drawn with `ItemView` and no adapter; the drop as a move from where it was let go, 180ms, transforms only; nothing animated under reduced motion. Find sections by `data-section-id` each time: a section that changes row is a new node. Clip the canvas so a carried copy cannot lengthen the page. Every step is said through `ui.say`.
4. **Keyboard**: Space or Enter on the grip, arrows a place at a time, Space or Enter to drop, Escape to cancel, Tab drops. `moveBy` does the same motion for the move buttons and keeps the focus on the button pressed, or the other one at an end.
5. **`remove` and `add`**: the motion, the words, and the focus (to what took a removed section's place; into a new text section's field). For a graph, `add` calls `ui.open("chart", id)` once it is placed, so its figures sheet opens (J fills the sheet; G's stub already holds `ChartEditor`). For an image, `add` opens the file picker and puts the pictures there through `useFiles().addImages(files, at)`; G's status line says "Uploading 1 of 3" from the moment they are chosen and shows a failed upload's reason, so do not draw your own.
6. **`Insert.tsx`**: the "+" in the gap above each row and at the end. The end one has the id `add-section`, the name "Add a section" and `data-path="sections"` (the anchor for "Things to fix" issues about how many of a kind; when G's jump lands on it, it gets an `xe-jump` event and opens its menu); each other one is named "Add a section before <label>" (`sectionLabel` of the item after it). It opens the list from `blockOptions(doc)`: each kind with its icon and the layout's word for it; a full kind dimmed and not choosable, with its reason under it and tied to it; the words left (`data-testid="words-left"`) at the top; and when every kind is full, one line above them: "This <layout> is full. Remove a section to add another, or try another layout." When `canTakeFigure(doc, useEnv().reportFiles)` (from `components/exhbt-editor/figures/take.ts`, J's) is true, the list ends with "Take a figure from my report", which calls `ui.open("figure")`; when the image kind is full, that entry is dimmed with the image's reason instead. On a phone the "+" sits at the left of the gap. It must take no room: nothing on the page moves when it is there.
7. **`Tray.tsx`**: the rail, drawn only from a 77rem window with `pointer: fine`, fixed in the right margin beside the page's frame, clear of the top and bottom fifths of the window, inside the look's wrapper so it takes the look's colours. A block dragged from it has no place until it is over the page, then is placed by the same plan; the page scrolls itself when it is held near an edge (the board does this for a tray block, since dnd-kit will not). Enter on a block adds it after `board.lastFocus()`, or at the end, and says so. A full kind cannot be dragged or added and gives its reason. At the top of the rail: the words left, and the same "full" line as the "+" when every kind is full.
8. **`scripts/editor-timing.mjs`**: the prototype's `scripts/lab-timing.mjs` pointed at G's sign-in-free harness, `/dev/editor-timing?sample=gallery`, on a production build made with `EXHBT_LAB=1` (the only way the harness is served in production; never set it anywhere else, and add no sign-in route), with the processor slowed four times: the longest and median frame during a scripted drag of the gallery sample's lead image to the foot of the page and at the drop, and keystroke-to-paint for 40 characters in a finding. It prints a table. It is not a test.

## What the prototype did not prove

It drew every sample with the case study's pairing and an even grid. The gallery's justified rows (tiles of different widths), research's stacks, and a pair forming or splitting are new here. Sliding must stay **stable** there (the no-flicker check) even where the picture mid-drag is not exact. If you cannot make sliding stable for a kind of row, do not ship a flicker: draw the line for that row only, and say so plainly in your report, because it changes what Rory chose and he has to agree.

## Tests

`e2e/editor-drag.spec.ts`, carried over from `e2e/lab-editor.spec.ts`, on each layout's sample (loop over `offered()` and `SAMPLES` from `e2e/page-editor.ts`, so release 4 adds four layouts with no change here), desktop project unless said:
- a click on a grip or a nudge under 6px is not a drag; words in a section can still be selected;
- **nothing moves when a drag starts, and until the drop every section's layout box is unchanged**; a slide changes only transforms; the drop's motion is transforms only and 180ms; (check 3 of 0026's "Smoothness");
- the flowchart is carried with a line over a still page, by mouse and by keyboard; every other section slides;
- dropped into a pair, out of a pair, into the image grid and out of it, the stored order is the place shown;
- **no flicker**: resting on a boundary and trembling 2px either side 40 times never changes the place, beside a pair, down the side of a pair, along a row of the grid, between two rows of it, and beside a stack (check 4);
- the keyboard moves a section across a pair and into and out of the grid, each step read out;
- the page scrolls itself with the pointer still near the bottom edge and near the top edge, and stops at its end; and the same for a block carried from the tray near the bottom edge (dnd-kit does not do this for something fixed to the window);
- with reduced motion `document.getAnimations()` is empty during and after a drag;
- the frame, the line and the lifted copy take the look's colours in Exhbt and Night, and pass contrast in all eight looks;
- the "+": every kind the layout holds, the real caps and reasons, on each layout; a new block lands where the "+" was; nothing moves when the menu opens; each "+" has its own name; on a full case study the "full" line shows; a new graph opens its figures sheet;
- the tray: there at 77rem and gone at 76rem; beside the page and never over it; a block dragged into a gap, beside the findings and into the grid; the keyboard way; a full kind refused;
- on the `touch` project: a swipe on a section's words and on a picture scrolls and moves nothing; a quick swipe from a grip picks nothing up; a 260ms press picks up; no tray;
- axe with a section lifted.

Run: `e2e/editor-drag.spec.ts` on both projects, and `e2e/editor-smooth.spec.ts` (G's; your work must not break it).

## Done looks like

Every check above passes on every offered layout; the timing script runs and you have its table; `drag/options.ts` has the three constants.

## Report back

The branch head; the timing table; any row where you fell back to the line, or wanted to; anything in the store or the frame you needed changed; what only a real finger can tell (list it for Rory's try); the specs you ran and their results.

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
