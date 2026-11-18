# Edit on the page: the drag prototype

Status: work in progress (18 Nov 2026). This note is filled in as the prototype is built, so a later reader gets what was learned even if the build stops part-way. Sections marked "to come" have no result yet.

The lab page is `/lab/editor` (`app/lab/editor/page.tsx`, `components/lab/`). No sign-in, nothing stored. The address carries the choices: `?sample=case-study|gallery|research`, `?look=exhbt|classic|night`, `?v=a|b`.

## The gate

`isLabEnabled()` in `lib/site.ts`: on when `NODE_ENV` is not production, or when `EXHBT_LAB=1`. `EXHBT_LAB` is set in `env.preview.vars` of `wrangler.jsonc` only, so the preview site has the lab and the live site does not. The page is `force-dynamic`, so the answer is read at request time and one build serves both.

Checked on 18 Nov 2026 with a production build (`next build`, then `next start -p 3213`):

| Run | `/lab/editor` | With a `workers.dev` Host header |
|---|---|---|
| No `EXHBT_LAB` | 404 | 404 |
| `EXHBT_LAB=1` | 200 | 200 |

With the lab on, a portfolio host (`amara.exhbt.co.uk`) still gets 404, because the middleware rewrites it to the portfolio routes. The page carries `noindex` in a meta tag and in the `X-Robots-Tag` header. `/lab` is left out of the page-view counter (`lib/page-views.ts`), so nothing at all is stored. Not checked: the page on the deployed preview Worker itself.

## What the two versions do

Both freeze the page when a section is picked up. Every section keeps its layout box until the drop; anything that moves, moves by a transform. The place the section would go is worked out from the page as it stood at pick-up and from where the pointer is, and from nothing that is shown during the drag (`components/lab/drag-plan.ts`). That is the reason neither version can flicker between two places: what the page shows never feeds back into where the pointer is taken to be, and another place has to be nearer by 10px before it takes over.

- **Version A, slide.** The other sections slide (180ms, translate only) to where they would sit, and a dashed box shows the room made for the lifted one. Where they would sit is measured, not guessed: at pick-up each section's size is noted, and for each place tried, empty boxes of those sizes are laid out in a hidden copy of the page's own rows, so the pairing, the grid and the gaps are the real CSS.
- **Version B, line.** The page stays still. A line shows where the section would go: across the column between two rows, or upright beside a neighbour when the section would share that neighbour's row.

In both, a lifted copy follows the pointer on a card with the pack shadow and an outline in the look's link colour (jade in the Exhbt look). On drop, the section moves from where it was let go to its place and any neighbours that pair up again move with it (180ms, transforms only). With reduced motion nothing animates.

From the keyboard (Space on the grip, arrows, Space, Escape) there is no pointer to carry a copy, so the section itself takes the lifted card: in A it slides to each place in turn, in B it stays put and the line moves. Each arrow press moves one place in the order, and each is read out ("Quote would go to place 3 of 7").

## What has been found so far

These are from building it; the recordings and the timing are still to come.

1. **Sliding cannot show a pair forming.** When a graph is dropped next to findings they share a row, and the findings get narrower. A slide that only translates (the Dragging rule: no scaling; and the rule here that layout boxes don't change until the drop) can move a section but cannot make it narrower. So version A shows where things go, in boxes that are still their old width, and the true shape arrives at the drop. Where a section would land beside a full-width neighbour, A's landing box lies over that neighbour's right half. Version B has the matching gap, more honestly: the line says "between these two" or "beside this one" and makes no claim about the shape.
2. **Today's page puts findings on the left even when the figure comes first in the order** (`runsOf` in `ProjectView.tsx`). In an edit-on-page editor that means a figure dropped to the left of the findings would land on the right. The lab draws a pair in the doc's own order. The design step has to choose one rule.
3. **A section that changes row is a new DOM node.** React cannot move a keyed child from one parent to another, so when a drop re-forms a pair, the sections in it are mounted again. Their words live in the store, so nothing is lost, but focus, the slide into place and the render counters all have to find a section by its id, never by a kept reference.
4. **Tiptap's own stylesheet changes the line.** It sets `white-space: break-spaces`, which breaks lines in different places from the published paragraph, and it switches ligatures off. It is unlayered, so it beats the site's layered CSS. The lab's context field turns it off (`injectCSS: false`) and writes the two rules it needs in `components/lab/lab.css`.
5. **The reset restyles Tiptap's inner paragraph** to 16px on a 24px line, whatever the line's own type is. The lab makes it inherit.
6. **A highlight that wraps is about 5px longer in the field than on the page.** A field keeps the space at the end of a wrapped line; a published paragraph drops it. Everything else on the case study (35 boxes: sidebar, pills, title, context line, flow boxes, findings, graphs, quote, what I'd do next, link) sits in exactly the same place and size in the lab as in the real `ProjectView`, on a 1440px screen and on a Pixel 7, in the Exhbt, Classic and Night looks.
7. **`text-wrap: balance` works inside a textarea** (Chromium 153), so the title wraps as the published title does. The cost is that the lines re-balance as you type: a word typed at the end of line two can pull a word down from line one.
8. **`field-sizing: content` does the auto-grow with no script.** For browsers without it, setting the height from `scrollHeight` was up to 3.4px out on the title (whole pixels, and it counts the overhang of a tight line height). The fallback the lab uses instead is a hidden mirror of the words in the same grid cell, which is exact. `?grow=mirror` forces it.
9. **`ProjectView` has no place to put a field or a draggable flowchart**, so the lab composes the page frame itself with the same classes and uses the real parts (`Findings`, `Figure`, `SectionBlock`, `MethodFlow`, `runsOf`, the look wrapper) wherever nothing is typed. Findings, an image's caption and the flowchart are copies with a field in them. The rewrite of those files should give each a slot for its words.
10. **A stored exhbt keeps the flowchart fixed above the sections.** The lab makes it an item in the order so it can be dragged. If the real editor lets it move, the schema needs a place for it.

## Stability, timing, typing, recommendation

To come.
