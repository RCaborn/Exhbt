# Figure eval

When an exhbt is drafted from a PDF, the AI picks the one figure in it that best shows the result, and the app cuts it out (`docs/decisions/0017-auto-figure.md`, `0025-key-visual-from-the-work.md`). This eval measures that pick with the real model on fourteen made-up reports: does it choose the right page, say the right kind, and give a box that holds the whole figure and little else?

It measures. It doesn't change the prompt or anything the app does.

## What's here

- `fixtures/`: fourteen reports as PDFs, and `cases.json`, the answer key. `build.mjs` makes both.
- `grade.ts`: the marking, and a self-test of the marking.
- `figures.eval.ts`, `playwright.config.ts`: the run, in a real browser against the app in development.
- `../../scripts/eval-figures.ts`: the runner behind the npm scripts.
- `../../app/dev/figure-eval/`: the development-only page the browser drives. It calls the draft page's own code.
- `../../.github/workflows/eval-drafts.yml`: runs it with the real model in GitHub Actions (the job `figures`).
- `runs/`: run output. Ignored by git.

Every person, university, society and result in the reports is made up.

### The reports

| Report | What it is | Expected |
|---|---|---|
| `01-bar-chart` | four pages, one bar chart of the results, drawn in vector shapes | page 3, graph |
| `02-line-chart` | three pages, a line chart of two series over eight weeks | page 2, graph |
| `03-results-table` | a dissertation extract whose only figure is a table of regression results | page 3, table |
| `04-method-then-results` | a lab report: a diagram of the method on page 2, the results chart on page 4 | page 4, graph |
| `05-three-charts` | three charts: the sample (page 2), the headline result (page 3), a check in an appendix (page 5) | page 3, graph |
| `06-bitmap-chart` | the results chart is a picture pasted in, not vector shapes | page 2, graph |
| `07-two-column` | a paper set in two columns with a small figure in one column | page 1, graph |
| `08-text-only` | a history essay of plain text | no figure |
| `09-cover-logo` | a cover page with a crest and a ruled title, then text | no figure |
| `10-slides` | five landscape slides, the chart on slide 4 | page 4, graph |
| `11-diagram-only` | a software report whose only figure is a diagram of the system | page 2, other |
| `12-scan` | `01-bar-chart` as a scan: every page a picture, no text behind it | page 3, graph |
| `13-essay-styled` | an essay with ruled headings, a shaded quotation and a boxed note | no figure |
| `14-poster` | a design project whose key visual is the finished poster, pasted in | page 2, other |

Only pages that paint a shape or a picture are sent, as in the app. So `08-text-only` sends nothing and makes no model call: it passes because the app never asks, which is what happens to a real essay. `09-cover-logo` and `13-essay-styled` do send pages, and the model has to say there is no figure. `04`, `05`, `10` and `12` send several pages, so the model has to choose between them. Each line of the results lists the pages sent.

### The answer key

`cases.json` holds, for each report, the page the figure is on, its kind, and its true box in fractions of the page. `build.mjs` prints each report from a web page laid out as fixed-size sheets, one sheet to a PDF page, so the box is measured from the page itself: the smallest box round everything the figure draws, which is its title, plot, axes and legend. A caption or source line under the figure is outside the true box, so a cut may hold it or not.

## What passes

- **No figure in the report:** the pick says so, or no page was sent.
- **A figure:** the pick is on the right page and is the right kind, and the picture the app cuts holds at least 95% of the true box and is at most twice the size of a perfect cut. The picture the app cuts is the pick's box with the app's own 2% margin, kept on the page (`withMargin` in `lib/figures/rules.ts`). A perfect cut is the true box with the same margin.
- **A request that failed** (an HTTP error, a pick that ran out of allowance, pages that couldn't be drawn) is an error. It is never a pass and never "no figure".
- **An answer from the wrong model** is an error: a real run checks that the model named in `lib/ai/model.ts` answered, and a mock run that the stand-in did.

## Running it

From the repo root, after `npm ci` and `npx playwright install chromium`.

```bash
npm run eval:figures -- --self-test   # no browser, no calls: a perfect answer must pass, each wrong one must not
npm run eval:figures -- --truth       # no calls: draws every true box on its page, to check the answer key by eye
npm run eval:figures -- --mock        # no key: the app's stand-in, to check the whole path works
ANTHROPIC_API_KEYS=... npm run eval:figures                 # the real model, one call per report
ANTHROPIC_API_KEYS=... npm run eval:figures -- --only 04,05 # some reports
```

`ANTHROPIC_API_KEY` works too (the same lookup as the app). Without a key and without `--mock`, the runner stops and says so; it never falls back to the stand-in quietly. `FIGURE_EVAL_PORT` sets the port (3213 if unset).

A run prints one line of JSON per report, then a summary, and exits 1 unless every report passed. It also writes `runs/<timestamp>/results.jsonl`, the picture the app would upload for each pick (`<report>-cut.png`), and the page it came from with the true box outlined in jade and the cut in red (`<report>-page-N.png`).

A mock run is a null baseline. The stand-in picks the first page it is sent with a fixed box, so it fails nearly every report; it exits 0 when every request went through. It says nothing about the model.

Running the app in development rewrites `tsconfig.json`. Run `git checkout tsconfig.json` afterwards.

### In GitHub Actions

There is no key on a development machine, so real runs happen in Actions. Go to Actions > "Exhbt draft eval" > Run workflow, choose the branch, and set **suite** to `figures` (or `both`). The key is the repository secret `ANTHROPIC_API_KEY`, the same one the draft eval uses. From the command line:

```bash
gh workflow run eval-drafts.yml --ref <branch> -f suite=figures
```

The job is `figures`. Its step "Run the figure eval" prints the lines and fails unless every report passed. The same lines go on the run's summary page, and the run folder is uploaded as the artifact `figure-pick-eval`, pictures included.

### Looking at the cuts

Save the job's log (or download `results.jsonl`) and redraw every cut from the reports in this folder:

```bash
npm run eval:figures:crops -- job-log.txt
npm run eval:figures:crops -- job-log.txt --out /tmp/cuts
```

It reads every line that starts `{"eval":"figure-pick"`, with or without a log timestamp before it, and writes the same two pictures per report as a run does. No API calls.

## The lines

| Field | Meaning |
|---|---|
| `case`, `file` | the report |
| `mode`, `model` | `real` or `mock`, and the model that answered (null when nothing was asked) |
| `result`, `why` | `pass`, `fail` or `error`, and the reasons |
| `expected` | the answer key: page, kind and true box; null when the report has no figure |
| `pages`, `sent` | pages in the PDF, and the page numbers sent |
| `http`, `status` | the route's HTTP status, and `picked`, `none`, `skipped` (nothing sent) or `failed` |
| `page`, `kind` | the page and kind chosen |
| `box` | the pick's box after the server's checks, in fractions of the page |
| `rawBox`, `imageSize` | the model's own answer, in pixels of the page image, and that image's size |
| `cut` | the box the app cuts: `box` with the margin |
| `contains`, `areaRatio` | how much of the true box the cut holds, and the cut's area over a perfect cut's |
| `alt`, `caption` | the words the model wrote |
| `tokensIn`, `tokensOut`, `costUsd`, `ms` | from the API's own usage figures, and the time the request took |

## What it exercises, and what it doesn't

It runs the app's own code for every step of the pick: the PDF's pages drawn in a browser by `pdfPages` at the size and JPEG quality the app uses; which pages are sent (`mayHoldFigure`, the caps in `candidatesOf`); the request to `/api/exhbts/figure-pick`, with its sign-in, plan and allowance checks, its size limits and its reading of each image's size; `pickFigure` with the real prompt and model; `toPick`, the server's checks on the answer; and the cut by `pdfFigure` with the margin.

It does not cover:
- the upload of the cut picture, or its placement on the exhbt (`e2e/auto-figure.spec.ts` covers those, with the stand-in);
- the production runtime: the app runs under `next dev` with the in-memory store, not on Cloudflare Workers with Supabase;
- real people's reports. The fixtures are clean, printed by one browser, with one clear right answer. Real PDFs from Word, LaTeX or a phone scanner will be messier;
- browsers other than Chromium;
- the alt text and caption beyond recording them. Nothing marks whether they are accurate;
- more than one run. One call per report is a single sample; a result that fails once in three would pass most single runs.

## Rebuilding the reports

After editing `fixtures/build.mjs`:

```bash
npm run eval:figures:fixtures
npm run eval:figures -- --truth       # look at every true box before committing
npm run eval:figures -- --self-test
```

Chromium stamps the time into each PDF, so a rebuild changes every file's bytes even when no page changed. The fonts come from the machine that builds them (Carlito, Caladea and Liberation Sans here) and are embedded, so the PDFs draw the same everywhere.
