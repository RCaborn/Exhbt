# Brief I: the portfolio editor on a phone

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Opus |
| Branch | `phase-2-pf-i-phone`, made from `phase-2-pf2` |
| Port | 3329 |
| Starts when | F and G are merged into `phase-2-pf2`, and an Opus slot is free |
| Hours | About 5 |

## Goal

Rory will try this on his iPhone before it goes on for everyone. Make the one-page editor work with a thumb: one "More" button per section and tile with a sheet of actions, a sheet to reorder sections, the bar folded to what matters, sheets that fill the screen, no zoom when a field takes the focus, and press-and-hold drag that still works.

## Read first

`docs/decisions/0031-portfolio-first.md` ("On a phone"), `docs/decisions/0026-edit-on-page-editor.md` ("The chrome": "On a phone"). From `components/exhbt-editor/`: `phone/usePhone.ts`, `phone/noZoom.ts`, `phone/ReorderSheet.tsx` (the pattern: rows with up and down for people who cannot drag), `css/phone.css`. F's `sections/` and `tiles/` (where `ItemMore` is called), G's `bar/` (its fold), E's `runtime.ts` and `ui/Sheet.tsx`. `e2e/editor-phone.spec.ts` and the touch helpers in `e2e/page-editor.ts` (`finger`). `playwright.config.ts` (the `touch` and `mobile` projects).

## You own

`components/portfolio-editor/phone/` (taking over E's stub `ItemMore.tsx`), `components/portfolio-editor/css/phone.css`, `playwright.config.ts` (the `touch` project's `testMatch` gains `portfolio-phone`, nothing else), `e2e/portfolio-phone.spec.ts` (new).

## You must not touch

F's and G's folders (a change you need there goes to them through the main session), E's files, `components/exhbt-editor/` (import `usePhone` and `noZoom`; change nothing).

## What you build against

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

## Steps

Commit and push after each.

1. **`ItemMore`:** one 44px button, named "More for <name>", opening a sheet (E's `Sheet`, full screen on a phone) of the actions it is given, in their order, each a 44px row with its name; an action that is `off` is shown dimmed with its reason read out. The sheet closes after an action and the focus goes back to the button (or, after Remove, to the next section's button). After a move or a remove, the live region says what happened and the bar offers "Undo <what>" until the next action.
2. **"Reorder sections"** (`open("reorder")`, from G's menu on a touch screen): a sheet of the page's sections as short rows, each with Move up and Move down, and the grip for a press-and-hold drag within the sheet, writing `arrangement.sections` with Undo.
3. **The fold and the bar.** On a phone the site header scrolls away and only the editor's bar sticks. Check G's fold (heading, save status, primary button; the rest in the menu) at 390 and 412 wide and say in your report if anything overflows; fix it in G's files only through the main session.
4. **Fields and sheets.** Every field on the page and in every sheet is 16px or more (`noZoom`), so iOS does not zoom when it takes the focus; every sheet fills the screen; nothing scrolls sideways at 320, 390 and 412 wide in any look.
5. **Press-and-hold drag** on a section's grip and a tile's grip (the 160ms press with 8px give) still lifts and drops on a touch screen, and a swipe that does not start on a grip scrolls the page.
6. **`e2e/portfolio-phone.spec.ts`** on the `touch` project (Pixel 7): every section's and tile's More sheet does each action, with Undo; Reorder sections; a press-and-hold drag of a section and of a tile; the bar's fold; no sideways scroll at 320, 390 and 412 in all eight looks; each field's computed font size is 16px or more; the first-run strip's "Step 1 of 2" and Next. Copy the touch helpers you need from `e2e/page-editor.ts`.

## Done looks like

On a 390px touch screen every arrangement can be made with a thumb, without dragging, and with dragging; nothing zooms or scrolls sideways.

## Report back

The branch head; what you asked F or G to change, and whether it landed; the specs' results and times; a short screen recording at 390 wide in the Exhbt look and Studio, for Rory.

Run: `e2e/portfolio-phone.spec.ts` (`--project=touch`), `e2e/portfolio-arrange.spec.ts`, `e2e/responsive.spec.ts`.

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
