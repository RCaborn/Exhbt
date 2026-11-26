# Brief C: the exhbt editor's live links, through portfolioHref

| | |
|---|---|
| Release | Hotfix, on its own |
| Model | Sonnet |
| Branch | `phase-2-pf-c-live-link`, made from `main` |
| Port | 3323 |
| Starts when | Now |
| Hours | About 1 |

## Goal

The exhbt edit page works out where a person's portfolio lives (`liveBase`) by asking whether the request came to the app host: `https://<name>.exhbt.co.uk` if it did, `/p/<name>` otherwise (`app/(app)/exhbts/[id]/edit/page.tsx`, about line 76). While the tool still runs on `www.` (the move to `app.` waits for `EXHBT_TOOL_HOST=1`), a live request is not on the app host, so the page gives `/p/<name>`, and on the real domains `middleware.ts` answers `/p/...` with 404. The publish sheet's address, "View it" and "See your portfolio" (`components/editor/PublishWhere.tsx`) all use `liveBase`. Whether this is broken on live today depends on `EXHBT_TOOL_HOST`, which nobody can read from the code. `portfolioHref` in `lib/portfolio-links.ts` already does the right thing on every host. Use it.

## Read first

`docs/decisions/0031-portfolio-first.md` ("Not sure, and risky", the live links), `lib/portfolio-links.ts`, `lib/hosts.ts` (`parseHost`, `portfolioHost`, `APEX`), `middleware.ts` (the `/p/` rule), `app/(app)/exhbts/[id]/edit/page.tsx`, `components/editor/PublishWhere.tsx` (read only).

## You own

`app/(app)/exhbts/[id]/edit/page.tsx` (the `liveBase` line and the host it reads, nothing else), `e2e/live-links.spec.ts` (new).

## You must not touch

`lib/portfolio-links.ts`, `lib/hosts.ts`, `middleware.ts`, anything in `components/editor/` or `components/exhbt-editor/`.

## Steps

Commit and push after each.

1. **Prove the helper first,** with no browser, in `e2e/live-links.spec.ts`: `portfolioHref("alex", host)` is `https://alex.exhbt.co.uk` for `www.exhbt.co.uk`, `app.exhbt.co.uk` and `exhbt.co.uk` (with and without a port), and `/p/alex` for `localhost:3200` and an `exhbt-preview.<x>.workers.dev` host. If any of these fails, stop and report: the helper is wrong, not the page.
2. **The page.** Read the host the way `app/(app)/portfolio/page.tsx` does (`x-forwarded-host`, then `host`) and set `liveBase` to `portfolioHref(profile.username, host)` when there is a username, `null` otherwise. Drop the `onAppHost` test if nothing else on the page uses it.
3. **In the browser,** in the same spec: seed a Premium person with a username and a published exhbt (through `/dev/portfolio`, as the editor specs do), open its edit page, open the publish sheet, and check "See your portfolio" and the address go to `/p/<name>` in development.

## Done looks like

The edit page asks `portfolioHref` and nothing else where a person's portfolio lives; the spec passes; nothing else changed.

## Report back

The branch head; the before and after of the line; the spec's results and time. Say in one line what the main session should check on live after the deploy: an edit page's "See your portfolio" link goes to `https://<name>.exhbt.co.uk`.

Run: `e2e/live-links.spec.ts`, `e2e/editor-sheets.spec.ts`.

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
