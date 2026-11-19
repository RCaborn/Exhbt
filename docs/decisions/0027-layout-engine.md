Status: accepted
Date: 19 Nov 2026
Amends: 0015 (the flowchart is a section that can be moved, and removed in five layouts; the core is no longer fixed in place), 0022 (the page is drawn by one engine from per-layout rules; a pair is drawn in the doc's order), 0024 (every layout is drawn in the doc's order; a layout is a starting template; what a switch does)

# A layout engine: every layout is drawn in the doc's own order

Rory, 17 Nov 2026: "you can edit it as you would see it… drag the sections up and down… I think we do need to go for the full plug and play." And on layouts: they are starting templates. Picking one arranges the sections in that layout's usual order, and after that everything can be dragged anywhere.

Today that cannot work. A case study draws its sections in the person's order, but the flowchart is fixed above them. A gallery and a research page are fixed compositions (`components/portfolio/formats/GalleryMain.tsx`, `ResearchMain.tsx`): the order in the doc only decides which image leads. So dragging a section in a gallery would change nothing on the page.

This record is the page's side of the edit-on-page editor (decision 0026). It ships first, on its own, as the reader release.

## One renderer, rules per layout

`GalleryMain`, `ResearchMain`, `runsOf` and `SectionsView` go. One component, `LayoutMain` (`components/portfolio/LayoutMain.tsx`), draws the main column of every layout. It asks a pure function for rows and draws them in order:

1. `pageItems(doc)` lists what the page draws, in page order: the sections the layout shows, and the flowchart.
2. `rowsFor(items, format)` groups neighbours into rows by the layout's rules: an item on its own, a pair side by side, or a group (two to a row, a grid, a list).
3. `LayoutMain` draws each row with the parts that exist today (`Findings`, `Figure`, `SectionBlock`, `MethodFlow`).

Nothing is ever reordered to make a row. Two things pair only when they are neighbours in the doc.

The rules are data (`ROW_RULES` in `lib/exhbt/layouts.ts`), tried in order at each place in the doc. For the three layouts that exist:

- **Case study.** Findings and a graph or image that is their neighbour share a row. Graphs next to each other share a row; so do images. Everything else stands alone. This is what `runsOf` does today.
- **Gallery.** The first image is the lead, across the column. The flowchart ("What I did", drawn as a column) and its neighbours the findings and the graph ("What happened") share a row. The other images that sit together form the justified grid. Links that sit together go two to a row.
- **Research.** The first graph or image is the key figure. The aim and the flowchart ("Method") stack; when the key figure is their neighbour, the stack and the figure share a row. Other figures go two to a row. The findings ("Results") pair with the conclusion and the limitations stacked beside them. Links that sit together are the References list.

In the usual order these rules give exactly the pages of decisions 0022 and 0024. Moved out of that order, each part is still drawn in its own style on a row of its own. The four new layouts add rules of the same kind (decision 0028).

The types the model and the renderer share:

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
/** What the main column draws, in order: the items of adopt(doc) that the layout shows, each with its index in `doc` as given. */
export function pageItems(doc: ExhbtDoc): PageItem[];
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
```

Each layout's own facts sit beside its name in `FORMAT_RULES` (`lib/exhbt/formats.ts`): the kinds it draws, its usual order, whether the flowchart can go, what it needs to publish, and what it takes from the work (decision 0025). `validateForPublish` reads `needs` from there, so the `F === "gallery"` branches go.

| Layout | Usual order (`template`) | Lead or key | No marker (`legacy`) | Flowchart can be removed |
|---|---|---|---|---|
| Case study | flowchart, findings, graphs, images, quote, what I'd do next, link | none | `flow-first`: the flowchart, then the sections in the doc's order | no |
| Gallery | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |
| Research | aim, flowchart, first graph or image, other graphs and images, findings, conclusion, what I'd do next, quote, links | first graph or image is the key figure | `template` | no |
| Build | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |
| Essay | flowchart, findings, pull quote, graph, image, quote, what I'd do next, links | none | `template` | yes |
| Before and after | images, flowchart, findings, graph, quote, what I'd do next, link | none | `template` | yes |
| Event or performance | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |

`lib/exhbt/formats.ts` keeps its name and its exports, so the many files that import `FORMAT_RULES`, `FORMAT_COPY` and `formatOf` do not change. The engine is a new file beside it.

## A pair is drawn in the doc's order

Today the case study puts the findings on the left even when the figure comes first in the doc. With drag and drop that is wrong: a figure dropped to the left of the findings would land on the right (the prototype found this). So in an arranged doc (below) a pair is drawn in the doc's order, and the column widths mirror when the figure comes first. Old docs keep their page: see "A doc the new editor has never touched".

## The flowchart is a section

The flowchart's place is a marker in `sections`: `{ id: "flow", kind: "flow" }`. Its boxes stay where they are, in `doc.flow`.

Why a marker and not a section that holds the boxes: every issue path (`flow.2.step`), the word count, the number check, the AI's flow block, "Back to the AI version" and the rewrite all read `doc.flow`. With a marker none of them change, and code that does not know the marker still finds the boxes.

Rules, all in `normaliseDoc`:
- At most one marker. A second is dropped. Its id is always `flow`.
- The marker counts no words and has no issues of its own.
- `SectionKind` does not include `flow`, so every table keyed by kind (`LIMITS.sections`, the section names) is unchanged. `Section` includes the marker; `ContentSection` is everything else.

The flowchart can be removed in Gallery, Build, Essay, Before and after, and Event or performance. A case study and research always draw it.

## A removed flowchart, exactly

Removing the flowchart takes the marker out and sets `flowOff: true` on the doc. The boxes stay in `doc.flow` in the working copy, so "+" then Flowchart puts it back as it was.

| | Working copy (`exhbts.blocks`) | Published copy (`published_blocks`) |
|---|---|---|
| Marker | absent | absent |
| `flowOff` | `true` | `true` |
| `doc.flow` | the boxes, kept | `[]` (`publicDoc` empties it, as it leaves out a section a layout does not draw) |

How it is read, by `flowShown(doc)`:
- A marker is there: the flowchart is drawn at the marker. `flowOff` is ignored, and `normaliseDoc` deletes it, so the two can never disagree in a saved doc.
- No marker and `flowOff` is true: not drawn, if the layout lets it go. In a case study or research it is drawn first, because those layouts always have one.
- No marker and no `flowOff`: a doc the new editor has never touched (below).

While it is off the page its words are not counted, its boxes are not checked for publishing, and the number check still reads them, as it reads every kept section.

What code one release older does with it:

| Live code | Meets a removed flowchart | What the person sees |
|---|---|---|
| Release 3 and later | understands it | no flowchart |
| Release 2, the reader release (the rollback target for release 3) | understands it: `flowShown` ships in release 2 | no flowchart, the same page. The classic editor keeps `flowOff` and offers "Put the flowchart back" |
| Before release 2 (two steps back, not a planned rollback) | drops `flowOff` when it saves; never sees a marker | Working copy: the flowchart is back in its fixed place with its boxes. Published copy: an empty list where the flowchart was, which draws nothing. Both are valid pages |

Everything that reads `doc.flow` was checked for an empty list: `MethodFlow` draws an empty `<ol>`; `keyFigureOf` (`lib/portfolio-home.ts`) falls back to a flow figure with no steps only when there is no graph and no image, and release 2 changes it to skip a flowchart that is not shown; `lib/exhbt/headline.ts`, `lib/ai/exhbt-rewrite.ts` and `lib/exhbt/draft-blocks.ts` read the working copy, where the boxes are kept.

## A doc the new editor has never touched

A doc with no marker and no `flowOff` is drawn as it is today, and nothing is written back.

How: such a doc is drawn as `adopt(doc)`. `adopt` is pure. It returns the same page with the order written down:
- **Case study:** the marker first, then the sections in the doc's order. One exception keeps today's page: a figure that sits straight before the findings, where today's page would pair them with the findings on the left, is swapped to sit after them.
- **Every other layout:** the sections sorted into the layout's usual order (a stable sort, so two images keep their order), with the marker at the flowchart's place.

So there is one way to draw a page, and an old doc goes through it by way of `adopt`. `pageItems` gives each item its index in the doc as stored, so issue paths still point at the right section.

This is needed in the reader release whatever is on the live site. Between that release and the editor, people keep drafting galleries in the classic editor, and the AI draft builds sections in its own order. Without `adopt` those would be drawn in a new order.

The marker is written to the stored doc only when the person makes their first structural change in the new editor (a move, an add, a remove, a layout switch). Opening an exhbt, typing in it and saving never write it. So opening a published exhbt creates no difference from what is live.

## Layouts are starting templates

In the new editor, picking a layout does three things as one step: adopts the doc, sets the layout, and sorts the sections into that layout's usual order (`applyTemplate`). The editor says "Laid out as a gallery. Undo restores your order." One Undo puts back the layout, the order and the flowchart as they were.

This amends 0024, which said a switch changes `format` and nothing else, so that switching back gave the exhbt exactly as it was. That promise now belongs to Undo. Picking the old layout again gives that layout's usual order, not the hand-made one.

Still true from 0024:
- Nothing is deleted by a switch.
- A kind the new layout does not draw is kept, not shown, not counted and not checked. The new editor lists these at the foot of the page as "Kept, not shown in this layout", each with Remove.
- More of a kind than the layout allows is a publishing error. Nothing is hidden.
- If the flowchart was off and the new layout always has one, it comes back in its usual place with its boxes.

The classic editor's picker is unchanged: it sets the layout and nothing else.

## Reading what is drawn

On a read-only page two things are left out before the rows are made, as today: an image with no signed address, and an aim or a conclusion with no words. In the editor nothing is left out for being empty; the field's placeholder shows in its place. The rows may depend only on what `structureKey` covers (the layout, `flowOff`, and each item's id, kind and image stage), because the editor lays the page out again only when that key changes.

## What the reader release ships, and why it is the rollback target

Release 2 changes nothing a person can see or do. It makes the live site able to read, draw and keep everything later releases write:

- the model: the marker, `flowOff`, the pull quote kind, an image's stage, `myRole`, the seven layout ids (the four new ones are not offered: `OFFERED_FORMATS`), and `adopt`;
- the engine and `LayoutMain`, drawing all seven layouts;
- the editing slots on the page parts (decision 0026), unused;
- the classic editor keeping what it does not edit: the marker (shown as a row called Flowchart that can be moved), `flowOff`, and the new fields;
- samples and seeds for the four new layouts, on development pages only.

Why this order makes each later step safe to undo:

| Rolled back | The live code is then | It meets | Result |
|---|---|---|---|
| Release 3, the editor | release 2 | docs with a marker, a removed flowchart, sections in any order | drawn the same; the classic editor edits and keeps them |
| Release 4, the four layouts | release 3 | essays, builds and the rest, pull quotes, stages, my role | drawn the same; the editor edits them. Its layout menu shows the doc's own layout as well as the three it offers |
| Release 2 itself | today's code | nothing new: release 2 writes nothing today's code cannot read | no change |

Code from before release 2 drops a kind and a layout it does not know and strips keys it does not know when it saves. That is why the editor cannot ship first.

The four new layouts' model and drawing ride in release 2 so there is one pass through the renderer and one parity gate. They are in the renderer's second part. If that part is late, release 2 ships without it and it lands at the start of release 3, before the editor.

## The parity gate

Release 2 may not change any existing page. "The same" is defined so a script can check it.

1. **The comparison.** For each fixture, the `outerHTML` of `article[data-exhbt-page]` at 1440 by 900, normalised in three ways and no others: file addresses in `src` and `href` become the file's id; ids React makes (`useId`) become their position in the page; the words in each `class` attribute are sorted. Two pages are the same when the strings are equal.
2. **The fixtures.** Every sample and seed (`lib/exhbt/sample.ts`: the old-shape GP exhbt, the library, open banking, the full one, five and six boxes, the gallery, the research poster) and order fixtures made for this: a figure before the findings, two graphs before the findings, an image then a graph then the findings, a gallery with no findings, a gallery whose sections are out of the usual order, research with no figure.
3. **Golden copies first.** `e2e/layout-parity.spec.ts`, run with `GOLDEN=write`, writes each fixture's string to `e2e/golden/`. That is done on the model agent's first commit, which adds the test and a development-only page and changes no product code. Run without `GOLDEN`, the test compares. The renderer's agent runs it and may not edit it.
4. **Every live page.** Before release, the main session exports each published exhbt from the live site to a file outside the repo, draws it on that first commit and on the candidate through the same test (`PARITY_DOCS`), and compares. Today that is one exhbt, a case study. The count is run again on the day.
5. **Adopting changes nothing.** For every fixture, the page of `adopt(doc)` equals the page of `doc`.
6. **Print.** The samples that print on one A4 page today still do (the checks in `e2e/exhbt-page.spec.ts` and `e2e/phase2-formats.spec.ts` stay as they are and stay green).
7. **An old reader.** A frozen copy of today's `normaliseDoc` and schema, kept in the test fixtures, reads docs as later releases will write them and gets a doc today's page can draw.

If the engine cannot give an identical page for a fixture, the agent stops and reports the difference. The gate is not loosened by the agent.

## Consequences

- `AGENTS.md`'s "Exhbt layout" line and `docs/MAP.md` describe a fixed core. Both change with release 2.
- `withKeyFigure` and `withWorkVisual` (decisions 0017 and 0025) place a figure by kind, not by index from the top, so they work on an arranged doc. They run before the editor opens, on a doc with no marker, and need no change beyond skipping the marker.
- The AI draft still writes docs with no marker. They are drawn in the usual order and adopted on the first structural change.
- A switch in the classic editor on an arranged doc keeps the hand-made order under the new layout. That is a valid page, and the classic editor lasts one release.

## Not sure, and risky

- **An identical page from a general engine.** Gallery and research have their own wrappers today. The row renderers must reproduce them exactly. This is the part of release 2 most likely to need a second round.
- **The figure-before-findings swap.** It is the only place `adopt` changes a case study's order. If a fixture shows today's page pairing in a way the swap does not cover, `adopt` needs that case too.
- **`flow: []` in the published copy** means a two-step rollback shows no flowchart, not the removed one. The other choice was to keep the boxes there, which would show a part the person took off.
- **Reading the layout from the usual order for every non-case-study doc with no marker** is right for the three old layouts. For a new layout it is a choice: the AI's own order is discarded in favour of the template.
- The rule tables for the four new layouts have not been drawn yet. Decision 0028 says what is expected of them.

## Not done

- Rows that reorder for a narrow screen. On a phone every pair and group stacks in the doc's order.
- A person's own rule for a row ("never pair these").
- Writing the marker into every stored doc with a script. There is no need: `adopt` is cheap and runs at render.

Code: `lib/exhbt/blocks.ts`, `lib/exhbt/formats.ts`, `lib/exhbt/layouts.ts`, `lib/exhbt/sections.ts`, `components/portfolio/LayoutMain.tsx`, `components/portfolio/layout-rows.ts`, `components/portfolio/ProjectView.tsx`, `components/portfolio/exhbt-parts.tsx`, `components/exhbt/MethodFlow.tsx`, `lib/portfolio-home.ts`, `app/dev/parity/`. Tests: `e2e/layout-model.spec.ts`, `e2e/layout-parity.spec.ts`. Briefs: `docs/briefs/edit-on-page/`.
