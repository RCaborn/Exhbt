# Brief N: moving the existing editor tests to the new editor

| | |
|---|---|
| Release | 3, the editor |
| Model | Sonnet |
| Branches | `phase-2-r3-n-tests-1` and `phase-2-r3-n-tests-2`, each made from `phase-2-r3` |
| Ports | 3314 (list 1), 3315 (list 2) |
| Starts when | `phase-2-e2e-page-object` is merged (it brings `e2e/editor.ts` and `docs/briefs/edit-on-page/test-contract.md`), and F, G, H, I, J, K and L are merged into `phase-2-r3` |

This brief is run by two agents. You are told which list is yours. **List 1 goes first and owns the page object. List 2 starts when list 1's first milestone is merged.**

## Goal

About 85 browser tests drive today's editor through its form cards. Make them drive the new editor, so everything they protect (limits, publishing, pictures, graphs, drafts, teammates) is still protected. A test is migrated, not weakened.

## Read first

`docs/briefs/edit-on-page/test-contract.md` (what the tests rely on, and how many use each thing), `docs/decisions/0026-edit-on-page-editor.md` (the fields table and "What the page does not draw": where each thing went), `e2e/editor.ts` (the page object for the classic editor), `e2e/page-editor.ts` (G's page object for the new one: read it, do not edit it), and the new specs `e2e/editor-inplace.spec.ts` and `e2e/editor-topbar.spec.ts` for how the new editor is driven.

## You own

- **List 1:** `e2e/editor.ts`, `e2e/editor-classic-helpers.ts` (new), and the specs `e2e/phase2-editor.spec.ts`, `e2e/phase2-formats.spec.ts`, `e2e/phase2-editor-media.spec.ts`, `e2e/phase2-graphs.spec.ts`, `e2e/auto-figure.spec.ts`, `e2e/phase2-draft.spec.ts`.
- **List 2:** the specs `e2e/phase2-draft-tools.spec.ts`, `e2e/phase2-sections.spec.ts`, `e2e/phase2-polish-2.spec.ts`, `e2e/phase2-teammates.spec.ts`, `e2e/phase2-billing-polish.spec.ts`, `e2e/exhbt-page.spec.ts`, `e2e/file-ownership.spec.ts`, `e2e/phase2-saved-ideas.spec.ts`, and the editor parts of `e2e/a11y.spec.ts` and `e2e/responsive.spec.ts`. List 2 does not edit `e2e/editor.ts`: if a helper is missing or wrong, say so in a report and carry on with other tests.

## You must not touch

Any file that is not a test. `e2e/page-editor.ts` (G's), the new `e2e/editor-*.spec.ts` files (their owners'), `e2e/layout-*.spec.ts`, `e2e/golden/`, `playwright.config.ts`. If a test fails because the new editor is wrong, do not bend the test: report the failure with the test's name and what it expected.

## What you build against

The new editor's selectors, which its builders were told to keep exact:

| What | How to find it |
|---|---|
| The editor, ready | `[data-editor="page"][data-ready=true]` (classic: `[data-editor="classic"]`) |
| A field | `[data-path="<path>"]`, or by its name: `#title`, `#context`, `#whereWhen`, the textbox named "Context" (or "The brief", "Background"), "Box n", "Box n detail", "Finding n", "The quote, word for word", "Who said it", "Web address", `#image-N-alt`, `#skill-new`, `#summary` (in the card sheet) |
| A section | `[data-section-id="<id>"]`, with `data-kind`; its buttons "Drag <label> to move it", "Move <label> up", "Move <label> down", "Remove <label>" |
| The "+" at the end | `#add-section`; the words left: `data-testid="words-left"` |
| The page being edited | `article[data-exhbt-page]`, `article[data-format]`, `[data-part]` |
| The visitor's view | the button "See as a visitor", then the region "Preview" |
| The layout | the radiogroup "Layout", radios named by layout |
| The word bar | `[data-word-bar]`, `data-over` |
| The save status | "Saving…", "Saved", "Not saved. Retry" |
| Things to fix | the region "Things to fix before publishing" |
| Publishing | "Review and publish", then the tick "This is my work, and the numbers are true", "Publish" or "Publish changes", "It's live." or "Your changes are live." |
| Rewrite tools | `data-testid="tools-<block>"`, `data-testid="rewrites-left"`, "Rewrite this block", "Back to the AI version" |
| A graph's figures | "Edit figures", then the group "Graph N" in the sheet |
| The picture picker | the file input named "Choose an image" |

## Steps

Commit and push after each spec file.

**List 1, milestone 1 (report it at once when pushed, so list 2 can start):**

1. Move the helpers only the classic editor needs into `e2e/editor-classic-helpers.ts`, unchanged. If `e2e/editor-classic.spec.ts` or `e2e/editor-classic-keeps.spec.ts` imports a helper from `e2e/editor.ts`, point that import line at the new file. That one line is the only edit you may make to those two specs.
2. Rewrite `e2e/editor.ts` to drive the new editor: the `SEL` block first, then each helper, keeping every helper's name and arguments so specs change as little as possible. Where the page object for the new editor already has the thing (`openNew`, `field`, `frame`, `waitSaved`), call it. Helpers that meant a form card (`card`, `sectionsArea`, `listOrder`, `openCardMenu`) become their nearest meaning on the page: a section's frame, the page's main column, the order of frames, the "More actions" button on a part.
3. Make `e2e/phase2-editor.spec.ts` pass. That is milestone 1.

**Both lists, then:**

4. Take your specs one at a time. Run one, fix what the move broke, run it again. Inline selectors named in `test-contract.md` under "Not behind a helper" are changed in the spec.
5. **A test of something that still exists is migrated**, whatever it takes to reach the thing in the new editor (open a sheet, press "See as a visitor").
6. **A test of something that no longer exists is removed**, and every removal goes in your report with one line of why. The known ones: "Arrange sections" and "Done arranging" in the preview; the first-visit checklist; "the preview stays in view"; the flowchart card's wrapping row; the phone's Edit and Preview buttons; a card flagged as the heaviest when over the word cap. If you think another test belongs on this list, do not remove it: report it and leave it failing.
7. A test that checked the page in the classic editor's preview pane checks it in "See as a visitor", or on the editing page itself where the selector is the same (`[data-part]`, `article[data-format]`).
8. "In a gallery the page sets where each part goes" is no longer true: every layout is drawn in the doc's order (decision 0027). A test that asserted a fixed order regardless of the doc's order now asserts the usual order for a new or drafted exhbt, and that moving a section changes the page.

## Tests

Your specs are the tests. Run each of yours on your port. Do not run the others.

## Done looks like

Every spec on your list passes against the new editor with no `skip`, `fixme` or loosened assertion, apart from failures you have reported as the editor's fault. The count of tests removed is small and each has its reason.

## Report back

The branch head; a table of your specs: tests before, migrated, removed (each with its reason), failing and why; every place the new editor did not match the selectors table above; anything in `e2e/editor.ts` list 2 asked for.

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
