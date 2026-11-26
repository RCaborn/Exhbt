# Edit on the page: the build

Written 19 Nov 2026, revised the same day after three critics read it (the last section says what changed). This folder holds one brief per build agent for the edit-on-page editor and the four new layouts. The decisions are:

- `docs/decisions/0026-edit-on-page-editor.md`: the editor.
- `docs/decisions/0027-layout-engine.md`: how the page is drawn, the flowchart as a section, the reader release.
- `docs/decisions/0028-four-more-layouts.md`: Build, Essay, Before and after, Event or performance.
- `docs/decisions/0025-key-visual-from-the-work.md`: the key visual (release 1b, on `phase-2-key-visual` until it is merged).

Also in this folder: `drag-prototype.md` (what the prototype found, copied from `phase-2-lab`, which is never merged) and `test-contract.md` (what the browser tests rely on today, on `phase-2` since the page-object work was merged). `open-questions.md` is the list for Rory.

Each brief stands alone. An agent reads its own brief, the files that brief names, and nothing else here. The letters are names, not an order.

## The releases

| | Ships | For users | Gate |
|---|---|---|---|
| **1b** | The key visual from the work (decision 0025). Not part of this folder; release 2's branch carries it. | A report's own graph goes on the exhbt | Its own: the real-AI test (`eval-drafts`), which needs the GitHub secret `ANTHROPIC_API_KEY` |
| **2, the reader release** | The model for everything later releases write; the layout engine; one renderer for all layouts; the editing slots, unused; the classic editor keeping what it does not edit; the published copy keeping the flowchart's place; the server refusing to delete a file an exhbt uses; the editor switch, unused | Nothing changes | The parity gate (0027): every sample, every order fixture and every live published exhbt draws the same page, markup and boxes, before and after |
| **3, the editor** | The edit-on-page editor for everyone, with Case study, Gallery and Research. The old editor stays as "classic" | The new editor | The exact smoothness checks, the editing page matching the visitor's page box for box, the kill switch proven, the existing tests migrated and green, the parity gate run again on the live pages, the Worker's size measured, four reviews |
| **4, the four layouts** | Build, Essay, Before and after, Event or performance in the layout menu; the AI choosing among seven | Seven layouts | Each sample at or under the word cap and on one A4 page in all eight looks, or Rory's answer where one cannot fit; the smoothness checks on all seven; the real-AI routing eval |
| **5** | The classic editor deleted | Nothing changes | The classic switch unused since release 3; suite green without it |

Release 2 is what makes releases 3 and 4 safe to undo. The table in 0027 ("What the reader release ships") says what each rollback meets.

**Release 1b does not hold up release 2.** The main session makes `phase-2-r2` from `phase-2` with `phase-2-key-visual` and this design branch merged in, and release 2's agents start at once. Release 1b goes to the live site only once its real-AI test has passed. If the secret is still missing when release 2 is ready, the two go out together, still behind that test: release 2 does not go live without 1b's test either, because its branch carries 1b's code.

Each release goes the usual way: the release branch is merged into `phase-2`, CI runs, a pull request to `main`, live checks (`/api/health`, `/demo`, a page sweep). The main session does all of that. Agents never do.

## Branches

- The main session makes one branch per release: `phase-2-r2` from `phase-2` with `phase-2-key-visual` and this design branch merged in (above); then `phase-2-r3`, `phase-2-r4`, `phase-2-r5` from `phase-2`, each after the release before it is live.
- Each agent works on its own branch, made from the release branch at the moment it starts, so it has everything it waits for. The names are in the table below. A is the one exception: it may start on a branch from `phase-2-r2` once E is merged there, and is merged into `phase-2-r3` first thing.
- The main session merges an agent's branch into the release branch when its report is in and its named specs pass. An agent that waits for another starts only after that merge.
- If C's part 2 (the four new layouts' drawing) or D is late, release 2 ships without them, and they are merged into `phase-2-r3` before any release 3 agent's branch except A's is cut. Until then C keeps `app/globals.css` and the page parts, and nobody else edits them.

## Agents, order and what each waits for

At most two heavy (Opus) agents run at once. Rory, 19 Nov 2026: "Move to opus". Fable is no longer used: it kept hitting the account's usage limit. Sonnet agents may run beside them.

| | Brief | Model | Branch | Port | Starts when |
|---|---|---|---|---|---|
| B | `r2-b-model-engine.md` | Opus | `phase-2-r2-b-model` | 3301 | `phase-2-r2` exists (made with 1b and this design merged in; 1b need not be live) |
| C | `r2-c-renderer.md` | Opus | `phase-2-r2-c-renderer` | 3302 | B's milestone 1 is merged (the parity harness, the schema, `FORMAT_COPY` and `FORMAT_LIMITS`, the engine's reading half: B's steps 1 to 5, 2b and 6a); B's milestone 2 runs beside it, and C needs nothing from it |
| E | `r2-e-classic-editor.md` | Sonnet | `phase-2-r2-e-classic` | 3304 | C's part 1 and B's `restoreFlow` (B's step 6b) are merged (its tests look at the page the new renderer draws, and it calls `restoreFlow`) |
| D | `r2-d-samples.md` | Sonnet | `phase-2-r2-d-samples` | 3303 | C's part 2 is merged |
| A | `r3-a-gate.md` | Opus | `phase-2-r3-a-gate` | 3305 | E is merged into `phase-2-r2`. Merged into `phase-2-r3` before anyone else's branch |
| N, list 1, milestone 0 | `r3-n-test-migration.md` | Sonnet | `phase-2-r3-n-tests-1` | 3314 | A is merged into `phase-2-r3`. Short: points the old specs at `?editor=classic` |
| G | `r3-g-editor-core.md` | Opus | `phase-2-r3-g-core` | 3307 | A is merged into `phase-2-r3` |
| F | `r3-f-drag.md` | Opus | `phase-2-r3-f-drag` | 3306 | G's milestone 1 is merged |
| H | `r3-h-top-bar.md` | Sonnet | `phase-2-r3-h-topbar` | 3308 | G's milestone 1 is merged |
| I | `r3-i-sheets.md` | Sonnet | `phase-2-r3-i-sheets` | 3309 | G's milestone 1 is merged |
| K | `r3-k-flowchart.md` | Opus | `phase-2-r3-k-flow` | 3311 | G's milestone 1 is merged and a heavy slot is free (G's milestone 2 and F hold the two) |
| J | `r3-j-figures-and-images.md` | Opus | `phase-2-r3-j-figures` | 3310 | G's milestone 1 is merged and a heavy slot is free |
| L | `r3-l-phone.md` | Opus | `phase-2-r3-l-phone` | 3312 | G's milestone 1 is merged and a heavy slot is free; its touch-drag and tablet checks need F |
| N, the rest | `r3-n-test-migration.md` | Sonnet | `phase-2-r3-n-tests-1`, `-2` | 3314, 3315 | F, G, H, I, J, K and L are merged. List 2 when list 1's milestone 1 is merged |
| M | `r4-m-ai-and-layouts.md` | Opus | `phase-2-r4-m-ai` | 3313 | Release 3 is live; D's numbers are in; the GitHub secret `ANTHROPIC_API_KEY` is set |
| Q | `r4-q-new-layout-checks.md` | Sonnet | `phase-2-r4-q-checks` | 3317 | M is merged into `phase-2-r4` |
| P | `r5-p-remove-classic.md` | Sonnet | `phase-2-r5-p-remove` | 3316 | Release 4 is live and Rory agrees |

Heavy agents in order: B, then C (beside B's milestone 2), then A, then G, then F beside G's milestone 2, then K, J and L two at a time as slots free, then M. C works in two parts and release 2 can ship after part 1 if part 2 is late (0027).

Nobody waits on an interface that is not written down: every type and signature an agent builds against is in its brief, word for word the same as in the brief of the agent that builds the other side. (Checked by a script that compares every copy of each block.)

When something an agent waits for lands after it has started (F for L's touch-drag and tablet checks, G's milestone 2 for the file rule and the jump into popovers), the main session tells it, and it merges the release branch into its own.

## Who owns which files

No two agents edit the same file in the same release, with these stated hand-overs: in release 2, B makes its listed fixes in classic-editor files before E takes them over; in release 3, A hands every file it made to G when A is merged, and G makes stub files that their owners take over when G's milestone 1 is merged; N's milestone 0 may change one kind of line (the `/edit` address) in list 2's specs before list 2 starts.

### Release 2

| Agent | Owns |
|---|---|
| B | `lib/exhbt/blocks.ts`, `lib/exhbt/formats.ts`, `lib/exhbt/layouts.ts` (new), `lib/exhbt/sections.ts`, `lib/exhbt/verify.ts`, `lib/exhbt/headline.ts`, `lib/exhbt/draft-blocks.ts` (one field and `readAiVersion`), `lib/draft-tools.ts` (`loadAiVersion`), `app/api/exhbts/[id]/figure/route.ts` (keeping the graphs a figure replaces), `app/api/files/[id]/route.ts` (the `DELETE` guard), `app/dev/parity/` (new), `e2e/layout-parity.spec.ts` (new), `e2e/golden/` (new), `e2e/fixtures/order-docs.ts` (new), `e2e/fixtures/reader-before-r2.ts` (new), `e2e/layout-model.spec.ts` (new), `e2e/data-safety.spec.ts` (new), and the exhbt lines of `AGENTS.md` and `docs/MAP.md`. One-off, smallest-possible fixes, because B runs alone at first (measured with `tsc` and a search for `FORMATS`): `components/editor/Sections.tsx`, `components/editor/LayoutPicker.tsx`, `lib/ai/exhbt-draft.ts`, `lib/exhbt/drafted.ts`, `e2e/phase2-sections.spec.ts`, `e2e/phase2-formats.spec.ts`, `e2e/auto-figure.spec.ts` |
| C | `components/portfolio/ProjectView.tsx`, `components/portfolio/exhbt-parts.tsx`, `components/portfolio/LayoutMain.tsx` (new), `components/portfolio/layout-rows.ts` (new), `components/portfolio/page-ctx.ts` (new), `components/portfolio/formats/` (deleted), `components/portfolio/ImageZoom.tsx`, `components/portfolio/themeFonts.ts` and `lib/portfolio-themes.ts` (the error colour), `components/exhbt/MethodFlow.tsx`, `app/globals.css`, `app/dev/edit-slots/` (new), `e2e/edit-slots.spec.ts` (new), and the exhbt page paragraphs of `DESIGN.md` |
| E | `components/editor/` (all of it, after B's fixes are merged), `lib/portfolio-home.ts`, `lib/editor-kind.ts` (new, server only), `app/api/health/route.ts`, `app/dev/editor/` (new), `e2e/editor-classic-keeps.spec.ts` (new), `e2e/editor-switch.spec.ts` (new) |
| D | `lib/exhbt/sample.ts`, `app/dev/portfolio/route.ts`, `e2e/layouts-new.spec.ts` (new) |

D may not edit `app/globals.css`. If a sample will not fit, D reports the numbers and C or Rory acts on them. The main session owns `.github/workflows/ci.yml` in release 2: after B and C are merged it looks at the shards' times and raises the shard count if one passes 22 minutes.

### Release 3

| Agent | Owns |
|---|---|
| A (until merged; then G) | `app/(app)/exhbts/[id]/edit/page.tsx`, `app/(app)/exhbts/[id]/edit/error.tsx` (new), `components/exhbt-editor/EditorGate.tsx`, `EditorShell.tsx` (stub), `StandIn.tsx`, `context.ts` (the props type), `pending.ts` (stub), `playwright.config.ts`, `e2e/editor-classic.spec.ts` (new) |
| G | everything in `components/exhbt-editor/` that is not handed over below (`EditorGate.tsx`, `EditorShell.tsx`, `StandIn.tsx`, `store.ts`, `undo.ts`, `adapter.tsx`, `Frame.tsx`, `fields/`, `files.ts`, `jump.ts`, `pending.ts`, `context.ts`, `ui/`, `css/core.css` among them); A's other files from A's merge; `.github/workflows/ci.yml` (the e2e shards); `app/dev/editor-timing/` (new); `e2e/page-editor.ts` (new); `e2e/editor-inplace.spec.ts`, `e2e/editor-smooth.spec.ts` (new); `DESIGN.md`'s and the other docs' editor paragraphs; the page parts for slot fixes only (`components/portfolio/ProjectView.tsx`, `exhbt-parts.tsx`, `LayoutMain.tsx`, `layout-rows.ts`, `page-ctx.ts`) |
| F | `components/exhbt-editor/drag/`, `components/exhbt-editor/Insert.tsx`, `components/exhbt-editor/Tray.tsx`, `components/exhbt-editor/css/drag.css`, `e2e/editor-drag.spec.ts` (new), `scripts/editor-timing.mjs` (new) |
| K | `components/exhbt-editor/flow/`, `components/exhbt-editor/css/flow.css`, `components/exhbt/MethodFlow.tsx`, `e2e/editor-flow.spec.ts` (new) |
| H | `components/exhbt-editor/topbar/` (with `LayoutMenu.tsx`), `components/exhbt-editor/css/topbar.css`, `e2e/editor-topbar.spec.ts` (new) |
| I | `components/exhbt-editor/sheets/`, `components/exhbt-editor/css/sheets.css`, `e2e/editor-sheets.spec.ts` (new) |
| J | `components/exhbt-editor/figures/`, `components/exhbt-editor/css/figures.css`, `app/(app)/exhbts/[id]/figure-actions.ts` (new), `components/editor/PickedFigure.tsx` and `ChartEditor.tsx` (adding the word `export` only), `e2e/editor-figures.spec.ts` (new) |
| L | `components/exhbt-editor/phone/`, `components/exhbt-editor/css/phone.css`, `e2e/editor-phone.spec.ts` (new), `e2e/editor-tablet.spec.ts` (new) |
| N, list 1 | `e2e/editor.ts`, `e2e/editor-classic-helpers.ts` (new), and the specs in its brief's first list; in milestone 0 only, the `/edit` address lines of list 2's specs |
| N, list 2 | the specs in the brief's second list. It does not edit `e2e/editor.ts` |

Frozen in release 3 (nobody edits them): `components/editor/` (the classic editor and the parts the new one reuses) apart from J's added exports, `lib/exhbt/`, `lib/editor-kind.ts`, `app/globals.css`. The new editor's CSS lives in `components/exhbt-editor/css/`, one file per owner, each imported by its owner's own component.

A slot the page parts lack is G's to add. Another agent that needs one says so in its report; the main session passes it to G.

### Releases 4 and 5

| Agent | Owns |
|---|---|
| M | `lib/ai/exhbt-draft.ts`, `lib/exhbt/drafted.ts`, `lib/exhbt/references.ts`, `lib/exhbt/formats.ts` (`OFFERED_FORMATS` and wording), `app/api/exhbts/draft/route.ts`, `evals/exhbt-draft/`, `scripts/eval-drafts.ts`, `components/exhbt-editor/topbar/LayoutMenu.tsx`, `e2e/layouts-new.spec.ts`, the layout lines of `AGENTS.md` and `docs/MAP.md` |
| Q | `e2e/editor-smooth.spec.ts`, `e2e/editor-drag.spec.ts`, `e2e/editor-inplace.spec.ts`, `e2e/editor-flow.spec.ts` (adding cases only) |
| P | `components/editor/` (what it deletes), `lib/editor-kind.ts` and `lib/editor-kind-server.ts` (deleted), `app/(app)/exhbts/[id]/edit/page.tsx`, `error.tsx` and `TryNewEditor.tsx`, `app/api/exhbts/editor/`, `app/dev/editor/`, `app/api/health/route.ts`, `components/exhbt-editor/EditorGate.tsx` (the fallback), `components/exhbt-editor/context.ts` (taking in `EditorProps`), the menu item in `components/exhbt-editor/topbar/`, `e2e/editor-classic.spec.ts`, `e2e/editor-classic-helpers.ts`, `e2e/editor-classic-keeps.spec.ts`, `e2e/editor-switch.spec.ts`, `e2e/editor-admin-switch.spec.ts`, and the docs that mention the classic editor |

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

## How each release is verified

**Release 2.**
- `e2e/layout-model.spec.ts`: the model, `adopt` as a fixed point of today's pairing, `rowsFor` (forward wins), a removed flowchart, `restoreFlow` with and without a place, the published copy keeping the order, the AI version keeping its graphs (`readAiVersion`), the old reader.
- `e2e/layout-parity.spec.ts`: the parity gate, markup and boxes, against golden copies taken at B's first commits, before any product code changed, with fixed file ids and a fixed date. C runs it and may not edit it. The golden boxes are compared only in the environment that wrote them, the agents' sandbox Chromium; the main session runs it once more on a later day before C starts, in that same sandbox. CI compares the markup only.
- `e2e/edit-slots.spec.ts`: with a stand-in adapter, every field path in 0026's table is reachable on every layout, and a full page matches the read-only one box for box, but for the two edit-only fields 0026 keeps in the flow, allowed by name.
- `e2e/editor-classic-keeps.spec.ts`: the classic editor opens, edits and saves a doc with a marker, a removed flowchart and the new fields, loses none of them, and puts a flowchart back without losing the order.
- `e2e/data-safety.spec.ts`: the server will not delete a file a published copy uses; the AI version's graphs survive a real save and load.
- `e2e/editor-switch.spec.ts`: the switch and its development cookie.
- `e2e/layouts-new.spec.ts`: each new sample draws, with its word count and page count reported.
- The existing suite, unchanged, green in CI.
- The main session: the live-page comparison (0027, step 4), with the "before" drawn on `main`'s live commit, run on the day; and the switch on the preview site (below).

**Release 3.**
- `e2e/editor-inplace.spec.ts`: typing on the page, every kind of issue path landing on its target, undo (keeping typing and flags, and taking the marker out again), publishing an arranged doc in its order, the editing page against the visitor's page box for box (full pages: only the highlight's wrap, each image's description field and the "Add a skill" box; a new exhbt: only what is on `EDIT_ONLY_IN_FLOW`), the loading stand-in, axe in all eight looks.
- `e2e/editor-smooth.spec.ts` and `e2e/editor-drag.spec.ts`: the exact checks that gate CI (0026, "Smoothness"), on every offered layout.
- `e2e/editor-flow.spec.ts`, `editor-topbar`, `editor-sheets`, `editor-figures`, `editor-phone`, `editor-tablet`: each agent's own.
- `e2e/editor-classic.spec.ts`: the kill switch, the menu's escape and the crash fallback.
- `e2e/editor-admin-switch.spec.ts`: the new editor switched off for everyone, an admin's own switch, `EXHBT_EDITOR` both ways, and what `/api/health` reports.
- The existing editor tests: on the classic editor from A's merge (N's milestone 0), then migrated by N, green.
- The main session: the live-page parity comparison again (release 3 touches the page parts); before the pull request to `main`, `npx opennextjs-cloudflare build` and `npx wrangler deploy --dry-run` on `phase-2-r3`, recording the Worker's size against the limit (release 3 adds Tiptap, ProseMirror and dnd-kit behind the edit page; CI never builds the Worker).
- Frame timings from `scripts/editor-timing.mjs` on a production build with the processor slowed four times, with short recordings, sent to Rory. Reported, not gating.
- Four reviews, each finding checked by a sceptic before anyone acts on it: data safety (autosave, undo, files, two editors on one doc); accessibility; the look of it (seven layouts by eight looks, print, 390px, editing against visiting, against `DESIGN.md` as 0026 amends it); security (the new action and route, the dev-only pages, the timing harness's gate).
- Rory tries it on the live site on his phone.

**Release 4.** `e2e/layouts-new.spec.ts` complete (per layout: its rows, what it needs to publish, print, eight looks, the AI's choice with the stand-in); Q's run of the smoothness, drag, flowchart and box-for-box checks on all seven; `npm run eval:drafts` with the real model for seven-way routing.

**Release 5.** The suite without the classic specs; a search for `EXHBT_EDITOR`, `editorKind` and `DEFAULT_EDITOR` finds nothing; the `phase-2-lab` branch deleted and `/lab/editor` gone from the preview site.

**CI time.** Releases 2 to 4 add about a dozen specs, several of them matrices. Every agent reports how long each spec it wrote takes. G raises the e2e shards from 3 to 6 in release 3; the main session watches the shard times after each merge.

## The kill switch, and how it is tested

From 24 Nov 2026 the new editor was to go live switched off (Rory's decision; 0026, "Going live: switched off, then on"). It was switched on for everyone on 26 Nov 2026; setting `EXHBT_EDITOR=classic` on the Worker (named "terna" in Cloudflare) puts everyone back without a deploy. An admin can choose either editor for themselves. With the new editor on for everyone, these are the three ways back to the old one during releases 3 and 4 (0026 has the detail):

1. **For everyone, with no deploy:** set the variable `EXHBT_EDITOR` to `classic` on the live Worker in the Cloudflare dashboard. The rule is `lib/editor-kind.ts`, and `lib/editor-kind-server.ts` (server only) reads the variable on each request. Delete the variable to go back to the default. Set to `page`, the same variable switches the new editor on for everyone while the default is still the classic one.
2. **For one visit:** "Use the classic editor" in the editor's menu opens `/exhbts/<id>/edit?editor=classic`.
3. **By itself:** if the new editor throws, it sends what it can and reloads into the classic editor for that visit. The new editor is only ever drawn in the browser, inside the boundary that does this, because a boundary cannot catch a throw on the server.

`EXHBT_EDITOR` must not be listed under `vars` in `wrangler.jsonc` and must not be in `env` in `next.config.ts`. Listed in `wrangler.jsonc`, every deploy would set it back (as the comment there says of `EXHBT_PHASE2`). In `next.config.ts` it would be fixed when the site is built.

Tests:
- **In the suite** (E's `e2e/editor-switch.spec.ts` in release 2, A's `e2e/editor-classic.spec.ts` in release 3): a development-only page, `/dev/editor?kind=classic`, sets a cookie that stands in for the variable in development only, for that browser context alone, so a failed test cannot leave the switch set for the next; the edit page then serves the classic editor (`[data-editor="classic"]`), and `?kind=page` puts it back. `?editor=classic` serves classic for that request only. Development only: `?crash=render` makes the new editor throw the first time it draws, `?crash=change` after the first change, and `?crash=server` makes the page itself fail on the server. Each test sees the notice (or the route's error page), then the classic editor, and after `?crash=change` the words typed before the crash are still there. The suite's server runs with `EXHBT_EDITOR=page` (`playwright.config.ts`), so these specs and every other one get the new editor as people will once it is on for everyone. `e2e/editor-admin-switch.spec.ts` covers the rest: the switched-off default, an admin's own switch, the variable both ways and what `/api/health` reports, in the browser through the same cookie (`kind=default` is a variable that is not set) and by running the rule directly as the live site runs it.
- **On the preview site, in release 2.** The switch and the health line ship in release 2, so this is done before the editor exists. The signed-in editor cannot run on the preview site (its database has no Phase 2 tables), so the proof goes through `/api/health`, which reports `editor: "page"` or `"classic"`. The main session: sets `EXHBT_EDITOR=classic` on the `exhbt-preview` Worker in the dashboard; fetches `/api/health` until it says `classic` (reading `editor` from the JSON body, whatever the status), and notes how long that took; dispatches `deploy-preview.yml` and checks it still says `classic` afterwards (this proves `keep_vars` keeps a dashboard variable across a deploy); deletes the variable and checks for `page` (in release 2 the default was the new editor; it is the classic one now). If a deploy does wipe the variable, the fallback is to flip it and hold deploys, and that goes to Rory before release 3.
- **On the live site, at release 3:** `/api/health` said `classic` until the new editor was switched on for everyone (26 Nov 2026), and says `page` from then on. After that the switch is not flipped on live unless it is needed.

## Undoing a release

The main session does this; no agent does.

1. **At once:** `npx wrangler rollback` to the Worker version before the release (the fastest way: no build, no CI). Then check `/api/health` (and its `editor` line from release 2 on) and `/demo`, and open the one published exhbt.
2. **Then:** revert the release's merge on `main` and push, so the next deploy does not bring it back. Let CI run on the revert.
3. **Open editors must reload.** A tab opened before the rollback calls server actions the rolled-back Worker does not have. The new editor says "The editor was updated. Reload to carry on; your changes are kept in this browser." The classic editor (release 2 code) says "Not saved. Retry" and keeps its browser copy; after a reload it offers it back. Say so in any note to users.
4. **What each rollback meets** is 0027's table. Release 2's own rollback is safe because release 2 writes nothing today's code cannot read. For a bad release 3, the switch (`EXHBT_EDITOR=classic`) is the first step, before any rollback: it needs no deploy.

## Critique and what changed

Three critics (data and rollback; the editing experience; buildability) read the documents on 19 Nov 2026. Each blocker and major point, with what was done. "Accepted" means the documents now say what the line says, in the decision and in every brief it touches.

**Data**
- data-1 (blocker): accepted. `publicDoc` keeps the marker and `flowOff`, and empties `doc.flow` only when the flowchart is off (0027, "The published copy keeps the order"; B step 4); a model test over every fixture made arranged, and a browser test that publishes an arranged doc and reads the live page's order (G).
- data-2 (major): accepted. B, C, G, F and K run on Opus; the limit on heavy agents names Opus only.
- data-3 (major): accepted. B owns `lib/draft-tools.ts` in release 2 and `loadAiVersion` keeps `graphs`; a model test runs the rewrite path's load and save; J's test puts a rewrite between Remove and "Put it back".
- data-4 (major): accepted. B adds `restoreFlow`; "Put the flowchart back" in the classic editor calls it; E's test checks the other sections keep their order.
- data-5 (major): accepted. In release 2 the classic editor shows My role only on a doc that already has it or on an event (E, 0027, 0028). Whether the new editor offers it on every layout stays with Rory (question 6).
- data-6 (major): accepted. 0026 and G say what an undo entry holds: the structure before a structural action, and otherwise the before and after of exactly the fields and keys changed; flags come back as the union, limited to numbers on the page; `remove` never prunes them; each entry lists the files it could bring back. G tests rewrite, type, Undo.
- data-7 (major): accepted. The file check never runs on `visibilitychange` or a `pagehide` that keeps the page; G tests hide, show, Undo.
- data-8 (major): accepted. `DELETE /api/files/[id]` deletes nothing while any of the person's exhbts uses the file in either copy, from release 2 (B step 10, `e2e/data-safety.spec.ts`). It uses `listExhbts`, which already returns both copies, so no new `Store` method.

**Experience**
- experience-1 (blocker): accepted. 0026 now rules that edit-only controls take no room and lists, by name, the only edit-only things in the flow (the placeholders of empty parts). The description strip, the picked-figure label, "Web address", the aim switch, "Add a finding", "Add a skill" and issue messages are drawn over the part or in popovers. The list is one constant, `EDIT_ONLY_IN_FLOW`; box for box runs on full pages (nothing allowed) and on a sparse page (only the list). C, G, J, K and L changed to match; J's "allows this field's own height" is gone.
- experience-2 (major): accepted. The loading view is drawn with a static stand-in adapter that draws the same placeholders (A's `StandIn.tsx`); G tests the boxes before and after `data-ready`.
- experience-3 (major): accepted. Every issue path has an anchor, each in the brief that owns its element: the end "+" (`sections`, F), the word bar (`""`, H), the flowchart's list (`flow`, K), the skills and "Add a finding" (`skills`, `sections.N.items`, G), every frame (`sections.N`, G); `sections.N.chart` opens the chart sheet. G tests one issue of every path shape.
- experience-4 (major): accepted. H's button shows for numbers to check alone ("1 number to check"), in a list named "Numbers to check"; I adds the rows to the publish sheet and rewords the server's "at the top"; both test a complete draft with one flagged number.
- experience-5 (major): accepted, with build-8. A `tools` slot on the adapter puts a corner toolbar on the title, the context line and the skills, with `tools-header`, `tools-gap` and `tools-skills`; L's bar offers it on a phone.
- experience-6 (major): accepted in part. G draws `files.status` and errors in a status line at the foot of the window from the moment pictures are chosen, with tests for three files and a too-large one. An "Uploading…" slot on the page before the upload lands was not added: an image section needs its file id, and the status line answers the same need.
- experience-7 (major): accepted. Under `pointer: coarse`, at any width, the toolbar is always shown at 44px (G); a `tablet` project and `e2e/editor-tablet.spec.ts` (L); "Reorder sections" is in the top bar's menu on every screen (H).
- experience-8 (major): accepted, with build-13. "Put it back" shows only when no image has a picked graph or table (0026, J), tested both ways.
- experience-9 (major): accepted. `board.add("graph", at)` calls `ui.open("chart", id)`, written into the `Board` type in every brief; an empty chart shows "Add your numbers" over it (J).
- experience-10 (major): accepted. Every smoothness, drag, flowchart and box-for-box spec loops over `OFFERED_FORMATS` (`offered()` and `SAMPLES` in G's page object); a new Sonnet brief, Q, runs them on seven in release 4 and adds flicker cases for the new rows.
- experience-11 (major): accepted in part. The critic was wrong that `--xp-muted` is unchecked: it is the palette's `soft`, checked at 4.5 on the ground, cards and the well, so placeholders use it. The error colour was truly missing: C adds `error` to every look's palette, `--pf-error` and `--xp-error`, and three contrast pairs, in release 2. axe runs at rest on a blank and a full exhbt in all eight looks. A per-look error colour is put to Rory (question 10; question 11 is the overlays on pictures).
- experience-12 (major): accepted (as data-2).

**Build**
- build-1 (blocker): accepted (as data-2).
- build-2 (blocker): accepted. Forward wins when a pair could be read both ways (0027, `RowRule`'s comment in B and 0028); the two fixtures and their rows are written down; B checks `adopt` is a fixed point of today's pairing before anything else.
- build-3 (blocker): accepted. Every fixture is seeded through `POST /dev/parity` with name-based file ids and a fixed publish date; file ids are also normalised to their order, and the checked-on date to a token; a second run after a restart, and a run on a later day before C starts.
- build-4 (major): accepted, as a split into A (the edit page's switch, the gate, the stand-in, the error page, the test projects; short) and G (the editor), with G's milestone 1 narrowed to what the others call. The switch and the health line moved to release 2 (E), so the preview proof is done before the editor exists.
- build-5 (major): accepted. A adds the `touch` and `tablet` projects with their `testMatch`, and `desktop` ignores the phone and tablet specs.
- build-6 (major): accepted. N's milestone 0, straight after A's merge, points the old specs at `?editor=classic`; J's done line says `auto-figure.spec.ts` runs on classic until N migrates it.
- build-7 (major): accepted. E's spec opens `?editor=classic` from release 2.
- build-8 (major): accepted (as experience-5).
- build-9 (major): accepted (as experience-1). Box tests do not hide `[data-edit-only]`: hiding would mask a real shift; the two-fixture rule is used instead. "Nothing moves" for the loading swap now holds through the stand-in.
- build-10 (major): accepted. The store writes the browser copy (`writeBackup`, exported by E in release 2) and keeps the newest doc before notifying; the boundary awaits `flushPending()`.
- build-11 (major): accepted. The development override is a cookie read in `editorKind()`'s development branch; production reads only the variable.
- build-12 (major): accepted (as data-5).
- build-13 (major): accepted (as experience-8).
- build-14 (major): accepted. G raises the shards to 6 in release 3; the main session owns `ci.yml` in release 2; every agent reports its specs' times.
- build-15 (major): accepted. The parity gate compares boxes at 1440 and 412 as well as markup, and the live-page comparison runs again at release 3.
- build-16 (major): accepted. G adds `/dev/editor-timing`, sign-in-free, served in production only with `EXHBT_LAB=1`; F's script points at it.

**Minor points taken:** data-9 (`withKeyFigure` after the marker; 0027's line corrected), data-10 (Undo of the first structural change takes the marker out), data-11 (a fixed placeholder size for images with no `w` or `h`), data-12 (the stale-editor message and "open editors must reload" in "Undoing a release"), experience-13 (0026 amends `DESIGN.md` with the wording written out; "Review and publish" everywhere), experience-14 (Undo on the phone bar; Link asks for an address), experience-15 (a "full" line, words left in the tray, "Take a figure" dimmed not hidden), experience-16 (`LayoutMenu.tsx` named, short menu lines, the 390px check now), experience-17 (names for every "+", focus after Undo, formatting buttons clear of the toolbar), build-17 ("Undoing a release"), build-18 (the Worker's size before release 3), build-19 (file names lined up; `drag-prototype.md` copied in; N's page-object condition dropped; P owns `EditorGate.tsx`), build-20 (a late C part 2 keeps its files), build-21 (the lab's clean-up in release 5), build-22 (the mirror fallback and tray auto-scroll tests), build-23 (the live pages' "before" drawn on `main`'s live commit).

**Nothing rejected outright.** Two points were taken in part (experience-6, experience-11), with the reasons above. No critic asked to reverse one of Rory's decisions, so nothing went to `open-questions.md` on that ground; the new questions there (the error colour, the overlays on pictures) are choices this revision made.

**Found while revising:** a frame memoised on its page place would keep a stale stored index (and so stale field paths) when a kept section before it is removed; G's frame now reads its stored index from the store.

### Vision check and cold read (19 Nov 2026)

Two more reads, the same day. The first checked that the revision above kept the original design (commit 39a7d95): Rory asked that the designer's vision not be lost, and the revision had moved several things on the page behind overlays and popovers. The second read the release 2 briefs cold, as an agent starting on them would. Where a line here differs from one above (experience-1, experience-5, experience-7, build-11), this one is current.

**Vision check**
- vision-1 (must-fix): done. `restoreFlow(doc, at?)`: with a place the marker goes there, without one to the usual place. The "+" and the tray always pass their place (`insertBlock(doc, "flow", at)` is `restoreFlow(doc, at)`); only the classic editor's button calls it without one. 0027, every copy of the layouts block, B step 6b, G step 2, F step 5 and F's test (Flowchart from the "+" before the last section lands there).
- vision-2 (must-fix): done. The skills end with an "Add a skill" box (`skill-new`), always drawn in the flow, so on an empty exhbt it is the skills block's placeholder. It is on `EDIT_ONLY_IN_FLOW`; A's stand-in draws it inert; the box-for-box tests allow it by name; C draws the skills block in edit mode even with no skills. It left the shell toolbar, which keeps More actions, so 0026's field table and its chrome now agree.
- vision-3 (must-fix): done. An image's description is again a field under the picture and its caption, in the editor only, marked "Needs a description" until filled. It is on `EDIT_ONLY_IN_FLOW`, drawn inert by A's stand-in, and allowed by name in the full and sparse box-for-box tests (0026 now says once, in "How a box-for-box test allows them", what a test allows). Question 11 is reworded neutrally, with the strip over the picture as the other choice.
- vision-4: done. "Reorder sections" is in the top bar's menu only under `(pointer: coarse)`, and H tests that it is absent on the desktop project. L's tablet test is unchanged.
- vision-5: done. A new link opens its "Web address" popover with the cursor in it (through `board.add` and the jump); the button is always shown and marked while the address is missing. 0026, J, F, and the `Board` comment in every copy.
- vision-6: done. While the share tick is unticked, the picked-figure label holds it ("From your report, page 3 · [ ] I may share this"); Crop and Choose another page stay in the popover. 0026, J, N's field list.
- vision-7: done. "Add a finding" shows whenever the pointer or the focus is in the findings section, and always under `(pointer: coarse)`, in the gap below the last finding, covering no words. 0026, G step 4, C step 5.
- vision-8: done, as a contradiction. 0026's always-shown toolbar is for touch screens wider than 48rem; on a phone the grip-only rule and the bar apply, as L says. G step 6 says the same.
- vision-9: done, as a contradiction with `AGENTS.md` ("don't invent new colours"). C uses the app's error colour (#C92324) in every look where it passes 4.5:1, proposes a value only where it fails, and reports each one; 0026 and question 10 say so.
- vision-10: no change; the stand-in stays. Rory should be told that the loading view shows a new exhbt's grey placeholders, and now the description fields and the skill box.
- vision-11: no change. Issue messages stay in popovers.
- vision-12: no change beyond vision-2.
- vision-13: not taken. No document contradicts another (H already checks the row at 390px), so a test with "2 numbers to check" showing would be new scope.
- vision-14: done, as a contradiction: the status line and the phone bar would overlap. G gives the status line the class `xe-status`, L lifts it above the bar on a phone and tests it, and 0026 says so.
- vision-15: not taken. 0028's "one line on what it suits" is what `MENU_LINES` are, so nothing contradicts. The seven menu lines are new words, not yet in question 7.
- vision-16: done. 0026's wording for `DESIGN.md`: the flowchart section is carried with a line; a box inside it is carried with a line by default, which Rory has not yet confirmed (`FLOW_BOX_STYLE`, question 1).
- vision-17: not taken here, as no document contradicts another. Before release 3, Rory could try the new editor's drag beside `/lab/editor`, which stays on the preview site until release 5.

**Cold read of the release 2 briefs**
- cold-1 (must-fix): done. `editorKind()` lives in a new `lib/editor-kind.ts` whose first line is `import "server-only"`, and `lib/site.ts` is left alone. Changed in E (step 9, with a check in `next dev`, since `tsc` misses this), A, G, P, 0026, 0027, the kill switch section and the ownership tables.
- cold-2 (must-fix): done, with the shape provisional. B's step 2b writes `FORMAT_COPY`'s new fields (`quote`, `skills`, `refs`, `inLayout`), today's literals for the three layouts, and `FORMAT_LIMITS` for all seven. The block is word for word in B and C, and B reports the final type with milestone 1. 0028 says so.
- cold-3: done. `POST /dev/parity` takes `{ username, slug, doc, working?, publishedAt?, plan?, extraFiles? }`, with plan `max` by default and `publishedAt` set through `memorySnapshot()`, and returns `files`. B, E and the data-safety test use it.
- cold-4: done. B, E and G's `openDoc` sign in with `/auth/dev?email=…` after seeding, and never call `signInAs` or `/dev/portfolio`, which clear the seeded exhbt.
- cold-5: done. A pure `readAiVersion(raw)` in `lib/exhbt/draft-blocks.ts`, which `loadAiVersion` calls and the model test checks. The real round trip goes through `/dev/parity`'s `aiVersion` in `e2e/data-safety.spec.ts`.
- cold-6: done. `e2e/auto-figure.spec.ts` (line 143: iterate `OFFERED_FORMATS`) is in B's named fixes and the README's B row.
- cold-7: done. `Need` gains `{ need: "results"; message: string }` in every copy (B, D, E, M). Research's figure cap stays a check of its own, in today's order of messages.
- cold-8: done. B's milestone 1 is steps 1 to 5, 2b and 6a, with step 1 pushed in four parts and the golden files pushed before any product code. Milestone 2 starts with `restoreFlow`, which E waits for. The agents table, C and E say so.
- cold-9: done. `BlockOption.name` is the noun in the layout's own words; the reasons name the layout with `FORMAT_COPY[f].inLayout`; `insertBlock(doc, "flow", at)` is `restoreFlow(doc, at)`, or null when the flowchart is on the page.
- cold-10: done. E's switch spec reads `editor` from the JSON body whatever the status, and may add `?only=editor`. The preview check above reads the body too.
- cold-11: done. B writes the expected runs by hand from `runsOf`, and rebuilds the five and six box docs from `app/dev/portfolio/route.ts`. 0027's fixture list says where they come from.
- cold-12: done. E starts after C's part 1 and B's `restoreFlow`, in its brief and in the agents table; "B's milestone 2 for C" is gone from the line on late arrivals.
- cold-13: done. B's step 2 notes `Widen` and booleans, the pull quote in `oneOf`, and narrowing with `isContent`.
- cold-14: done. B copies the old per-kind schemas from the base commit and builds the old union from the copies, beside `normaliseDoc` and `FORMATS`.
- cold-15: done. C step 3: a lone flowchart is drawn as `ctx.format`'s page draws it today, checked by the "gallery with no findings" and "research with no figure" fixtures.
- cold-16: done. D seeds with `plan=max`.
- cold-17: done. The golden boxes are compared only in the environment that wrote them, the agents' sandbox Chromium, and the main session's later re-run uses that sandbox. In CI the spec compares markup only. 0027, B, C and this README.

**Found while revising**
- C's slot harness drew `skills` as an empty element, while its box test compared each pill. It now draws the pills and the "Add a skill" box.
- The link's "Web address" slot is now `where: "over"`, so `"below"` means only an image's description, in the flow. C, J, the plug table and the `ExtraSlot` comment agree.
