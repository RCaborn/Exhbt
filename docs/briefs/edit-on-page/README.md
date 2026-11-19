# Edit on the page: the build

Written 19 Nov 2026. This folder holds one brief per build agent for the edit-on-page editor and the four new layouts. The decisions are:

- `docs/decisions/0026-edit-on-page-editor.md`: the editor.
- `docs/decisions/0027-layout-engine.md`: how the page is drawn, the flowchart as a section, the reader release.
- `docs/decisions/0028-four-more-layouts.md`: Build, Essay, Before and after, Event or performance.
- `docs/decisions/0025-key-visual-from-the-work.md`: the key visual (release 1b, on `phase-2-key-visual` until it is merged).

Also in this folder once their branches are merged: `drag-prototype.md` (what the prototype found, from `phase-2-lab`) and `test-contract.md` (what the browser tests rely on today, from `phase-2-e2e-page-object`). `open-questions.md` is the list for Rory.

Each brief stands alone. An agent reads its own brief, the files that brief names, and nothing else here.

## The releases

| | Ships | For users | Gate |
|---|---|---|---|
| **1b** | The key visual from the work (decision 0025). Not part of this folder; release 2 starts from it. | A report's own graph goes on the exhbt | Its own: the real-AI test |
| **2, the reader release** | The model for everything later releases write; the layout engine; one renderer for all layouts; the editing slots, unused; the classic editor keeping what it does not edit | Nothing changes | The parity gate (0027): every sample, every order fixture and every live published exhbt draws the same page before and after |
| **3, the editor** | The edit-on-page editor for everyone, with Case study, Gallery and Research. The old editor stays as "classic" | The new editor | The exact smoothness checks, the editing page matching the visitor's page box for box, the kill switch proven, the existing tests migrated and green, four reviews |
| **4, the four layouts** | Build, Essay, Before and after, Event or performance in the layout menu; the AI choosing among seven | Seven layouts | Each sample at or under the word cap and on one A4 page in all eight looks, or Rory's answer where one cannot fit; the real-AI routing eval |
| **5** | The classic editor deleted | Nothing changes | The classic switch unused since release 3; suite green without it |

Release 2 is what makes releases 3 and 4 safe to undo. The table in 0027 ("What the reader release ships") says what each rollback meets.

Each release goes the usual way: the release branch is merged into `phase-2`, CI runs, a pull request to `main`, live checks (`/api/health`, `/demo`, a page sweep). The main session does all of that. Agents never do.

## Branches

- The main session makes one branch per release from `phase-2`: `phase-2-r2` (after release 1b is in `phase-2` and this design branch is merged), then `phase-2-r3`, `phase-2-r4`, `phase-2-r5`, each after the release before it is live.
- Each agent works on its own branch, made from the release branch at the moment it starts, so it has everything it waits for. The names are in the table below.
- The main session merges an agent's branch into the release branch when its report is in and its named specs pass. An agent that waits for another starts only after that merge.

## Agents, order and what each waits for

At most two heavy agents (Fable or Opus) run at once. Sonnet agents may run beside them.

| | Brief | Model | Branch | Port | Starts when |
|---|---|---|---|---|---|
| B | `r2-b-model-engine.md` | Fable | `phase-2-r2-b-model` | 3301 | `phase-2-r2` exists and has `withWorkVisual` (release 1b) |
| C | `r2-c-renderer.md` | Fable | `phase-2-r2-c-renderer` | 3302 | B is merged |
| E | `r2-e-classic-editor.md` | Sonnet | `phase-2-r2-e-classic` | 3304 | B is merged (beside C) |
| D | `r2-d-samples.md` | Sonnet | `phase-2-r2-d-samples` | 3303 | C's part 2 is merged |
| G | `r3-g-editor-core.md` | Fable | `phase-2-r3-g-core` | 3307 | Release 2 is live |
| F | `r3-f-drag.md` | Fable | `phase-2-r3-f-drag` | 3306 | G's first milestone is merged |
| K | `r3-k-flowchart.md` | Fable | `phase-2-r3-k-flow` | 3311 | G's first milestone is merged |
| H | `r3-h-top-bar.md` | Sonnet | `phase-2-r3-h-topbar` | 3308 | G's first milestone is merged |
| I | `r3-i-sheets.md` | Sonnet | `phase-2-r3-i-sheets` | 3309 | G's first milestone is merged |
| J | `r3-j-figures-and-images.md` | Opus | `phase-2-r3-j-figures` | 3310 | G's first milestone is merged |
| L | `r3-l-phone.md` | Opus | `phase-2-r3-l-phone` | 3312 | G's first milestone is merged; its touch-drag checks need F |
| N | `r3-n-test-migration.md` | Sonnet | `phase-2-r3-n-tests-1`, `-2` | 3314, 3315 | `phase-2-e2e-page-object` is merged, and F to L are merged |
| M | `r4-m-ai-and-layouts.md` | Opus | `phase-2-r4-m-ai` | 3313 | Release 3 is live; D's numbers are in; the GitHub secret `ANTHROPIC_API_KEY` is set |
| P | `r5-p-remove-classic.md` | Sonnet | `phase-2-r5-p-remove` | 3316 | Release 4 is live and Rory agrees |

Heavy agents in order: B, then C, then G, then F with K, then J with L, then M. C works in two parts and release 2 can ship after part 1 if part 2 is late (0027).

Nobody waits on an interface that is not written down: every type and signature an agent builds against is in its brief, word for word the same as in the brief of the agent that builds the other side.

## Who owns which files

No two agents edit the same file in the same release, with one stated hand-over in release 3 (G makes stub files and their owners take them over when G's first milestone is merged).

### Release 2

| Agent | Owns |
|---|---|
| B | `lib/exhbt/blocks.ts`, `lib/exhbt/formats.ts`, `lib/exhbt/layouts.ts` (new), `lib/exhbt/sections.ts`, `lib/exhbt/verify.ts`, `app/dev/parity/` (new), `e2e/layout-parity.spec.ts` (new), `e2e/golden/` (new), `e2e/fixtures/order-docs.ts` (new), `e2e/fixtures/reader-before-r2.ts` (new), `e2e/layout-model.spec.ts` (new), and the exhbt lines of `AGENTS.md` and `docs/MAP.md`. One-off, smallest-possible compile fixes, because B runs alone: `components/editor/Sections.tsx`, `components/editor/LayoutPicker.tsx`, `lib/ai/exhbt-draft.ts`, `e2e/phase2-sections.spec.ts` |
| C | `components/portfolio/ProjectView.tsx`, `components/portfolio/exhbt-parts.tsx`, `components/portfolio/LayoutMain.tsx` (new), `components/portfolio/layout-rows.ts` (new), `components/portfolio/page-ctx.ts` (new), `components/portfolio/formats/` (deleted), `components/portfolio/ImageZoom.tsx`, `components/exhbt/MethodFlow.tsx`, `app/globals.css`, `app/dev/edit-slots/` (new), `e2e/edit-slots.spec.ts` (new), and the exhbt page paragraphs of `DESIGN.md` |
| E | `components/editor/` (all of it, after B's two fixes are merged), `lib/portfolio-home.ts`, `e2e/editor-classic-keeps.spec.ts` (new) |
| D | `lib/exhbt/sample.ts`, `app/dev/portfolio/route.ts`, `e2e/layouts-new.spec.ts` (new) |

D may not edit `app/globals.css`. If a sample will not fit, D reports the numbers and C or Rory acts on them.

### Release 3

| Agent | Owns |
|---|---|
| G | `components/exhbt-editor/` as first made, then everything in it that is not handed over below; `lib/site.ts`; `app/(app)/exhbts/[id]/edit/page.tsx`; `app/api/health/route.ts`; `app/dev/editor/` (new); `playwright.config.ts`; `e2e/page-editor.ts` (new); `e2e/editor-inplace.spec.ts`, `e2e/editor-smooth.spec.ts`, `e2e/editor-classic.spec.ts` (new); the page parts for slot fixes only (`components/portfolio/ProjectView.tsx`, `exhbt-parts.tsx`, `LayoutMain.tsx`, `layout-rows.ts`, `page-ctx.ts`); the editor paragraphs of `DESIGN.md`, `docs/MAP.md`, `HANDOFF.md`, `AGENTS.md` |
| F | `components/exhbt-editor/drag/`, `components/exhbt-editor/Insert.tsx`, `components/exhbt-editor/Tray.tsx`, `components/exhbt-editor/css/drag.css`, `e2e/editor-drag.spec.ts` (new), `scripts/editor-timing.mjs` (new) |
| K | `components/exhbt-editor/flow/`, `components/exhbt-editor/css/flow.css`, `components/exhbt/MethodFlow.tsx`, `e2e/editor-flow.spec.ts` (new) |
| H | `components/exhbt-editor/topbar/`, `components/exhbt-editor/css/topbar.css`, `e2e/editor-topbar.spec.ts` (new) |
| I | `components/exhbt-editor/sheets/`, `components/exhbt-editor/css/sheets.css`, `e2e/editor-sheets.spec.ts` (new) |
| J | `components/exhbt-editor/figures/`, `components/exhbt-editor/css/figures.css`, `app/(app)/exhbts/[id]/figure-actions.ts` (new), `app/api/exhbts/[id]/figure/route.ts`, `lib/exhbt/draft-blocks.ts` (the `graphs` field only), `e2e/editor-figures.spec.ts` (new) |
| L | `components/exhbt-editor/phone/`, `components/exhbt-editor/css/phone.css`, `e2e/editor-phone.spec.ts` (new) |
| N | `e2e/editor.ts`, `e2e/editor-classic-helpers.ts` (new), and the existing specs in its brief's two lists |

Frozen in release 3 (nobody edits them): `components/editor/` (the classic editor and the parts the new one reuses), `lib/exhbt/` apart from J's one field, `app/globals.css`. The new editor's CSS lives in `components/exhbt-editor/css/`, one file per owner, each imported by its owner's own component.

A slot the page parts lack is G's to add. Another agent that needs one says so in its report; the main session passes it to G.

### Releases 4 and 5

| Agent | Owns |
|---|---|
| M | `lib/ai/exhbt-draft.ts`, `lib/exhbt/drafted.ts`, `lib/exhbt/references.ts`, `lib/exhbt/formats.ts` (`OFFERED_FORMATS` and wording), `app/api/exhbts/draft/route.ts`, `evals/exhbt-draft/`, `scripts/eval-drafts.ts`, `components/exhbt-editor/topbar/LayoutMenu.tsx`, `e2e/layouts-new.spec.ts`, the layout lines of `AGENTS.md` and `docs/MAP.md` |
| P | What it deletes in `components/editor/`, `lib/site.ts`, `app/(app)/exhbts/[id]/edit/page.tsx`, `app/dev/editor/`, `e2e/editor-classic.spec.ts`, `e2e/editor-classic-helpers.ts`, `e2e/editor-classic-keeps.spec.ts`, and the docs that mention the classic editor |

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `phase-2`, `main` or a release branch (`phase-2-r2`, `phase-2-r3`, `phase-2-r4`, `phase-2-r5`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip or delete a test to make it pass.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with your own attribution lines, then the line `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`.
8. **House rules that bite here:** colours and corners on the exhbt page come only from the `--xp-*` variables; buttons in app chrome are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose; Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.

## How each release is verified

**Release 2.**
- `e2e/layout-model.spec.ts`: the model, `adopt`, `rowsFor`, a removed flowchart, the old reader.
- `e2e/layout-parity.spec.ts`: the parity gate, against golden copies taken at B's first commit, before any product code changed. C runs it and may not edit it.
- `e2e/edit-slots.spec.ts`: with a stand-in adapter, every field path in 0026's table is reachable on every layout.
- `e2e/editor-classic-keeps.spec.ts`: the classic editor opens, edits and saves a doc with a marker, a removed flowchart and the new fields, and loses none of them.
- `e2e/layouts-new.spec.ts`: each new sample draws, with its word count and page count reported.
- The existing suite, unchanged, green in CI.
- The main session: the live-page comparison (0027, step 4), run again on the day.

**Release 3.**
- `e2e/editor-inplace.spec.ts`: typing on the page, the exact field for each issue, undo, the editing page against the visitor's page box for box (1440 wide and a Pixel 7; the Exhbt, Classic and Night looks), axe.
- `e2e/editor-smooth.spec.ts` and `e2e/editor-drag.spec.ts`: the exact checks that gate CI (0026, "Smoothness").
- `e2e/editor-flow.spec.ts`, `editor-topbar`, `editor-sheets`, `editor-figures`, `editor-phone`: each agent's own.
- `e2e/editor-classic.spec.ts`: the kill switch, the menu's escape and the crash fallback.
- The existing editor tests, migrated by N, green.
- Frame timings from `scripts/editor-timing.mjs` on a production build with the processor slowed four times, with short recordings, sent to Rory. Reported, not gating.
- Four reviews, each finding checked by a sceptic before anyone acts on it: data safety (autosave, undo, files, two editors on one doc); accessibility; the look of it (seven layouts by eight looks, print, 390px, editing against visiting); security (the new action and route, the dev-only pages).
- Rory tries it on the live site on his phone.

**Release 4.** `e2e/layouts-new.spec.ts` complete (per layout: its rows, what it needs to publish, print, eight looks, the AI's choice with the stand-in); `npm run eval:drafts` with the real model for seven-way routing.

**Release 5.** The suite without the classic specs; a search for `EXHBT_EDITOR` and `editorKind` finds nothing.

## The kill switch, and how it is tested

Three ways back to the old editor during release 3 and 4 (0026 has the detail):

1. **For everyone, with no deploy:** set the variable `EXHBT_EDITOR` to `classic` on the live Worker in the Cloudflare dashboard. `editorKind()` in `lib/site.ts` reads it on each request. Delete the variable to go back.
2. **For one visit:** "Use the classic editor" in the editor's menu opens `/exhbts/<id>/edit?editor=classic`.
3. **By itself:** if the new editor throws, it saves what it can and reloads into the classic editor for that visit.

`EXHBT_EDITOR` must not be listed under `vars` in `wrangler.jsonc` and must not be in `env` in `next.config.ts`. Listed in `wrangler.jsonc`, every deploy would set it back (as the comment there says of `EXHBT_PHASE2`). In `next.config.ts` it would be fixed when the site is built.

Tests:
- **In the suite** (`e2e/editor-classic.spec.ts`, G): a development-only page, `/dev/editor?kind=classic`, sets what `editorKind()` returns for the test server; the edit page then serves the classic editor (`[data-editor="classic"]`), and `?kind=page` puts it back. `?editor=classic` serves classic for that request only. `?crash=1`, development only, makes the new editor throw: the test sees the notice, then the classic editor, with the words typed before the crash still there.
- **On the preview site, before release 3.** The signed-in editor cannot run there (its database has no Phase 2 tables), so the proof goes through `/api/health`, which reports `editor: "page"` or `"classic"`. The main session: sets `EXHBT_EDITOR=classic` on the `exhbt-preview` Worker in the dashboard; fetches `/api/health` until it says `classic`, and notes how long that took; dispatches `deploy-preview.yml` and checks it still says `classic` afterwards (this proves `keep_vars` keeps a dashboard variable across a deploy); deletes the variable and checks for `page`.
- **On the live site, at release 3:** `/api/health` says `page`. The switch is not flipped on live unless it is needed.

If the preview test shows a deploy does wipe the variable, the fallback is to flip it and hold deploys, and the brief for G says to report that at once.
