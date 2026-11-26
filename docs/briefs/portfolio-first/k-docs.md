# Brief K: the docs, and Rory's trial checklist

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Sonnet |
| Branch | `phase-2-pf-k-docs`, made from `phase-2-pf2` |
| Port | 3331 (only if you run a page to check wording) |
| Starts when | E, F, G, H, I and J are merged into `phase-2-pf2` |
| Hours | About 2 |

## Goal

Bring the living docs in line with what release 2 built, and write the checklist Rory and Alex use on a laptop and an iPhone before the switch goes on for everyone.

## Read first

`docs/decisions/0031-portfolio-first.md`, `docs/briefs/portfolio-first/README.md`, `docs/MAP.md`, `HANDOFF.md`, `DESIGN.md` (the Dragging rule and the builder paragraphs), `AGENTS.md`, the anti-AI-slop writing skill in `.claude/skills/`. The release 2 branch itself: what was built, from the agents' reports the main session gives you.

## You own

`docs/MAP.md` (the portfolio, nav and landing lines), `HANDOFF.md` (the portfolio editor, the switch, where things live), `DESIGN.md` (the builder paragraph and the Dragging rule's builder sentence, as 0031 amends them), `AGENTS.md` (one line: the portfolio is edited on the page, through `components/portfolio-editor/`, and `PortfolioHome` takes `edit`), `docs/briefs/portfolio-first/trial-checklist.md` (new); in `docs/decisions/`, only an "Amended by: 0031 (…)" line in the headers of 0014, 0016 and 0018, and of 0026 once `switch-on-page-editor` (which edits 0026) is merged.

## You must not touch

Code. The rest of `docs/decisions/` (0031 is written; if what was built differs from it, say so in your report and the main session writes a follow-up). Other briefs.

## Steps

Commit and push after each.

1. **`docs/MAP.md`, `HANDOFF.md`, `AGENTS.md`:** what is true with the switch at `steps` (today) and what is true at `page`, and where the switch is (`lib/portfolio-kind.ts`, `EXHBT_PORTFOLIO`). No plan figures in prose; no "exhbts list" as a place people go once the switch is on.
2. **`DESIGN.md`:** the builder paragraph becomes the portfolio editor's (the page itself, edited where it sits; the bar; sheets; tiles and sections with corner toolbars; the vision band); the Dragging rule's builder sentence says sections and tiles are dragged on the page by their grips, as built.
3. **The trial checklist:** one page, plain words, for Rory and Alex, in two parts. On a laptop: opt in ("Try the new portfolio"), type in each part of the hero, change the look to Studio and back, add a section and undo it, drag a tile, hide and show one, add an exhbt, write a title, go back, publish (on Premium), find the note, see as a visitor, open the address sheet, job links, team, then "Use the step builder" and back. On an iPhone: the same in the Exhbt look and Studio, plus a photo from the camera roll, a press-and-hold drag of a tile and a section, a More sheet, Reorder sections, and that nothing zooms. Each line has a box to tick and a space for what went wrong.
4. **The amended records:** an "Amended by: 0031" line, with a few words on what changed, in the headers of 0014, 0016 and 0018 (0016 already has one for 0018: add to it), and of 0026 if `switch-on-page-editor` is merged; if it is not, say so in your report and leave 0026 alone.

## Done looks like

`npm run check:docs` passes; the docs say what the code does at both settings; the checklist fits on one page.

## Report back

The branch head; every place the built thing differs from 0031.

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
