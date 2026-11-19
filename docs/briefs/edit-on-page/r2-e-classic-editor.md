# Brief E: the classic editor keeps what it does not edit

| | |
|---|---|
| Release | 2, the reader release |
| Model | Sonnet |
| Branch | `phase-2-r2-e-classic`, made from `phase-2-r2` after C's part 1 is merged |
| Port | 3304 |
| Starts when | B and C's part 1 are merged: your tests look at the preview, which only draws a moved or removed flowchart once the new renderer is in. C's part 2 may run beside you, on other files |

## Goal

Today's editor stays for two more releases as the fallback. Make it open, edit and save any exhbt the new editor will write (a flowchart that has been moved or removed, a pull quote, a before or after mark, My role, a new layout) without losing any of it, while offering nothing new to anyone today. Also put in the switch that will choose between the two editors (unused until release 3), so it can be proven on the preview site now.

## Read first

`docs/decisions/0027-layout-engine.md` ("The flowchart is a section", "A removed flowchart, exactly", "What the reader release ships") and the data table in `docs/decisions/0028-four-more-layouts.md`. Then `components/editor/Editor.tsx`, `Sections.tsx`, `LayoutPicker.tsx`, `PreviewArrange.tsx`, `model.ts`, and `lib/portfolio-home.ts`.

## You own

`components/editor/` (every file), `lib/portfolio-home.ts`, `lib/site.ts`, `app/api/health/route.ts`, `app/dev/editor/` (new), `e2e/editor-classic-keeps.spec.ts` (new), `e2e/editor-switch.spec.ts` (new).

## You must not touch

`lib/exhbt/` (B's, merged; report what you need), `components/portfolio/` and `components/exhbt/` (C's), `app/globals.css`, `app/(app)/exhbts/[id]/` (the edit page does not read the switch until release 3), `wrangler.jsonc`, `next.config.ts`, the existing specs.

## What you build against

From B, on your base. You call these; you do not change them.

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
  /** A findings section, a graph, or an image picked from the work as a graph or a table (decision 0025): what a case study needs today. */
  | { need: "results"; message: string }
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

From `lib/exhbt/layouts.ts`: `hasMarker(doc)`, `isArranged(doc)`, `flowShown(doc)`, and

```ts
/**
 * Puts a removed flowchart back and deletes flowOff. Every other item keeps its place, and the doc stays arranged. The same object when the flowchart is shown.
 * With `at` (a page-item place, as insertBlock's), the marker goes in there: the new editor's "+" and tray always pass it.
 * Without it (the classic editor's "Put the flowchart back", which has no place to give), the marker goes in before the first page item whose place in the layout's usual order comes after the flowchart's, or at the end if none.
 */
export function restoreFlow(doc: ExhbtDoc, at?: number): ExhbtDoc;
```

 From `lib/exhbt/formats.ts`: `OFFERED_FORMATS`, `FORMAT_RULES[f].flowRemovable`. Every helper that returns sections (`shownSections`, `sectionsOf`, `imagesOf` and the rest) returns content sections only; `doc.sections` itself can hold the marker.

B's development page helps your tests: `POST /dev/parity` with `{ username, slug, doc }` stores a doc as it is and returns `{ id, url }`; `GET /dev/parity?id=<id>` returns the stored working copy and published copy as JSON.

## Steps

Commit and push after each. Nothing here may change what a person sees on an exhbt that has none of the new data: the existing specs must stay green untouched.

1. **The marker in the sections list.** `Sections.tsx` walks `doc.sections`, so a marker would show as a broken card. Draw it as a short row named "Flowchart" with the grip and the move up and move down buttons, `data-kind="flow"`, no fields and no Remove, and one line: "Edit its boxes in the card above." Moving it moves the flowchart on the page. Section numbering, labels and issue paths for the other cards must not shift: issue paths use the index in `doc.sections`, marker included, as `validateForPublish` reports them.
2. **"Arrange sections"** in the preview draws the flowchart first, which is wrong once it can sit anywhere. Hide the button when `isArranged(doc)`. The list on the left still moves everything.
3. **A removed flowchart.** When `flowShown(doc)` is false, the flowchart card shows "The flowchart is off the page." and a button, "Put the flowchart back", which sets the doc to `restoreFlow(doc)`. Never just delete `flowOff`: a doc with no marker and no `flowOff` counts as untouched and is redrawn in the layout's template order, so the person's own order would be lost from the page. Its boxes stay editable. The classic editor offers no way to remove a flowchart.
4. **The new fields, kept and minimally editable,** so someone sent here by the fallback is not stuck:
   - a pull quote section: a card named "Pull quote" with one plain text field and its word limit;
   - an image in a "Before and after" exhbt: a small choice under the description, "Before", "After" or "Neither", writing `stage`;
   - "My role (optional)" in the first card, beside "Where and when", with its character limit, shown **only** when `doc.myRole !== undefined` or the layout is Event or performance. Release 2 offers nobody a new field: a value typed now would show on their live page before the layouts that use it exist, and would be dropped if release 2 were rolled back;
   - a link where `formatLimits(f).link.hrefOptional`: the address field says "(optional)".
   Check by reading the code that nothing in `components/editor/` rebuilds a section or the doc from a fixed list of keys. Where something does, make it spread what is there.
5. **`LayoutPicker`** lists `OFFERED_FORMATS`. If the doc's own layout is not one of them, list it too, selected, so the person can see where they are. A layout with no sketch of its own uses the case study's.
6. **The "Add a section" menu** offers the layout's kinds from `FORMAT_RULES[f].kinds`; add the entry "Add a pull quote". Keep today's wording for everything that exists (the tests read it).
7. **`keyFigureOf`** (`lib/portfolio-home.ts`): Build and Event or performance take the first image, then a graph; Before and after takes the first image, then a graph; an essay takes the first graph or image. The flowchart is the fallback only when `flowShown(doc)`. Check what a card draws for a flowchart with no steps (`components/portfolio/PortfolioHome.tsx`, read only) and say in your report whether it is acceptable.
8. **One word for the new editor.** In `components/editor/useAutosave.ts`, add `export` to `writeBackup` and change nothing else. In release 3 the new editor's store writes the browser copy itself, under the same key, so the classic editor's "We kept changes from…" offer still finds it after a crash.
9. **The switch, unused.** In `lib/site.ts`:
   ```ts
   // lib/editor-kind.ts  (new, server only: its first line is import "server-only")
   export type EditorKind = "page" | "classic";
   /** Which editor /exhbts/<id>/edit serves. "classic" only when the runtime variable EXHBT_EDITOR is "classic". Read on each request. */
   export async function editorKind(): Promise<EditorKind>;
   ```
   In production it reads `process.env.EXHBT_EDITOR` when called and nothing else. In development only (`process.env.NODE_ENV !== "production"`), a cookie `exhbt-editor-kind` (`page` or `classic`, read with `cookies()` from `next/headers`) overrides it, so each browser test has its own and nothing leaks between tests. `app/dev/editor/route.ts` (development only, guarded as `app/dev/portfolio/route.ts` is): `GET ?kind=classic|page` sets the cookie, `?kind=` with nothing clears it; it answers with the kind now in force. `app/api/health/route.ts` adds `editor: await editorKind()` to what it reports. Do not add `EXHBT_EDITOR` to `wrangler.jsonc` (`vars` there are reset on every deploy) or to `next.config.ts` (fixed at build). Nothing reads `editorKind()` yet but the health route: the edit page starts using it in release 3.

## Tests

Write `e2e/editor-classic-keeps.spec.ts`. Seed each doc with `POST /dev/parity`, sign in as that development user, open `/exhbts/<id>/edit?editor=classic` (today's page ignores the query; from release 3 it is what keeps this spec on the classic editor, so nobody has to edit it then):
- A case study with the marker third in `sections`: the preview draws the flowchart third; the list has a "Flowchart" row there; type in the title, wait for "Saved", read the doc back with `GET /dev/parity`: the marker is still third and nothing else changed but the title. Move the row up: the preview and the stored doc follow.
- A gallery with `flowOff: true` and its sections in an order of the person's own (not the template's): no flowchart in the preview; "Put the flowchart back" brings it back at the flowchart's usual place; the stored doc has the marker and no `flowOff`; every other section's page order is what it was before the press.
- A case study with no `myRole`: no My role field. An event with `myRole`: the field is there.
- An essay with a pull quote and a source with no address, a "Before and after" with a before and an after, an event with `myRole`: each opens, takes an edit to the title, saves, and reads back with every one of those values intact. Each can be edited in its minimal field.
- "Arrange sections" is not offered on an arranged doc and still is on an untouched case study.
- axe on the editor with the marker row and the note showing.

Write `e2e/editor-switch.spec.ts`: `/api/health` reports `editor: "page"`; after `/dev/editor?kind=classic` in a browser context, `/api/health` from that context reports `"classic"`, and from a fresh context still `"page"`; `?kind=` puts it back.

Run: `e2e/editor-classic-keeps.spec.ts`, `e2e/editor-switch.spec.ts`, `e2e/phase2-editor.spec.ts`, `e2e/phase2-sections.spec.ts`, `e2e/phase2-formats.spec.ts`, `e2e/phase2-polish-2.spec.ts`, `e2e/phase2-portfolio.spec.ts`.

## Done looks like

The four checks pass; the seven named specs pass with no existing spec edited; a doc with every new thing in it survives a visit to the classic editor; nobody is offered a field they were not offered before.

## Report back

The branch head; anything in `components/editor/` that rebuilt a doc from fixed keys and how you fixed it; what a portfolio card draws when an exhbt has no graph, no image and no flowchart; anything you needed from B or C; the specs you ran and their results.

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
