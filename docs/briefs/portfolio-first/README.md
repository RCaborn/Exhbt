# Portfolio first: the build

Written 26 Nov 2026 from three designs and a judge's reading of them against `main` at 5261c10. The decision is `docs/decisions/0031-portfolio-first.md`; read it before any brief. `for-rory.md` is the one-page version for Rory and Alex.

This folder holds one brief per build agent, A to L. Each brief stands alone: an agent reads its own brief, the files it names and 0031, and nothing else here. The letters are names, not an order. Every type or signature one agent builds and another builds against is written out word for word in both briefs, as in 0031.

## Before anything starts

- **The new exhbt editor is on for everyone.** The change is ready on `switch-on-page-editor` (c526fcf, 26 Nov: `DEFAULT_EDITOR` and its pin in one commit). Rory's decision: the portfolio is built after that, and it goes live after that too, because the portfolio hands people to the new exhbt editor and back.
- **The hotfix (C) can go at once.** It mends a link on the live site and has nothing to do with the switch.
- **Release branches are cut from `main`.** `origin/phase-2` is 409 commits behind `main` and none ahead: Phase 2 is live (`EXHBT_PHASE2=1` in `wrangler.jsonc`), and the editor's releases have gone to `main` by pull request. The line in `CLAUDE.md` about the `phase-2` branch predates that; nothing here pushes straight to `main`.

## The releases

| | Ships | For users | Gate |
|---|---|---|---|
| **Hotfix** | The exhbt editor's live links (`liveBase`) through `portfolioHref` | "See your portfolio" and the publish sheet's address work on the live host | C's spec; the main session opens the link on live after the deploy |
| **R0, guard rails** | Portfolio parity goldens written on `main` before any renderer change; the switch, unused; the nav and landing seams, behaving as today; `/portfolio` in `SESSION_PATHS`; the in-memory store's roadmap prefill; `npm run check:protected` | Nothing changes | The suite green; `portfolio-switch` and `portfolio-landing`; the goldens written |
| **R1, the reader release** | `PortfolioHome`'s `edit` prop and slots, unused; `joinYear`; memoised cards and figures; the slots harness | Nothing changes | Parity with the goldens untouched; `home-slots`; `/demo` and `/what-is-an-exhbt` compared before and after on live |
| **R2, editor and structure, switched off** | The one-page editor and every structure change in 0031, behind `EXHBT_PORTFOLIO` | Only an admin who opts in | J's gate specs; every agent's own; parity again; the old specs green at `steps`; four reviews; the Worker's size |
| **R3, trial, then on** | Nothing new: Rory and Alex try it, then `EXHBT_PORTFOLIO=page` | Everyone | The trial checklist; `/api/health` says `"portfolio": "page"` |
| **R4, clean-up, a week later** | The default becomes `page`; the step builder, `frame`, the exhbts list's body and the switch go; the old specs' useful checks move | Nothing changes | The suite green without the old builder; a search for the switch finds nothing outside the docs |

Each release goes the usual way: the release branch into a pull request to `main`, CI, the merge, live checks (`/api/health`, `/demo`, a published exhbt, the portfolio pages that answer). The main session does all of that. Agents never do.

## Branches

- The main session makes one branch per release: `phase-2-pf0` from `main`; `phase-2-pf1` from `phase-2-pf0` once A is merged there (D needs the goldens, not R0's deploy); `phase-2-pf2` from `phase-2-pf1` once D is merged there, with `main` merged in after each earlier release lands; `phase-2-pf4` from `main` a week after the switch-on. The hotfix is `phase-2-pf-c-live-link`, from `main`, merged alone.
- R0's pull request goes to `main` before R1's, and R1's before R2's.
- Each agent works on its own branch, made from its release branch at the moment it starts. The names are in the table below.
- The main session merges an agent's branch into the release branch when its report is in and its named specs pass. An agent that waits for another starts only after that merge.

## Agents, order and what each waits for

At most two Opus agents run at once; Sonnet agents may run beside them. Haiku does the Notion save at the end.

| | Brief | Model | Branch | Port | Starts when | Hours |
|---|---|---|---|---|---|---|
| C | `c-live-link-hotfix.md` | Sonnet | `phase-2-pf-c-live-link` | 3323 | now, from `main` | 1 |
| A | `a-portfolio-parity.md` | Opus | `phase-2-pf-a-parity` | 3321 | `phase-2-pf0` exists | 4 |
| B | `b-switch-and-seams.md` | Sonnet | `phase-2-pf-b-switch` | 3322 | `phase-2-pf0` exists | 5 |
| D | `d-page-slots.md` | Opus | `phase-2-pf-d-slots` | 3324 | A is merged into `phase-2-pf0` and `phase-2-pf1` is cut | 6 |
| E | `e-editor-core.md` | Opus | `phase-2-pf-e-core` | 3325 | D is merged and `phase-2-pf2` is cut; B is merged; the new exhbt editor is on for everyone | 12 |
| H | `h-structure.md` | Sonnet | `phase-2-pf-h-structure` | 3328 | B is merged; the new exhbt editor is on for everyone; the classic editor's removal (`docs/briefs/edit-on-page/r5-p-remove-classic.md`) is merged or held until R2 is merged | 6 |
| F | `f-sections-and-tiles.md` | Opus | `phase-2-pf-f-arrange` | 3326 | E's milestone 1 is merged | 9 |
| G | `g-bar-and-sheets.md` | Sonnet | `phase-2-pf-g-bar` | 3327 | E's milestone 1 is merged; its Team sheet waits for H's step 1 | 8 |
| I | `i-phone.md` | Opus | `phase-2-pf-i-phone` | 3329 | F and G are merged, and an Opus slot is free | 5 |
| J | `j-gate-specs.md` | Opus | `phase-2-pf-j-specs` | 3330 | E's milestone 2 and H are merged (it starts with the structure and safety specs); F, G and I as they land | 9 |
| K | `k-docs.md` | Sonnet | `phase-2-pf-k-docs` | 3331 | E to J are merged | 2 |
| L | `l-clean-up.md` | Sonnet | `phase-2-pf-l-clean-up` | 3332 | the switch has been on for everyone for a week; the classic exhbt editor's removal is merged; Rory agrees | 5 |
| | Notion save | Haiku | none | | K is merged | 0.5 |

Opus agents in order: A, then D, then E, then F beside E's milestone 2, then I and J. About 72 agent-hours in all. Jobs on the longest chain: A, D, E's milestone 1, F, I, then the end of J, about 33 hours. With two or three streams at once that is about five working days of building (R0 to R2), then the trial day and the switch-on day. Rory was given 2 to 3 days for the editor, 1 to 2 for the restructure, plus tests; this is about a day over the top of that, mostly the guard rails at the start (A, B, C and D, about 16 hours).

**If it runs over,** cut in this order and say so to Rory:
1. A first exhbt from a roadmap idea goes straight to the exhbt editor, as today, not to the portfolio with the draft in the band.
2. The note that the page is open in another tab.
3. Phone polish beyond what the phone spec checks.
4. Undo falls back to `useBuilder`'s one step.

## Who owns which files

No two agents edit the same file in the same release, with these hand-overs: E makes stub files that F, G and I take over when E's milestone 1 is merged; E owns `PortfolioHome.tsx` in R2 for slot fixes only (a slot another agent lacks goes to E through the main session); J takes over `e2e/portfolio-editor.ts` when E is merged.

### The hotfix and R0

| Agent | Owns |
|---|---|
| C | `app/(app)/exhbts/[id]/edit/page.tsx` (the `liveBase` line and the host it reads), `e2e/live-links.spec.ts` (new) |
| A | `e2e/portfolio-parity.spec.ts` (new), `e2e/golden/portfolio/` (new), `e2e/fixtures/portfolio-pages.ts` (new), `app/dev/portfolio-parity/` (new) |
| B | `lib/portfolio-kind.ts`, `lib/portfolio-kind-server.ts`, `lib/landing.ts`, `components/site/app-nav.ts` (all new); `app/api/portfolio/editor/route.ts`, `app/dev/portfolio-kind/` (new); `app/api/health/route.ts` (the `portfolio` line); `components/site/SiteHeader.tsx`, `app/(app)/layout.tsx`; the sign-in fallbacks in `app/(app)/login/actions.ts`, `login/page.tsx`, `login/new/page.tsx`, `login/link/page.tsx`, `app/auth/callback/route.ts`, `app/auth/confirm/route.ts`, `app/auth/dev/route.ts`; `middleware.ts` (`SESSION_PATHS`); `lib/store.ts` (the in-memory `claimPendingRoadmaps` only); `scripts/check-protected.mjs` (new), `package.json` (one script), `.github/workflows/ci.yml` (one step); `e2e/portfolio-switch.spec.ts`, `e2e/portfolio-landing.spec.ts` (new) |

### R1

| Agent | Owns |
|---|---|
| D | `components/portfolio/PortfolioHome.tsx`, `components/portfolio/home-ctx.ts` (new), `lib/portfolio-layout.ts` (`joinYear` only), `app/dev/home-slots/` (new), `e2e/home-slots.spec.ts` (new) |

### R2

| Agent | Owns |
|---|---|
| E | `app/(app)/portfolio/page.tsx`, `load.ts` (new), `actions.ts`, `builder-state.ts` (new), `TryNewPortfolio.tsx` (new), `error.tsx` (new), `Builder.tsx` (exporting `BuilderProps` and moving `personOf` and `problemOf` out, nothing else); everything in `components/portfolio-editor/` but the folders handed over below; `components/exhbt-editor/fields/InlineText.tsx` (the word `export` only); `components/portfolio/PortfolioHome.tsx` and `home-ctx.ts` (slot fixes only, held to parity); `e2e/portfolio-editor.ts` (new, until J takes it), `e2e/portfolio-core.spec.ts` (new) |
| F | `components/portfolio-editor/sections/`, `components/portfolio-editor/tiles/`, `components/portfolio-editor/css/arrange.css`, `e2e/portfolio-arrange.spec.ts` (new) |
| G | `components/portfolio-editor/bar/`, `sheets/`, `tools/`, `components/portfolio-editor/css/bar.css`, `app/(app)/portfolio/JobLinksSection.tsx` (a `compact` variant), `e2e/portfolio-bar.spec.ts` (new) |
| H | `components/team/TeamPanel.tsx` (new); `app/(app)/exhbts/page.tsx`, `exhbts/new/page.tsx`, `exhbts/[id]/actions.ts` (the idea redirects and the revalidations), `exhbts/[id]/edit/page.tsx` (passing the switch), `exhbts/[id]/team/page.tsx` (its back link); `components/exhbt-editor/topbar/TopBar.tsx` (the back link), `components/exhbt-editor/sheets/PublishSheet.tsx` (what follows a publish, and Free's line), `components/exhbt-editor/context.ts` (one optional prop); `app/(app)/account/page.tsx`, `account/portfolio/page.tsx`, `account/billing/page.tsx` (one button); `app/(app)/portfolio/customise/page.tsx`; `app/(app)/job-links/page.tsx`, `job-links/new/page.tsx`, `job-links/[id]/page.tsx` (back links); `app/(app)/team/accept/page.tsx`; `components/roadmap/BuildThis.tsx`, `app/(app)/roadmap/[id]/page.tsx`, `app/(app)/roadmap/saved/page.tsx` (passing the switch); `e2e/portfolio-routes.spec.ts` (new) |
| I | `components/portfolio-editor/phone/`, `components/portfolio-editor/css/phone.css`, `playwright.config.ts` (the touch project's match), `e2e/portfolio-phone.spec.ts` (new) |
| J | `e2e/portfolio-editor.ts` (from E's merge), `e2e/portfolio-editor.spec.ts`, `portfolio-structure.spec.ts`, `portfolio-safety.spec.ts`, `portfolio-visitor.spec.ts`, `portfolio-smooth.spec.ts` (all new) |
| K | `docs/MAP.md`, `HANDOFF.md`, `DESIGN.md` (the portfolio and builder paragraphs, and the Dragging rule's builder sentence), `AGENTS.md` (one line), `docs/briefs/portfolio-first/trial-checklist.md` (new) |

**Frozen in R2** (nobody edits them): `components/exhbt-editor/` apart from E's `export` and H's three named edits; `components/editor/`; `lib/editor-kind.ts` and `lib/editor-kind-server.ts`; `app/(portfolio)/**`, `lib/portfolio.ts`, `lib/plan-rules.ts`; `lib/hosts.ts`; `useBuilder.ts`; `app/(marketing)/` (the home hero keeps its button and its address; `/exhbts/new` does the new thing); `e2e/golden/portfolio/`.

### R4

| Agent | Owns |
|---|---|
| L | what it deletes in `app/(app)/portfolio/` (`Builder.tsx`, `Step*.tsx`, `Preview.tsx`, `steps.ts`, `TryNewPortfolio.tsx`, `customise/`), `PortfolioHome.tsx`'s `frame` and the props only the step builder used, the body of `app/(app)/exhbts/page.tsx` and `moveExhbt`; `lib/portfolio-kind*.ts`, `app/api/portfolio/editor/`, `app/dev/portfolio-kind/`, the `portfolio` line of `/api/health`; `lib/landing.ts` and `components/site/app-nav.ts` (dropping the kind); every file that reads the switch (making `page` the only way); `app/(portfolio)/p/[username]/page.tsx` (the owner preview's wording, the one planned edit there) and `scripts/check-protected.mjs` (allowing it); `e2e/phase2-builder.spec.ts`, `phase2-customiser.spec.ts`, the look steps of `phase2-themes.spec.ts`, `portfolio-switch.spec.ts`, and the other specs that open `?step=` or the exhbts list |

### Work outside this build that meets it

- **The classic exhbt editor's removal** (brief P in `docs/briefs/edit-on-page/`) edits `edit/page.tsx`, `context.ts`, the top bar's menu, `/api/health`, `playwright.config.ts` and deletes from `components/editor/`. B and C land before it. P and H are never in flight together: whichever is ready first is merged first, and the other merges `main` in before it reports. P must keep `components/editor/PublishWhere.tsx` and `lib/exhbt/publish-words.ts` (the new publish sheet imports both) and `isAdmin` in `lib/admin.ts` (the portfolio's switch calls it).
- **`phase-2-flow-lift`** touches `components/exhbt-editor/flow/` only: no overlap.
- **Alex's files:** the header, the app layout, the login pages and actions, the auth routes, `middleware.ts` and the billing page. B (R0) and H (R2) touch them, a line or a few each. Alex reviews both pull requests; ask him to hold changes to those files for the day each is in flight. His branches on `origin/cursor/*` are all merged or older than main's versions of these files; ask him before treating them as dead.

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

## How each release is verified

**The hotfix.** `e2e/live-links.spec.ts`: `portfolioHref` gives the subdomain on `www.`, `app.` and the apex and `/p/<name>` on `localhost` and `workers.dev`; the publish sheet's "See your portfolio" in development goes to `/p/<name>`. After the deploy the main session publishes nothing; it opens a published exhbt's edit page on live and checks the link's address.

**R0.**
- `e2e/portfolio-parity.spec.ts` writes the golden copies (`GOLDEN=write`) on R0's base commit, before any product change, then compares them: normalised markup and per-element boxes of `[data-portfolio-home]` at 1440 and 412 wide. The targets are in A's brief: every look and colourway; full, sparse and long-name content; every section set A names; the owner preview; a job-link page and an exhbt page's frame (`ProjectCard` is shared); `/demo`, `/what-is-an-exhbt`, the home page's look pictures and the step builder's look cards. CI compares the markup only; the boxes are compared in the environment that wrote them, the agents' sandbox Chromium, before each merge. Whoever changes `PortfolioHome` may not edit this spec or its goldens.
- `e2e/portfolio-switch.spec.ts`: the rule run directly over every combination of facts; `SHIPPED_DEFAULT = "steps"` pinned against `DEFAULT_PORTFOLIO`; the development cookie in the browser; `/api/portfolio/editor` answering 404 to anyone but an admin and setting the cookie for an admin; the cookie ignored for someone who is not an admin; `/api/health`'s `portfolio`.
- `e2e/portfolio-landing.spec.ts`: each way of signing in lands where it does today with the switch at `steps`, and on `/portfolio` at `page` (dev cookie); the nav both ways; a `next` always wins.
- The in-memory prefill: a roadmap gate's name and LinkedIn fill an empty profile at sign-in, and never overwrite one already there.
- `npm run check:protected` fails on a branch that edits a protected file.
- The main session: after the deploy, `/api/health` on live says `"portfolio": "steps"`.

**R1.**
- Parity passes with the goldens untouched, markup in CI and boxes in the sandbox.
- `e2e/home-slots.spec.ts`: with a stand-in adapter that marks every slot and adds no box, each slot appears once with its path and name, in all eight looks; the page matches the read-only one box for box at 1440 and 412, but for the parts in 0031's list; `joinYear` and `splitYear` round-trip.
- The main session: the normalised HTML of `/demo` and `/what-is-an-exhbt` on live, before and after the deploy, match. If a person's portfolio answers on live (`*.exhbt.co.uk` reaching the Worker is not confirmed), it is compared too; no release waits on it.

**R2.**
- J's gate specs, all in CI:
  - `portfolio-editor`: each field typed in place is stored at its path and survives a reload; looks, locked looks never saved; sections by keyboard, mouse and touch; star, hide, drafts, Add, claim; axe in all eight looks.
  - `portfolio-structure`: the nav; the landing after sign-up and log-in; `/exhbts` with each query; Add, write, publish and back to the tile; Free's first minute; the roadmap's "Add as an exhbt".
  - `portfolio-safety`: opening and leaving the editor writes nothing; a round trip both ways between the step builder and the editor on each legacy fixture; a failed save and a stale action keep the state; the crash fallback flushes first; the exhbt editor's back link waits for its save.
  - `portfolio-visitor`: "See as a visitor" equals the public page box for box in every look, and shows no draft, hidden exhbt, held extra or locked look.
  - `portfolio-smooth`: a key in the headline draws the hero again and no card or chart.
- Each agent's own spec (`portfolio-core`, `portfolio-arrange`, `portfolio-bar`, `portfolio-routes`, `portfolio-phone`).
- The old specs keep testing today's default, `steps`: the 8 spec files that open `?step=` and the 12 that open the exhbts list stay green unchanged. New specs opt in per browser with `/dev/portfolio-kind?kind=page`.
- Parity again (E's slot fixes touch the renderer) and `npm run check:protected`.
- The main session: `npx opennextjs-cloudflare build` and `npx wrangler deploy --dry-run` on `phase-2-pf2`, recording the Worker's size against the limit.
- Four reviews, each finding checked by a sceptic before anyone acts on it: data safety (autosave, undo, the round trip, two tabs, the claim); accessibility; the look of it (eight looks on a laptop and a phone, editing against visiting, against `DESIGN.md`); security (the new action and route, the dev-only pages, the admin check).

**R3.**
1. Rory and Alex opt in on live ("Try the new portfolio" on the step builder) and run K's trial checklist on a laptop and an iPhone: typing in Studio, a photo from the camera roll, a press-drag of a tile and a section, Add, publish and back, See as a visitor, Undo, the address sheet.
2. A new account cannot be an admin, so a new person's first minute, Free's preview and an upgrade are tried with the variable set on the preview Worker if its database has the Phase 2 tables. If it does not, the e2e first-run specs stand in, and the main session makes a fresh test account on live in the first hour after the switch-on, with `steps` one dashboard change away.
3. The main session tries the session refresh on the preview with a short token life: load `/portfolio` after the access token has expired and check the next page is still signed in.
4. Set `EXHBT_PORTFOLIO=page` on the live Worker in the Cloudflare dashboard; fetch `/api/health` until it says `"portfolio": "page"`.
5. Never in the same week as `EXHBT_TOOL_HOST=1`, which signs everyone out and drops admins' own cookies.

**R4.** The suite green without the old builder; a search outside `docs/decisions/` and `docs/briefs/` for `EXHBT_PORTFOLIO`, `portfolioKind`, `DEFAULT_PORTFOLIO`, `builder=steps` and `?step=` finds nothing; the exhbts list's address still redirects.

**CI time.** R0 to R2 add about a dozen specs, two of them matrices over the looks. Every agent reports how long each spec it wrote takes; the main session watches the shard times after each merge.

## The switch, and how it is tested

The editor and the new structure go live switched off. `steps` is what everyone gets until `DEFAULT_PORTFOLIO` in `lib/portfolio-kind.ts` or `EXHBT_PORTFOLIO=page` says otherwise, and an admin can choose either for themselves. The three ways back are in 0031 ("The switch"): the variable, `?builder=steps` for one visit, and the crash fallback.

- **In the suite:** `/dev/portfolio-kind?kind=page` sets a development cookie for that browser context alone, so a failed test cannot leave it set for the next. `?builder=steps` serves the step builder for that request. Development only: `?crash=render` makes the editor throw the first time it draws and `?crash=change` after the first change; each test sees the step builder next, and after `?crash=change` the words typed before the crash are saved.
- **On the preview Worker, at R0:** the main session sets `EXHBT_PORTFOLIO=page` there, reads `/api/health` until it says `page`, dispatches `deploy-preview.yml` and checks it still says `page` (so `keep_vars` keeps it), then deletes it and checks for `steps`.
- **On live:** `/api/health` says `steps` until R3's switch-on and `page` from then on.

## Undoing a release

The main session does this; no agent does.

1. **From R2 on, the switch first:** `EXHBT_PORTFOLIO=steps` on the live Worker. It needs no deploy and brings back today's app.
2. **Then, if the code itself is wrong:** `npx wrangler rollback` to the Worker version before the release, check `/api/health`, `/demo` and a published exhbt, then revert the release's merge on `main` and push.
3. **Open editors must reload.** A tab opened before a rollback calls a save action the older Worker lacks: the portfolio editor says "The site was updated. Reload to carry on" and offers the unsaved state back once after the reload. The step builder says "Not saved" and keeps what is on screen.
4. **Every release writes only what the step builder reads,** so each can be rolled back without touching data.
