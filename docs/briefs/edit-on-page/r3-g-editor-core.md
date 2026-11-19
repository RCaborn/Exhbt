# Brief G: the editor's core

| | |
|---|---|
| Release | 3, the editor |
| Model | Opus |
| Branch | `phase-2-r3-g-core`, made from `phase-2-r3` after A is merged |
| Port | 3307 |
| Starts when | A (the edit page's switch, the gate and the crash fallback) is merged into `phase-2-r3`. Six agents wait for your first milestone |

## Goal

Build the frame of the edit-on-page editor: the store, the adapter that puts fields on the real page, typing in the page's own type, autosave, undo and file safety. A has already made the edit page serve the new editor, the error boundary round it and stubs for the files you take over. Everything the other release 3 agents build plugs into files you create, so your first milestone is their interfaces, working in the plainest way.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` (all of it) and `docs/decisions/0027-layout-engine.md` ("A doc the new editor has never touched", "Layouts are starting templates", "The published copy keeps the order"). The prototype's findings, `docs/briefs/edit-on-page/drag-prototype.md` ("Typing in the page's own type", "What the real editor will need"). Its code is reference for how typing and the store were made to work, not code to copy in: `git show origin/phase-2-lab:components/lab/store.ts`, `fields.tsx`, `ContextField.tsx`, `lab.css`. Then, on your base: `components/portfolio/page-ctx.ts`, `ProjectView.tsx`, `LayoutMain.tsx`, `app/dev/edit-slots/` (a stand-in adapter that shows every slot), A's files (`components/exhbt-editor/EditorGate.tsx`, `EditorShell.tsx`, `StandIn.tsx`, `context.ts`, `pending.ts`, `app/(app)/exhbts/[id]/edit/page.tsx`), `components/editor/Editor.tsx` (the logic you port: publishing, images, the work, the backup offer), `useAutosave.ts` (`writeBackup` is exported since release 2), `media.ts`, `model.ts`, `BlockTools.tsx`.

## You own

- `components/exhbt-editor/`: everything in it, A's files included from A's merge (`EditorGate.tsx`, `EditorShell.tsx`, `StandIn.tsx`, `context.ts`, `pending.ts`), until the hand-over of the plugs below
- from A's merge: `app/(app)/exhbts/[id]/edit/page.tsx`, `app/(app)/exhbts/[id]/edit/error.tsx`, `playwright.config.ts`, `e2e/editor-classic.spec.ts`
- `.github/workflows/ci.yml` (the e2e shards only), `app/dev/editor-timing/` (new)
- `e2e/page-editor.ts` (new), `e2e/editor-inplace.spec.ts`, `e2e/editor-smooth.spec.ts` (new)
- the page parts, for slot fixes only: `components/portfolio/ProjectView.tsx`, `exhbt-parts.tsx`, `LayoutMain.tsx`, `layout-rows.ts`, `page-ctx.ts`. Any change there must leave `e2e/layout-parity.spec.ts` and `e2e/edit-slots.spec.ts` passing, and may not change a signature in the blocks below
- the editor paragraphs of `DESIGN.md`, `docs/MAP.md`, `HANDOFF.md` and `AGENTS.md`

## You must not touch

`components/editor/` (frozen: you import from it), `lib/exhbt/`, `lib/site.ts` (the switch is done), `app/globals.css`, `components/exhbt/MethodFlow.tsx` (K's), the server actions in `app/(app)/exhbts/[id]/actions.ts` (unchanged on purpose), `e2e/editor.ts` and the existing specs (N's).

## What you build against

The page's side, built in release 2 and on your base:

```ts
// components/portfolio/page-ctx.ts  (types only: no "use client", no values, safe to import anywhere)
import type { ReactNode } from "react";
import type { RichText, SectionKind } from "@/lib/exhbt/blocks";
import type { Format, PageKind } from "@/lib/exhbt/formats";
import type { ItemAs } from "@/lib/exhbt/layouts";

export type Sub = "h2" | "h3";
export type ImageUrls = Record<string, string | null>;

/** The path validateForPublish reports for a field: "title", "gap", "flow.2.step", "sections.3.items.1", "sections.4.alt". */
export type FieldPath = string;

/** Plain text typed in the page's own type. The adapter returns a labelled field with no box of its own. */
export type TextSlot = {
  path: FieldPath;
  value: string;
  /** The field's accessible name: "Box 3", "Who said it". */
  label: string;
  placeholder: string;
  /** A fixed DOM id, where the tests rely on one: "title", "context", "whereWhen", "myRole", "flow-box-2". */
  id?: string;
  /** A hard cap in characters, where the model has one. */
  maxChars?: number;
};

/** Formatted text (bold, italic, links; or the highlight). The adapter renders a <div> with `className` and the field in it. */
export type RichSlot = {
  path: FieldPath;
  value: RichText;
  label: string;
  placeholder: string;
  /** The classes of the element the page draws this text in, when that element is a <p>: the adapter's <div> takes its place. "" when the page keeps its own element (<li>, <figcaption>) and the field goes inside it. */
  className: string;
  /** The context line: bold is drawn as the highlight and the one button says Highlight. */
  highlight?: boolean;
};

/** One page item. Every value is a string, a number or a boolean, so the frame can be memoised. */
export type ItemSlot = {
  id: string;
  kind: PageKind;
  as: ItemAs;
  /** The classes the read-only page puts on this item's root for its place in the column (the row's margin). The frame carries them and the part inside is drawn without them. "" inside a pair, a stack or a group. */
  rowClass: string;
  /** Its place among the page's items, from 0, and how many there are. */
  index: number;
  count: number;
};

/** The "+" before the page item at `at`. `end` is the one after the last item. */
export type InsertSlot = { at: number; end?: boolean };

/**
 * Edit-only things that belong to a part but are not on the published page: an image's description and picked-figure label, a link's "Web address", a graph's "Edit figures", the aim or hypothesis switch.
 * "above" is drawn over the part's top edge and "over" over a corner: they take no room (decision 0026, "Edit-only controls take no room").
 * "below" is an image's description field, in the flow under the picture and its caption: one of the two edit-only fields 0026 allows in the flow (`EDIT_ONLY_IN_FLOW`).
 */
export type ExtraSlot = { sectionId: string; kind: SectionKind; where: "above" | "below" | "over" };

/** Controls for point `index` of a list (move up, move down, remove). `index === n` is the control that adds a point. All of them are drawn over the list and take no room. */
export type ListSlot = { path: FieldPath; index: number; n: number };

/** The flowchart's own slots, so MethodFlow keeps its markup and classes. */
export type FlowEdit = {
  /** Wraps the whole list (the adapter returns the <ol> it is given, inside whatever it needs round it). */
  list(o: { count: number; stack: boolean; children: ReactNode }): ReactNode;
  /** One box. The adapter renders the <li> itself with `className`, so it can be the thing that is dragged, and gives it a key that lasts. */
  box(o: { index: number; last: boolean; className: string; children: ReactNode }): ReactNode;
  /** Inside a box, out of the flow: its grip and its remove button. */
  tools(o: { index: number; count: number }): ReactNode;
  /** In the arrow after box `after`: the "+" that adds a box there. `after === count - 1` is the one at the end. */
  add(o: { after: number; count: number }): ReactNode;
};

/** A part of the page with no frame of its own: the title with the facts, the context line, the skills. */
export type ShellTools = { block: "header" | "gap" | "skills" };

export type EditAdapter = {
  text(o: TextSlot): ReactNode;
  rich(o: RichSlot): ReactNode;
  item(o: ItemSlot): ReactNode;
  insert(o: InsertSlot): ReactNode;
  extra(o: ExtraSlot): ReactNode;
  list(o: ListSlot): ReactNode;
  flow: FlowEdit;
  /** The skill pills, each with remove, then the "Add a skill" box (id `skill-new`) at their end, in the flow: one of the two edit-only fields 0026 allows there. Takes the place of the read-only list, and is drawn even when there are no skills, when the box alone is the block's placeholder. */
  skills(): ReactNode;
  /** The sidebar's control for the work. Takes the place of "See the work". */
  work(): ReactNode;
  /** A shell part's corner toolbar, out of the flow: "More actions" (rewrite, back to the AI version) where the AI drafted it. */
  tools(o: ShellTools): ReactNode;
};

/** What every page part is given. `edit` is absent on every public page. */
export type PageCtx = { Sub: Sub; imageUrls: ImageUrls; format: Format; edit?: EditAdapter };
```

```ts
// components/portfolio/LayoutMain.tsx  (server-safe: no hooks, no "use client")
/** The main column below the context line: the rows of rowsFor(pageItems(doc), format), drawn in order. */
export function LayoutMain(props: { doc: ExhbtDoc; ctx: PageCtx }): React.ReactNode;
/** One page item, drawn the way `as` says. `rowClass` goes on its root (read-only page); the editor's frame leaves it out and carries those classes itself. */
export function ItemView(props: { item: PageItem; as: ItemAs; ctx: PageCtx; rowClass?: string }): React.ReactNode;

// components/portfolio/layout-rows.ts  (pure: strings only, no React)
/** The classes of a row's root, its margin included. `first`: it is the first row under the context line. */
export function rowClass(row: Row, f: Format, first: boolean): string;
/** The classes of a stack's wrapper. */
export function stackClass(name: StackName, f: Format): string;

// components/portfolio/ProjectView.tsx: every prop it has today, unchanged, plus
//   edit?: EditAdapter      // only the editor passes it
// It builds ctx = { Sub, imageUrls, format, edit } once and hands it to every part.
// components/exhbt/MethodFlow.tsx: MethodFlow gains  ctx?: PageCtx  (page variant only).
```

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
/** `name` is the kind's noun in the layout's own words, as the "+" and the tray show it ("Graph", "What happened", "Reference", "Flowchart"). `full` is why it cannot be added ("Up to 2 graphs in a case study"); undefined when there is room. */
export type BlockOption = { kind: BlockKind; name: string; full?: string };
/** What the "+" menu and the tray offer: the layout's kinds in its own order and words, then the flowchart when it is off the page. */
export function blockOptions(doc: ExhbtDoc): BlockOption[];

/** Structural changes. Each adopts the doc first. `at` and `place` count page items (pageItems), not doc.sections. */
/** `kind` "flow" puts a removed flowchart back at `at` (restoreFlow(doc, at)) and returns the id "flow"; null when the flowchart is on the page already. */
export function insertBlock(doc: ExhbtDoc, kind: Exclude<BlockKind, "image">, at: number): { doc: ExhbtDoc; id: string } | null;
export function insertImage(doc: ExhbtDoc, image: { fileId: string; w?: number; h?: number }, at: number): { doc: ExhbtDoc; id: string } | null;
/** `place`: the item's index among the page items with the item itself taken out (0 is first). */
export function moveItem(doc: ExhbtDoc, id: string, place: number): ExhbtDoc;
/** Takes a section out. For the flowchart: removes the marker and sets flowOff; the boxes stay in doc.flow. */
export function removeItem(doc: ExhbtDoc, id: string): ExhbtDoc;
/**
 * Puts a removed flowchart back and deletes flowOff. Every other item keeps its place, and the doc stays arranged. The same object when the flowchart is shown.
 * With `at` (a page-item place, as insertBlock's), the marker goes in there: the new editor's "+" and tray always pass it.
 * Without it (the classic editor's "Put the flowchart back", which has no place to give), the marker goes in before the first page item whose place in the layout's usual order comes after the flowchart's, or at the end if none.
 */
export function restoreFlow(doc: ExhbtDoc, at?: number): ExhbtDoc;
```

What you define. The other agents build against these word for word.

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
| `figures/ImageExtras.tsx` | `ImageExtras(props: ExtraSlot): ReactNode` | J | below: the description field (`image-N-alt`), in the flow under the picture and its caption; above: nothing |
| `figures/LinkExtras.tsx` | `LinkExtras(props: ExtraSlot): ReactNode` | J | over: a "Web address" button over the link's corner, always shown, opening a popover that holds the field |
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
  /** Add a block at a place, with the motion and the focus put in it. Returns its id, or null when there is no room. A graph then opens its figures sheet (`ui.open("chart", id)`); a link opens its "Web address" popover with the cursor in it (`ui.jumpTo` on its `href` path); an image opens the picture picker instead and is placed when the pictures are chosen; the flowchart, offered only when it is off the page, goes back at `at`. */
  add(kind: BlockKind, at: number): string | null;
  /** The section the focus was last in, for "add after the section you were last in". */
  lastFocus(): string | null;
};
```

The buttons in a section's toolbar carry `data-grip`, or `data-tool` with one of `up`, `down`, `action`, `more`, `remove`, so another agent's CSS and tests can find them.

Each owner's CSS goes in its own file in `components/exhbt-editor/css/` (`core.css` G, `drag.css` F, `flow.css` K, `topbar.css` H, `sheets.css` I, `figures.css` J, `phone.css` L), imported at the top of that owner's own component, in `@layer components`, using only the page's `--xp-*` variables for anything drawn on the page and the app's own tokens for the top bar and sheets. Class names start `xe-`.

## Milestone 1: everything the others call, working

Push after each step. Milestone 1 is every hook and plug in the blocks above, **working**, because six agents write code and tests against them: the store with undo, the adapter and the frame, the fields, the files, the jump, the sheets. It is deliberately the plainest working version: Tiptap's idle start-up, the formatting buttons, the shell toolbars, the issue popovers and the file rule come in milestone 2. When milestone 1 is pushed and its tests pass, say so in a report at once ("milestone 1 ready at <commit>") and carry on: the main session merges it and starts the others.

1. **`EditorShell.tsx`** (A's stub, now yours) exports `PageEditor(props: PageEditorProps)`. The root is `<div data-editor="page" data-ready>` (`data-ready="true"` once the editor is up, as the classic editor sets it). Inside: the providers; `TopBar` (it holds the screen's heading, "Edit exhbt", at level 1); the canvas, wrapped in the person's look (`lookAttrs(theme)`, `themeStyle(theme)`) at the public frame's width; `ProjectView` with `headingLevel="h2"` and `edit` set; `DraftedGraph`; `Tray`; `PhoneBar`; the sheets; one polite live region; and a status line fixed at the foot of the window, out of the flow, that shows `useFiles().status` (`role="status"`) and, under it, `useFiles().error` (`role="alert"`). "See as a visitor" draws `ProjectView` with no `edit` inside `<section aria-label="Preview">`.
2. **The store** (`store.ts`), as above. One doc outside React. `setAt` writes by path. The structural actions call B's `insertBlock`, `insertImage`, `moveItem`, `removeItem`, `applyTemplate`, `restoreFlow` ("+" then Flowchart when it is off); all of them adopt. The store keeps a `shell` object that changes identity only when a shell field changes (title, gap, context, whereWhen, myRole, skills, evidence, format) or `structureKey(doc)` changes; the canvas subscribes to that and to nothing else. `useSection(id)` gives the frame its one section.
   - **The browser copy and the newest doc go round React** (0026, "Saving"). In every change (`setAt`, `patch`, `patchDoc`, each structural action), the store calls `writeBackup(id, doc)` from `components/editor/useAutosave.ts` and records the doc as the newest, before it tells any subscriber. `pending.ts` (A's stub, now yours) exports `flushPending(): Promise<void>`: when the newest doc differs from the last one the server has, it sends it with `saveDraft`; it resolves when that lands or after three seconds, whichever is first. The crash boundary awaits it.
   - In development only, `?crash=change` makes `PageEditor` throw on the render after the first change.
3. **Undo** (`undo.ts`), exactly as 0026 says under "Undo", "What an entry holds":
   - a structural action's entry holds the structure before it (the sections' ids in stored order, the content of any section it took out, whether the marker was there, `flowOff`, the layout), and Undo restores exactly that, the marker absent if it was absent; sections still on the page keep their words;
   - a `patch` or `patchDoc` with an undo name: the store runs `fn`, then compares before and after, and the entry holds the before and after of each section field and each top-level key (other than `sections`) that changed, and nothing else. Undo writes back only those. Never a whole-doc snapshot;
   - the numbers to check: `remove` never prunes them; Undo sets `unverified` to the list now joined with the entry's list before, limited to numbers on the page after the undo (`numbersInDoc`, `normaliseNumber`);
   - each entry lists the stored file ids it could bring back, for the file rule;
   - up to 30; flowchart boxes get keys that last for the visit; Ctrl or Cmd and Z only when the cursor is not in a field; after an Undo the focus goes as 0026 says.
4. **The adapter** (`adapter.tsx`): `useAdapter(): EditAdapter`, one stable object.
   - `item` returns `<Frame {...slot} />`. `Frame` is memoised, reads its section with `useSection(id)` and its index in `doc.sections` with `useDoc` (a number, so it re-renders when a kept section before it is removed and its fields' paths would otherwise go stale), draws `<div data-section-id data-kind data-as data-path="sections.N" class="xe-frame …rowClass">` (no `data-path` on the flowchart's frame: K's list carries `flow`), positioned, with the toolbar and `ItemView` inside, and counts its renders. The frame must add no box: the part inside sits exactly where the read-only page puts it.
   - `text` returns `InlineText`; `rich` returns `RichField`; `insert` returns `Insert`; `extra` returns the right plug by kind (the aim's switch is yours, over the aim's top edge); `list` returns a finding's controls (move up, move down, remove), and at `index === n` "Add a finding" with `data-path="sections.N.items"`, all drawn over the list, names as the classic editor's; `flow` is `useFlowEdit()`; `skills` is yours (pills with remove, the block carrying `data-path="skills"`); `work` returns `WorkButton`; `tools` returns null until milestone 2.
   - Every element the adapter adds that the visitor's page lacks carries `data-edit-only`, and none but the placeholders of 0026's list takes room.
5. **`fields/InlineText.tsx` and `fields/RichField.tsx`**, as 0026 says under "Typing in the page's own type". Each carries `data-path`, its name, and an id (`o.id`, or the path with dots as hyphens). An empty field shows its placeholder in `--xp-muted`. In milestone 1, `RichField` draws the page's own markup and makes its Tiptap editor (`injectCSS: false`, loaded in its own chunk) when the field is clicked or focused; nothing moves in the swap. Keep the limits out of the fields: a field never stops typing at a word cap.
6. **The toolbar** on each frame: the grip (`<button data-grip {...board.grip(id)}>`, named "Drag <label> to move it"), "Move <label> up", "Move <label> down" (`board.moveBy`), the layout's action where there is one ("Make lead image", "Make key figure", and "Before" and "After" on an image in a Before and after exhbt), "More actions" where the AI drafted the part (the existing `BlockTools`, with its `tools-*` and `rewrites-left` test ids), and "Remove <label>" (`board.remove`). The flowchart has no Remove where the layout always has one (`FORMAT_RULES[f].flowRemovable` is false: a case study and research). Labels come from `sectionLabel`. It is out of the flow. With a mouse it shows on hover and on focus within; under `(pointer: coarse)`, whatever the width, it is always shown and its buttons are 44px (36px otherwise). Each button has a tooltip.
7. **Autosave.** A component that renders nothing subscribes to the whole doc and runs `useAutosave` with a `save` that wraps `saveDraft`. Focus leaving the editor flushes. The status words are exactly "Saved", "Saving…", "Not saved. Retry". A save that throws for a reason other than the network (a `TypeError` from `fetch`, or `navigator.onLine` false) means the page's server actions are gone (a deploy or a rollback since the page was opened): `useSave().status` then carries `error: "The editor was updated. Reload to carry on; your changes are kept in this browser."`, and H shows it with a Reload button. In development only, `?save=stale` makes the save throw a plain `Error`, for the test.
8. **Files.** `files.ts`: port `addImages` from `Editor.tsx` with its ordering (the pictures land in the order picked, whichever upload finishes first), `pick`, `replaceImage`, `attachWork`, `removeWork` (one undo entry), `markPublished`. `status` reads "Uploading 1 of 3" from the moment the pictures are chosen; a file too large or of a kind that cannot be read sets `error.image` with the reason, at once. **In this milestone no stored file is ever deleted**: that is always safe, and the rule that deletes them is milestone 2's.
9. **The jump** (`jump.ts`): `ui.jumpTo(path)` finds `[data-path]` exactly, then by shorter and shorter prefixes; when what it finds is not a field, it puts the cursor in the first field inside it, or focuses it. Milestone 2 adds opening a sheet or a popover first.
10. **Every plug in the table**, with its stub, `drag/options.ts` with its three constants included. **`css/core.css`**, which defines `--xe-topbar-h`, the top bar's one fixed height: A's loading view leaves that much room and H's bar is exactly that tall, so nothing moves when the bar arrives. **`ui/Sheet.tsx`**: a native `<dialog>` opened by `ui.open`, at the side on a desktop and full screen under 48rem, titled, closing on Escape and giving the focus back.
11. **`e2e/page-editor.ts`**:
    - `openNew(page, username, plan?)` (development sign-in, "Start from scratch", wait for `[data-editor="page"][data-ready=true]`, return the id), `openSeeded(page, username, withParam, slug)`, `openDoc(page, username, doc)` (seeds a doc with `POST /dev/parity` and opens its editor), `field(page, path)`, `frame(page, id)`, `grip(page, id)`, `waitSaved(page)`, `pageOrder(page)` (frame ids in page order), `boxes(page)` (the place and size of every `[data-part]`, the title, the context line, each pill, each flowchart box, each finding and each figure), `renders(page)`, `readStored(page, id)` (`GET /dev/parity`);
    - `SAMPLES`: for each of the seven layouts, the seed of its sample (`with` and slug; the four new ones are D's, from release 2), and `offered()`, the layouts in `OFFERED_FORMATS`. Every editor spec that runs "on each layout" loops over `offered()`, so in release 4 it covers seven with no change;
    - `full(doc)`: the doc with every empty optional part given words (a context line, What it is, Where and when, My role, a work link, every box's detail, every caption, a quote's role, every link's description);
    - `EDIT_ONLY_IN_FLOW`: 0026's list of placeholders, as data (a name and a selector each). Every box-for-box test reads it; nobody writes the list anywhere else.
12. **First tests** in `e2e/editor-inplace.spec.ts`: a new exhbt opens in the new editor; typing the title, a box, a finding and the context line saves and is there after a reload; the stored doc has no marker after typing alone; "Move down" on a section writes the marker, and Undo puts the order back and takes the marker out; a picture can be added and is stored. In `e2e/editor-classic.spec.ts` (A's, now yours): `?crash=change` ends in the classic editor with the words typed before the crash, both in the stored doc and in the classic editor's fields.

## Milestone 2: the rest

13. **`RichField`, all of it**: editors made one at a time in idle moments after the page is up, and at once for a field that is clicked; the formatting buttons out of the flow while it has the cursor, below the line on a section's first line, where the toolbar sits; `useActiveRich()`; `toggleLink()` opening the field's own address prompt (as the classic `RichTextField` does, with its error).
14. **Issues on the page**: a field with an issue at its path gets an outline in `--xp-error`, `aria-invalid`, and `aria-describedby` pointing at its message, which is visually hidden until the field has the focus and then shows in a small popover under it. Never in the flow.
15. **The jump, all of it**: a path whose field lives in a sheet opens that sheet first (`summary`, `headline`, `evidence`; `sections.N.chart` and `sections.N.chart.*` open the chart sheet); a field inside a closed native popover opens it first (`showPopover()` on the closest `[popover]`). The anchors 0026 lists for paths with no field: `""` is H's word bar, `sections` F's end "+", `flow` K's list, `skills` and `sections.N.items` yours, `sections.N` the frame. On whatever it lands, the jump dispatches an `xe-jump` event (F's end "+" opens its menu on it).
16. **The shell toolbars** (`edit.tools`): for the title (`header`), the context line (`gap`) and the skills, a small toolbar over the part's corner, out of the flow, holding "More actions" (`BlockTools` with `tools-header`, `tools-gap`, `tools-skills`) where the AI drafted the part, and for the skills "Add a skill", a popover holding the box `skill-new`. Same show and size rules as the section toolbar.
17. **The file rule.** The four-part rule in 0026 decides when a file is deleted. Run it after each save lands, when an undo entry falls off the list, on `pagehide` only when `event.persisted` is false, and on unmount (use `keepalive`). Never on `visibilitychange`, and never on a `pagehide` that keeps the page in the back-forward cache. Pictures dropped onto the canvas are added after the section they were dropped on.
18. **The kept list** ("Kept, not shown in this layout", each with Remove), **the backup offer** (port the classic editor's "We kept changes from…"), a new text section's focus going into its field, and the focus after an Undo (0026).
19. **The timing harness.** `app/dev/editor-timing/page.tsx`: draws `PageEditor` on a sample (`?sample=`) with no sign-in and a save that does nothing. It is not found unless `NODE_ENV` is not `production`, or the build has `EXHBT_LAB=1` (as the lab's page was gated; never set on the live Worker). F's `scripts/editor-timing.mjs` opens it on a production build.
20. **The docs**: paste 0026's "What DESIGN.md says from release 3" into `DESIGN.md` as written; the editor paragraph in `docs/MAP.md`; `HANDOFF.md`; the layout line in `AGENTS.md`. Say what is true at release 3.
21. **CI time.** In `.github/workflows/ci.yml`, raise the e2e shards from 3 to 6 (the matrix and the `--shard` argument). Report each spec you wrote with how long it takes on one worker, so the main session can see where the time goes.
22. **The full tests** below.

## Tests

`e2e/editor-inplace.spec.ts` (finish it). "Each layout" means each of `offered()`:
- every path in 0026's fields table can be typed in and is stored at that path, on each layout;
- formatting survives: a finding with bold and a link keeps both after typing in it and after a reload;
- **each kind of issue path jumps to its target**, one of each shape: `title`, `gap`, `flow.N.step`, `sections.N.items.K`, `sections.N.alt`, `sections.N.href` (in its popover), `sections.N.chart` (the sheet), `summary` (the sheet), `""` (the word bar), `sections` (the end "+", its menu open), `flow`, `skills`, `sections.N.items`. Use the targets of other agents only once they are merged; until then, test yours;
- undo: remove and put back a quote, an image (its file is not deleted while Undo can restore it, and is deleted after a save once it cannot) and the flowchart; a layout switch and its undo give back the layout and the order;
- **undo keeps typing and flags**: on a doc whose findings hold an unverified "18%", replace the findings as "Back to the AI version" does (through `BlockTools`, with an AI version whose findings lack "18%"), so the flag is pruned, type in the title, press Undo: the title keeps the new words, the old findings are back, and "18%" is in the numbers to check again;
- **undo of the first move**: on the order fixture "a figure before the findings" (untouched), move a section, then Undo: the stored doc has no marker and its first order, and `boxes(page)` equals what it was before the move;
- **publishing keeps the order**: on an arranged doc (the flowchart moved below the findings, a figure before the findings), publish, open the live address: its `[data-part]` order is the editor's;
- **a hidden page keeps Undo working**: remove a picture, wait for "Saved", fire `visibilitychange` to hidden and back, press Undo: the picture is back and its address loads;
- **box for box, on full pages**: for each layout's sample made `full`, `boxes(page)` while editing equals `boxes(page)` in "See as a visitor", to half a pixel, at 1440 wide and on a Pixel 7, in the Exhbt, Classic and Night looks and one colourway of each other look. The only difference allowed is the highlight's wrap, by name;
- **box for box, on a sparse page**: on a new exhbt, every difference from "See as a visitor" is a part named in `EDIT_ONLY_IN_FLOW`, and nothing else moves but what sits below it;
- **the loading stand-in matches**: on a new exhbt, `boxes(page)` just before `data-ready="true"` (hold the editor's chunk back with `page.route`) equals `boxes(page)` after;
- **the status line**: three pictures picked at once show "Uploading 1 of 3", then land in the order picked; a picture over the size limit shows its reason in the alert and adds nothing;
- **a stale editor**: with `?save=stale`, a change ends in "The editor was updated. Reload to carry on; your changes are kept in this browser.";
- axe: at rest, while typing, with a sheet open; and at rest on a new exhbt and on a full one in all eight looks.

`e2e/editor-smooth.spec.ts`: checks 1 and 2 of 0026's "Smoothness" (the render counts for a finding, a caption, a quote, a flowchart box, the title and the context line; nothing moves on focus), on each layout's sample; and **the field-sizing fallback**: with the mirror forced (`?grow=mirror`, development only), a field that wraps to three lines is the same size as with `field-sizing`, to half a pixel.

`e2e/editor-classic.spec.ts`: A's tests, plus `?crash=change` as in step 12.

Run: those three, plus `e2e/layout-parity.spec.ts` and `e2e/edit-slots.spec.ts` whenever you touch a page part.

## Done looks like

Milestone 1: a person can open an exhbt, type every word on the page, add, move, remove and undo, and have it saved; every hook and plug in the blocks above works; a crash after a change lands in the classic editor with the change kept. Milestone 2: the three specs pass, the parity and slot specs still pass, and nothing in `components/editor/` changed.

## Report back

At milestone 1 and at the end: the commit; any signature above you had to change, and why (this matters to six other agents, so avoid it); slots you added to the page parts; whether `reportFiles` was filled; any difference between editing and visiting beyond 0026's list; how long each of your specs takes; what you could not verify.

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
