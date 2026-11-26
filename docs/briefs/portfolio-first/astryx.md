# Astryx is the design guide: what it changes in briefs E to K

Rory, 26 Nov 2026, after these briefs were written: "you must use astryx as the design guide! Currently the entire site is lacking the strong UI feel it needs!" and "The site is good right now... it could be GREAT." **Where this file and a brief disagree, this file wins.**

## The rule

Astryx (`@astryxdesign/core`, Meta's open-source design system) is installed with an Exhbt theme (`themes/exhbt/exhbtTheme.ts`). Until now only buttons used it.

1. **Read before you build any control.** `npm run astryx -- docs principles --dense`. Find what you need with `npm run astryx -- search "<what you need>"`, and read each component you use with `npm run astryx -- component <Name> --dense`. If `docs/design/astryx-agent-guide.md` is in your branch, read that too.
2. **Every control in the portfolio editor's chrome is an Astryx component.** The bar along the top, its menus and buttons, sheets and panels, popovers, tooltips, notices, the first-run strip, the "More" sheet on a phone, confirmations and toasts. Look at `Toolbar`, `IconButton`, `ToggleButton`, `DropdownMenu`, `Popover`, `Tooltip`, `Dialog`, `AlertDialog`, `Drawer`, `BottomSheet`, `Banner`, `Toast`, `Stepper`, `SegmentedControl`, `Field`, `TextInput`, `Skeleton` and `EmptyState`. Never hand-build a control Astryx has, and never copy the exhbt editor's hand-built toolbar, sheet or menu. If Astryx lacks something, build the smallest thing from its tokens and say so in your report.
3. **Tokens only in chrome:** no hard-coded colours, spacing, radii, shadows or timings. Motion uses Astryx's motion tokens and is off under reduced motion.
4. **The page itself is not Astryx.** The portfolio a person edits is their own page in their look, drawn by `PortfolioHome` from the `--pf-*` variables. Fields typed on the page, the frames round sections and tiles, and anything else that sits in the page's flow belong to the page and take the look's variables. The exhbt editor's field code (`InlineText`, `RichField`) is page code, not chrome: reuse it as the briefs say.
5. **Stubs follow the same rule.** Where E leaves a stub for F, G or I, the stub is already an Astryx component in the right place, so nobody has to replace hand-built chrome later.
6. **A press target is at least 44px under a finger.** Check Astryx's sizes; do not shrink them.

## What "great" means here

- A stranger must be able to tell what each screen is for, what to do now and what happens next. Rory: "it is not obvious what we do or how we help... that should be considered as we design to limit confusion and help sell the product and continuation to building portfolios and exhbts." The first-run strip, the empty band and every empty state do this work: write their words with care, in plain British English, with nothing claimed that is not true.
- Build it, look at it in the browser at 1440 and at 390 (take screenshots and read them), and improve what looks rough before you report. Save two or three screenshots (deviceScaleFactor 2) to `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/portfolio-editor/` and name them in your report.

## The deadline

Rory needs the whole site proud and shippable by **Wednesday 2 Dec**. The portfolio editor and the page-flow changes are two of his four main goals. So:
- Reach each milestone as early as you can and push it; the main session merges milestones as they land so the next agents can start.
- If something in a brief is optional or can follow later, leave it out, list it in your report, and keep going.
- A design plan for the whole site is being written on branch `phase-2-appeal-plan` (decision 0033). If the main session sends you changes from it, they are small adjustments to chrome, not a restart.

## The shared machine

Many agents share one 4-core machine with 15 GB of memory, and it has been running out: browser tests crash with "Page crashed", "Target crashed" or `ERR_ABORTED` when it does. So:
- Run one spec file at a time, one worker, and stop your dev server when you are not testing.
- A test that fails with one of those errors is re-run once on its own before you treat it as a failure.
- Do the reading and the writing first; test in bursts.

## Models named in the briefs

Briefs name Opus or Sonnet. The main session may run a brief on Fable. Sign your commits with the model you are: the `Co-Authored-By` line names your own model, and the `Claude-Session` line stays as written.
