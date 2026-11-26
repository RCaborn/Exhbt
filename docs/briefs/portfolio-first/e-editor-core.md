# Brief E: the portfolio editor's core

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Opus |
| Branch | `phase-2-pf-e-core`, made from `phase-2-pf2` |
| Port | 3325 |
| Starts when | D is merged and `phase-2-pf2` is cut; B is merged; the new exhbt editor is on for everyone |
| Hours | About 12: milestone 1 about 5, milestone 2 about 7 |

## Goal

Build the one-page portfolio editor's core: `/portfolio` draws the person's own page (`PortfolioHome` with an adapter) in their look, every word typed where it sits, saved through the step builder's own save path, with Undo, problems shown at the field, "See as a visitor", the crash fallback, and the switch deciding which builder a person gets. F (sections and tiles), G (the bar, sheets and first run) and I (the phone) build on your milestone 1; J tests the whole.

## Read first

`docs/decisions/0031-portfolio-first.md` (all of it). `docs/decisions/0026-edit-on-page-editor.md` ("Typing in the page's own type", "Undo", "The classic editor: the switch, the fallback, the escape"). `app/(app)/portfolio/` (all of it, above all `page.tsx`, `Builder.tsx`, `useBuilder.ts`, `actions.ts`, `steps.ts`). `components/portfolio/home-ctx.ts` and `PortfolioHome.tsx` (D's). From `components/exhbt-editor/`: `fields/InlineText.tsx`, `fields/issues.tsx`, `ui/Sheet.tsx`, `ui/Said.tsx`, `topbar/SaveStatus.tsx`, `topbar/UndoButton.tsx`, `topbar/Popover.tsx`, `EditorGate.tsx`, `pending.ts`, `Autosave.tsx` (`isStale`), `undo.ts` (the rule: an entry reverses its own change), `EditorShell.tsx` (how the canvas sits in the look's wrapper; the dev window global), `css/core.css`. `e2e/editor-test.ts` and `e2e/page-editor.ts` (the helpers you copy).

## You own

`app/(app)/portfolio/page.tsx`, `load.ts` (new), `actions.ts`, `builder-state.ts` (new), `TryNewPortfolio.tsx` (new), `error.tsx` (new), and in `Builder.tsx` only: exporting `type Props` as `BuilderProps`, and moving `personOf` and `problemOf` to `builder-state.ts` with no change in what they do. Everything in `components/portfolio-editor/` except `sections/`, `tiles/` (F), `bar/`, `sheets/`, `tools/` (G) and `phone/` (I), where you make only the stubs below. `components/exhbt-editor/fields/InlineText.tsx`: the word `export` on `BlockText`, `InlineSpan` and their props type (as `PlainFieldProps`), nothing else. `components/portfolio/PortfolioHome.tsx` and `home-ctx.ts` for slot fixes only, held to A's parity gate (a slot another agent needs comes to you through the main session). `e2e/portfolio-editor.ts` (new; J takes it over when you are merged), `e2e/portfolio-core.spec.ts` (new).

## You must not touch

`useBuilder.ts` (the step builder's save hook: use it, never change it). The rest of `components/exhbt-editor/` and `components/editor/`. `lib/editor-kind*.ts`. `lib/portfolio.ts`, `lib/plan-rules.ts`, `app/(portfolio)/**`. The folders handed to F, G and I once your milestone 1 is merged. `e2e/golden/portfolio/` and A's spec.

## What you build against

```ts
// lib/portfolio-kind.ts  (the rule only: reads no request; copied from lib/editor-kind.ts, which it never imports,
// because that file is deleted with the classic exhbt editor)
export type PortfolioKind = "page" | "steps";

/**
 * THE SWITCH for portfolio first: "steps" is today's app for everyone (the step builder, the two nav items,
 * today's landings after sign-in); "page" is the one-page editor and the new structure. Pinned by
 * e2e/portfolio-switch.spec.ts (SHIPPED_DEFAULT): change both in one commit. The runtime variable
 * EXHBT_PORTFOLIO overrides it for everyone without a deploy.
 */
export const DEFAULT_PORTFOLIO: PortfolioKind = "steps";

/** An admin's own choice, for a year, honoured only while the signed-in person is an admin. Set by POST /api/portfolio/editor. */
export const PORTFOLIO_OWN_COOKIE = "exhbt-portfolio-own";
/** Development only: stands in for EXHBT_PORTFOLIO in one browser ("page", "steps", or "default" for not set). */
export const PORTFOLIO_KIND_COOKIE = "exhbt-portfolio-kind";

export const isPortfolioKind = (v: unknown): v is PortfolioKind => v === "page" || v === "steps";

export type PortfolioFacts = {
  /** process.env.EXHBT_PORTFOLIO as it is set, if it is. */
  variable: string | undefined;
  production: boolean;
  devCookie?: string;
  admin?: boolean;
  own?: string;
};

/** What an ordinary person gets, and what /api/health reports. */
export function portfolioForEveryone(f: PortfolioFacts): PortfolioKind;
/** What this person gets: an admin's own choice first, then what everyone gets. */
export function decidePortfolio(f: PortfolioFacts): PortfolioKind;
```

```ts
// lib/portfolio-kind-server.ts  (import "server-only"; reads cookies and process.env.EXHBT_PORTFOLIO on each request)
export async function portfolioKindForEveryone(): Promise<PortfolioKind>;
/** `admin` is isAdmin(user), checked on this request. */
export async function portfolioKind(admin: boolean): Promise<PortfolioKind>;
/** For code with no signed-in person to hand (the app layout's nav): asks isAdmin only when the own cookie is there. */
export async function portfolioServed(): Promise<PortfolioKind>;
```

- `EXHBT_PORTFOLIO` is never listed in `wrangler.jsonc` `vars` (every deploy would reset it) nor in `next.config.ts` `env` (it would be fixed at build).
- `POST /api/portfolio/editor` (form field `kind`: `page` or `steps`): 404 for anyone who is not an admin; otherwise sets `PORTFOLIO_OWN_COOKIE` (httpOnly, sameSite lax, one year) and redirects to `/portfolio`.
- `GET /dev/portfolio-kind?kind=page|steps|default`: sets `PORTFOLIO_KIND_COOKIE` in that browser and redirects to `/portfolio`; 404 in production.
- `/api/health` gains `portfolio: "page" | "steps"` from `portfolioKindForEveryone()`, never an admin's own choice; `?only=portfolio` answers at once.
- `isAdmin` in `lib/admin.ts` stays: this switch calls it, so the classic editor's removal must not delete it.

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

## What you build, for the others

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

`/portfolio`, with the switch at `page`:

| In the address | What the editor does |
|---|---|
| `?builder=steps` | Serves the step builder for this request, whatever the switch says: the escape and the crash fallback. Wins over everything below. |
| `?open=look` · `address` · `job-links` · `team` · `links` | Opens that menu, sheet or popover once the page is up. |
| `?at=<exhbt id>` | Scrolls to that tile and marks it for two seconds. If the exhbt is live, the note at the foot of the window says "<title> is live at <address>" with Copy link. |
| `?full=1` | The Add tile gives the plan's reason in the alert tone (`canCreateExhbt`). With `open=team`, the team sheet gives it beside Make my own. |
| `?joined=1`, `?left=1` | Opens Team, with today's note from `/exhbts` (`TEAM_SAID`). |
| `?step=you` | Focuses `profile.name`. |
| `?step=look` | As `open=look`. |
| `?step=projects` | Scrolls to the work. |
| `?step=publish` | As `open=address`. |
| `#team-projects` | As `open=team` (sent emails carry it; browsers keep it across the `/exhbts` redirect). |
| `#job-links` | As `open=job-links`. |

Once acted on, the query and the hash are taken out of the address with `history.replaceState`, so a reload does not do it again. Unknown values are ignored. With the switch at `steps` the step builder reads `?step=` as it does today and ignores the rest.

## Steps

Commit and push after each.

**Milestone 1: the page draws and saves** (merged before F, G and I start)

1. **The loader** (`load.ts`): move what `page.tsx` builds for `Builder` into `loadPortfolioData`, unchanged, and add the extras: `ownerOnly` (on a paid plan, the exhbts `customisableExhbts` leaves out, drawn from their working copy with `homeProject`, each marked draft or over-limit; empty on Free); `addRoom` (`canCreateExhbt`, `limitsFor(plan).exhbts`, the plan's name from `PLAN_NAMES`); `visitor` (the `visibleOnPortfolio` set's published copies); `teamRequests`; `jobLinks`. No figure is written into prose: every number comes from `lib/entitlements.ts` through these values.
2. **The page.** `page.tsx` decides with `portfolioKind(await isAdmin(user))`: `?builder=steps` or `steps` serves the step builder exactly as now (with `TryNewPortfolio` above it for an admin: a form posting `kind=page` to `/api/portfolio/editor`); `page` serves `PortfolioGate` with the data, `team={<TeamPanel …/>}` once H's step 1 is merged (until then `null`; the main session tells you) and `jobLinks={<JobLinksSection compact userId={…} />}` once G has added `compact` (until then the full one). `error.tsx` offers the step builder.
3. **Saving.** Move `saveBuilderAction`'s checks into one function both callers use, with no change in what it accepts or refuses. `saveBuilderAction` keeps calling `revalidate()`; a new `savePortfolioAction` does not. Write in your report whether, in a production build (`npm run build && npm start`), a save from the editor draws the page again with and without `revalidate()`.
4. **The runtime** (`runtime.ts`), as above, over `useBuilder(initial, savePortfolioAction, problemOf)`. `usePortfolioState` reads an `atom` (`components/exhbt-editor/atom.ts`) the editor keeps equal to `useBuilder`'s state, so a component reading one slice draws again only when that slice changes.
5. **The fields** (`components/portfolio-editor/fields/`): `text` draws the exported `BlockText` (block) or `InlineSpan` (inline), with `onText` writing through `setAt`, or, for a line's `part`, writing the whole line back with `joinYear`; `paras` is your own field in the same `xe-text` classes, one paragraph per stored paragraph with `paraClass`, where Enter starts a new paragraph and the stored text keeps a blank line between them, and nothing moves when it takes the focus. Every field carries `data-path`, its name and the iOS 16px floor.
6. **The canvas and the adapter.** The editor draws `PortfolioHome` with `edit`, inside a wrapper with the look's `themeStyle`, `lookAttrs` and the `@container` the public page has, at the width visitors get, under the bar's slot; the wrapper sets `--xe-topbar-h`. The adapter is one stable object (`useMemo`), mapping each slot as the runtime block says.
7. **The stubs** for F, G and I, each with the signature above and drawing nothing but its children where it has any.
8. **The gate.** `PortfolioGate` loads the editor in its own chunk (`ssr: false`, with `again.ts`'s retry), shows a stand-in until it is ready (the page drawn with an inert stand-in adapter, as `StandIn.tsx` does for the exhbt editor, so nothing moves when the fields come alive), catches a throw, sends what is waiting (your own `pending.ts`, keyed `"portfolio"`, racing three seconds, as the exhbt editor's does), then reloads into `?builder=steps`. Development only: `?crash=render` and `?crash=change`.
9. **The test helpers** (`e2e/portfolio-editor.ts`): `openEditor(page, fixture)` (seed through A's `/dev/portfolio-parity` with a fixture from `e2e/fixtures/portfolio-pages.ts`, then `/dev/portfolio-kind?kind=page`), `waitReady`, `field(page, path)`, `typeIn`, `stateNow` (reads `window.__portfolioEditor`, set in development only), `waitSaved`, `settle`, `boxes` with its selector list as a parameter, and `HOME_EDIT_ONLY_IN_FLOW` as the list above. Import `e2e/editor-test.ts`'s `test`.
10. **`e2e/portfolio-core.spec.ts`, first part:** at `steps` the step builder is served and unchanged; at `page` the editor is; `?builder=steps` wins; each field in the path table is typed in and is stored at its path after a reload; a line's two halves are saved as one line; the crash fallback lands on the step builder with the words typed before `?crash=change` saved.

**Milestone 2: the rest of the core**

11. **Undo:** up to 30 entries, each holding only the before-values of the keys its change touched (the exhbt editor's rule), applied back through `change()` with no label; named ("Undo: remove Experience"); typing is not an entry; Ctrl or Cmd and Z outside a text field. `useBuilder`'s own one-step undo is not used by the editor and not changed. Copy `UndoButton` and `SaveStatus` into `components/portfolio-editor/ui/` with their words and classes, reading your runtime.
12. **Problems at the field:** each `profileProblems` and `checkTiles` key mapped to its path as the table says; the field gets the look's error outline, `aria-invalid` and its message in a popover under it on focus, never in the flow; the status line says "Not saved: <the first problem>" with "Show me", which calls `jumpTo`.
13. **The status words:** Saved, and "Saved · live" when visitors can see the page (a public plan, an address, something listed); Saving; Not saved.
14. **After a deploy:** wrap the save so a stale action (copy `isStale` from `Autosave.tsx`) says "The site was updated. Reload to carry on", keeps the unsaved state in `localStorage` (inside try and catch), and after the reload offers it back once ("Put back the changes from before the reload"), as one undoable change.
15. **Two tabs:** a `BroadcastChannel` note, "This page is open in another tab: the last change saved wins."
16. **The address:** act on the query and the hash as the table says, then take them out with `history.replaceState`; the note at the foot of the window after `?at=` for a live exhbt (its address through `portfolioHref`, with Copy link); `router.refresh()` when the browser's Back returns to the page (`pageshow` with `persisted`, and `popstate`).
17. **See as a visitor** (`VisitorView.tsx`): `PortfolioHome` with no adapter, `mode="public"`, from `visitor.published` in the edited order, without hidden exhbts, owner-only tiles, held extras or a previewed look, in a region named "Preview"; above it the line 0031 gives when visitors get "not found". G's bar has the button; you draw the view.
18. **Render counts:** `useRenderCount` as the exhbt editor's (`window.__portfolioRenders`, development only), counting the hero, each section frame, each tile and each chart.
19. **`e2e/portfolio-core.spec.ts`, second part:** Undo keeps typing done since; an over-limit field holds the save and "Show me" lands on it; a stale action keeps the state and offers it back once; `?open=`, `?at=`, `?step=` and the two hashes each do their one thing and leave the address clean.

## Done looks like

With the dev cookie at `page`, `/portfolio` is the person's own page in their look, every word on the path table typed in place and saved, Undo by name, problems at the field, the visitor view, the crash fallback and the address contract working; with no cookie, the step builder exactly as before; parity untouched.

## Report back

The branch head after each milestone; the runtime and stub signatures as built (they must equal the blocks above; any change named, with why); the production-build answer on `revalidate()`; render counts for a key in the headline, a key in the intro and a section move; the specs' results and times.

Run: `e2e/portfolio-core.spec.ts`, `e2e/portfolio-parity.spec.ts`, `e2e/home-slots.spec.ts`, `e2e/phase2-builder.spec.ts`, `e2e/phase2-customiser.spec.ts`.

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
10. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), and do not regenerate the portfolio golden copies (`e2e/golden/portfolio/`; brief A writes them once). Brief L's one named edit under `app/(portfolio)/` is the only exception.
11. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
12. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
