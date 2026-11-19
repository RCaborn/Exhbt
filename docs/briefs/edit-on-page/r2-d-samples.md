# Brief D: samples and seeds for the four new layouts

| | |
|---|---|
| Release | 2, the reader release (it may land at the start of release 3 if the renderer's second part is late) |
| Model | Sonnet |
| Branch | `phase-2-r2-d-samples`, made from `phase-2-r2` after C's part 2 is merged |
| Port | 3303 |
| Starts when | C's part 2 is merged. You can write the sample docs as soon as B is merged, but you cannot check them on a page until C's part 2 is |

## Goal

Write one fictional sample exhbt for each of Build, Essay, Before and after, and Event or performance, with a development seed for each, and measure them: how many words, how many printed pages, in every look. The numbers you report decide whether those layouts can keep the 200-word cap, so they must be honest.

## Read first

`docs/decisions/0028-four-more-layouts.md` (all of it), `docs/decisions/0024-exhbt-formats.md` ("The 200 words", "Print"), `DESIGN.md` (the writing rules) and the anti-AI-slop writing skill in `.claude/skills/`. Then `lib/exhbt/sample.ts` (see how `galleryDoc` and `researchDoc` are made), `app/dev/portfolio/route.ts` (how they are seeded with stored placeholder pictures), and the print and looks checks in `e2e/phase2-formats.spec.ts` and `e2e/phase2-looks.spec.ts` (copy their method).

## You own

`lib/exhbt/sample.ts` (add only), `app/dev/portfolio/route.ts` (add only), `e2e/layouts-new.spec.ts` (new).

## You must not touch

Any existing sample or seed, by even a word: the parity gate compares them. `app/globals.css`, `components/`, `lib/exhbt/` apart from `sample.ts`. If a sample will not fit a page, you do not change CSS or caps. You report.

## What you build against

From B, on your base:

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

The layouts' facts and caps (the code is the owner: read `FORMAT_RULES`, `FORMAT_COPY` and `formatLimits(f)`; this table is what they should say):

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

`validateForPublish(doc)` returns what stops publishing; `wordCount(doc)` is every word on the page.

## Steps

Commit and push after each sample.

1. **Four samples** in `lib/exhbt/sample.ts`, each a function that takes the file ids of its pictures, with its picture facts (`w`, `h`, `alt`, `caption`) exported beside it as `GALLERY_IMAGES` is:
   - `buildDoc(fileIds)`: a student's working tool or app, with a lead screenshot, what it does, a demo link and a code link.
   - `essayDoc(fileId?)`: a humanities or law essay with a thesis, key points, a pull quote in the student's own words, and sources (one with no address).
   - `beforeAfterDoc(fileIds)`: a redesign with at least one before and after pair, what changed and why, and a graph.
   - `eventDoc(fileIds)`: a society event or a production, with a poster as the lead, My role, how it went, and a review.
   Fictional people and places, UK universities, plain British English, no hype words, numbers that agree with each other. Each must return no issues from `validateForPublish`, sit in its usual order with no marker (as an AI draft would), and be at or under the word cap.
2. **Make each as full as a real one would be.** Start with every part the layout offers. If that is over the cap, take out the least important optional part, and write down what you took out and the count before and after. Do not shorten sentences into fragments to squeeze under.
3. **Seeds.** In `app/dev/portfolio/route.ts`: `with=build`, `with=essay`, `with=before-after`, `with=event`, and `with=layouts` for all four, each published at a slug you name in the route's comment, with flat placeholder pictures stored as the user's own files, as the gallery's are.
4. **Measure.** For each sample, in each of the eight looks: the printed page count, and whether anything is cut off or overlaps at 390px and at 1440px.

## Tests

Write `e2e/layouts-new.spec.ts`:
- each sample passes `validateForPublish` and is at or under the cap (a pure test; print the count in the test's title);
- each seed's page draws with `article[data-format="<id>"]` and its parts in the usual order (`[data-part]`);
- each prints on one A4 page, in each look;
- axe finds nothing on each, in each look, and nothing scrolls sideways at 390px.

If a check fails because the layout cannot fit, do not weaken it and do not delete it. Mark that one check `test.fixme`, with the measured numbers in its title, and report.

Run: `e2e/layouts-new.spec.ts`, `e2e/layout-parity.spec.ts` (to prove you changed no existing sample), `e2e/phase2-formats.spec.ts`.

## Done looks like

Four samples and their seeds exist; the parity spec still passes; every check in your spec passes or is a `fixme` with numbers.

## Report back

A table, one row per layout: words with every part; words as shipped; which parts were left out; printed pages in each look; anything that looked wrong, with the address to open. Then, in two sentences each, your view on whether Essay and Before and after can honestly live within 200 words and one page. Also the branch head and the specs you ran.

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
