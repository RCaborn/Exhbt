# Brief D: the reader release, edit slots in PortfolioHome

| | |
|---|---|
| Release | R1, the reader release |
| Model | Opus |
| Branch | `phase-2-pf-d-slots`, made from `phase-2-pf1` |
| Port | 3324 |
| Starts when | Brief A is merged into `phase-2-pf0` and `phase-2-pf1` is cut from it (the goldens exist) |
| Hours | About 6 |

## Goal

Give `PortfolioHome` one optional prop, `edit`, so a client editor can draw the person's own page with every word typed where it sits, while every public page, which passes nothing, draws exactly what it draws today. This is decision 0026's "one page, one renderer", for the portfolio. Nothing passes `edit` in this release: you prove the hook with a stand-in adapter, and A's parity gate proves visitors' pages did not move.

## Read first

`docs/decisions/0031-portfolio-first.md` (all of "The portfolio editor", above all "The adapter", "Fields, and the path each one has" and "What the editing page adds that takes room"), `docs/decisions/0026-edit-on-page-editor.md` ("One page, one renderer"), `components/portfolio/page-ctx.ts` (how the exhbt page's slot types are written), `components/portfolio/PortfolioHome.tsx` (all of it: seven hero treatments, `Intro`, `Meta`, `factsOf`, `Section`, `Featured`, `Work`, `ProjectCard`, `About`, `Rows`, `Contact`, `EmptySection`, `Figure`), `lib/portfolio-layout.ts` (`splitYear`, `TILE_LIMITS`, `sectionHasContent`'s inputs), `app/dev/edit-slots/` and `e2e/edit-slots.spec.ts` (the exhbt harness you copy), `e2e/portfolio-parity.spec.ts` (A's gate: run it, never edit it).

## You own

`components/portfolio/PortfolioHome.tsx`, `components/portfolio/home-ctx.ts` (new), `lib/portfolio-layout.ts` (`joinYear` only), `app/dev/home-slots/` (new, development only), `e2e/home-slots.spec.ts` (new).

## You must not touch

`e2e/portfolio-parity.spec.ts`, `e2e/golden/portfolio/`, `e2e/fixtures/portfolio-pages.ts` (A's). Anything under `app/(portfolio)/`, `lib/portfolio.ts`, `lib/plan-rules.ts`, `app/(app)/portfolio/` (the step builder keeps using `frame`), `components/exhbt-editor/`.

## What you build against

```ts
// components/portfolio/home-ctx.ts  (types only: no "use client", no values, safe to import anywhere)
import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/portfolio-layout";

/** A path into the editor's state (`BuilderState`): "profile.name", "arrangement.tiles.about.text", "arrangement.tiles.education.lines.1". */
export type HomePath = string;

/** One line of plain text in the page's own type. Enter does nothing. */
export type HomeTextSlot = {
  path: HomePath;
  value: string;
  /** The field's accessible name: "Your name", "Who said it". */
  label: string;
  placeholder: string;
  /** "block" where the page sets the words on their own (a name, a headline, a line); "inline" where they flow among other words (a quote between its marks; its name and role on one line). */
  as: "block" | "inline";
  /** For a line of education or experience only: which half this field is. The adapter writes the whole line back with joinYear. */
  part?: "label" | "year";
  maxChars?: number;
};

/** Paragraphs in the page's own type: Enter starts a new paragraph (a blank line in the stored text). The intro and About me's words. */
export type HomeParasSlot = {
  path: HomePath;
  value: string;
  label: string;
  placeholder: string;
  /** The classes the page puts on each paragraph, so the field's paragraphs are set exactly the same. */
  paraClass: string;
};

/** One section, for its frame and corner toolbar. Plain values only. */
export type HomeSectionSlot = { key: SectionKey; index: number; count: number };

/** One exhbt as the page draws it: in the band, as a card, or as a row (the list and index looks). */
export type HomeTileSlot = { id: string; where: "band" | "card" | "row"; index: number; count: number };

/** A list of education or experience lines, for the controls drawn over it (add a line; move or remove one). */
export type HomeLinesSlot = { path: HomePath; kind: "education" | "experience"; count: number; max: number };

/** Where the page asks for what only the owner sees. */
export type HomeOwnerPlace =
  /** The band, when the band is on the page and there is no exhbt yet: the vision. */
  | "band"
  /** After the last card of More of my work: owner-only tiles, the Add tile, the hidden row. */
  | "work-end"
  /** After the last section, when More of my work is not on the page: the same parts. */
  | "page-end";

export type HomeEdit = {
  text(s: HomeTextSlot): ReactNode;
  paras(s: HomeParasSlot): ReactNode;
  /** The photo or the initials with the button over it that opens the photo sheet. `face` is what the page draws without an adapter. */
  photo(face: ReactNode): ReactNode;
  /** A section in its frame. `node` is the section as the page draws it, its fields included. */
  section(s: HomeSectionSlot, node: ReactNode): ReactNode;
  /** An exhbt with the owner's controls over its corner. `node` is the band, card or row as the page draws it. */
  tile(s: HomeTileSlot, node: ReactNode): ReactNode;
  /** Drawn over a list of lines; takes no room. */
  lineTools(s: HomeLinesSlot): ReactNode;
  owner(where: HomeOwnerPlace): ReactNode;
  /** The corner toolbar of a part with no frame of its own: the intro's (Suggest an intro) and Get in touch's (Your links). Takes no room. */
  tools(where: "intro" | "contact"): ReactNode;
};

// HomeProps (components/portfolio/PortfolioHome.tsx) gains one optional prop:
//   edit?: HomeEdit
// No public caller passes it. With `edit`, the page draws every section in `sections` (none is left out
// for being empty), draws empty word sections with their fields rather than EmptySection's outline, and
// keeps the top bar and the footer inert (as `inertChrome` does). `frame` stays for the step builder
// until the clean-up removes it.

// lib/portfolio-layout.ts gains, beside splitYear:
//   export function joinYear(label: string, year: string | null): string
// It writes "label, year". splitYear(joinYear(label, year)) gives back { label, year } for any label that does
// not itself end in a year and any year splitYear reads ("2024", "2021–2024", "2023 to now");
// joinYear(label, null) and joinYear(label, "") give label.trim(). A line is rewritten only when one of its
// two fields is typed in, so a stored line nobody touches keeps its own punctuation.
```

| Path | What | Drawn in | Edited as | Name read out |
|---|---|---|---|---|
| `profile.name` | the name | every hero | `text`, block | Your name |
| `profile.headline` | one line about you | every hero | `text`, block | One line about you |
| `profile.bio` | the intro | `Intro`, in the heroes that draw one | `paras` | Your intro |
| `profile.location` | where you are | `Meta` (five heroes), Notebook's facts, Ledger's rows | `text` | Where you're based |
| `profile.lookingFor` | what you're looking for | the same places | `text` | What you're looking for |
| `profile.linkedin`, `profile.github`, `profile.website`, `profile.contactEmail` | your links | Get in touch's rows | the "Your links" popover (`tools("contact")`) | LinkedIn, GitHub, Website, Email |
| `arrangement.header.linkedin` | show LinkedIn | the hero and Get in touch | a switch in the same popover | Show LinkedIn on your page |
| `arrangement.tiles.about.text` | About me's words | About | `paras` | About you |
| `arrangement.tiles.education.lines.N` | a course or qualification, and its year | About's rows | two `text` fields, `part` "label" and "year" | Course or qualification N; Year |
| `arrangement.tiles.education.tools` | the tools line | About's last row | `text` | Tools you use |
| `arrangement.tiles.experience.lines.N` | a job or role, and its years | Experience's rows | two `text` fields, `part` "label" and "year" | Role N; Years |
| `arrangement.tiles.quote.text` | the quote | Quote, between its marks | `text`, inline | The quote, word for word |
| `arrangement.tiles.quote.name`, `arrangement.tiles.quote.role` | who said it, their role | Quote's byline, on one line | `text`, inline | Who said it; Their role (optional) |
| `arrangement.sections` | the sections and their order | each section's frame; "Add a section" | toolbars and drag | (the section's name) |
| `arrangement.order`, `arrangement.featured`, `arrangement.hidden` | the exhbts' order, the band, the hidden ones | each tile's frame; the hidden row | tile controls and drag | (the exhbt's title) |
| `arrangement.themeId` | the look | the whole page | the Look menu | Look |

Every field carries `data-path`. A problem is shown at its path: `profileProblems` key `k` at `profile.k`; `checkTiles` key `kind.field` at `arrangement.tiles.kind.field` (a list's problem, `education.lines`, at `arrangement.tiles.education.lines`, which the list's own anchor carries). Heroes that repeat a line from About (Notebook's facts, Ledger's rows of education) draw it as words, not as a field: the line is typed in About.

The editing page matches the visitor's page box for box except for these, which the box-for-box tests allow by name (`HOME_EDIT_ONLY_IN_FLOW` in `e2e/portfolio-editor.ts`, the portfolio's twin of `EDIT_ONLY_IN_FLOW` in `e2e/page-editor.ts`):

1. **Placeholders.** An empty field shows its placeholder, one line of the type it sits in.
2. **Empty sections drawn whole.** An empty About, Experience, Quote or Get in touch draws its heading and its empty fields, where the visitor's page leaves the section out. (The step builder's dashed `EmptySection` outline is not used in the editor.)
3. **The vision.** With no exhbt yet and the band on the page, the band is drawn full size in the look's band colours: "Your best project goes here", with the look's own button, "Add an exhbt" (`owner("band")`).
4. **The end of the work.** After the last card (`owner("work-end")`), or after the last section when More of my work is off the page (`owner("page-end")`): owner-only tiles (a draft, an exhbt over the plan's limit), then the Add tile, then the hidden row.
5. **An empty More of my work.** When the only exhbt is in the band, More of my work draws its heading to hold the Add tile.
6. **Studio's name.** Studio sets the name one word per line; while it is being typed it is one field. Its box differs; nothing else on the page moves.

Everything else the editor adds is drawn over the page and takes no room: section and tile toolbars, "Add a line", the photo button, Suggest an intro, the "Your links" button. The bar, the first-run strip, the team notice and the note after a publish are app chrome above or below the page.

## Steps

Commit and push after each.

1. **`home-ctx.ts`,** exactly as above: types only, no `"use client"`, nothing that is not a type. Add `edit?: HomeEdit` to `HomeProps`.
2. **`joinYear`** in `lib/portfolio-layout.ts`, beside `splitYear`, with its tests in `home-slots.spec.ts` (no browser): the round trip for "2024", "2021–2024", "2021-2024", "2023 to now", "2023 to present"; a label with no year; an empty year.
3. **Edit mode's rules**, in one place near the top of `PortfolioHome`: with `edit`, every section in `sections` is drawn (none is dropped by `sectionHasContent`); empty word sections draw their heading and fields, not `EmptySection`; the top bar and the footer are inert (as `inertChrome`); interactive public parts inside sections (a card's link, the band's button, a contact link) are inert while editing, so a click on a card reaches the editor, not the link. Without `edit` nothing changes, `mode="preview"` and `frame` included.
4. **The words.** Each part asks `edit ? edit.text({ … }) : value` (or `paras`): the name and headline in every hero treatment (portrait and greeting, masthead, notes, terminal, block, ledger); the intro (`Intro`, as `paras` with the paragraph classes it uses now); location and looking for in `Meta` and wherever Notebook's facts and Ledger's rows draw them; About's words (`paras`), its lines (two `text` fields per line with `part`) and the tools line; Experience's lines; the quote's words, name and role (`as: "inline"`); the photo through `edit.photo(face)`. Heroes that repeat an About line draw it as words. Studio's name, one word per line, is one field while editing (the listed difference). Empty fields draw their placeholder.
5. **The frames and the owner's places.** Each section through `edit.section({ key, index, count }, node)` where `frame` is used now (keep `frame` working for the step builder). Each exhbt through `edit.tile({ id, where, index, count }, node)`: `"band"` in `Featured`, `"card"` or `"row"` in `Work` by the look's work treatment. `edit.owner("band")` when the band is on the page and there is no exhbt; `edit.owner("work-end")` after the last card, with More of my work drawing its heading even when it has no card; `edit.owner("page-end")` after the last section when `work` is not in `sections`. `edit.lineTools(…)` over each list of lines. `edit.tools("intro")` over the intro's corner and `edit.tools("contact")` over Get in touch's.
6. **Memoise the costly leaves.** Wrap `ProjectCard` and the band's figure (`Figure` and `KeyFigureView`) in `memo`, keyed on the project object, which the loader gives and typing never changes. Check React's server build accepts `memo` here: the public page must render on the server exactly as before (parity). If it does not, leave them unwrapped, say so in your report, and the editor's `tile` slot will memoise instead.
7. **The harness.** `app/dev/home-slots/` draws `PortfolioHome` with a stand-in adapter (copy `app/dev/edit-slots/stand-in.tsx`'s idea): every slot returns what the page would draw without an adapter, wrapped in a marker that takes no box (`display: contents`) and carries `data-slot` and the path or key; `owner` and `tools` return an empty marker. It takes a fixture and a look by query. Development only.
8. **`e2e/home-slots.spec.ts`:** for each of the eight looks, with A's full fixture and the sparse one: each text and paragraph path in the table appears exactly once with its name; one `section` marker per section and one `tile` marker per exhbt; the `owner` places appear where step 5 says (and nowhere else) for a page with no exhbt, one exhbt, and the work section removed; and the page matches the read-only page box for box at 1440 and 412, but for the parts on the edit-only list, allowed by name. Run A's `e2e/portfolio-parity.spec.ts` after every step that touches `PortfolioHome.tsx`.

## Done looks like

Parity passes with the goldens untouched (markup and boxes, in the sandbox); `home-slots` passes; no public caller passes `edit`; the step builder works as before.

## Report back

The branch head; `home-ctx.ts` as written (it must equal the block above; if a slot had to change, say exactly how and why, so the editor's briefs are updated before they start); whether `memo` worked on the server; every place a hero draws a field, by treatment; the specs' results and times.

Run: `e2e/home-slots.spec.ts`, `e2e/portfolio-parity.spec.ts`, `e2e/phase2-builder.spec.ts`, `e2e/phase2-looks.spec.ts`, `e2e/portfolio-card.spec.ts`.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, `docs/decisions/0031-portfolio-first.md`, and the other records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `main` or a release branch (`phase-2-pf0`, `phase-2-pf1`, `phase-2-pf2`, `phase-2-pf4`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Never run anything that calls the Anthropic API.** "Suggest an intro" and job-link matching use the stand-in with no key, as the suite does today; do not set `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEYS`.
8. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with these two lines:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`
9. **House rules that bite here:** on the portfolio page, colours, faces and corners come only from the look's variables (`--pf-*`, and `--xp-*` for the editor's field styles); app chrome uses the existing tokens and Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose or UI strings (read them from `lib/entitlements.ts`); hosts only from `lib/hosts.ts` (links to a person's page through `portfolioHref`); Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface, on both implementations; never edit an applied migration (this build needs no new one); never commit a secret.
10. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), and do not regenerate the portfolio golden copies (`e2e/golden/portfolio/`; brief A writes them once). Brief L's named edits (the owner preview's words, and the two parity targets they change) are the only exception.
11. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
12. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
