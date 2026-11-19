# Brief M: the four new layouts go live, and the AI chooses among seven

| | |
|---|---|
| Release | 4, the four layouts |
| Model | Opus |
| Branch | `phase-2-r4-m-ai`, made from `phase-2-r4` |
| Port | 3313 |
| Starts when | Release 3 is live; the sample agent's numbers are in and Rory has answered if any sample could not fit; the GitHub secret `ANTHROPIC_API_KEY` is set (the real-AI test cannot run without it) |

## Goal

Offer Build, Essay, Before and after, and Event or performance in the layout menu, and teach the AI draft to choose among seven layouts and to fill the new parts only from what the person supplied. The pages, the editor and the data for these layouts are already live and unreachable; you switch them on.

## Read first

`docs/decisions/0028-four-more-layouts.md` (all of it; "The AI chooses among seven" is your specification), `docs/decisions/0025-key-visual-from-the-work.md` ("What each layout takes from the work", "What the person is told"), `docs/decisions/0024-exhbt-formats.md` ("The AI draft"). `AGENTS.md`: the AI must only use facts the user supplied; Claude Haiku only. Then `lib/ai/exhbt-draft.ts` (the prompt, the schema, the stand-in used when there is no key, how a draft becomes a doc), `lib/exhbt/drafted.ts`, `lib/exhbt/references.ts`, `evals/exhbt-draft/README.md` and `RUBRIC.md`, `scripts/eval-drafts.ts`, `.github/workflows/eval-drafts.yml` (read only), `components/exhbt-editor/topbar/LayoutMenu.tsx`.

## You own

`lib/ai/exhbt-draft.ts`, `lib/exhbt/drafted.ts`, `lib/exhbt/references.ts`, `lib/exhbt/formats.ts` (`OFFERED_FORMATS`, `DRAFT_FORMATS` and wording only), `app/api/exhbts/draft/route.ts`, `evals/exhbt-draft/`, `scripts/eval-drafts.ts`, `components/exhbt-editor/topbar/LayoutMenu.tsx`, `e2e/layouts-new.spec.ts`, and the layout lines of `AGENTS.md` and `docs/MAP.md`.

## You must not touch

The renderer, the engine's rules (`lib/exhbt/layouts.ts`), `lib/exhbt/blocks.ts`, the samples, the rest of the editor. If a cap or a rule has to change because of Rory's answer on the 200 words, that is a separate, named change the main session gives you: do not fold it in unasked.

## What you build against

Already live:

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

`FORMAT_RULES[f].fromWork` says what each layout takes from the work; the figure route already refuses a figure for a layout that takes none.

## Steps

Commit and push after each.

1. **The draft's schema and prompt** (`lib/ai/exhbt-draft.ts`). The layout field becomes all seven (`DRAFT_FORMATS`). Add the fields the new parts need, each empty unless the layout uses it: `pullquote`, `sources` (a citation and an optional address), `myRole`, and for Build its links (a label and an address). Write the layout rules into the prompt in the order 0028 gives, with its tie-breaks, and the per-layout notes on what the context line, the findings and the title are in each (0028's table). Keep every existing instruction for the three layouts word for word unless it must change.
2. **Only what the person supplied.** In the code that turns a draft into a doc: a pull quote is kept only if it is found word for word in the source text (compare with `squash` from `lib/exhbt/references.ts`, as quotes are checked today) and is within its cap; a source with an address goes through `referencesFrom`; a source with no address is kept only if its citation is found word for word in the source; `myRole` only if the source text contains it; a Build link only if its https address is in the source. Before and After marks are never set. Add what you need to `references.ts`.
3. **The stand-in** (no API key) must be able to produce each new layout, so the browser tests can: choose it when the notes name the layout, and from one plain cue each otherwise, as it does for research today.
4. **The line after a draft** (`lib/exhbt/drafted.ts`): add a fixed signal and fixed wording for each new layout (a built thing; an argument with sources; a before and an after; an event with a role), and in `checkedReason` the test each must pass against the draft itself before it is said. Nothing the model writes is shown as the reason.
5. **Offer them.** `OFFERED_FORMATS` becomes all seven. Add four sketches to `LayoutMenu.tsx`, in the manner of the three there, and check seven options still scan quickly: one line each, no wrapping at 390px.
6. **The eval.** In `evals/exhbt-draft/`: two made-up pieces of work for each new layout, and the near misses 0028 names (a humanities dissertation with survey data, which is research; a poster for an event with nothing about the person's part, which is a gallery; a redesign that describes only the result, which is a case study). Each fixture says the layout expected. Extend `scripts/eval-drafts.ts` to mark the layout, and to fail a draft that contains a pull quote, a source or a role not in its source. You cannot run it without the key: say so, and give the exact command and the workflow inputs for the main session.
7. **The docs lines** in `AGENTS.md` and `docs/MAP.md`: seven layouts.

## Tests

Finish `e2e/layouts-new.spec.ts` (the sample agent started it; keep its tests):
- with the stand-in, notes naming each new layout draft that layout, and the editor opens on it with its line;
- for each new layout in the editor: its rows are drawn as 0028 says (the lead; the pair; the button row; the before and after pair once two images are marked; the sources list); what it needs to publish blocks publishing with its own message and clears when met; the "+" offers its kinds with its caps;
- a pull quote not in the source is dropped; a source with no address not in the source is dropped; My role is empty when the source does not say;
- the layout menu shows seven and each can be chosen and undone;
- each published sample still prints on one page and passes axe (the sample agent's checks stay green; any that were `fixme` are now passing or agreed with Rory, as the main session tells you).

Run: `e2e/layouts-new.spec.ts`, `e2e/phase2-draft.spec.ts`, `e2e/phase2-formats.spec.ts`, `e2e/auto-figure.spec.ts`, `e2e/editor-topbar.spec.ts`.

## Done looks like

Seven layouts can be chosen and drafted in the tests; nothing the AI could have invented reaches a doc; the eval fixtures and the marking are ready to run with the real model.

## Report back

The branch head; the full new prompt text for the layout rules, so it can be read without opening the file; how to run the eval and what a pass is; any pair of layouts you expect the real model to confuse; the specs you ran and their results.

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
