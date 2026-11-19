# Brief Q: the editor's exact checks on the four new layouts

| | |
|---|---|
| Release | 4, the four layouts |
| Model | Sonnet |
| Branch | `phase-2-r4-q-checks`, made from `phase-2-r4` after M is merged |
| Port | 3317 |
| Starts when | M is merged into `phase-2-r4`, so `OFFERED_FORMATS` holds seven |

## Goal

Rory's smoothness rule (decision 0026, "Smoothness") gates CI, and release 3 proved it on three layouts. The four new layouts bring rows the drag prototype never tried: Build's row of buttons, Essay's key points beside the pull quote and its Sources list, the Before and after pair that forms when two pictures are marked, and Event's grid. Run the exact checks on all seven, add the flicker cases for the new rows, and report anything that fails. You do not fix the editor: a failure goes to the main session, which gives it to an Opus agent.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("Smoothness", "Dragging"), `docs/decisions/0028-four-more-layouts.md` ("How each is drawn"). On your base: `e2e/page-editor.ts` (`offered()`, `SAMPLES`, `full(doc)`, `boxes(page)`, `renders(page)`), `e2e/editor-smooth.spec.ts`, `e2e/editor-drag.spec.ts`, `e2e/editor-inplace.spec.ts` (the box-for-box tests), `e2e/editor-flow.spec.ts`.

## You own

In release 4, for adding cases only: `e2e/editor-smooth.spec.ts`, `e2e/editor-drag.spec.ts`, `e2e/editor-inplace.spec.ts`, `e2e/editor-flow.spec.ts`. Change no existing test, except to point a hard-coded list of three layouts at `offered()` if one slipped through.

## You must not touch

Anything that is not one of those four specs. `e2e/page-editor.ts` is read only: if a helper is missing, say so.

## Steps

Commit and push after each.

1. **Run the four specs as they are**, on the desktop project, and `editor-drag` and `editor-flow` on the `touch` project too. They loop over `offered()`, so they now cover seven layouts. Write down each failure with the layout, the test and what it saw.
2. **Add the flicker cases** to `e2e/editor-drag.spec.ts` ("no flicker": resting on a boundary and trembling 2px either side 40 times never changes the place):
   - in a Before and after exhbt, beside an image marked Before, at the place where dropping an image marked After would form the pair;
   - along Build's row of link buttons, and between it and the section above;
   - beside Essay's key points and pull quote pair, on each side;
   - along Event's image grid.
   And for each: dropped there, the stored order is the place shown.
3. **Box for box** (`e2e/editor-inplace.spec.ts`): the four new samples, made `full`, in the Exhbt, Classic and Night looks, at 1440 and on a Pixel 7. Nothing may differ but what 0026 allows on a full page: the highlight's wrap and the entries of `EDIT_ONLY_IN_FLOW` that are always there (each image's description field, the "Add a skill" box), by name.
4. Report how long each spec now takes: they are four times the matrix they were.

## Done looks like

Every check passes on all seven layouts, or each failure is reported with enough to reproduce it (the layout, the test, the address, what moved).

## Report back

The branch head; a table of the four specs by layout (pass, fail, and why); the flicker cases you added; the run times.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `phase-2`, `main` or a release branch (`phase-2-r2`, `phase-2-r3`, `phase-2-r4`, `phase-2-r5`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with your own attribution lines, then the line `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`.
8. **House rules that bite here:** colours and corners on the exhbt page come only from the `--xp-*` variables; buttons in app chrome are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose; Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
10. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
