Status: accepted
Date: 16 Nov 2026
Amends: 0007 (what the header holds), 0015 (how the sections are drawn; the sections themselves are unchanged)
Amended by: 0018 (a look sets the --xp-* names through its --pf-* set, on the frame round the page; graphs take the look's shades), 0024 (the page now has three layouts; the case study is the page described here, unchanged); changed in place on 17 Nov 2026 (the flowchart goes to a row at a width that depends on its number of boxes, below)

# The exhbt page: a sidebar, the title as the question, findings beside the chart

Rory drew the page on 16 Nov 2026: `docs/design/portfolio-and-exhbt-layouts.pdf`, page 2. Pages 3 and 4 are the portfolio looks, which carry over to this page.

## The layout

A sidebar on the left, the work on the right. On a phone, and anywhere the page is given less than 48rem (the editor's half-width preview included), the sidebar sits above the main column, with its facts side by side and the ticks in a row where there's room. It scrolls with the page rather than sticking, so nothing in it is cut off on a short window.

The sidebar, top to bottom:
- a card with the photo, the name, the short line under it (the profile's headline) and "All of <first name>'s work", back to the portfolio
- **What it is** (e.g. "MSc Finance dissertation") and **Where and when** (e.g. "University of St Andrews, August 2026")
- **Can you trust it?**: "Confirmed by <first name>", "Source attached" (only when there is one) and "Checked by exhbt, <date>" (linked to the guide to the checks). A check that hasn't happened is drawn hollow with its own wording ("Not confirmed yet", "Checked when published"), so the page never claims more than happened.
- **See the work: <file name>**, the one big button; then "Save as PDF" on the public page

The main column:
- the skill pills, top right
- **the title, which is the question** the work set out to answer, large
- the context line under it, with the gap highlighted (a flat mint block)
- the flowchart, as before: always there, 3 to 6 boxes, the last one dark. A row in print. On screen it is a row once the column is wide enough for the number of boxes: 36rem for 3 or 4, 42rem for 5, 48rem for 6 (`PAGE_ROW` in `MethodFlow.tsx`), a column below that. On 17 Nov 2026 this replaced a flat 36rem, which squeezed six boxes to about 55px of text each and split words (words now break only when a single word is wider than its box).
- the sections, in the person's order (decision 0015)

Gone from the page: the `EX·01` catalogue number and the headline figure. `headline` stays in the schema, the word cap, job-link tiles and the link preview, since old exhbts have it; the editor still offers it, labelled as shown on job links. `catalogueNo` stays for the Phase 1 card and the tiles.

## Sections in the new style

The sections model doesn't change: every section can be added, removed and dragged into any order. How each one is drawn:
- **What I found** (the findings section): a heading over a dark rule, then the points as a ruled list. When a graph or an image is its neighbour (straight before or after it), the two share a row, findings on the left; otherwise each takes the full width. Nothing is reordered to make a pair (`runsOf` in `components/portfolio/ProjectView.tsx`).
- **Graphs** and **images** sit in a card; two of the same kind next to each other share a row, as before. A graph's own title is its caption. The PDF shows the chart on a light grey card: graphs stay on white with a hairline edge, because DESIGN.md keeps them off mist (the lightest series step drops below 2:1 there).
- **Feedback** (the quote) has a coloured rule down its left edge; **What I'd do next** has a hairline above and a small label; the **link** is a grey card.

The editor's preview has "Arrange sections": the sections are drawn one under another, each with a grip to drag (pointer, finger, or Space and the arrow keys, with each move read out) and move up and down buttons. The cards on the left still do the same.

The hook for a figure picked from an upload is `withKeyFigure(doc, { fileId, alt, caption })` in `lib/exhbt/sections.ts`: an image section straight after What I found, so it is drawn beside the findings.

## The schema

Rory asked for "What it is" as a new field. Every stored exhbt already has it in `context`, the old line under the title ("BSc Data Science, final-year project"), so `context` keeps its key and is now labelled "What it is". A second field with the same words would have counted twice against the 200 words, and the AI versions kept for "Back to the AI version" and the rewrite already use `context`.

- `title`: the question. Publishing doesn't require a question mark, so old exhbts still publish.
- `gap`: was "The question"; it is now the context line. Its bold run is the highlighted phrase: the field's button says "Highlight" and shows it highlighted, and the page draws it as a `<mark>`. Old exhbts with a bold run there get the highlight with no change.
- `whereWhen` (new, optional, up to 60 characters): "Where and when".
- `summary` (new, optional, one sentence of up to 25 words): what the work found, for portfolio cards and the featured band. `exhbtSummary(doc)` in `lib/exhbt/blocks.ts` returns it, or the first finding when it's empty.

Both new fields are optional, so old exhbts read and render as they are (the store runs `normaliseDoc`, not the zod parse). Both count in `wordCount` (the summary shows on portfolio cards) and both are in the number check (`lib/exhbt/verify.ts`). jsonb, no migration.

The AI draft writes the title as a question, the context line and the phrase to highlight (kept only when it is copied from the line exactly, `withHighlight`), the summary, what it is and where and when, only from the material. It no longer writes a headline number.

## Looks

The person's portfolio look carries over: the route sets `data-theme` and the look's inline variables on the page's wrapper, and the page draws every colour, radius and face from the `--xp-*` variables in `app/globals.css`. Their defaults (the Exhbt look) are on `:root`; a look overrides any of them on `[data-theme="<id>"]`. Tailwind colour classes aren't used for anything a look might change.

| Variable | Paints |
|---|---|
| `--xp-page-ground` | the ground behind the whole page. Read where the layout's div is, so set it from the root: `:root:has([data-exhbt-route][data-theme="<id>"]) { … }` |
| `--xp-ground`, `--xp-ink`, `--xp-muted` | the page's ground, text, and secondary text (labels, captions, the bio) |
| `--xp-font`, `--xp-title-font`, `--xp-title-weight`, `--xp-title-tracking` | the body face, and the title, name and "What I found" face. Unset fonts follow the site's Inter and the look's `--font-display` |
| `--xp-rule`, `--xp-rule-strong` | hairlines between facts and findings; the rule under "What I found" |
| `--xp-card`, `--xp-card-ink`, `--xp-card-muted`, `--xp-card-edge` | the sidebar's person card and the link card (the bio and the link's description are the muted text) |
| `--xp-figure`, `--xp-figure-ink`, `--xp-figure-muted`, `--xp-figure-edge` | the card under a graph or image, its text and an image's caption. Keep the ground white or near it, even on a dark look: the graphs colour themselves for white |
| `--xp-pill`, `--xp-pill-ink`, `--xp-pill-edge` | skill pills |
| `--xp-tick`, `--xp-tick-ink` | the filled ticks, and the quote's rule |
| `--xp-link` | link underlines |
| `--xp-accent`, `--xp-accent-hover`, `--xp-accent-ink` | the "See the work" button |
| `--xp-outline-ground`, `--xp-outline-ink`, `--xp-outline-edge` | "All of <name>'s work" |
| `--xp-highlight`, `--xp-highlight-ink` | the highlighted gap |
| `--xp-flow-ground`, `--xp-flow-ink`, `--xp-flow-muted`, `--xp-flow-edge`, `--xp-flow-end`, `--xp-flow-end-ink`, `--xp-arrow` | flowchart boxes and their detail line, the dark last box, the arrows |
| `--xp-avatar`, `--xp-avatar-ink`, `--xp-avatar-edge` | the initials when there's no photo (a photo's edge is `--xp-rule`) |
| `--xp-radius-card`, `--xp-radius-box`, `--xp-radius-pill`, `--xp-radius-button` | corners: cards, flowchart boxes and the highlight, pills, buttons. 0 for the sharp looks |

Headings, the teammates' byline (decision 0013) and links in the text take the page's ink too. Every pair a look sets has to pass WCAG AA, as the band colours do (`e2e/phase2-themes.spec.ts`); `e2e/exhbt-page.spec.ts` sets a dark set of these variables and runs axe on the page.

Two things sit outside the page, on `--xp-page-ground`, and keep their own colours: the portfolio's "made with exhbt" sign-off (`MadeWith`, in the portfolio layout) and the previous and next cards (`ProjectPager`). A dark look has to restyle those as well.

## Print

"Save as PDF" prints one A4 page: the sidebar becomes a band across the top (the person and the work on the left; what it is, where and when and the checks in three columns), the main column takes the full width below it, the flowchart stays a row and the sections close up (the `print:` classes and `@media print` in `app/globals.css`, which also sets a 12px rem). A full exhbt at 196 words with two graphs, a quote and a link fits with room to spare (`fullDoc` in `lib/exhbt/sample.ts`, checked in `e2e/exhbt-page.spec.ts`); an image as well may run onto a second page.

Code: `components/portfolio/ProjectView.tsx`, `components/exhbt/MethodFlow.tsx` (`variant="page"`), `components/editor/PreviewArrange.tsx`, `lib/exhbt/blocks.ts`, `lib/exhbt/sections.ts`, `lib/ai/exhbt-draft.ts`, `app/(portfolio)/p/[username]/[slug]/page.tsx`. Tests: `e2e/exhbt-page.spec.ts`.
