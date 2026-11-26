# Brief 2a: the shell, one frame for every app and marketing page

| | |
|---|---|
| Phase | 2, the app frame and navigation |
| Model | Opus |
| Branch | `phase-2-appeal-2a-shell`, made from `phase-2-appeal` |
| Port | 3353 |
| Starts when | 1a's milestone 1 is merged into `phase-2-appeal` (it themes the nav), and the main session has told Alex: the header and the app layout are his files. Milestone 2 waits for Rory's choice of mock-up, or the defaults at midday on Saturday 28 Nov |
| Hours | About 8: milestone 1 about 5, milestone 2 about 3 |

## Goal

Put every app and marketing page inside one frame built from Astryx: its shell, its top navigation and its phone menu. Astryx's own advice is to move the frame first, so every later screen is moved inside the navigation, spacing and widths it will keep.

Two milestones, so nothing is designed before Rory has chosen:

1. **Today's header, drawn by Astryx.** The same links with the same names in the same order, the same look on a laptop, and Astryx's drawer for the menu on a phone. A person comparing before and after at 1440 should not be able to tell.
2. **The frame's look,** from the mock-up Rory picks: the footers, and whatever of the header's look he chose.

This job changes the header on every page at once, and it must never be half done. If it is not green by Sunday night it is left out whole and the old header stays; nothing else in the plan depends on it.

## Read first

`docs/decisions/0033-astryx-is-the-design-guide.md` ("The order of authority", "What Astryx governs", "Visitors' pages stay as they are"). `docs/design/appeal-plan.md` (the safety rules; phase 2). `docs/decisions/0031-portfolio-first.md` ("The nav"; "On a phone": the site header scrolls away and only an editor's bar sticks). `DESIGN.md` (Mode by surface; Focus; Banned). With the CLI: `npm run astryx -- docs layout` and its `scaffold`, `layout-spacing` and `responsive` guides; `docs migration/component-migration`; `component AppShell`, `component TopNav`, `component TopNavItem`, `component TopNavHeading`, `component MobileNav`, `component Layout`; `template shell-top-nav --skeleton`. Then the code: `components/site/SiteHeader.tsx`, `HeaderLinks.tsx`, `MobileNav.tsx`, `SiteFooter.tsx`, `app-nav.ts`; `app/(app)/layout.tsx`, `app/(marketing)/layout.tsx`, `app/layout.tsx` (read only); `components/exhbt-editor/css/core.css` (the first 30 lines: how the editor's bar sticks); the header's cases in the seven specs named under "You own".

## You own

`components/site/SiteHeader.tsx`, `HeaderLinks.tsx`, `MobileNav.tsx`, `SiteFooter.tsx`; `components/site/AppFooter.tsx` and `components/site/shell.css` (new); `app/(app)/layout.tsx`, `app/(marketing)/layout.tsx`. In the specs, only the cases that select the site's header, its Menu or its `Main` navigation: `e2e/landing.spec.ts`, `e2e/phase1.spec.ts`, `e2e/phase2-editor-media.spec.ts`, `e2e/phase2-polish-2.spec.ts`, `e2e/phase2-saved-ideas.spec.ts`, `e2e/portfolio-landing.spec.ts`, `e2e/portfolio-switch.spec.ts`. `e2e/shell.spec.ts` (new).

## You must not touch

`app/layout.tsx` and `app/providers.tsx`: the root layout draws the skip link and the private-preview strip for visitors' pages too. `components/site/app-nav.ts` (brief B's, pinned by `portfolio-landing` and `portfolio-switch`: you read `appNav`, you do not change what it returns). `themes/exhbt/` (a nav style you need goes to 1a through the main session). `app/(portfolio)/**` and its layouts. `components/exhbt-editor/`, `components/editor/`, `app/(app)/exhbts/`, `app/(app)/portfolio/`: the editors sit inside your frame and must behave exactly as before. `components/home/`, `app/(marketing)/page.tsx` and every page's own content. Everything in the README's frozen list.

## What you build against

**What the header does today, which is your contract for milestone 1.** From `SiteHeader.tsx` and the specs:

- A `banner` landmark holding the logo as a link named "Exhbt home".
- A navigation named "Main". Signed out: "What is an exhbt?", then the "Build your roadmap" button to `/roadmap/new` in the middle, then "Pricing"; "Build your exhbt" is never in the header. Signed in: what `appNav(portfolio, phase2)` returns, in that order. The page you are on carries `aria-current="page"`.
- At the end: "Log in" signed out; "Account", a link to `/account`, signed in. The app has no sign-out, so there is no account menu to build.
- The row gives way to a "Menu" button below 1024px signed out and below 640px signed in. The button carries `aria-expanded`. Its panel holds a navigation named "Main menu" with the same links, and the roadmap button signed out. Opening it moves focus to the first link; Escape closes it and puts focus back on the button; following a link or pressing outside closes it.
- Marketing pages call `SiteHeader` with no props and stay static; `app/(app)/layout.tsx` reads the session on the server and passes `signedIn`, `phase2` and `portfolio`, so there is no flash and no extra request.

**What Astryx's shell does that can break this app.** Each of these is a test in step 2, before you build on `AppShell`.

1. `AppShell` is a client component. Children passed through it stay server-rendered, so a static marketing page should stay static. `e2e/seo.spec.ts` and the build's route table are the proof.
2. Its default `height` is `"fill"`: the window is fixed and the main region scrolls inside it. This app needs the **document** to scroll: the editors' bars are `position: sticky; top: 0` against the window, the exhbt editor's drag scrolls the window near its edges, and the phone bar is fixed to the window. So `height="auto"` is the only setting to try.
3. With `height="auto"` Astryx makes the top navigation sticky. Today's header scrolls away, and decision 0031 relies on that ("the site header scrolls away; only the editor's bar sticks"). A sticky site header would sit on top of an editor's sticky bar.
4. It draws its own skip link ("Skip to content") and its own main region: a `div` with `role="main"` and an id it makes itself. The root layout already draws a skip link to `#main`, and both layouts draw `<main id="main">`. A page needs one skip link that works and one main landmark.
5. It decides "phone or not" at a breakpoint it resolves from the theme. Check what a phone gets in the server's HTML before scripts run: a flash of the laptop row, or a header that changes height as it hydrates, is a failure.
6. Its drawer names its navigation "Mobile navigation" unless told otherwise, and draws it as a dialog, outside the header element.

**If `AppShell` cannot pass step 2's tests,** do not fight it. Build the header from Astryx's `TopNav`, `TopNavItem`, `TopNavHeading` and `MobileNav` inside today's two layouts (`MobileNav` takes `isOpen` and `onOpenChange` when it is outside a shell), keep `<main id="main">` as it is, and say in your report exactly which test stopped `AppShell`. That is this job done, not a failure: the header is Astryx on every page either way.

## Steps

Commit and push after each.

**Milestone 1: today's header, drawn by Astryx**

1. **Photograph "before".** Six pages at 1440 by 900 and 390 by 844, signed out and signed in where it applies: `/`, `/pricing`, `/login`, `/roadmap`, `/account`, and an exhbt's edit page. On the two phone shots of `/` and `/account`, also with the menu open. Record the header's height on each.
2. **Try `AppShell` on one route before you commit to it.** On a scratch route or behind a temporary flag in `app/(marketing)/layout.tsx`, wrap the page in `AppShell` with `height="auto"`, `contentPadding={0}`, `variant="surface"` and a `TopNav`, and answer each of the six points above with a test you keep in `e2e/shell.spec.ts`:
   - the document scrolls and `window.scrollY` grows; nothing inside the shell is a scroll container;
   - after scrolling 1500px the site header is out of view (if Astryx keeps it sticky, find the prop or the shell's own class and undo it in `components/site/shell.css`);
   - on an exhbt's edit page, after scrolling, the editor's bar sits at the top of the window: `e2e/editor-topbar.spec.ts` and `e2e/editor-phone.spec.ts` pass unchanged;
   - exactly one skip link can be reached by Tab, and pressing it moves focus into the main region; there is one main landmark;
   - at 390 wide with scripts off, the header shows the logo and the Menu button and no laptop row; with scripts on, the header's box is the same before and after hydration;
   - `npm run build` still lists the marketing pages as static.
   Write the six answers down. If any cannot be met, take the fallback above for the whole job.
3. **The skip link.** The root layout's link to `#main` is frozen and must keep working, on your pages and on visitors'. Keep an element with `id="main"` and `tabIndex={-1}` as the first thing inside the main region, wrapping the page, so that link still lands. Then there are two skip links on a shell page, the root's and Astryx's: turn Astryx's off if `component AppShell` shows a way, and otherwise hide it from `shell.css`, scoped to the shell, and say so in your report.
4. **The header.** `SiteHeader` keeps its three props and its place in both layouts. Inside, it is Astryx: the logo in `TopNavHeading`; the links as `TopNavItem`s, selected from the pathname as `HeaderLinks` does today, with `aria-current="page"`; the signed-out roadmap button between the two halves, as now; "Log in" or "Account" in the end slot through `components/ui/Button.tsx` and Astryx `Link`. The navigation's `label` is "Main". No hand-built row is left. If the theme lacks something the nav needs to look as it does today, tell the main session at once: 1a owns the theme.
5. **The phone menu.** Astryx's `MobileNav`, opened by a button whose visible word and name are "Menu" (the specs and people know it by that), with `aria-expanded`. Inside: a navigation named "Main menu" with the same links, and the roadmap button signed out. Two breakpoints, as today: below `lg` signed out, below `sm` signed in. Escape, following a link and pressing outside close it; after Escape, focus is back on the button.
6. **The layouts.** Each layout renders the shell (or, on the fallback, the header), the page inside the element with `id="main"`, and the footer after it. `JsonLd` stays in the marketing layout. Both layouts stay server components.
7. **The specs.** Update only the header's cases in the seven specs, and only where the markup they select has really changed (the phone menu is a dialog now, not a panel inside the `header` element). Keep every assertion about what a person can do: the names, the order, `aria-current`, focus moving in and coming back, no sideways scroll. Do not loosen one to make it pass. `portfolio-landing` and `portfolio-switch` read the `Main` navigation's link texts and addresses in order: they should pass unchanged.
8. **Photograph "after"** as in step 1 and set the pairs side by side. At 1440 the header must match: same height, same edges, same type. Fix what does not. On a phone the menu is now a drawer; everything else matches.
9. **Prove it.** The seven specs; `e2e/shell.spec.ts`; `e2e/a11y.spec.ts`; `e2e/responsive.spec.ts`; `e2e/seo.spec.ts`; `e2e/editor-topbar.spec.ts` and `e2e/editor-phone.spec.ts` unchanged; both parity specs with `CI` unset. Push, and tell the main session milestone 1 is in.

**Milestone 2: the frame's look** (after Rory's choice)

10. **Footers.** The ink marketing footer closes every page today, the editors included. From now on: marketing pages keep `SiteFooter`; signed-in app pages get `AppFooter`, one quiet line with Privacy, Terms and Cookies on the page's own ground; an editor route (`/exhbts/[id]/edit`, and `/portfolio` when it is the one-page editor) gets none. A layout cannot read the path, so the choice is made by a small client component that reads the layout's selected segments; it must render the same thing on the server and in the browser.
11. **The header's look,** as the chosen mock-up has it, through the shell's `variant`, the theme (ask 1a) and `shell.css` for layout only. If Rory chose nothing that touches the header, this step is empty: say so.
12. **The roadmap button's words** are one constant in `SiteHeader.tsx`. Leave it as it is: the plan's job 6a changes it when the hero changes, so the header and the hero always say the same thing.
13. **Prove it again:** step 9's list, and `e2e/landing.spec.ts`'s footer case; photographs of the six pages.

## Done looks like

Every app and marketing page is inside one Astryx frame. On a laptop the header is indistinguishable from today's; on a phone the menu is Astryx's drawer; a keyboard user has one skip link and one main landmark; the editors' bars still stick to the top of the window and the site header still scrolls away; marketing pages are still static; the editors have no marketing footer. No visitor's page has changed.

## Report back

The branch head after each milestone. Whether you shipped `AppShell` or the fallback, with the six answers from step 2. How the two skip links were made one. The before and after photographs, named, with the header's height on each. Every spec case you changed, the old assertion and the new one, and why. Anything you needed from the theme. The build's route table for the marketing pages, before and after.

Run: `e2e/shell.spec.ts`, `e2e/landing.spec.ts`, `e2e/phase1.spec.ts`, `e2e/phase2-editor-media.spec.ts`, `e2e/phase2-polish-2.spec.ts`, `e2e/phase2-saved-ideas.spec.ts`, `e2e/portfolio-landing.spec.ts`, `e2e/portfolio-switch.spec.ts`, `e2e/a11y.spec.ts`, `e2e/responsive.spec.ts`, `e2e/seo.spec.ts`, `e2e/editor-topbar.spec.ts`, `e2e/editor-phone.spec.ts` (`--project=touch`), `e2e/portfolio-parity.spec.ts`, `e2e/layout-parity.spec.ts`.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `main` or a release branch (`phase-2-appeal`, or the portfolio build's `phase-2-pf0` to `phase-2-pf4`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. An Opus agent ends with these two lines:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`
   Any other model names itself in the first line and keeps the second as written.
8. **House rules that bite here:** on a person's own page, colours, faces and corners come only from the look's variables (`--pf-*`, `--xp-*`); everywhere else every control is an Astryx component in the theme's tokens, with no fixed colour, pixel size or timing; buttons are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose or in a UI string (read them from `lib/entitlements.ts`); Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
10. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
11. **Never run anything that calls the Anthropic API.** Do not set `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEYS`.
12. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), never regenerate a golden copy, and keep to the frozen list in this folder's README. The theme, `app/layout.tsx` and `components/ui/Button.tsx` all reach a page an employer reads.
13. **Read Astryx before you build with it.** `docs/design/astryx-agent-guide.md`, then `npm run astryx -- docs principles`. Read each component you use with `npm run astryx -- component <Name>`: take prop names, theming keys and public variables from there, never from memory or from a review. `npm run astryx -- theme targets` lists every theming key. The installed version is 0.7.11; do not raise it.
14. **Look at what you build.** Open it in the browser at 1440 and at 390 wide, take screenshots (deviceScaleFactor 2), read them, and fix what looks rough before you report. Save them under `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/2a/`, or the folder the main session gives you, and name each file in your report. If `.claude/skills/impeccable/` is in your branch, read its `reference/craft-floor.md` before you build and `reference/polish.md` before you report.
15. **The shared machine** has four cores and 15 GB, and has been running out. Run one spec file at a time, stop your dev server when you are not testing, and do the reading and writing first. A test that fails with "Page crashed", "Target crashed" or `ERR_ABORTED` is run once more on its own before you treat it as a failure.
