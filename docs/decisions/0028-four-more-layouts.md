Status: accepted
Date: 19 Nov 2026
Amends: 0024 (seven layouts, not three; "My part" is built as "My role"; a "Build" layout, which 0024 left for later), 0015 (one new section kind, the pull quote; an image can be marked before or after; a link's address is optional in one layout), 0025 (what each new layout takes from the work)

# Four more layouts: Build, Essay, Before and after, Event or performance

Rory, 17 Nov 2026: layouts stay, with "maybe 5 options". He was shown four suggestions and picked all of them. With Case study, Gallery and Research that makes seven.

Decision 0024's reason still holds: employers read different kinds of work in different ways. Three layouts cover analysis, visual work and experiments. They do not suit something that was built and runs, an argument made in prose, a redesign, or an evening that happened once.

A layout is rules for the one renderer (decision 0027), not a page of its own. So each of these is a row in the tables in `lib/exhbt/formats.ts` and `lib/exhbt/layouts.ts`, a sample, and a rule for the AI draft.

## The four

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

Everything not in the table is as a case study: the title's length, the flowchart's 3 to 6 boxes, the quote's 30 words, the skill pills, the sidebar.

Their usual order and whether the flowchart can go:

| Layout | Usual order (`template`) | Lead or key | No marker (`legacy`) | Flowchart can be removed |
|---|---|---|---|---|
| Case study | flowchart, findings, graphs, images, quote, what I'd do next, link | none | `flow-first`: the flowchart, then the sections in the doc's order | no |
| Gallery | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |
| Research | aim, flowchart, first graph or image, other graphs and images, findings, conclusion, what I'd do next, quote, links | first graph or image is the key figure | `template` | no |
| Build | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |
| Essay | flowchart, findings, pull quote, graph, image, quote, what I'd do next, links | none | `template` | yes |
| Before and after | images, flowchart, findings, graph, quote, what I'd do next, link | none | `template` | yes |
| Event or performance | first image, flowchart, findings, graph, other images, quote, what I'd do next, links | first image is the lead | `template` | yes |

### How each is drawn

The same kind of rules as the first three (0027), tried at each place in the doc's order:

- **Build.** The first image is the lead, across the column. "What it does" pairs with a graph or another image that is its neighbour. Other images that sit together go two to a row. Links that sit together are a row of buttons ("Try the demo", "See the code"), not grey cards.
- **Essay.** "Key points" pair with the pull quote when it is their neighbour: the points on one side, the quote large on the other, in the look's display face. Links that sit together are the "Sources" list, drawn like research's references; one with no address is plain text.
- **Before and after.** An image marked Before straight before one marked After is drawn as a labelled pair, side by side, each with "Before" or "After" over it. Several pairs each take a row. "What changed and why" pairs with the graph when it is its neighbour. Other images go two to a row.
- **Event or performance.** As the gallery: the lead image (the poster), the flowchart beside "How it went" and the graph, the other images in justified rows, links two to a row. The sidebar shows My role.

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

## The least new data that does it

All of it is optional and lives in the jsonb doc. There is no migration.

| New | What it is | Why it is safe for code that does not know it |
|---|---|---|
| Four layout ids: `build`, `essay`, `before-after`, `event` | values of `format` | Today's code reads a layout it does not know as a case study (0024). The page is valid; the parts all exist in a case study |
| `image.stage`: `"before"` or `"after"` | a mark on an image section | Unknown keys are stripped on save and ignored on read. The two pictures still sit side by side, without their labels |
| `pullquote`: a section kind with `text` | the person's own sentence, drawn large | Old code leaves out a kind it does not know. That is safer than reusing `quote`: the existing quote means someone else's feedback, and an old page would have shown the person's own line under "Feedback" with no name |
| `myRole`: a string, up to 60 characters | "My role", a fact in the sidebar | Stripped and ignored. It is the "My part" 0024 left for later |
| A link with no address | an empty `href`, allowed only where the layout says so (`link.hrefOptional`) | Today's page already draws a link with no usable address as plain text |

Build needs nothing new. Its screenshots are images, its demo and code are links, and its stack is the skill pills under another name.

`myRole` is offered on every layout by the new editor (release 3 on) and needed only by Event or performance. It counts towards the word cap, as every fact in the sidebar does. It is not drafted unless the material says it. In release 2 the classic editor shows its field only on a doc that already has one or whose layout is Event or performance: release 2 offers nobody anything new, and a value typed then would be dropped without a word if release 2 were rolled back.

A stage is set by the person in the editor (Before, After, or neither), on any image in a Before and after exhbt. Outside that layout the mark is kept and not shown.

This data ships in release 2 with the rest of the model, so the live site can read, draw and keep it before anything can write it (0027). The layouts are not offered until release 4: `OFFERED_FORMATS` lists three until then, and the AI's choice is limited to the same three.

## Samples

Each layout gets a fictional sample in `lib/exhbt/sample.ts`, like `galleryDoc` and `researchDoc`: a function that takes the file ids of its pictures. Each must:

- pass `validateForPublish`;
- be at or under the word cap;
- print on one A4 page;
- pass axe and the contrast checks in all eight looks.

Each also gets a seed on the development page (`/dev/portfolio?with=build` and so on, `with=layouts` for all four), so the tests and the reviews have a page to open.

## The key visual each wants

Decision 0025 has each layout say what it takes from the person's own files (`fromWork`):

- **Build: a figure.** The architecture diagram, a screenshot or a results chart from the report, placed as a case study places it. A graph or table from the work replaces the drafted chart, as 0025 rules.
- **Essay: nothing.** An essay rarely has a figure worth the page, and 0025 names it as the layout that takes none. Nothing is looked for and nothing is placed. A person can still add one image by hand.
- **Before and after: pictures.** One visual, placed as the first image. It is not marked Before or After: the AI has not been told which it is.
- **Event or performance: pictures.** One visual, placed as the lead.

## The AI chooses among seven

From release 4 the draft's layout field has seven values. The rules, in the order the prompt gives them (`lib/ai/exhbt-draft.ts`, Claude Haiku as always):

1. If the person's notes name a layout, use it.
2. **Research:** an experiment, a lab report, a study or a dissertation with a question or hypothesis, a method and results from data.
3. **Build:** the person made a thing that works (software, an app, a device, a structure, a tool) and the material says what it does and how it was made.
4. **Before and after:** an existing thing was redesigned or improved, and the material describes both how it was and how it is now.
5. **Event or performance:** something that happened at a time and place (a concert, a production, a tournament, a society's event) and the material says what the person's part was.
6. **Essay:** an argument in prose with a thesis and sources, and no data the person collected.
7. **Gallery:** mostly visual work whose outcome the work itself shows.
8. **Case study** otherwise, and whenever unsure.

The subject of the course alone is never evidence of a layout. Where two fit, the earlier in the list wins, except that data the person collected always means research and never essay.

What the draft may write for the new parts follows the house rule (only facts the person supplied):

- **A pull quote** is kept only when it is found word for word in the material and is within the cap. Otherwise there is none. The AI never writes one.
- **A source with no address** is kept only when its citation appears word for word in the material. A source with an address needs the https address in the material as written, as references do today (`referencesFrom`).
- **My role** only if the material states it.
- **Before and After marks** are never drafted. The AI has not seen the pictures.
- **Demo and code links** only when the https address is in the material.

The line the editor says after a draft (0025: "Laid out as Research because…") gains a fixed signal for each new layout, each said only when the draft bears it out: a built thing with what it does; an argument with sources; a before and an after; an event with a role.

It is proven with the real model before release 4: two made-up pieces of work for each new layout and a set of near misses (a humanities dissertation with survey data; a poster for an event; a redesign with only the after), run through `npm run eval:drafts`.

## The 200 words

The cap stays at 200 on every layout (decisions 0009 and 0024, and Rory again on 17 Nov). Each layout's caps for its parts are set so a full one can fit. Whether a full, honest sample does fit is measured, not assumed. Estimates from the caps, for a sample with every part:

| Layout | Estimate | Reading |
|---|---|---|
| Build | about 175 | fits |
| Event or performance | about 180 | fits |
| Essay | about 210 with a flowchart, about 195 without | tight: fits only with a short flowchart or none, or three key points not four |
| Before and after | about 220 with four captions and three points, about 190 with two points and short captions | tight |

The sample agent reports the real numbers, with and without each optional part, and whether each prints on one page. Then:

- If a sample fits by using fewer of an optional part, that is the sample, and the editor's aim for that layout says so.
- If no honest sample fits 200 words and one page, the numbers go to Rory. Raising the cap for a layout would amend 0009.
- None of this holds up the editor. The layouts are not offered until release 4, and release 3 does not wait for the answer.

## Consequences

- `keyFigureOf` (`lib/portfolio-home.ts`) picks a card's figure by layout: the lead image for Build and Event or performance, the first image for Before and after, the first graph or image for an essay, then its usual fallbacks.
- The layout menu grows to seven. Each keeps a small sketch and one line on what it suits, so it stays quick to scan.
- `FORMAT_COPY` gains the words that differ per layout and were fixed before: the quote's heading, what the skill pills are called, and the heading over a list of sources (research's "References", an essay's "Sources"). The model's agent writes them in release 2, with every layout's entry in `FORMAT_COPY` and `FORMAT_LIMITS`, so the renderer reads each layout's words from one place.
- Rewrite works on the same five drafted parts in every layout. The pull quote, the sources and My role are not rewritten.

## To confirm with Rory

These have defaults built in. They are in `docs/briefs/edit-on-page/open-questions.md` in plain words.

- The names and headings above ("What it does", "Key points", "How we put it on", "Review").
- Whether an essay starts with a flowchart. Built: yes, and it can be removed.
- My role on every layout, or only on Event or performance. Built: offered on all, needed on one.
- The 200 words for Essay and Before and after, once the numbers are in.

## Not sure, and risky

- **Seven-way routing.** Three was easy to keep apart. Essay against research, and event against gallery, are the likely confusions. The eval decides; case study as the default limits the harm.
- **Before and after depends on the person marking pictures.** Until they do, the page is two pictures in a row and publishing is blocked with a plain reason. That is honest but adds a step.
- **A pull quote found word for word** may be rare in real essays, so most drafted essays will have none.
- **The four have never been drawn.** Their rows are designed on paper from the first three. The sample pass is the first time anyone sees them, and it may send back changes to the rules above.
- **Print.** Build's button row and the before and after pairs have no print rules yet.

## Not done

- Choosing a layout on `/exhbts/new` before drafting (the notes can name one).
- Several pictures taken from a deck for an event or a before and after.
- Wording on the publish tick for each layout.
- A recording or a film embedded in the page. A link is the way.
- A label other than Before and After (for example "Version 1").

Code: `lib/exhbt/formats.ts`, `lib/exhbt/layouts.ts`, `lib/exhbt/blocks.ts`, `lib/exhbt/sample.ts`, `components/portfolio/LayoutMain.tsx`, `lib/ai/exhbt-draft.ts`, `lib/exhbt/drafted.ts`, `lib/portfolio-home.ts`, `evals/exhbt-draft/`. Tests: `e2e/layouts-new.spec.ts`, `e2e/layout-model.spec.ts`. Briefs: `docs/briefs/edit-on-page/`.
