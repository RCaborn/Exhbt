# Milestone 0: old specs kept on the classic editor

Brief N, list 1, 20 Nov 2026. Branch `phase-2-r3-n-tests-1`, desktop project, one worker, port 3314.

How: `keepClassic(page)` in `e2e/editor.ts` sets the `/dev/editor?kind=classic` cookie. The shared helpers `signInAs`, `signInToDraft` and `draftAndOpen` call it, and every spec on both lists has `test.beforeEach(({ page }) => keepClassic(page))` (the only edit made to each spec; no assertion changed). Extra browser contexts that sign in through `signInAs` get the cookie from it.

The baseline (`origin/phase-2-r2`, no gate) was not re-run: memory in the sandbox was too tight. Before the gate every test in these specs passed, so the "tests" column is the expected count.

| Spec | Tests | Passing on classic | Note |
|---|---|---|---|
| phase2-editor | 10 | 10 | one earlier run was a browser crash and one a save timeout under load; both passed alone |
| auto-figure | 32 | 32 | |
| phase2-draft | 11 | 11 | |
| phase2-formats | 81 | 81 | first run 77, four killed by memory (page crash, ECONNRESET); the four passed alone |
| phase2-editor-media | 15 | 15 | |
| phase2-graphs | 16 | 16 | |
| phase2-draft-tools | 11 | 11 | |
| phase2-sections | 15 | 15 | one failed once on ECONNRESET and once on a 90 s timeout while compiling cold; passes alone in 54 s |
| phase2-polish-2 | 13 | 13 | the Free photo test failed on a server reset, passed alone |
| phase2-teammates | 7 | 7 | first run 4 of 7 under memory pressure; 7 of 7 on re-run |
| phase2-billing-polish | 7 | 7 | |
| exhbt-page | 16 | 16 | |
| file-ownership | 1 | 1 | |
| phase2-saved-ideas | 7 | 7 | |

`npm run check:theme` cannot run in this sandbox (the Astryx CLI is not installed); no theme file changed.
