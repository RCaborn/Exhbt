# Exhbt draft eval

This measures the AI exhbt draft (`lib/ai/exhbt-draft.ts`) on eight fictional student projects, so changes to the prompt can be judged by numbers rather than by reading one or two drafts. It measures only: it doesn't change the prompt or anything the app does.

Each run reads every fixture the way the upload page does, calls the app's real `draftExhbt`, checks the draft with the same code the editor and the publish button use, and writes the results to `runs/<timestamp>/`.

## What's here

- `fixtures/`: the eight projects, each with an answer key (`<name>.facts.json`).
  - `01-econ-dissertation.pdf`: economics dissertation extract (question, data, regression, results table, conclusion).
  - `02-ds-notebook.md`: data-science write-up exported from a notebook, with code and printed outputs.
  - `03-finance-dcf.docx`: finance coursework, a DCF valuation full of figures.
  - `04-marketing-society.docx`: a student society's recruitment campaign report, results in percentages.
  - `05-eng-lab-report.pdf`: engineering lab report with measurements and error analysis.
  - `06-history-essay.docx`: a history essay with no numbers at all.
  - `07-results-only.csv` and `07-results-only.notes.txt`: a three-row results sheet plus a one-paragraph note (the note goes in the notes box). Thin material on purpose.
  - `08-rambling-report.txt`: a long, rambling placement report (about 3,800 words) with the results buried.
  - `src/`: the text behind the PDF and Word fixtures. `build.ts` turns it into the binary files.
- `RUBRIC.md`: the eight criteria (C1 to C8), scored 0 to 2.
- `runs/`: run output. Ignored by git apart from `.gitkeep`.
- `../../scripts/eval-drafts.ts`: the runner.
- `../../.github/workflows/eval-drafts.yml`: runs it with the real model in GitHub Actions.

Every person, university, company and society in the fixtures is made up.

### The answer keys

Each `.facts.json` says what the fixture is and what it tests, which files and notes make up the material, and:

- `keyFacts`: what a good exhbt should mention. Each has `match` alternatives: a plain number matches by value (so "14,200" matches "14200"), text matches without regard to case, and a list of strings needs all of them.
- `forbidden`: things that shouldn't appear (an invented significance test, stray figures).
- `expect`: whether a headline number and a before/after chart make sense, and whether the material has no numbers at all.
- `sourceNumbers`: every number in the source, written by `build.ts`. The runner checks they all survive text extraction, so an unfair "unverified" flag can be told apart from a real one.

## Running it

From the repo root, after `npm ci`.

Without a key (tests the pipeline with the app's labelled placeholder draft):

```bash
npm run eval:drafts -- --mock
```

Check the checks, with no API calls: a hand-written good draft must score 2 on every code check, and a broken one and an empty one must fail:

```bash
npm run eval:drafts -- --self-test
```

With a key, locally:

```bash
ANTHROPIC_API_KEYS=... npm run eval:drafts                 # real drafts, code checks
ANTHROPIC_API_KEYS=... npm run eval:drafts -- --model-judge # plus AI-judged rubric scores
ANTHROPIC_API_KEYS=... npm run eval:drafts -- --only 06,07 --reps 3
```

`ANTHROPIC_API_KEY` works too (the same lookup as the app, `lib/ai/model.ts`). Without `--mock` and without a key, the runner stops and says so; it never falls back to the placeholder quietly. The key is never printed or written to the run files.

Options: `--mock`, `--model-judge`, `--only <prefixes>` (comma-separated, such as `01,08`), `--reps <n>` (drafts per fixture, up to 10), `--self-test`.

### In GitHub Actions

This sandbox has no key, so real runs happen in Actions. Add the key as the repository secret `ANTHROPIC_API_KEY` (Settings > Secrets and variables > Actions), then go to Actions > "Exhbt draft eval" > Run workflow. Leave "judge" ticked for AI-judged scores as well.

The workflow runs only when started by hand, never on a push or pull request. It puts `SUMMARY.md` on the run's summary page and uploads the whole run folder as the artifact `exhbt-draft-eval`. If the secret is missing it stops with an error that names it.

### Rebuilding the fixtures

After editing anything in `fixtures/src/`, a text fixture or an answer key's `files`:

```bash
npm run eval:fixtures
```

This rewrites the PDF and Word files (byte for byte the same if nothing changed) and refreshes each answer key's `sourceNumbers`. Commit the results. To add a fixture, add its file (or its text in `src/` and a line in `build.ts`), write `<name>.facts.json` by hand, and run the build.

## What each check means

The code checks run on every draft:

- **Words**: `wordCount` from `lib/exhbt/blocks.ts`, every word on the page except image alt text. The limit is 200 and the editor aims for 150.
- **Publish issues**: what `validateForPublish` would block on (a box over its word limit, too few findings and so on).
- **Unverified numbers**: the editor's number check, exactly as `app/api/exhbts/draft/route.ts` runs it: numbers in the draft that aren't in the material (`unverifiedNumbers`), plus numbers whose source quote isn't in the material.
- **Key facts**: how many of the answer key's facts the draft mentions, and which are missing.
- **Should not appear**: the answer key's forbidden list.
- **Tone**: the banned words, phrases and openers from `.claude/skills/anti-ai-slop-writing/references/banned-words.md` (read at run time, so that file stays the one list), exclamation marks, "we"/"our", em dashes, and a short list of American spellings. Words the list bans only in a figurative sense ("landscape", "robust") count as soft.
- **Expectations**: a headline number or chart where the answer key expects none, or none where it expects one, and any number at all in a draft of the history essay.

From those, the code scores four rubric criteria: C1 (facts, numbers only), C2 (limits), C5 (answer-key coverage) and C8 (tone). `RUBRIC.md` gives the thresholds.

With `--model-judge`, Haiku (`AI_MODEL`, the only model the app uses) reads `RUBRIC.md`, the material, the answer key and the draft, and scores all eight criteria with a reason for each. These scores are labelled AI-judged everywhere. Bear in mind that the judge is the same model as the drafter, so it may go easy on its own habits, and it hasn't yet been checked against a person's scores. Use it to spot patterns and to point you at drafts to read; where the code checks a criterion, trust the code.

## Reading the summary

`runs/<timestamp>/SUMMARY.md` starts with the mode, model, commit, token counts and cost, then one row per fixture:

| Column | Meaning |
|---|---|
| OK | drafts scored / drafts attempted. A failed attempt (timeout, API error, no output, wrong model) is listed with its reason and left out of the scores, never counted as a zero. |
| Words | `wordCount` of the draft. |
| Publish issues | how many things would block publishing. |
| Unverified numbers | numbers the editor would flag. Anything above 0 fails C1. |
| Key facts | answer-key facts covered / total. |
| Banned / soft | hard tone hits / soft ones. |
| C1, C2, C5, C8 | code scores, 0 to 2. |
| Code /8 | their total. |
| AI-judged /16 | the judge's total across C1 to C8 (with `--model-judge`). |
| Tokens in/out, Cost $ | from the API's own usage figures, priced by `costUsd` in `lib/ai/model.ts`. |

Below the table, each fixture has the draft as a reader would see it, the details behind each check, and the judge's score and reason per criterion. The JSON file for each fixture holds the extracted material, the full draft, the model's number list with source quotes, every check and the token usage.

With `--reps` above 1, the table shows means. One draft per fixture is a noisy measure: before deciding a prompt change helped, run both versions with `--reps 3` or more and compare.

A mock run is a null baseline. It should pass C1, C2 and C8 (the placeholder is short and quotes the material) and score 0 on C5 for most fixtures. If a mock run scores well on key facts, the answer key is too easy to match.

## How extraction compares with the browser

The runner calls `extractTextInBrowser` from `lib/doc-readers.ts`, the same function the upload page uses, with a `File` built from the fixture's bytes (Node 22 has `File` built in). PDFs go through `unpdf`, Word files through `mammoth` and then the XML reader, CSVs through the same table reader, and every candidate through the same quality check. Files are joined as `DraftForm.tsx` joins them (`File: <name>` then the text) and the notes go in the notes field. So the text the model sees should match what the browser would send.

Two differences: the AI reader for scans and photos isn't used (no fixture needs it), and pdf.js runs under Node rather than in a browser (`unpdf` ships the same build for both). The runner's lost-numbers check would show if that ever changed what's extracted.
