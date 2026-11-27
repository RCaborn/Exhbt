# Brief 5b: less in the way in the exhbt editor

| | |
|---|---|
| Phase | 5, the exhbt editor's chrome |
| Model | Sonnet |
| Branch | `phase-2-appeal-5b-editor`, made from `phase-2-appeal` |
| Port | 3356 |
| Starts when | Now. `phase-2-appeal` has editor-freedom (release b2) and brief H (portfolio release 2), which are what the plan's row waits for, and the classic editor's removal is not in flight |
| Hours | About 4 |

## Why this starts before Rory has chosen a level

This folder's README holds later phases until Rory picks a level in the design lab. That rule is about the look. This job moves chrome and adds one line of words, the same at every level. It uses the kit's components in the theme as it stands. When 1a's second milestone changes the theme's values, this work follows them with no change.

## Goal

On a phone, four strips sit above the page and take well over a third of the screen. "Review and publish" wraps onto two lines inside its own button. A first draft arrives with no word on what was written or what to check (the clarity review, finding 6: `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal/review-clarity-final.md`). Three changes:

1. **A first draft says what to do next.** Once per AI draft, under the bar, an information notice with a close button:
   > Here's your first draft. We wrote it from your files and nothing else. Click any part to change it, check each number, then press Review and publish.

   The line about the layout the AI chose stays where it is today: it is read out, and it sits in the Layout menu. It is not shown on the page.
2. **"Review and publish" on one line** at 360 and 390 wide. Get there by giving the button room: smaller gaps in the bar, or a part that yields at phone width, such as the word bar or the save status going into the menu or shortening. Never use a second, shorter label. It stays the bar's one mint button.
3. **Last, in its own commit: the teammates offer moves into the menu.** See step 5.

Not in this job: the footer on editor routes (2a's milestone 2), the finish after publishing (5a), and the bar's parts on Astryx's `Toolbar` (5c).

## How "once" is kept, with nothing stored

The draft page opens the editor with `?drafted=…&why=…&fig=…` right after drafting. See `components/exhbt-editor/EditorGate.tsx`, which takes those off the address, and `components/exhbt-editor/topbar/LayoutMenu.tsx`, which reads them. Show the notice only on that load. Once it is closed, or the page is reloaded after the editor has cleaned the address, it is gone. Use no cookie, no local storage, no column and no migration.

## Read first

- Decision 0033: "Every screen says what it is for and what happens next", and the third of the six, "Mint means go, live and checked".
- Decision 0026: the editor and its top bar. `DESIGN.md`: the editor and buttons.
- Astryx, with the CLI: `npm run astryx -- component Banner`, `component Button`, `docs principles`.
- The kit: `components/ui/Notice.tsx` (1b's wrapper of Astryx's `Banner`) and `components/ui/Menu.tsx`.
- The code: `components/exhbt-editor/topbar/TopBar.tsx`, `MenuButton.tsx`, `LayoutMenu.tsx`, `components/exhbt-editor/css/topbar.css`, `EditorGate.tsx`, `app/(app)/exhbts/[id]/edit/page.tsx`, `components/team/TeamStrip.tsx`.
- `e2e/editor.ts`, the page object, which you read and do not change.

## You own

- `components/exhbt-editor/topbar/**` and `components/exhbt-editor/css/topbar.css`.
- One new file for the notice, in `components/exhbt-editor/topbar/`.
- `app/(app)/exhbts/[id]/edit/page.tsx`.
- `components/team/TeamStrip.tsx` (step 5 only).
- `e2e/editor-topbar.spec.ts` and `e2e/editor-phone.spec.ts`.
- For step 5 only, the cases in the teammates specs (`git ls-files e2e | grep -i team`) that look for the offer line.

## You must not touch

- `e2e/editor.ts`. If you need a change there, say exactly what in your report.
- The rest of `components/exhbt-editor/`: the page, the corner toolbars and their placement, drag, sheets and figures.
- `components/editor/` (the classic editor).
- Visitors' pages: `app/(portfolio)/**`, `components/portfolio/`, `components/exhbt/`, `lib/portfolio.ts`, `lib/plan-rules.ts`.
- What job 3a owns, which runs beside you: `app/(app)/exhbts/new/**`, `app/(app)/exhbts/page.tsx`, the roadmap, the login pages, `lib/seo.ts`, `scripts/check-labels.mjs`.
- The theme, and everything else in this folder's README's frozen list that is not named under "You own".

## Facts that bite

- The notice is chrome, not the page. Draw it in the app's tokens through the kit, never in the look's `--xp-*` variables, and keep it outside the page's `article`.
- The "box for box" tests (`e2e/editor-inplace.spec.ts`, `e2e/editor-smooth.spec.ts`) compare the editing page with the visitor's page. Something new near the page failed them in release 3's fix round. Run both.
- The notice is announced once. Its words are not in a live region that repeats on every render.
- The phone bar's buttons keep 44px presses.

## Steps

Commit and push after each. End the first line of every commit with `[skip ci]`; full CI runs only on the release pull request.

1. **A failing test in `e2e/editor-topbar.spec.ts`,** then the notice. After a draft from the stand-in AI, the notice shows with those words. Closing it removes it and returns the focus to the bar. Reloading does not bring it back. An exhbt opened from the list, or one made with "Write it myself", shows no notice.
2. **A failing test in `e2e/editor-phone.spec.ts`,** then the bar. At 360 and 390 wide, "Review and publish" sits on one line: its text's height is one line box. Nothing in the bar overflows, the page does not scroll sideways, and every control still has its 44px press.
3. **Photograph** the editor's first screen after a draft at 1440, 390 and 360, before and after, and set them side by side. Read them: how much of a phone's first screen is chrome before and after, and one mint button.
4. **Prove it:** `e2e/editor-topbar.spec.ts`, `e2e/editor-phone.spec.ts`, `e2e/editor-inplace.spec.ts`, `e2e/editor-smooth.spec.ts`, and `e2e/a11y.spec.ts`. Run each on its own, one worker.
5. **Its own commit, last: the teammates offer.** Today `TeamStrip` draws "Worked on this with other people? Add them as teammates." above the editor. It is the first thing a new draft shows.
   - With no team, no team files and nothing skipped, there is no strip. "Add teammates" goes into the editor's ⋯ menu, linking to `/exhbts/[id]/team`.
   - With a team ("Team project with …"), the team's files to draft from, or files that didn't fit, the strip shows as it does today.
   - This is question 8 on Rory's design page. Its default, moving the offer, applies from midday on Saturday 28 Nov, so the main session may hold this commit back. Run the teammates specs and `e2e/editor-topbar.spec.ts` with it.

## Done looks like

A first draft opens with one line saying what to do, and it shows once. "Review and publish" is one line on a 360-wide phone. Less of the phone's first screen is chrome. The box-for-box tests and every spec above pass. The teammates commit stands alone at the end.

## Report back

- The branch head, and which commit is the teammates one.
- How the notice knows it is the first load, and where that is read.
- What gave the publish button its room, at each width.
- The photographs, named, with the share of a phone's first screen taken by chrome before and after.
- The specs you ran and their results.
- Anything you needed in `e2e/editor.ts` or another file you don't own.

## Rules

The fifteen rules in this folder's `README.md` apply, with your branch, your port (3356) and your screenshot folder (`/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/5b/`). As a Sonnet agent, end each commit with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and then the README's `Claude-Session:` line, unchanged.
