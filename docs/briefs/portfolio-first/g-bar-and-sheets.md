# Brief G: the bar, its menus and sheets, and the first minute

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Sonnet |
| Branch | `phase-2-pf-g-bar`, made from `phase-2-pf2` |
| Port | 3327 |
| Starts when | E's milestone 1 is merged into `phase-2-pf2`. The Team sheet waits for H's step 1 (`TeamPanel`); the main session tells you when it is merged |
| Hours | About 8 |

## Goal

The editor's bar and everything it opens: the Look menu, the address sheet, Job links, Team, the photo sheet, the "Your links" popover, "Suggest an intro", the chip, and the first-run strip that takes a new person through their first minute. Most of the parts already exist in the step builder (`StepYou`, `StepLook`, `StepPublish`, `PhotoField`, `UsernameForm`, `JobLinksSection`); you give them their new homes.

## Read first

`docs/decisions/0031-portfolio-first.md` ("A new student", "The bar", "What is edited where": Photo, the links, Look, Address, Job links, Team; "On a phone"; "Data", first run). `app/(app)/portfolio/StepYou.tsx`, `StepLook.tsx`, `StepPublish.tsx`, `PhotoField.tsx`, `UsernameForm.tsx`, `JobLinksSection.tsx`, `actions.ts` (`suggestIntroAction`, `claimUsernameAction`, `savePhotoAction`, `removePhotoAction`), `steps.ts` (`ThemeLock`, `BuilderPlan`). `lib/portfolio-themes.ts` (`LOOKS`, colourways, names, faces), `lib/plan-rules.ts` (`canUseTheme`, read only). From `components/exhbt-editor/`: `topbar/TopBar.tsx` (the row's layout and classes), `topbar/Popover.tsx` (`useNarrow`), `topbar/MenuButton.tsx` (the pattern only: it imports exhbt actions), `css/topbar.css`. E's `runtime.ts`, `ui/` copies of `Sheet`, `SaveStatus` and `UndoButton`, and `load.ts`.

## You own

`components/portfolio-editor/bar/`, `components/portfolio-editor/sheets/`, `components/portfolio-editor/tools/` (taking over E's stubs `EditorBar.tsx`, `FirstRun.tsx`, `PhotoButton.tsx`, `PartTools.tsx`), `components/portfolio-editor/css/bar.css`, `app/(app)/portfolio/JobLinksSection.tsx` (adding a `compact` variant; the step builder keeps the full one), `e2e/portfolio-bar.spec.ts` (new).

## You must not touch

E's files and F's and I's folders. `app/(app)/portfolio/actions.ts` and the step builder's components (import them; change none). `components/team/TeamPanel.tsx` (H's: you show it). `lib/plan-rules.ts`, `lib/entitlements.ts`.

## What you build against

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

```ts
// components/team/TeamPanel.tsx  (server components; H moves them out of app/(app)/exhbts/page.tsx with no change in what they draw)

/** "Someone asked to join your exhbt": each request with Review. Draws nothing when there is none. */
export async function JoinRequests(props: { userId: string }): Promise<ReactNode>;

/**
 * "Team projects": the projects the person is on as a teammate, with today's buttons and server actions
 * (Open your own exhbt, Make my own exhbt from this project, View, Leave). `said` is today's note after
 * joining or leaving; `full` is today's upgrade prompt after a refused Make my own. Draws nothing when the
 * person is on no team project and `said` is null.
 */
export async function TeamProjects(props: { userId: string; host: string | null; said: "joined" | "left" | null; full: boolean }): Promise<ReactNode>;

/** Both, requests first: what the editor's Team sheet shows. */
export async function TeamPanel(props: { userId: string; host: string | null; said: "joined" | "left" | null; full: boolean }): Promise<ReactNode>;
```

The `/exhbts` list draws `JoinRequests` and `TeamProjects` where it draws those sections today, until the clean-up. The editor's page passes `<TeamPanel …/>` to the editor as its `team` prop.

## Steps

Commit and push after each.

1. **The bar** (`EditorBar`), one row in app chrome with the exhbt editor's `xe-topbar` classes, sticky: "Your portfolio" as the heading, and the chip ("Live" when visitors can see the page; "Not online yet" on a public plan with no address or nothing listed; "Preview only" where the plan has no public page); Look; Undo and the save status (E's components); See as a visitor (toggles E's view); Job links; the menu (Team projects; "Reorder sections" on a touch screen, which opens I's sheet; "Use the step builder", which opens `?builder=steps`; for an admin, "Go back to the step builder for good", posting `kind=steps`); and the primary button, "Claim your address" with no address, "Share" with one. Narrow windows fold Look, Undo, See as a visitor, Job links and Team into the menu (`useNarrow`), keeping the heading, the status and the primary button. Buttons are Astryx Buttons through `components/ui/Button.tsx`.
2. **The Look menu:** a list, not pictures: each look's name, its two faces named in their own type, its swatches (and its colourways, as swatches to pick), and for a locked one the plan it comes with (`locks`). An open look applies at once through `change(…, "changed the look to Studio")`, and the page behind restyles. A locked look calls `previewLook(id)` and shows a line under the bar: "Preview of Studio, comes with <plan> · See plans · Back to yours"; it is never saved. Keep the builder's downgrade notes: a saved look the plan lacks (`savedButLocked`).
3. **The photo** (`PhotoButton`): a button over the face ("Add a photo" or "Change your photo") that opens a sheet with `PhotoField` as it is (it saves at once, outside autosave).
4. **The part tools** (`PartTools`): over the intro's corner, "Suggest an intro" (`suggestIntroAction`, only from what the person gave; it fills the field through `setAt`, and autosave keeps it; its daily limit's message as now); over Get in touch's corner, "Your links", a popover holding LinkedIn, GitHub, website and email as `StepYou` has them, with "Show LinkedIn on your page" (`arrangement.header.linkedin`). The fields write through `setAt` and show their problems as E's fields do.
5. **The address sheet** (`open=address`): on a plan that can claim, today's `UsernameForm` as it is (its live check, its hourly limit, its 30-day redirect; never autosaved), then the address with Copy link, Change and "Hide from search" (`profile.hideFromSearch`), and `StepPublish`'s before-you-go-live checklist. With an address and nothing listed: "Your address shows 'not found' until you publish an exhbt." Where the plan cannot claim: its reason (`addressBlocked`) and "See plans" (`/account/billing`). After a claim, `router.refresh()` brings the new address in.
6. **Job links:** `JobLinksSection` gains `compact` (a list for a menu: each link's address, Live or Off, its views and Edit; New job link; the live links left). With nothing published, compact says "Publish an exhbt first: a job link shows your live exhbts." Below the plan that has them, the upgrade line only. The bar's Job links menu shows the `jobLinks` node E passes.
7. **Team:** the menu's Team projects opens a sheet showing the `team` node; a notice under the bar when `teamRequests` is more than 0 ("Someone asked to join one of your exhbts · Review"), opening the same sheet.
8. **The first minute** (`FirstRun`), under the bar in app chrome: "1 Your page, about a minute · 2 Your first exhbt". Step 1 lists your name, one line about you, a photo (optional) and a look; each one focuses its field (`jumpTo`) or opens the Look menu, and ticks when done (the name and the headline filled in; a photo; a look chosen this visit or not the default). Step 2 is the first exhbt: it scrolls to the vision band or the Add tile. "Skip to your first exhbt" is there from the start; "Hide this" is kept in `localStorage` inside try and catch. The strip shows until both steps are done. On a phone it is one line, "Step 1 of 2", with Next.
9. **`e2e/portfolio-bar.spec.ts`:** the bar's parts at 1440 and folded at 700; each look applies and is saved, and a locked one previews and is not saved (and is not in "See as a visitor"); the photo sheet adds and removes; Suggest an intro fills the field with the stand-in; the links popover saves and its problems show; the address sheet on Free, on Premium with and without an address; the chip in each state; Job links on Max with links, with none, and on Premium; the team notice and sheet; the first-run strip's ticks, Skip and Hide; each `?open=` value opening its part.

## Done looks like

Everything the step builder's You, Your look and Publish steps did, and its job links section, is reachable from the bar or the page, with a new person's first minute guided by the strip.

## Report back

The branch head; any slot or runtime call you needed from E; the specs' results and times; a screenshot of the bar at 1440 and 700 in two looks.

Run: `e2e/portfolio-bar.spec.ts`, `e2e/portfolio-core.spec.ts`, `e2e/phase2-joblinks.spec.ts`, `e2e/phase2-portfolio-media.spec.ts`, `e2e/phase2-themes.spec.ts`.

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
