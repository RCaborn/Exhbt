# The appeal build: briefs

Written 26 Nov 2026 against `main` at b2ec870. The decision is `docs/decisions/0033-astryx-is-the-design-guide.md`; read it before any brief. The plan, with every phase and job, is `docs/design/appeal-plan.md`. `docs/design/for-rory-appeal.md` is the one page for Rory and Alex.

This folder holds one brief for each job of the plan's first two phases: the theme foundations, and the app frame and navigation. Each stands alone: an agent reads its own brief, the files it names and 0033. Jobs in later phases get a brief from the main session when their gate opens; the plan's row for each holds what the brief needs.

## Before anything starts

- **The main session cuts `phase-2-appeal` from `main` and merges `origin/phase-2-add-exhbt` and `origin/phase-2-design-lab` into it.** The first already edits the real theme, which must have one history; if it cannot be merged yet, 1a's step 1 says what to do. The second is the design lab: it adds files only, and its proposed theme (`themes/exhbt-next/`) is what 1a moves across.
- **Only look-neutral work starts before Rory has chosen in the lab.** 1a's first milestone, 1b and 2a's first milestone are plumbing: nothing a student can see changes. The second milestones of 1a and 2a, 2b and everything in later phases wait for his choice, or for the defaults in 0033 at midday on Saturday 28 Nov.
- **Alex is told before 2a starts.** The header, the app layout and the login pages are his files; he reviews that pull request.

## Agents, order and what each waits for

At most two Opus agents run at once, and the portfolio build holds one of those places. Sonnet agents run beside them.

| | Brief | Model | Branch | Port | Starts when | Hours |
|---|---|---|---|---|---|---|
| 1a | `1a-theme.md` | Opus | `phase-2-appeal-1a-theme` | 3351 | `phase-2-appeal` is cut. Tonight. Its milestone 2 waits for Rory's choice | 5 |
| 1b | `1b-kit-and-checks.md` | Sonnet | `phase-2-appeal-1b-kit` | 3352 | `phase-2-appeal` is cut. Tonight | 7 |
| 2a | `2a-shell.md` | Opus | `phase-2-appeal-2a-shell` | 3353 | 1a's milestone 1 is merged into `phase-2-appeal`; Alex has been told. Its milestone 2 waits for Rory's choice | 8 |
| 2b | `2b-page-frame.md` | Sonnet | `phase-2-appeal-2b-frame` | 3354 | 2a's milestone 1 and 1b are merged; brief H of the portfolio build is in `phase-2-appeal` (it edits lines in the same pages; the main session merges `phase-2-pf-h-structure` in once portfolio R1 is on `main`); Rory has chosen the frame's mock-up, or the defaults apply | 5 |

## Who owns which files

No two agents edit the same file. Hand-overs are named in the briefs.

| Agent | Owns |
|---|---|
| 1a | `themes/exhbt/exhbtTheme.ts` and the five files `npm run theme` writes beside it |
| 1b | `app/dev/astryx/` (new); new files in `components/ui/` (`Field.tsx`, `Notice.tsx`, `toast.ts`, `Sheet.tsx`, `Confirm.tsx`, `Menu.tsx`, `Empty.tsx`, `Steps.tsx`); `components/brand/AddressLine.tsx` (new); `scripts/check-tokens.mjs`, `scripts/check-raised.mjs`, `scripts/check-astryx-use.mjs` (new); `package.json` (four script lines); `.github/workflows/ci.yml` (one step); `e2e/astryx-kit.spec.ts` (new) |
| 2a | `components/site/SiteHeader.tsx`, `HeaderLinks.tsx`, `MobileNav.tsx`, `SiteFooter.tsx`; `components/site/shell.css` and `components/site/AppFooter.tsx` (new); `app/(app)/layout.tsx`, `app/(marketing)/layout.tsx`; the header's cases in `e2e/landing.spec.ts`, `phase1.spec.ts`, `phase2-editor-media.spec.ts`, `phase2-polish-2.spec.ts`, `phase2-saved-ideas.spec.ts`, `portfolio-landing.spec.ts` and `portfolio-switch.spec.ts`; `e2e/shell.spec.ts` (new) |
| 2b | `components/ui/Page.tsx` (new); `app/(app)/account/page.tsx`, `account/billing/page.tsx`, `roadmap/page.tsx`, `roadmap/saved/page.tsx`, `job-links/new/page.tsx`, `job-links/[id]/page.tsx`, `admin/page.tsx`, `admin/accounts/page.tsx` (their outer frame and section wrappers only); `e2e/page-frame.spec.ts` (new); once 1b is merged, the baseline list in `scripts/check-raised.mjs`, to take a flattened file off it |

**Frozen for every agent here:** the lab (`themes/exhbt-next/`, `app/lab/`, `components/lab/`); `app/layout.tsx`, `app/providers.tsx`; in `app/globals.css` the `@theme` block, the base layer and every `.xp-*`, `.pf-*` and `[data-look]` rule; `app/(portfolio)/**`, `lib/portfolio.ts`, `lib/plan-rules.ts`; `components/portfolio/`, `components/exhbt/`, `components/charts/`; `components/exhbt-editor/` and `components/editor/`; `app/(app)/portfolio/` and `app/(app)/exhbts/`; `e2e/golden/`; `lib/hosts.ts`, `lib/entitlements.ts`, `middleware.ts`.

## Rules for every agent

The first ten are the rules of `docs/briefs/edit-on-page/README.md`, with this build's branch names. The rest are added for this build.

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
12. **Visitors' pages are protected.** The frozen list above is the rule; `npm run check:protected` fails on the three protected paths. Never regenerate a golden copy. The theme, `app/layout.tsx` and `components/ui/Button.tsx` all reach a page an employer reads, so the plan's ten safety rules apply to you even when your job is "only" app chrome.
13. **Read Astryx before you build with it.** `docs/design/astryx-agent-guide.md`, then `npm run astryx -- docs principles`. Read each component you use with `npm run astryx -- component <Name>`: take prop names, theming keys and public variables from there, never from memory or from a review. A variable a component does not define compiles to CSS that never applies, with no warning. `npm run astryx -- theme targets` lists every theming key. The installed version is 0.7.11; do not raise it.
14. **Look at what you build.** Open it in the browser at 1440 and at 390 wide, take screenshots (deviceScaleFactor 2), read them, and fix what looks rough before you report. Save them under `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/<your job>/`, or the folder the main session gives you, and name each file in your report. If `.claude/skills/impeccable/` is in your branch, read its `reference/craft-floor.md` before you build and `reference/polish.md` before you report.
15. **The shared machine** has four cores and 15 GB, and has been running out. Run one spec file at a time, stop your dev server when you are not testing, and do the reading and writing first. A test that fails with "Page crashed", "Target crashed" or `ERR_ABORTED` is run once more on its own before you treat it as a failure.

## How each job is verified

**1a.** `npm run check:theme`. Both parity specs with `CI` unset, so boxes are compared, `e2e/exhbt-page.spec.ts` and `e2e/phase2-looks.spec.ts`: the same results before the first change and after the last. A search of the built `exhbt.css` for the motion values and for the neutral theme's blue. Photographs of a focused "See the work" button in all eight looks, before and after. The display type measured in a touch context at 390 and 820 wide, because the theme has a rule for touch screens that parity never runs. `/dev/astryx` beside the lab's Kit page: they match.

**1b.** `e2e/astryx-kit.spec.ts`: axe on `/dev/astryx`; the focus ring's colour; a notice that is still a live region; the sheet as a drawer on a wide window, and a list of actions as a bottom sheet on a phone; nothing animating under reduced motion; the address component. The three check scripts pass on the branch and fail on a planted fault each.

**2a.** The seven specs that select the header, `e2e/shell.spec.ts`, `e2e/a11y.spec.ts`, `e2e/responsive.spec.ts`, `e2e/seo.spec.ts`, both parity specs. Six pages photographed at 1440 and 390 before and after milestone 1, which must match but for the phone menu.

**2b.** `e2e/page-frame.spec.ts`: every listed page's heading and content start at the same left edge as the header's logo at 1440, 1024 and 390. The specs of each page touched (`phase2-account`, `phase2-billing`, `phase2-saved-ideas`, `phase2-joblinks`, `admin`), `a11y`.

**Before the release branch goes to `main`,** the main session runs the whole suite once, both parity specs with boxes, and the build and dry-run deploy with the Worker's size written down.
