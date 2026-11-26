# Brief F: sections and tiles on the page

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Opus |
| Branch | `phase-2-pf-f-arrange`, made from `phase-2-pf2` |
| Port | 3326 |
| Starts when | E's milestone 1 is merged into `phase-2-pf2` |
| Hours | About 9 |

## Goal

Everything a person arranges on their page, done on the page: each section's frame and corner toolbar, dragging sections, adding and removing them; each exhbt tile's controls (open, star, hide, move, drag); the hidden row; owner-only tiles for drafts and over-limit exhbts; the "Add an exhbt" tile; the vision band when there is no exhbt yet; and the controls over education and experience lines. The rules are the step builder's (`StepProjects.tsx`, `Preview.tsx`), moved onto the page.

## Read first

`docs/decisions/0031-portfolio-first.md` ("What is edited where": Sections, Exhbt tiles, Draft and over-limit tiles, Add an exhbt, Education and experience lines; "What the editing page adds that takes room"). `docs/decisions/0026-edit-on-page-editor.md` ("The chrome": "On each section", for how a toolbar sits over a corner and never over words; "Dragging", for what the drag must feel like). `app/(app)/portfolio/StepProjects.tsx` and `Preview.tsx` (the rules, sensors and announcements you move), `app/(app)/portfolio/actions.ts` (what the server accepts for `order`, `featured`, `hidden`, `sections`), `lib/portfolio-layout.ts` (`SECTION_KEYS`, `SECTION_NAMES`, `EXTRA_SECTIONS`, `TILE_LIMITS`, `tileKindsShownBy`), `lib/plan-rules.ts` (`customisableExhbts`, read only), `components/portfolio/PortfolioHome.tsx` (`Featured`, `Work`, the work treatments), E's `components/portfolio-editor/runtime.ts`, `adapter.tsx` and `load.ts`. `DESIGN.md` (Dragging).

## You own

`components/portfolio-editor/sections/`, `components/portfolio-editor/tiles/` (taking over E's stubs `SectionFrame.tsx`, `TileFrame.tsx`, `LineTools.tsx`, `OwnerParts.tsx`), `components/portfolio-editor/css/arrange.css`, `e2e/portfolio-arrange.spec.ts` (new).

## You must not touch

E's files (`runtime.ts`, `adapter.tsx`, the fields, `page.tsx`, `load.ts`, `actions.ts`); `PortfolioHome.tsx` (a slot you lack goes to E through the main session); G's and I's folders (`ItemMore` is I's: you call it). `lib/plan-rules.ts`, `useBuilder.ts`.

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

```ts
// app/(app)/portfolio/load.ts  (server only). page.tsx calls it for both the step builder and the editor.
import type { Plan } from "@/lib/entitlements";
import type { HomeProject } from "@/lib/portfolio-home";
import type { BuilderProps } from "./Builder";          // today's `type Props`, exported under this name

/** On a paid plan, an exhbt the page does not arrange: a draft, or one over the plan's limit. Drawn from its working copy. Empty on Free, where every exhbt is arranged. */
export type OwnerOnlyExhbt = { id: string; title: string; home: HomeProject; why: "draft" | "over-limit" };

/** The Add tile's words: how many exhbts the plan holds and whether there is room (canCreateExhbt, limitsFor). */
export type AddRoom =
  | { ok: true; used: number; limit: number; planName: string }
  | { ok: false; used: number; limit: number; planName: string; reason: string; upgradeTo?: Plan };

/** What "See as a visitor" draws from: the published copies a visitor's page would list (visibleOnPortfolio), before the person's order and hiding are applied. */
export type VisitorSource = { publicPlan: boolean; published: { id: string; home: HomeProject }[] };

export type PortfolioData = {
  /** Exactly what page.tsx gives Builder today, but `step`. */
  builder: Omit<BuilderProps, "step">;
  ownerOnly: OwnerOnlyExhbt[];
  addRoom: AddRoom;
  visitor: VisitorSource;
  /** How many people are waiting for an answer to join one of the person's exhbts (joinRequestsFor). */
  teamRequests: number;
  /** canMakeJobLinks(plan).ok, for the bar's Job links menu. */
  jobLinks: boolean;
};

export async function loadPortfolioData(userId: string, host: string | null): Promise<PortfolioData>;
```

The editor gets the loader's data as props and keeps the edited state apart from it: a `router.refresh()` (after a claim, a photo, a publish in another tab) brings new data, and never resets what the person has typed. Two parts of the page are server components passed in as props, so they keep their own server actions: `team` (`<TeamPanel …/>`, H) and `jobLinks` (`<JobLinksSection compact …/>`, G).

```ts
// components/portfolio-editor/runtime.ts  ("use client"; E builds it)
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import type { HomePath } from "@/components/portfolio/home-ctx";

export type PortfolioSheet = "photo" | "look" | "address" | "job-links" | "team" | "links" | "reorder" | "item";

export type PortfolioEditorApi = {
  /** Applies a change at once and saves it shortly after. `undo` is the past-tense phrase Undo names ("removed Experience"); typing passes none. */
  change(update: (s: BuilderState) => BuilderState, undo?: string): void;
  /** Writes one field by its path, with no undo entry (typing). */
  setAt(path: HomePath, value: unknown): void;
  /** Opens a menu, sheet or popover by name; close() puts the focus back where it was. */
  open(sheet: PortfolioSheet): void;
  close(): void;
  /** Says something in the polite live region. */
  say(message: string): void;
  /** Scrolls to and focuses the field or anchor with this data-path, opening what it lives in first. */
  jumpTo(path: HomePath): void;
  /** Draws the page in another look without saving it (a locked look); null goes back to the saved one. */
  previewLook(themeId: string | null): void;
};

/** Stable for the editor's life: reading it never re-renders. */
export function usePortfolioApi(): PortfolioEditorApi;
/** A slice of the edited state: re-renders only when the selected value changes (Object.is). */
export function usePortfolioState<T>(select: (s: BuilderState) => T): T;
/** What the loader gave, the newest after a refresh. */
export function usePortfolioData(): PortfolioData;
/** The open sheet, the look being previewed, and each path's problem. */
export function usePortfolioUi(): { sheet: PortfolioSheet | null; previewing: string | null; issues: Record<HomePath, string> };
```

Stub files E makes in its milestone 1, each drawing nothing yet and taken over by its owner when that milestone is merged:

```ts
// components/portfolio-editor/sections/SectionFrame.tsx   (F)
export function SectionFrame(props: HomeSectionSlot & { children: ReactNode }): ReactNode;
// components/portfolio-editor/tiles/TileFrame.tsx         (F)
export function TileFrame(props: HomeTileSlot & { children: ReactNode }): ReactNode;
// components/portfolio-editor/tiles/LineTools.tsx         (F)
export function LineTools(props: HomeLinesSlot): ReactNode;
// components/portfolio-editor/tiles/OwnerParts.tsx        (F)
export function OwnerParts(props: { where: HomeOwnerPlace }): ReactNode;
// components/portfolio-editor/sheets/PhotoButton.tsx      (G)
export function PhotoButton(props: { children: ReactNode }): ReactNode;   // children: the face as the page draws it
// components/portfolio-editor/tools/PartTools.tsx         (G)
export function PartTools(props: { where: "intro" | "contact" }): ReactNode;
// components/portfolio-editor/bar/EditorBar.tsx           (G)
export function EditorBar(props: { team: ReactNode; jobLinks: ReactNode }): ReactNode;
// components/portfolio-editor/bar/FirstRun.tsx            (G)
export function FirstRun(): ReactNode;
// components/portfolio-editor/phone/ItemMore.tsx          (I)
export type ItemAction = { id: "up" | "down" | "remove" | "star" | "unstar" | "hide" | "show" | "open"; label: string; /** Why it is off, read out and shown. */ off?: string; run(): void };
export function ItemMore(props: { name: string; actions: ItemAction[] }): ReactNode;
```

E's adapter maps `text` and `paras` to its own fields, `photo` to `PhotoButton`, `section` to `SectionFrame`, `tile` to `TileFrame`, `lineTools` to `LineTools`, `owner` to `OwnerParts` and `tools` to `PartTools`. F's frames draw `ItemMore` in place of their toolbar on a phone (`usePhone()` from `components/exhbt-editor/phone/usePhone.ts`).

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

1. **The section frame.** `SectionFrame` wraps the section in an outline (not a border, so nothing moves) and a corner toolbar drawn over it, out of the flow: grip, Move up, Move down, Remove. With a mouse it shows on hover and focus; on a touch screen it always shows, 44px; on a phone (`usePhone()`) only the grip and `ItemMore` (I's) with the same actions. The toolbar never sits over the section's words or another section: put it in the gap above the corner, or half over the top edge where the gap is short (the order 0026 gives, without the exhbt editor's long placement search). One Tab stop, arrows along it. Each button has a name and a tooltip ("Move Experience up").
2. **Dragging sections** with the builder's dnd-kit set-up as it is (mouse 6px, touch a 160ms press with 8px give, keyboard Space, arrows, Space, Escape cancels) and its plain-English announcements. The grip is the only handle. The others move aside by transform, 180ms; nothing animates under reduced motion; the lifted copy keeps its look and takes `shadow-pack` and an outline in the look's link colour, never scaled. A drop writes `arrangement.sections` through `change(…, "moved Experience")`.
3. **Add and remove.** "Add a section", after the last section and out of the flow, lists the six by `SECTION_NAMES` with those already on the page dimmed; Experience and Quote, where the plan lacks them, are listed with the reason and the upgrade (`extraTilesReason`). Adding one puts it at the end with the cursor in its first field. Remove takes it off with its words (`tileKindsShownBy` keeps the step builder's rule); Undo puts both back. The "Add a section" anchor carries `data-path="arrangement.sections"`.
4. **The tile frame.** `TileFrame` makes the whole card a button that opens the exhbt (`/exhbts/<id>/edit`), and draws over its corner: the star (in or out of the band), Hide, a grip, and More with Move up and Move down. In the band the star is "Take out of the band". On Free every arranged exhbt is a draft: a "Draft" chip over the card, still arranged (the server's rule).
5. **Dragging tiles** within the work, in the card grid or the rows, with the same sensors; the band is not a drop target (the star puts a tile there). A drop writes `arrangement.order` as `StepProjects` does now (only the listed keys move; hidden and featured keep their slots). The announcements say "Open banking app is over position 3 of 5".
6. **Hide and the hidden row.** Hide moves the tile to a row after the work, owner-only, each with Show; hiding the band's exhbt takes the star off, as now.
7. **Owner-only tiles** (`OwnerParts`, at `work-end`, or `page-end` with the work off the page), in the look's own shape (a card where it draws cards, a row in its list and index looks), dashed: each draft or over-limit exhbt from `ownerOnly` with its chip ("Draft", "Over your plan's limit") and "Finish and publish", never dragged or starred; then the Add tile; then the hidden row.
8. **The Add tile:** "Add an exhbt", with "Upload your project" (`/exhbts/new`) and "Or start from a blank page" (`createFromScratch`), and "<used> of <limit> on <plan>" from `addRoom`. When `addRoom.ok` is false: the reason and the upgrade, in the alert tone when the address had `?full=1` (E's runtime tells you).
9. **The vision** (`owner("band")`): with no exhbt and the band on the page, the band at full size in the look's band colours: "Your best project goes here", and the look's own button, "Add an exhbt", doing what the Add tile does.
10. **The lines' controls** (`LineTools`): over the list, taking no room, "Add a line" while there is room (`TILE_LIMITS.lines`), which adds an empty line and puts the cursor in its first half; and per line Move up, Move down and Remove. The list carries `data-path` for its own problem. When the year half holds words `splitYear` will not read as a year, a hint under the field on focus: "This shows as part of the line: use a year, like 2024, or 2021 to 2024".
11. **`e2e/portfolio-arrange.spec.ts`:** sections by keyboard, mouse and touch, each with Undo; add and remove with words kept by Undo; a locked section offered with its reason on Free; tiles by keyboard and mouse, the order stored and the same in the step builder after a reload; star in and out; hide and show; on a paid plan a draft is an owner-only tile that cannot be dragged or starred, and on Free it is arranged; the Add tile's count and its full state, alert after `?full=1`; the vision with no exhbt; lines added, moved and removed, and a line's halves stored as one line; no toolbar over any word (copy `toolbarClashes` from `e2e/page-editor.ts` into your spec). Use E's helpers in `e2e/portfolio-editor.ts`.

## Done looks like

Everything the step builder's Your page step and its preview did is done on the page, with the server's rules unchanged, in all eight looks.

## Report back

The branch head; any slot you needed from E; how the toolbar placement works and the cases where it falls back to the corner; the specs' results and times.

Run: `e2e/portfolio-arrange.spec.ts` (on `desktop`, and on `touch` for the touch cases: E's `playwright.config.ts` runs it on both), `e2e/portfolio-core.spec.ts`, `e2e/phase2-customiser.spec.ts`. If `E2E_WEBKIT` works in your sandbox, run `portfolio-arrange` on `safari` and `iphone` too and report it; if it does not, say so.

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
