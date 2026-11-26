# Brief L: the clean-up, a week after the switch-on

| | |
|---|---|
| Release | R4, clean-up |
| Model | Sonnet |
| Branch | `phase-2-pf-l-clean-up`, made from `phase-2-pf4` (cut from `main`) |
| Port | 3332 |
| Starts when | `EXHBT_PORTFOLIO=page` has been on for everyone for a week with no rollback; the classic exhbt editor's removal (brief P in `docs/briefs/edit-on-page/`) is merged; Rory agrees |
| Hours | About 5 |

## Goal

Take out what the one-page editor replaced, so there is one way to build a portfolio and no switch left to forget: the step builder, `PortfolioHome`'s `frame`, the exhbts list's body, `moveExhbt`, and the switch itself. The addresses people have stay, as redirects. Nothing changes for anyone.

## Read first

`docs/decisions/0031-portfolio-first.md` ("The switch", "Releases"), `docs/briefs/portfolio-first/README.md` (R4), the files below.

## You own

What you delete in `app/(app)/portfolio/`: `Builder.tsx`, `StepYou.tsx`, `StepLook.tsx`, `StepProjects.tsx`, `StepPublish.tsx`, `Preview.tsx`, `TileEditor.tsx` (if nothing else imports it), `TryNewPortfolio.tsx`, `steps.ts` (its types move to `builder-state.ts`); `customise/page.tsx` and `app/(app)/account/portfolio/page.tsx` stay one-line redirects, to `/portfolio` and `/portfolio?open=address`. `PortfolioHome.tsx`: `frame`, `inertChrome` and `sectionsOnly` if nothing passes them now (`thumbnail` stays while the home page's look pictures use it). `app/(app)/exhbts/page.tsx`'s body (it becomes the redirect alone) and `moveExhbt` in `exhbts/[id]/actions.ts`. `lib/portfolio-kind.ts`, `lib/portfolio-kind-server.ts`, `app/api/portfolio/editor/`, `app/dev/portfolio-kind/`, the `portfolio` line of `/api/health`. `lib/landing.ts` and `components/site/app-nav.ts` (dropping the kind: one landing, one nav). Every file that reads the switch (each takes the `page` path only). `app/(portfolio)/p/[username]/page.tsx`: the owner preview's link and words ("Your portfolio" to `/portfolio`), the one planned edit there, and `scripts/check-protected.mjs` (allowing that one file in this change, then protecting it again). The specs: `e2e/phase2-builder.spec.ts`, `phase2-customiser.spec.ts`, the look steps of `phase2-themes.spec.ts`, `portfolio-switch.spec.ts`, the switch cases in `portfolio-landing`, `portfolio-routes` and `portfolio-structure`, and every other spec that opens `?step=` or the exhbts list (`grep` for them; there were 8 and 12 at 5261c10).

Two parity targets change with this, and they are the only goldens you may touch: the step builder's look cards (deleted with `StepLook`: remove the target from `e2e/portfolio-parity.spec.ts` and delete its golden files) and the owner preview (reworded: write its golden again with `GOLDEN=write` for that target alone). `scripts/check-protected.mjs` allows exactly those files in this change.

## You must not touch

`lib/portfolio.ts`, `lib/plan-rules.ts`, the rest of `app/(portfolio)/`, every other golden in `e2e/golden/portfolio/` and every other target in the parity spec. The exhbt editor. Any migration.

## Steps

Commit and push after each.

1. **The default first:** `DEFAULT_PORTFOLIO = "page"` and its pin, in one commit, so the suite runs on the editor everywhere before anything is deleted. Run the old builder specs: they now fail by design; list what each checked.
2. **Move the checks worth keeping** from `phase2-builder`, `phase2-customiser` and `phase2-themes` into the portfolio specs they belong in (a rule tested with no browser stays a rule test; a flow becomes the editor's flow), then delete the old ones. Say which checks you dropped and why (a step that no longer exists).
3. **Delete the step builder** and what only it used, then run `e2e/portfolio-parity.spec.ts` (after taking out `frame` and the props only the builder passed, every other target must pass untouched); `useBuilder.ts`, `actions.ts`, `PhotoField`, `UsernameForm` and `JobLinksSection` stay (the editor uses them).
4. **Delete the switch:** the rule, the server side, the route, the dev route, the health line, every `portfolioKind` call and its `steps` branch, `?builder=steps`, `PortfolioGate`'s reload into it (the boundary stays and offers "Reload" once it has flushed), and "Use the step builder" from the menu.
5. **The exhbts list's body** goes; `/exhbts` stays a redirect for good. `moveExhbt` goes if nothing calls it.
6. **The owner preview's wording,** with `check:protected` allowing that file and its golden in this change only; write that one golden again and run the whole parity spec.
7. **Search** outside `docs/decisions/` and `docs/briefs/` for `EXHBT_PORTFOLIO`, `portfolioKind`, `DEFAULT_PORTFOLIO`, `builder=steps`, `?step=` and `exhbt-portfolio-own`: nothing.

## Done looks like

The suite is green with no step builder and no switch; every old address still lands somewhere sensible; the search finds nothing.

## Report back

The branch head; each deleted file; each test check moved or dropped, with why; the search's output; whether `EXHBT_PORTFOLIO` can now be deleted from the live Worker (it can: nothing reads it).

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
