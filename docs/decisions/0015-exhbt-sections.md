Status: accepted
Date: 15 Nov 2026
Amends: 0007 (which parts are fixed, and their order), 0009 (the new sections' words count)
Amended by: 0022 (how the sections are drawn on the page; the sections are unchanged), 0024 (two new kinds, aim and conclusion, used by research only; caps per layout; in a gallery or research page the page sets where each kind goes), 0026 (the editor: sections are edited and dragged on the page itself, not as cards), 0027 (the flowchart is a section: it can be moved, and removed in five layouts; a case study and research keep it), 0028 (one new kind, the pull quote; an image can be marked before or after)

# The flowchart stays; what goes below it is up to the person

Owner, 13 Nov 2026: "Add a small range of tiles or take some away… I want the flowchart to stay permanent on all, but you can add or take away boxes." And on the cap: "200 should cap EVERYTHING… even if you add, it is within limit."

Until now every part of an exhbt sat in one fixed order (decision 0007). Projects aren't that alike: a client project may have feedback worth quoting while a solo analysis has none, and a modelling project wants two graphs and no pictures. So the top of the exhbt stays fixed, and below the flowchart the person picks from a short list.

## The core, on every exhbt

In this order, and never removed: the header (photo, name, skill boxes), the title and context line, the headline number (optional, as before), the question, then the process flowchart with 3 to 6 boxes, still edited on the diagram.

## Sections

Below the flowchart, in whatever order the person sets, from "Add a section":

| Section | What it holds | How many |
|---|---|---|
| Findings | 2 to 4 bullets, up to 20 words each | one |
| Graph | any kind from decision 0011, protected numbers included | up to 2 |
| Image | a picture with alt text and a caption of up to 15 words | up to 2 |
| Quote | feedback someone gave, in their words, up to 30 words, with their name and (if wanted) role | one |
| What I'd do next | a line or two, up to 35 words | one |
| Link | an https link to a repository, demo or document, a label of up to 8 words and an optional one-line description | one |

The caps are `LIMITS` in `lib/exhbt/blocks.ts`. Publishing needs a complete core and at least one findings or graph section, because an exhbt that doesn't show what came of the work isn't doing its job; each section is also checked on its own (`validateForPublish`, on the server).

A quote is plain text with no bold, italic or links: it's someone else's words, and formatting them changes what they said. A link shows its label and description, not the address, the same as the link to the work.

## Every word counts

The 200-word cap still covers everything on the page (decision 0009), so each new section's words count: the quote with the name and role under it, what I'd do next, and a link's label and description. Alt text and link addresses don't, since neither shows. The "Add a section" menu says how many words are left (or how many over), the word bar turns red past 200, and publishing is refused over it. Saving never is.

## The work stays in the footer

"The work" (the original file or link) isn't a section. It stays beside the trust badge, whose "source attached" tick reads it, and every published exhbt already has it there; making it movable would have moved it on every old page too.

## Stored as an ordered list

`ExhbtDoc` (schema version 2) keeps the core at the top level and adds `sections`: a list discriminated on `kind`, each with an `id` that stays put when it moves, so the editor keeps each section's fields while it's dragged. Teammates (decision 0013) are still a byline, not a section, and count no words.

Docs saved before sections have `findings`, `charts` and `images` at the top. `normaliseDoc` reads them as sections in the order their page always had: findings, then each graph, then each image, with fixed ids (`findings`, `graph-1`, `image-1` and so on), so reading one twice gives the same doc. The store runs it on every read, in both implementations, and `ExhbtDocSchema` runs it first, which covers a stale tab or a copy kept in the browser. It also gives old graphs their kind, which `withChartKinds` used to do (decision 0011). The stored jsonb isn't touched, so there's no migration: an old row takes the new shape the next time it's saved or published.

Old published pages look as they did. The project page puts graphs that sit next to each other in one row, as it always did for an exhbt's two graphs, and does the same for images; with another section between them they stack instead. The e2e tests store the sample GP exhbt in the old layout on purpose, in both copies (`setStoredCopiesForDevelopment`, development only), and compare its page with the same exhbt stored as sections.

`publicDoc` still swaps a protected graph's figures for its index (decision 0011), wherever its section sits.

## The editor

Each section is a card with a grip handle, move up and move down buttons and a remove button. Dragging uses dnd-kit's sortable, the library the portfolio customiser uses too: with the pointer or a finger, or from the keyboard on the handle (Space, the arrow keys, Space again), with each step read out. The buttons are the plain keyboard and screen-reader way, and focus stays on the one pressed. The lifted card takes the pack shadow, and the sorting animation is off for anyone who asks for less motion. A removed section can be put back with Undo, apart from an image, whose file is deleted once the save without it lands.

## The AI draft

The draft proposes findings and, when the material has figures, usually one graph; a second graph, a quote or what I'd do next only when the person's material supports one (`lib/ai/exhbt-draft.ts`). A quote has to be copied word for word with the name as the material gives it. The server keeps it only when both are found in the material and drops it otherwise, since a quote can't be checked the way a number can. `lib/exhbt/verify.ts` checks the numbers in every section.

## Not decided here

More kinds of section, letting people move the core, and showing sections on per-job link pages (which show the tile, unchanged).

Code: `lib/exhbt/blocks.ts`, `lib/exhbt/sections.ts`, `components/editor/Sections.tsx`, `components/portfolio/ProjectView.tsx`, `lib/ai/exhbt-draft.ts`.
