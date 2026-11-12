# Exhbt draft rubric

How we score one AI draft of an exhbt against the material it was drafted from. Eight criteria, each scored 0, 1 or 2, so a draft scores out of 16.

Some criteria are checked by code (`scripts/eval-drafts.ts`), some need judgement. The judgement scores come from a person reading the draft, or from `--model-judge`, which asks Haiku to score every criterion against this file. Treat Haiku's scores as AI-judged: useful for spotting patterns across runs, not a verdict. Where the code checks a criterion, the code's score is the one to trust; the judge's score sits beside it.

The limits come from `lib/exhbt/blocks.ts` (`LIMITS`). If this file and that one disagree, the code wins.

The criterion ids (C1 to C8) are used by the runner and the judge. Keep them.

## C1. Facts only

Every fact in the draft is in the material. Every number can be found in the material as written (the editor's check, `unverifiedNumbers`, plus the model's own source quotes). No new figures worked out by the model (percentage changes, totals, averages the material doesn't state). No invented tools, organisations, dates, methods or outcomes.

- 2: everything is traceable to the material.
- 1: no invented numbers, but a small claim goes beyond the material (a tool that isn't named, an outcome stated more strongly than the author does).
- 0: any invented or unverifiable number, or an invented result, organisation or date.

Checked by code: the number check (2 or 0). Judged: claims that aren't numbers.

## C2. Within the limits

The draft could be published as it stands: `validateForPublish` returns no issues, and the whole page (every word except image alt text, `wordCount`) is at most 200 words. The editor aims for about 150.

- 2: publishable and 180 words or fewer.
- 1: publishable but 181 to 200 words, or the only problem is a total of 201 to 220 words.
- 0: anything else (a box over its word limit, too few findings, more than 220 words).

Checked by code only.

## C3. A 30-second read

A recruiter gets the point in about 30 seconds: short sentences, findings that read like bullets rather than paragraphs, no throat-clearing, nothing repeated between blocks. The gap says the question and why it mattered in two short sentences at most.

- 2: every block is short and earns its place.
- 1: readable, but one block is wordy, vague or repeats another.
- 0: reads like a summary paragraph cut into pieces, or several blocks are padded.

Judged.

## C4. The flowchart tells the method in order

Three to six boxes, each a short phrase that starts with a verb ("Cleaned 14,200 rows", "Ran a regression"), in the order the work was done, describing what the person did rather than what they found. Details, where present, are short and factual.

- 2: 3 to 6 boxes, verb-led, in order, a reader could follow the method from them alone.
- 1: right count, but a box is vague ("Did analysis"), out of order, or a finding has crept in.
- 0: fewer than 3 or more than 6 boxes, or the boxes don't describe the method.

Judged (the code reports the box count and word counts).

## C5. Findings are specific

The findings carry the key results a reader would want, with the numbers that make them concrete, and leave out the stray figures. The answer key in each fixture's `.facts.json` lists what a good draft should mention.

- 2: covers most of the answer key (at least three quarters), with concrete results rather than descriptions of activity.
- 1: covers some of it (at least two fifths), or the results are there but vague.
- 0: covers little of it, or the findings describe what was done rather than what came of it.

Checked by code: answer-key coverage. Judged: whether the findings are concrete and well chosen.

## C6. Skills are sensible and short

Up to six skills, each at most three words, each shown being used in the material (a method, a tool, a technique), not soft-skill filler ("Teamwork", "Passion") unless the material shows it in action.

- 2: every skill is specific, short and shown in the material.
- 1: one skill is generic, padded or weakly supported.
- 0: several skills are generic or unsupported, or there are none when the material shows some.

Judged (the code checks the count and length as part of C2).

## C7. A title a recruiter would click

At most 80 characters. Says what was done and what came of it, in plain words. Specific to this project: it could not be the title of a hundred other projects.

- 2: specific, concrete, and gives a result or a clear question.
- 1: accurate but generic ("Data analysis project") or missing what came of it.
- 0: misleading, over-claiming, or not about the work.

Judged.

## C8. Plain British English, no hype

Plain words, British spelling, no hype or stock AI phrasing (the banned list in `.claude/skills/anti-ai-slop-writing/references/banned-words.md`), no exclamation marks, no "we" or "our" (the draft speaks about one person's work).

- 2: plain and clean.
- 1: one or two soft slips (an American spelling, a figurative "landscape", an em dash).
- 0: a banned word or phrase, an exclamation mark, first person plural, or a marketing tone.

Checked by code: the banned list, exclamation marks, "we"/"our", em dashes and a short list of American spellings. Judged: tone.

## Fixture expectations

Each answer key also says whether a good draft has a headline number, whether a before/after chart makes sense, and whether the material has no numbers at all (the history essay). The runner reports a mismatch with these; it doesn't score them, because a missing chart is a judgement call. A draft of the history essay with any number in it fails C1.
