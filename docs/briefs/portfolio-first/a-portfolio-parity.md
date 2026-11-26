# Brief A: the portfolio parity gate and its golden copies

| | |
|---|---|
| Release | R0, guard rails |
| Model | Opus |
| Branch | `phase-2-pf-a-parity`, made from `phase-2-pf0` |
| Port | 3321 |
| Starts when | `phase-2-pf0` exists (cut from `main`) |
| Hours | About 4 |

## Goal

Visitors' portfolio pages must not change while the editor is built. Today nothing guards them: `e2e/layout-parity.spec.ts` covers only the exhbt page (`article[data-exhbt-page]`). Write the same gate for the portfolio home, `[data-portfolio-home]`, and write its golden copies now, on `main`'s commit, before anyone touches `PortfolioHome.tsx`. Brief D then changes the renderer and must pass this gate with the goldens untouched.

## Read first

`docs/decisions/0031-portfolio-first.md` ("Visitors' pages stay as they are", "The adapter"), `e2e/layout-parity.spec.ts` (all of it: you copy its method), `app/dev/parity/route.ts`, `app/dev/portfolio/route.ts` (how portfolios are seeded today), `components/portfolio/PortfolioHome.tsx`, `lib/portfolio-layout.ts` (`normaliseLayout`, `sectionsOf`, the legacy markers of decision 0014), `lib/portfolio-themes.ts` (`LOOKS`, colourways), `lib/portfolio.ts` (`loadPortfolio`, read only), `components/portfolio/JobLinkView.tsx`, `app/(portfolio)/p/[username]/page.tsx` (the owner preview, read only). The callers of `PortfolioHome`: the public page, `PortfolioPage.tsx`, `JobLinkView.tsx`, `/demo`, `/what-is-an-exhbt`, `components/home/Preview.tsx` and `LookPreview.tsx`, the step builder's `Preview.tsx` and `StepLook.tsx`.

## You own

`e2e/portfolio-parity.spec.ts` (new), `e2e/golden/portfolio/` (new), `e2e/fixtures/portfolio-pages.ts` (new), `app/dev/portfolio-parity/` (new, development only: 404 in production).

## You must not touch

Any product file: `components/`, `lib/` (outside reading), `app/` outside `app/dev/portfolio-parity/`. The exhbt goldens in `e2e/golden/` (the portfolio's go in their own folder).

## Steps

Commit and push after each.

1. **The seed route.** `POST /dev/portfolio-parity` takes a fixture (a person, a plan, a look and colourway, a `portfolio_layout`, the exhbts with fixed ids, fixed file ids and a fixed publish date, which are hidden and which is featured) and writes it through the `Store` as `/dev/portfolio` does, so a second run on another day draws the same page. Fixed photo: a small image from `devBlobs`, as the exhbt parity does.
2. **The fixtures** (`e2e/fixtures/portfolio-pages.ts`), all of them importing nothing that release 1 or 2 adds, so the file runs unchanged on `main`:
   - every look, and every colourway of the looks that have several, with full content (a photo, an intro of two paragraphs, location, looking for, all links, three education lines with years, tools, experience, a quote, five exhbts);
   - in the Exhbt look and two others of your choosing with different heroes: sparse (a name only), a long name (Studio's one word per line), and no photo;
   - section sets: the default; all six; About only; Get in touch only;
   - featured set and not set; a hidden featured exhbt; an exhbt whose key figure is an image;
   - a legacy layout (0014's `"p"` markers and tile names);
   - held extras after a downgrade (Experience and a quote stored on a plan without them);
   - the owner preview (`/p/<name>` signed in as the owner with nothing live);
   - a job-link page (`[data-job-page]`) and an exhbt page's frame on a portfolio host (`ProjectCard` and the look's variables are shared);
   - `/demo`, `/what-is-an-exhbt`, the home page's look pictures (`components/home/LookPreview.tsx`) and the step builder's look cards (signed in, `/portfolio?step=look`), as they are.
3. **The spec** (`e2e/portfolio-parity.spec.ts`), the same method as `layout-parity.spec.ts`: the normalised outer HTML of `[data-portfolio-home]` (or the target's root) at 1440 by 900, and the box of every element in it at 1440 by 900 and 412 by 915, within half a pixel. The same five normalisations and no others; add one only if a target needs it (a signed address that changes hourly), and say so in the file's header. `GOLDEN=write` writes; otherwise it compares. The box check runs only where the goldens were written (not on CI), exactly as the exhbt gate.
4. **Write the goldens** on your branch's base commit, before any other change lands, and commit them. Run the spec twice more without `GOLDEN=write`: it must pass both times, so nothing in it depends on the time or the order.

## Done looks like

`npx playwright test e2e/portfolio-parity.spec.ts` passes on the base commit with the goldens it wrote; every target in step 2 is in it; the header says who may not edit it (whoever changes `PortfolioHome`).

## Report back

The branch head; the list of targets and how many goldens; the spec's run time; any normalisation you added and why; anything on a page that you could not make the same twice (and what you did about it).

Run: `e2e/portfolio-parity.spec.ts`.

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
