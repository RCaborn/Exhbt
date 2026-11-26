Status: accepted
Date: 25 Nov 2026
Amends: 0015 (a section's words have no cap of their own), 0022 (nor has the summary), 0024 and 0028 (each layout's caps on a part's words are now the AI's targets, not limits for people)

# One word limit for the page, not one per part

Rory, 25 Nov 2026, after trying the edit-on-page editor: "It should be less forceful on certain sections... it said there should only be 25 words in this section. I really don't think we need to be telling people that. As long as we keep a 200-ish limit, so it keeps to the point."

## What changed

Until now most parts of an exhbt had a word cap of their own. Each one blocked publishing, and both editors showed it as people typed:

- the summary 25 words, the context line 40, each finding 20, an image's caption 15;
- a quote 30, what I'd do next 35, a link's description 15;
- research's aim 20 and conclusion 25, an essay's pull quote 30;
- and `evidenceCaptionWords` (15), which nothing read.

Some layouts set their own (decisions 0024 and 0028): a gallery's context line 30 and its findings 15 each, research's findings 15 each, and so on.

Those caps are gone for people. Publishing no longer checks them, "Things to fix" doesn't list them, and neither editor shows them: no "12 / 20 words" beside a finding, no "up to 30 words" in a hint, no "Keep the quote to 30 words". A card in the classic editor still shows how many words it holds, because those add up to the page's total.

An exhbt that was held back only by a part's cap can now be published. Nothing stored changes.

## What stays

- **The page's 200 words** (decision 0009), checked on publish. The top bar still says "aim for 150, at most 200", with each layout's own target (170 for research and an essay).
- **The limits that keep the page's shape.** These are not word caps on prose:
  - how many of each thing there may be: skills, flowchart boxes, findings, images, sections, and research's graphs and images together;
  - the characters a one-line field holds: the title (80, which the database holds it to as well), what it is, where and when, my role, a skill, and a quote's name and role; and a skill's three words;
  - a link's label, in words (8, or 12 in research and an essay);
  - a flowchart box's words (8) and its detail's (6), because long text breaks the diagram.
- **The AI still writes each part short.** Left to itself it pads, and a recruiter reads in about 30 seconds. Its prompts keep every word target they had, word for word. `draftTargets` in `lib/ai/draft-targets.ts` holds the old caps, layout by layout, for the AI alone, and the code that reads its answers still holds it to some of them:
  - a quote or a pull quote longer than its target is left off, never cut, because a cut quote is not what was said (`quoteFrom`, `pullquoteFrom`);
  - a picked figure's caption is cut to its layout's target (`fitCaption` and the figure route);
  - the draft eval marks a draft that runs past them (`overTargets`, criterion C2 in `evals/exhbt-draft/RUBRIC.md`), so the measure of the prompt didn't loosen when the publish check did.

## Why

The 200 words are what keep an exhbt to a quick read. A cap on each part on top of that told people what to do with words they already had room for. Someone whose results need 40 words and whose context needs 10 was held to 20 and 40.

## Printing

The caps also kept every page on one A4 sheet, so a page they would have refused was printed to check. It puts most of its words in one finding of 120 words, beside the graph (`e2e/exhbt-page.spec.ts`, "an uneven page prints on one A4 page"):

- a case study of 182 words prints on one page, filling 521 of the 1,032 pixels of height a printed page has (about half);
- research of 198 words prints on one page, filling 647 (63%).

With that finding at 320 words, about 390 words in all (which can't be published), both still print on one page, at 788 and 915 pixels. Measured with Chromium's print to PDF, at A4 with the print styles' 12mm margins; another browser's print may differ a little. What could already run onto a second page still can: an image as well as a full page (decision 0022).

## Code

- `LIMITS` (`lib/exhbt/blocks.ts`) and `FORMAT_LIMITS` (`lib/exhbt/formats.ts`) lose the word caps, and `validateForPublish` loses their checks.
- `DRAFT_TARGETS` and `draftTargets(format)` (`lib/ai/draft-targets.ts`) are read by the draft and rewrite prompts, the figure pick's prompt, both stand-in AIs, `quoteFrom`, `pullquoteFrom`, `fitCaption` and the figure route. `overTargets` is the eval's check.
- The classic editor (`components/editor/`) loses the counters on a finding, a quote and a link's description, the cap beside a card's word count, and the caps in its hints. The new editor's card sheet loses the summary's counter.
