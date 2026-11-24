# Brief P: delete the classic editor

| | |
|---|---|
| Release | 5 |
| Model | Sonnet |
| Branch | `phase-2-r5-p-remove`, made from `phase-2-r5` |
| Port | 3316 |
| Starts when | Release 4 is live, the classic switch has not been needed since release 3, and Rory has agreed |

## Goal

Remove the old card editor and the switch to it, now that the edit-on-page editor has run for two releases. Nothing a person sees changes.

## Read first

`docs/decisions/0026-edit-on-page-editor.md` ("The classic editor: the switch, the fallback, the escape"). Then `components/editor/` (every file: some are the classic editor, some are parts the new editor imports), `app/(app)/exhbts/[id]/edit/page.tsx`, `lib/editor-kind.ts`, `components/exhbt-editor/` (search it for imports from `@/components/editor/`).

## You own

In this release, all of: `components/editor/`, `lib/editor-kind.ts`, `app/(app)/exhbts/[id]/edit/page.tsx` and `error.tsx`, `app/dev/editor/`, `app/api/health/route.ts`, `components/exhbt-editor/EditorGate.tsx` (the fallback), `components/exhbt-editor/topbar/` (the menu item only), `components/exhbt-editor/context.ts` (to take in `EditorProps`), `e2e/editor-classic.spec.ts`, `e2e/editor-classic-keeps.spec.ts`, `e2e/editor-switch.spec.ts`, `e2e/editor-classic-helpers.ts`, and the paragraphs of `DESIGN.md`, `docs/MAP.md`, `HANDOFF.md`, `AGENTS.md` and `docs/briefs/edit-on-page/README.md` that mention the classic editor.

## You must not touch

`lib/exhbt/` (the model keeps reading every doc ever stored, marker or not), the renderer, the server actions, any other test.

## Steps

Commit and push after each.

1. **List what the new editor still imports from `components/editor/`.** Expect: `useAutosave.ts`, `media.ts`, `model.ts`, `ChartEditor.tsx`, `PickedFigure.tsx`, `BlockTools.tsx`, `ConfirmAction.tsx`, `FieldIssues.tsx`, perhaps `parts.tsx` and `SkillsInput.tsx`, and `RichTextField.tsx` if the link prompt still borrows from it. Those stay where they are, with their names.
2. **Delete the rest:** `Editor.tsx`, `Sections.tsx`, `PreviewArrange.tsx`, `Checklist.tsx`, `LayoutPicker.tsx`, `FlowEditor.tsx`, `RichTextField.tsx` if nothing imports it, and anything else only they used. `EditorProps` is imported by the new editor from `Editor.tsx`: move that type into `components/exhbt-editor/context.ts` first.
3. **Remove the switch:** delete `lib/editor-kind.ts` (`editorKind` and its development override); `app/dev/editor/`; the `editor` line from `/api/health`; the `?editor=classic` branch and the "You're in the classic editor" line from the edit page; "Use the classic editor" from the menu.
4. **The crash fallback** (`EditorGate.tsx`) can no longer reload into another editor. The error boundary stays: it shows "Something went wrong. Your work is saved." and a button, "Reload", once `flushPending()` has settled. `error.tsx` loses its link to the classic editor and keeps "Reload".
5. **`sectionsSlot`** on `ProjectView` was for "Arrange sections". If nothing passes it now, say so in your report; removing it is the renderer's change, not yours.
6. **Tests:** delete the four classic test files (`editor-classic`, `editor-classic-keeps`, `editor-switch`, `editor-classic-helpers`). Search `e2e/` for `data-editor="classic"`, `editor=classic` and `/dev/editor` (but not `/dev/editor-timing`, which stays): nothing should be left.
7. **Docs:** take the classic editor out of the paragraphs listed above. The decision records are history and are not edited.

## Tests

Nothing new. Run: `e2e/editor-inplace.spec.ts`, `e2e/editor-topbar.spec.ts`, `e2e/editor-sheets.spec.ts`, `e2e/editor-figures.spec.ts`, `e2e/phase2-editor.spec.ts`, `e2e/phase2-draft-tools.spec.ts`.

## Done looks like

The four checks pass; a search of the repo outside `docs/decisions/` and `docs/briefs/` for `EXHBT_EDITOR`, `editorKind` and "classic editor" finds nothing; the named specs pass.

## Report back

The branch head; the files deleted and the files kept in `components/editor/`; anything that still passed `sectionsSlot`; the reminder for the main session to delete the `EXHBT_EDITOR` variable from the Workers' dashboards if it was ever set, to delete the `phase-2-lab` branch (its report is in the tree since the design, as `docs/briefs/edit-on-page/drag-prototype.md`), and to check that `/lab/editor` answers 404 on the preview site after the next `phase-2` deploy.

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
