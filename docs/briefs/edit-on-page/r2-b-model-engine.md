# Brief B: the model and the layout engine

| | |
|---|---|
| Release | 2, the reader release |
| Model | Opus |
| Branch | `phase-2-r2-b-model`, made from `phase-2-r2` |
| Port | 3301 |
| Starts when | `phase-2-r2` exists. You run alone: nobody else is working yet |

## Goal

Teach the stored exhbt everything later releases will write (the flowchart's marker, a removed flowchart, the pull quote, an image's stage, My role, seven layout ids) and write the pure engine that turns a doc into rows. After your work the pages must be exactly as they are now, with the old renderer still in place.

## Read first

`docs/decisions/0027-layout-engine.md` (all of it) and the tables in `docs/decisions/0028-four-more-layouts.md`. Then `lib/exhbt/blocks.ts`, `formats.ts`, `sections.ts`, `verify.ts`, `runsOf` in `components/portfolio/ProjectView.tsx`, `components/portfolio/formats/GalleryMain.tsx` and `ResearchMain.tsx` (the pages your rows must reproduce), and "Sections: the model" in `e2e/phase2-sections.spec.ts` (how pure model tests are written here: plain `test()` blocks, no page).

**Check your base before anything else.** `lib/exhbt/sections.ts` must export `withWorkVisual` and `FORMAT_RULES` must have `fromWork` (release 1b, decision 0025). If they are missing, stop and report: the release branch was cut too early.

## You own

- `lib/exhbt/blocks.ts`, `lib/exhbt/formats.ts`, `lib/exhbt/layouts.ts` (new), `lib/exhbt/sections.ts`, `lib/exhbt/verify.ts`, `lib/exhbt/headline.ts`
- `lib/exhbt/draft-blocks.ts` (one new field) and `app/api/exhbts/[id]/figure/route.ts` (one addition), for step 8
- `app/dev/parity/route.ts` (new), `e2e/layout-parity.spec.ts` (new), `e2e/golden/` (new)
- `e2e/fixtures/order-docs.ts` (new), `e2e/fixtures/reader-before-r2.ts` (new), `e2e/layout-model.spec.ts` (new)
- the exhbt lines of `AGENTS.md` ("Exhbt layout") and `docs/MAP.md` ("The exhbt and its editor")

Smallest-possible fixes only, in files that are not yours, because your changes break them and nobody else is working yet. This list was measured by making the type changes and running `tsc`, and by searching for every use of `FORMATS`:
- `components/editor/Sections.tsx`: two places that switch on a section's kind;
- `components/editor/LayoutPicker.tsx`: it maps over `FORMATS` and keys its sketches by `Format`. Make it list `OFFERED_FORMATS`, and type the sketches so three are enough;
- `lib/ai/exhbt-draft.ts`: the layout enum (step 2);
- `lib/exhbt/drafted.ts`: `NAMED` is keyed by `Format`; key it by the three drafted layouts;
- `e2e/phase2-sections.spec.ts`: three type errors from the wider `Section`;
- `e2e/phase2-formats.spec.ts`: one assertion that `FORMATS` is the three; point it at `OFFERED_FORMATS`.

If `tsc` or one of your named specs fails anywhere else, make the smallest fix and list the file in your report.

## You must not touch

Everything in `components/portfolio/` and `components/exhbt/`, `app/globals.css`, `lib/exhbt/sample.ts`, `lib/portfolio-home.ts`, and the rest of `components/editor/`. Change no behaviour of the classic editor and no markup of any page.

## What you build against

Nothing new. You define the interfaces below; three other agents build against them word for word, so do not rename anything. If one of them is wrong, say so in your report rather than changing it quietly.

```ts
// lib/exhbt/formats.ts  (a leaf file: it imports types from ./blocks, never values)
export const FORMATS = ["case-study", "gallery", "research", "build", "essay", "before-after", "event"] as const;
export type Format = (typeof FORMATS)[number];
/** The layouts the picker shows and the AI draft may choose. Three until release 4, then all seven. */
export const OFFERED_FORMATS: readonly Format[] = ["case-study", "gallery", "research"];

export type PageKind = SectionKind | "flow";
/** One place in a layout's usual order. `first` means only the first section of these kinds (the lead image, the key figure). */
export type Slot = { kinds: readonly PageKind[]; first?: true };
/** What a layout needs before it can be published, beyond each part's own checks. Every issue has the path "sections", or "myRole". */
export type Need =
  | { need: "count"; kinds: readonly SectionKind[]; min: number; message: string }
  | { need: "stages"; message: string }
  | { need: "myRole"; message: string };

export type FormatRule = {
  name: string;
  bestFor: string;
  /** The kinds the layout draws. Any other kind is kept in the doc but not shown, counted or checked (decision 0024). */
  kinds: readonly SectionKind[];
  /** What it takes from the person's work when drafted (decision 0025). */
  fromWork: FromWork;
  /** Whether the flowchart can be taken off the page in this layout. */
  flowRemovable: boolean;
  /** The usual order: what picking this layout sorts the sections into. */
  template: readonly Slot[];
  /** How a doc with no flow marker is drawn. "flow-first" is today's case study: the flowchart, then the sections in the doc's order. */
  legacy: "flow-first" | "template";
  /** The first section of these kinds is drawn as the lead image or the key figure. */
  first?: { kinds: readonly SectionKind[]; as: "lead" | "key" };
  needs: readonly Need[];
};
export const FORMAT_RULES: Record<Format, FormatRule>;
```

```ts
// lib/exhbt/blocks.ts
export const SECTION_KINDS = ["findings", "graph", "image", "quote", "reflection", "link", "aim", "conclusion", "pullquote"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];          // never "flow"

export const FLOW_ID = "flow";
/** Where the flowchart sits among the sections. Its boxes stay in doc.flow. At most one. */
export const FlowMarkerSchema = z.object({ id: z.literal(FLOW_ID), kind: z.literal("flow") });
export type FlowMarker = z.infer<typeof FlowMarkerSchema>;
/** Your own words, drawn large (the essay layout). Plain text. */
export const PullquoteSectionSchema = z.object({ id: SectionId, kind: z.literal("pullquote"), text: z.string() });

// ImageSchema gains:   stage: z.enum(["before", "after"]).optional().catch(undefined)
// DocSchema gains:     myRole: z.string().optional()      "My role", in the sidebar
//                      flowOff: z.boolean().optional()    the flowchart has been taken off the page
// SectionSchema gains: PullquoteSectionSchema and FlowMarkerSchema

export type Section = z.output<typeof SectionSchema>;               // includes FlowMarker
export type ContentSection = Exclude<Section, FlowMarker>;
export const isContent = (s: Section): s is ContentSection => s.kind !== "flow";
// LIMITS gains: myRoleChars: 60, pullquote: { words: 30 }, sections.pullquote: 1, link.hrefOptional: false
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

```ts
// lib/exhbt/layouts.ts
/** One side of a pair: a single item, or a stack. `first: true` matches only the layout's lead or key item; `first: false` never matches it. */
type Side =
  | { kinds: readonly PageKind[]; as?: ItemAs; first?: boolean }
  | { stack: StackName; kinds: readonly PageKind[] };
export type RowRule =
  /** `a` straight before `b` (reversed: false), or `b` straight before `a` (reversed: true). Forward wins: a reversed match is not taken when its `a` item is straight followed by an item that makes a forward pair with it. */
  | { rule: "pair"; ratio: PairRatio; a: Side; b: Side }
  /** A run of one or more of these kinds, each kind once, on a row of its own. Its items are drawn "stacked". */
  | { rule: "stack"; stack: StackName; kinds: readonly PageKind[] }
  /** A run of one or more sections of these kinds. Never takes the lead or key item. */
  | { rule: "group"; of: GroupOf; kinds: readonly SectionKind[]; as: ItemAs }
  /** An image marked "before" straight before one marked "after". */
  | { rule: "before-after" };

const FIGURE = ["graph", "image"] as const;
/** Tried in this order at each place in the doc's order; the first that matches takes its items. Nothing matches: the item is a row of its own, drawn "plain" (or as LONE says). */
export const ROW_RULES: Record<Format, readonly RowRule[]> = {
  "case-study": [
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: FIGURE } },
    { rule: "group", of: "graphs", kinds: ["graph"], as: "plain" },
    { rule: "group", of: "images", kinds: ["image"], as: "plain" },
  ],
  gallery: [
    { rule: "pair", ratio: "even", a: { kinds: ["flow"], as: "stacked" }, b: { stack: "happened", kinds: ["findings", "graph"] } },
    { rule: "group", of: "grid", kinds: ["image"], as: "tile" },
    { rule: "group", of: "links", kinds: ["link"], as: "plain" },
  ],
  research: [
    { rule: "pair", ratio: "key", a: { stack: "method", kinds: ["aim", "flow"] }, b: { kinds: FIGURE, first: true, as: "key" } },
    { rule: "stack", stack: "method", kinds: ["aim", "flow"] },
    { rule: "group", of: "figures", kinds: FIGURE, as: "plain" },
    { rule: "pair", ratio: "even", a: { kinds: ["findings"], as: "kicker" }, b: { stack: "closing", kinds: ["conclusion", "reflection"] } },
    { rule: "stack", stack: "closing", kinds: ["conclusion", "reflection"] },
    { rule: "group", of: "refs", kinds: ["link"], as: "listed" },
  ],
  build: [
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: FIGURE, first: false } },
    { rule: "group", of: "images", kinds: ["image"], as: "plain" },
    { rule: "group", of: "buttons", kinds: ["link"], as: "button" },
  ],
  essay: [
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: ["pullquote"] } },
    { rule: "group", of: "refs", kinds: ["link"], as: "listed" },
  ],
  "before-after": [
    { rule: "before-after" },
    { rule: "pair", ratio: "found", a: { kinds: ["findings"] }, b: { kinds: ["graph"] } },
    { rule: "group", of: "images", kinds: ["image"], as: "plain" },
  ],
  event: [
    { rule: "pair", ratio: "even", a: { kinds: ["flow"], as: "stacked" }, b: { stack: "happened", kinds: ["findings", "graph"] } },
    { rule: "group", of: "grid", kinds: ["image"], as: "tile" },
    { rule: "group", of: "links", kinds: ["link"], as: "plain" },
  ],
};
/** How an item on a row of its own is drawn when it is not "plain". The lead and key items are always "lead" and "key". */
export const LONE: Partial<Record<Format, Partial<Record<PageKind, ItemAs>>>> = { research: { findings: "kicker" } };
```

The layouts' own facts:

| Layout | Usual order (`template`) | Lead or key | No marker (`legacy`) | Flowchart can be removed |
|---|---|---|---|---|
| Case study | flowchart, findings, graphs, images, quote, what I'd do next, link | none | `flow-first`: the flowchart, then the sections in the doc's order | no |
| Gallery | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |
| Research | aim, flowchart, first graph or image, other graphs and images, findings, conclusion, what I'd do next, quote, links | first graph or image is the key figure | `template` | no |
| Build | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |
| Essay | flowchart, findings, pull quote, graph, image, quote, what I'd do next, links | none | `template` | yes |
| Before and after | images, flowchart, findings, graph, quote, what I'd do next, link | none | `template` | yes |
| Event or performance | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |

| | Build (`build`) | Essay (`essay`) | Before and after (`before-after`) | Event or performance (`event`) |
|---|---|---|---|---|
| Best for | "Something you made that works. Software, apps, engineering and hardware." | "An argument and the sources behind it. Law, history, English and politics." | "A redesign, shown as it was and as it is now. UX, product and design." | "Something you put on or took part in. Music, drama, sport and societies." |
| Title is | what you built | the question or thesis | what you redesigned | the event |
| Context line (`gap`) | "The problem", 30 words | "Context", 30 words | "The problem", 30 words | "The brief", 30 words |
| Flowchart heading | "How I built it" | "How the argument runs" | "What I did" | "How we put it on" |
| Findings | "What it does", 1 to 3 of 15 words, optional | "Key points", 2 to 4 of 20 words, required | "What changed and why", 2 to 3 of 20 words, required | "How it went", 1 to 3 of 15 words, optional |
| Images | up to 4 ("screenshots"), captions 10 words; the first is the lead | up to 1, caption 15 words | 2 to 6, captions 10 words, each can be marked Before or After | 1 to 6, captions 10 words; the first is the lead (the poster) |
| Graphs | 1 | 1 | 1 | 1 |
| Links | up to 2 ("Link": the demo, the code); description 10 words | up to 4 ("Source"); label 12 words; description 10 words; the address is optional | 1 ("Link": the prototype) | up to 2 ("Link": a recording, the programme); description 10 words |
| Quote heading | "Feedback" | "Feedback" | "Feedback" | "Review" |
| What I'd do next | "What's next", 35 words | "What I'd look at next", 25 words | "What I'd do next", 35 words | "What I'd do next", 35 words |
| Extra kind | none | pull quote, 1, up to 30 words | none | none |
| Skill pills are called | "Built with" | "Skills used" | "Skills used" | "Skills used" |
| Needs, to publish | a screenshot or a link | a key points section | at least 2 images, one marked Before and one After; a "What changed" section | at least 1 image; My role |
| Takes from the work (0025) | `figure` | `none` | `pictures` | `pictures` |
| Words the editor aims for | 150 | 170 | 150 | 150 |

The three existing layouts keep every word, cap and message they have today. For them the new fields are: `flowRemovable` (case study and research false, gallery true), `template`, `legacy`, `first` (as the table), and `needs`, which replaces the `F === …` branches in `validateForPublish` with the same messages in the same order.

## Steps

Commit and push after each.

1. **The parity harness, first, with no other change.** This commit is where the golden copies come from, so it must change no product code.
   - `app/dev/parity/route.ts`: development only, guarded exactly as `app/dev/portfolio/route.ts` is. `POST { username, slug, doc }` stores `doc` as a published exhbt for the development user of that username (raw, in both copies: `setStoredCopiesForDevelopment`), and returns `{ id, url }`. `GET ?id=<id>` returns that exhbt's stored working copy and published copy as JSON, untouched (E's and later tests read docs back with it). For each image section it stores a flat placeholder picture of that section's `w` by `h` as the user's own file and points the section at it, the same way on every run.
   - `e2e/fixtures/order-docs.ts`: the order fixtures of 0027 ("The parity gate", step 2), as plain docs.
   - `e2e/layout-parity.spec.ts`: for every sample and seed (`/dev/portfolio?with=open-banking,full,flow,formats`, the old-shape GP exhbt and the library; `/demo` pages) and every order fixture, open the page at 1440 by 900, take the `outerHTML` of `article[data-exhbt-page]`, normalise it as 0027 says (file addresses to ids, `useId` values to positions, class words sorted), and compare it with `e2e/golden/<name>.html`. With `GOLDEN=write` it writes the files. With `PARITY_DOCS=<dir>` it also reads every `*.json` doc in that directory and keeps their golden copies in `<dir>/golden` (the main session uses this for the live pages; those files never enter the repo).
   - Run it with `GOLDEN=write`, commit the golden files, then run it without and see it pass.
2. **The schema** (`blocks.ts`, `formats.ts`), as the types above. `normaliseDoc`: keeps one marker and gives it the id `flow`; drops a second; deletes `flowOff` when a marker is there; still drops a kind or layout it does not know. `OFFERED_FORMATS` is the three. Export `DRAFT_FORMATS` (the same three, as a tuple) and use it for the enum in `lib/ai/exhbt-draft.ts`, so the AI's choice does not widen.
3. **Every helper that returns sections returns content sections only** (`shownSections`, `hiddenSections`, `sectionsOf`, `imagesOf`, `findingsOf`, `chartsOf`). Only `doc.sections` and `pageItems` ever show the marker. `sectionTexts` of a pull quote is its text. `sectionLabel` of the marker is "Flowchart". `sectionName` of a pull quote is "Pull quote". `newSection("pullquote")` is `{ text: "" }`. `roomFor`, `withKeyFigure` and `withWorkVisual` ignore the marker.
4. **Reading a removed flowchart.** `wordCount` leaves the flowchart's words out when `flowShown` is false and adds `myRole`. `validateForPublish` skips the flowchart's checks when it is not shown; reads `needs`; allows an empty link address where `formatLimits(f).link.hrefOptional`; checks a pull quote (not empty, within its words) at `sections.N.text`; checks `myRole`'s length at `myRole`. `publicDoc` writes `flow: []` when the flowchart is not shown. `tileFromDoc` (`lib/exhbt/headline.ts`) gives a tile no methodology steps when the flowchart is not shown; look at what `components/exhbt/ExhbtTile.tsx` then draws (read only) and say in your report whether an empty strip is left behind. The number check (`verify.ts`) still reads everything kept, and gains `myRole`.
5. **`pathOfNumber(doc, n): string | null`** in `verify.ts`: the path of the first field whose text holds that number (by value, as `normaliseNumber`), for "Things to fix".
6. **The engine** (`layouts.ts`):
   - `adopt`: for a case study, port `runsOf` as it is today and emit its runs flattened with the marker first, a findings-and-figure run as the findings then the figure. For every other layout, a stable sort into `template`, the marker at the flowchart's slot. Sections the layout keeps but does not draw stay after the shown section they followed.
   - `pageItems`, `keptItems`, `rowsFor` (the rules above), `structureKey`, `applyTemplate`. `pageItems`'s `skip` is applied before the order is worked out, so a doc with no marker pairs exactly as today's page does once an image with no address has been left out.
   - `blockOptions`: the layout's kinds in the order and words of today's "Add a section" menu (`menuFor` in `components/editor/Sections.tsx`), each with `full` when there is no room. The reasons read: "Up to 2 graphs in a case study", "One quote in a gallery", "Up to 3 graphs and images together in research". Every number comes from `formatLimits`. The flowchart is offered only when it is off the page.
   - `insertBlock`, `insertImage`, `moveItem`, `removeItem`. A new section is empty (`newSection`), not filled with sample words. `removeItem` on the flowchart does nothing where `flowRemovable` is false.
7. **`layoutNotes`** reads `needs`, so its "missing" list works for all seven.
8. **Keep the graphs a figure replaces.** `AiVersion` in `lib/exhbt/draft-blocks.ts` gains `graphs?: Chart[]`. In `app/api/exhbts/[id]/figure/route.ts`, when `withWorkVisual` returns `removed` graphs, save their charts in the exhbt's AI version (`saveAiVersion` in `lib/draft-tools.ts`), beside what is there. Nothing else in the route changes and nothing reads the field yet: release 3 offers the chart back (decision 0026). It ships now so every exhbt drafted from release 2 on has it.
9. **The docs lines** in `AGENTS.md` and `docs/MAP.md`: say the flowchart's place is a marker and that one engine draws every layout. Keep them short and true for release 2.

## Tests

Write `e2e/layout-model.spec.ts`, pure:
- `normaliseDoc`: one marker survives, two become one, `flowOff` goes when a marker is there, a pull quote and a stage survive a read and a `ExhbtDocSchema` parse.
- `adopt`: every sample equals itself adopted when drawn (`pageItems` ids in the same order); adopting twice is the same object; each order fixture gives the order written beside it in the fixture. With `skip` leaving out an image that sits between a graph and the findings, the graph and the findings pair with the findings first, as today.
- `rowsFor`: for each of the seven layouts in its usual order, the rows expected (for example a case study of flowchart, findings, graph, graph, quote gives: flowchart; a `found` pair of findings and graph 1; a `graphs` group of graph 2; quote). A reversed pair. A gallery with no findings (the flowchart alone, "plain"). Research with no figure (the method stack alone).
- A removed flowchart: not in `pageItems`, not counted, not checked, `flow: []` in `publicDoc`; drawn first in a case study even with `flowOff`.
- `insertBlock`, `moveItem`, `removeItem`: places count page items; a full kind returns null; each leaves an arranged doc.
- `structureKey` changes on a move, an add, a stage and a layout, and not on typing.
- **An old reader.** `e2e/fixtures/reader-before-r2.ts` is a frozen copy of today's `normaliseDoc`, `DocSchema` and `FORMATS` (copy them from the base commit; do not import them). Docs with a marker, `flowOff`, a pull quote, a stage, `myRole` and each new layout id must parse with it and come out as a doc with only kinds and a layout it knows.

Run: `e2e/layout-model.spec.ts`, `e2e/layout-parity.spec.ts`, `e2e/phase2-sections.spec.ts`, `e2e/phase2-formats.spec.ts`, `e2e/exhbt-page.spec.ts`, `e2e/auto-figure.spec.ts`, `e2e/phase2-editor.spec.ts`.

## Done looks like

- The four checks pass. The seven named specs pass.
- `e2e/layout-parity.spec.ts` passes on your last commit with the renderer untouched: the model change alone moved nothing.
- No layout but the three is offered or drafted.

## Report back

The branch head; the files outside your list you had to touch and why; anything in the interfaces above you think is wrong; any fixture where today's page surprised you (a pairing `adopt` had to cover); which specs you ran and their results.

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
