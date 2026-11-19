# Brief C: one renderer for every layout, with editing slots

| | |
|---|---|
| Release | 2, the reader release |
| Model | Opus |
| Branch | `phase-2-r2-c-renderer`, made from `phase-2-r2` after B's milestone 1 is merged |
| Port | 3302 |
| Starts when | B's milestone 1 (the schema and the engine) is merged into `phase-2-r2`. B carries on with its milestone 2 beside you, on other files; merge the release branch into yours when the main session says it has landed. E starts when your part 1 is merged |

## Goal

Replace the three fixed page compositions with one component that draws any layout from the engine's rows, and thread the editing slots through every page part so the editor in release 3 can draw this same page with fields on it. Every existing page must come out byte for byte as it is now.

## Read first

`docs/decisions/0027-layout-engine.md` (the parity gate above all), `docs/decisions/0026-edit-on-page-editor.md` ("One page, one renderer" and the fields table), `docs/decisions/0028-four-more-layouts.md` ("How each is drawn"), `DESIGN.md`. Then `components/portfolio/ProjectView.tsx`, `exhbt-parts.tsx`, `formats/GalleryMain.tsx`, `formats/ResearchMain.tsx`, `components/exhbt/MethodFlow.tsx`, the `xp-*` and print rules in `app/globals.css`, and `lib/exhbt/layouts.ts` as B left it.

## You own

- `components/portfolio/ProjectView.tsx`, `exhbt-parts.tsx`, `LayoutMain.tsx` (new), `layout-rows.ts` (new), `page-ctx.ts` (new), `ImageZoom.tsx`
- `components/portfolio/formats/` (you delete it)
- `components/exhbt/MethodFlow.tsx`
- `app/globals.css` (the `xp-*` rules and the print block; add, do not change what an existing rule does)
- `lib/portfolio-themes.ts` and `components/portfolio/themeFonts.ts`, for the error colour only (step 1b)
- `app/dev/edit-slots/` (new), `e2e/edit-slots.spec.ts` (new)
- the exhbt page paragraphs of `DESIGN.md`

If your part 2 is not merged when release 2 ships, you keep `app/globals.css` and the page parts until it is: part 2 and D are then merged into `phase-2-r3` before the release 3 agents' branches are cut, so nobody else edits those files while you do.

## You must not touch

`lib/exhbt/` (B's; report what you need), `components/editor/` (E's), `lib/exhbt/sample.ts`, `e2e/layout-parity.spec.ts` and `e2e/golden/` (the gate you are measured by: if you think a golden copy is wrong, report it), every page that calls `ProjectView` (its props do not change, so they need no edit).

## What you build against

From B, already on your base:

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

`ROW_RULES` and `FORMAT_RULES` in `lib/exhbt/layouts.ts` and `formats.ts` say which rows each layout makes. `FORMAT_COPY` has each layout's words.

What you define, and the editor's agents build against word for word:

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
 * Edit-only controls that belong to a part but are not on the published page: an image's description and picked-figure strip, a link's address, a graph's "Edit figures", the aim or hypothesis switch.
 * Each is drawn over the part and takes no room (decision 0026, "Edit-only controls take no room"): "above" over its top edge, "below" over its foot, "over" over a corner.
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
  /** The skill pills, with a way to add and remove one. Takes the place of the read-only list. */
  skills(): ReactNode;
  /** The sidebar's control for the work. Takes the place of "See the work". */
  work(): ReactNode;
  /** A shell part's corner toolbar, out of the flow: "More actions" (rewrite, back to the AI version) where the AI drafted it, and for the skills "Add a skill". */
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

## Part 1: the three existing layouts and the slots

Commit and push after each step. Run the parity spec after each.

1. **`page-ctx.ts`**, exactly as above. Re-export `Sub` and `ImageUrls` from `exhbt-parts.tsx` so existing imports keep working.
1b. **The error colour** (decision 0026, "The person's own look"). Add `error` to `Palette` in `lib/portfolio-themes.ts`, a value for every look and colourway that reads as an error on that look's ground (a red or a deep orange, never the app's own red copied blindly), and three rows to `contrastPairs`: error text on the ground, on cards and on the well, each at 4.5. `themeStyle` in `components/portfolio/themeFonts.ts` writes it as `--pf-error`. In `app/globals.css`, add `--xp-error` beside `--xp-muted` in both blocks of `xp-*` variables: `var(--pf-error)` inside a look, and the app's own error token outside one. Nothing uses it yet; `e2e/phase2-looks.spec.ts` checks it in every look. The article's markup does not change (the variables sit on the wrapper outside it), so the parity gate does not move.
2. **`layout-rows.ts`.** `rowClass` and `stackClass` return the classes today's wrappers carry, copied from `SectionsView`, `GalleryMain` and `ResearchMain`, as whole class names (Tailwind reads the source). A reversed pair mirrors its column widths. The editor's drag engine lays out empty boxes with these same strings to measure where things would land, so they must be the only source of a row's classes: `LayoutMain` reads them from here too.
3. **`LayoutMain` and `ItemView`.**
   - Read-only: take `pageItems(doc, skip)`, where `skip` leaves out an image with no address in `ctx.imageUrls` and an aim or conclusion with no words (it must be passed in, not filtered afterwards: today's page drops these before it pairs anything); `rowsFor`; draw. A row of one item is that item's own root element with the row's classes on it (as today, where a lone section carries `xp-section` itself). A pair or a group is a wrapper with the row's classes and the items inside it.
   - Each `ItemAs` is one of today's drawings: "plain" is `SectionBlock`'s; "lead" is the gallery's lead image; "tile" a grid tile; "key" research's key figure; "kicker" research's Results; "stacked" a part inside a stack (the flowchart as a column under its heading, the aim with its rule, the conclusion and limitations as small blocks); "listed" a reference in the list. Keep every `data-part`, `aria-label`, heading id and class as it is now.
   - Editing (`ctx.edit` is there): pass no `skip`; leave nothing out. Before each row, and once after the last with `end: true`, render `ctx.edit.insert({ at })`, where `at` is the index of the row's first item among the page items. For each item render `ctx.edit.item({ id, kind, as, rowClass, index, count })` and nothing else: the editor's frame calls `ItemView` itself with a fresh copy of the item. `rowClass` is the row's classes for a row of one item and `""` inside a pair, a stack or a group. Wrappers for pairs, groups and stacks are yours in both modes.
   - In edit mode the rows may depend only on what `structureKey` reads: the layout, `flowOff`, and each item's id, kind and image stage.
4. **`ProjectView`.** Builds `ctx` once and passes it down. New prop `edit?: EditAdapter`. With it: the title is `ctx.edit.text` inside the same heading element; the context line is `ctx.edit.rich` with the paragraph's classes and `highlight: true`, in place of the `<p>`; "What it is", "Where and when" and "My role" are always drawn, each a `ctx.edit.text`; the skill list is `ctx.edit.skills()`; the work button is `ctx.edit.work()`, always drawn; "All of …'s work" is drawn but `inert`. Call `ctx.edit.tools({ block: "header" })` inside the title's heading block, `ctx.edit.tools({ block: "gap" })` inside the context line's block, and `ctx.edit.tools({ block: "skills" })` inside the skills block, each as that block's last child; in edit mode only, give each of those three blocks `position: relative` (a class added only when `ctx.edit` is there), so the toolbar the adapter returns can sit over its corner and take no room. Add the "My role" fact (shown read-only when `doc.myRole` has words). The quote's heading and the skill list's name come from `FORMAT_COPY`. `sectionsSlot` keeps working as now (the classic editor's "Arrange sections" uses it). Keep exporting `SectionBlock`, `Owner` and `ProjectView`; search for other importers before removing `runsOf` and `SectionsView`.
5. **The parts** (`exhbt-parts.tsx`). `Findings`, `Figure` and `SectionBlock` keep the props they have (the classic editor calls `SectionBlock` with them) and take an optional `ctx`. With `ctx.edit`, every text in the fields table of 0026 is a slot at its path, with the name and id that table gives. **Every `extra` and `list` slot is called as the last child of a box that is `position: relative` in edit mode only** (a class added when `ctx.edit` is there, never a new wrapper element), because what the adapter returns is drawn over that box and takes no room (0026, "Edit-only controls take no room"):
   - a finding: `ctx.edit.rich` inside the same `<li>` (`className: ""`), then `ctx.edit.list({ path, index, n })` inside that `<li>`; after the last `<li>`, inside the list, `ctx.edit.list` with `index === n` ("Add a finding");
   - an image: the picture with no zoom, then, inside the box that holds the picture, `ctx.edit.extra({ …, where: "above" })` and `ctx.edit.extra({ …, where: "below" })`; the caption as `ctx.edit.rich` inside an always-drawn `<figcaption>`;
   - a graph: the chart, then, inside the box that holds it, `ctx.edit.extra({ …, where: "over" })`;
   - a quote: the words, the name and the role as three `ctx.edit.text`, the quotation marks drawn round the field, not typed into it;
   - what I'd do next, the aim, the conclusion: `ctx.edit.rich` with the paragraph's classes; the aim also `ctx.edit.extra({ …, where: "above" })` inside the aim's own block, for its aim-or-hypothesis choice;
   - a link: label and description as `ctx.edit.text`, drawn as now but not as a link, then, inside the link's box, `ctx.edit.extra({ …, where: "below" })`;
   - a pull quote: `ctx.edit.text`.
   In edit mode the only things drawn that the read-only page leaves out are the placeholders of 0026's list (an empty context line, the three facts, "Add the work", a box's detail, a caption, a quote's role, a link's description, an aim or a conclusion with no words), each in the element the part uses once it has words.
6. **`MethodFlow`, page variant.** Takes `ctx`. With `ctx.edit`: the `<ol>` goes through `ctx.edit.flow.list`; each box's `<li>` is rendered by `ctx.edit.flow.box` with the classes you would have put on it; in each box `ctx.edit.flow.tools`, the step as `ctx.edit.text` (path `flow.N.step`, name "Box n", id `flow-box-N`) and the detail, always drawn, as `ctx.edit.text` ("Box n detail"); in each arrow, and once after the last box, `ctx.edit.flow.add`. Without `ctx.edit` its output is exactly today's, keys included.
7. **The slot harness.** `app/dev/edit-slots/page.tsx`: development only (not found in production or with a database configured). It draws `ProjectView` for a sample (`?sample=`) with a stand-in adapter that marks each slot and adds no box: `text` and `rich` render the words in a `<span data-slot data-path data-label>` with `display: contents`; `item` renders `<div data-slot="item" data-id data-as>` with the row classes round `ItemView`; `insert`, `extra`, `list`, `tools`, `skills`, `work` and the flow slots render marked, empty, zero-size elements (the flow's `box` renders the `<li>` it is given). `?read=1` draws the same sample with no adapter. `?full=1` first fills every empty optional part of the sample with words (a context line, the three facts with My role, a work link, every box's detail, every caption, a quote's role, every link's description), in the harness's own code, so the sample in `lib/exhbt/sample.ts` is not touched.

## Part 2: the four new layouts

Start when part 1 is merged or at least pushed and green. Release 2 can ship without this part; say clearly in your report where you stopped.

8. Draw the rest of `ItemAs` and `GroupOf`: "button" and the `buttons` group (Build's links as a row of buttons, drawn with the look's button variables; in edit mode not links); "before" and "after" and the `before-after` group (two images side by side, each with a small "Before" or "After" label over it); the pull quote (large, in the look's display face, with a rule; beside the key points in a `found` pair); `refs` for an essay's "Sources", where an item with no address is plain text; the lead image for Build and Event; each layout's flowchart heading from `FORMAT_COPY`.
9. Print rules for them in the print block, in the manner of the gallery's and research's: the aim is one A4 page.
10. Put a fixture doc for each new layout in `app/dev/edit-slots/` so the harness can draw them. The real samples are D's.

## Tests

- `e2e/layout-parity.spec.ts` (B's) is your gate for part 1. Never run it with `GOLDEN=write`.
- Write `e2e/edit-slots.spec.ts`: for each layout's sample in the harness, every path in 0026's fields table that applies is there exactly once with its name; every page item has one item slot; there is one insert slot per row and one at the end; the three `tools` slots are there once each. **Box for box, two ways**, at 1440 wide and at 412 wide: with `?full=1`, every `[data-part]`, the title, the context line, each pill and each flowchart box is in the same place and size with the stand-in adapter as with `?read=1&full=1`, to half a pixel, with nothing allowed for; and on the sample as it is, any difference is one of 0026's placeholders (say which, by name) and nothing else.
- Run: `e2e/layout-parity.spec.ts`, `e2e/edit-slots.spec.ts`, `e2e/exhbt-page.spec.ts`, `e2e/phase2-formats.spec.ts`, `e2e/phase2-sections.spec.ts`, `e2e/phase2-looks.spec.ts`, `e2e/responsive.spec.ts`.

## Done looks like

- The parity spec passes for every fixture with `components/portfolio/formats/` deleted.
- The slot spec passes for the three layouts (part 1) and for all seven (part 2).
- No page that calls `ProjectView` was edited. The public page ships no editor code: `page-ctx.ts` has types only and no page part has `"use client"` that did not have it before.

## Report back

The branch head for each part; any fixture you could not make identical, with the difference; any slot the fields table needs that you could not place; any change you needed in `lib/exhbt/`; the print page count for each new layout's fixture; the specs you ran and their results.

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
