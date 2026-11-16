Status: accepted
Date: 12 Nov 2026
Amends: 0007 (how the 150–200 words are counted)

# The word cap counts everything on the page

An exhbt has 200 words at most, and the editor aims for 150. Those words are every word the person writes onto the exhbt, wherever it sits: the title and context in the header, the skill boxes, the headline number and its label, the question, every flowchart box and its detail, the findings, each graph's title, series labels, unit and row labels, the image captions and the label on the work.

Image alt text is the one thing left out. A screen reader reads it, but nobody sees it on the page, and a cap that punished good alt text would get people writing worse alt text.

Why: Rory, 12 Nov 2026: "200 should cap everything". A recruiter reads the whole page, labels and chart titles included, so a cap that skipped them would let an exhbt grow past a 30-second read while still passing. Counting everything also means there's no rule to explain about which fields count.

The person's name and photo come from their profile and the trust badge is ours, so they aren't part of the count.

Code: `wordCount()` and `LIMITS.totalWords` in `lib/exhbt/blocks.ts`. Publishing is refused over the cap, on the server (`validateForPublish()`); saving a draft never is.
