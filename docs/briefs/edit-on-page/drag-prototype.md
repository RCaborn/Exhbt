# Edit on the page: the drag prototype

Status: work in progress (18 Nov 2026). This note is filled in as the prototype is built, so a later reader gets what was learned even if the build stops part-way. Sections marked "to come" have no result yet.

The lab page is `/lab/editor` (`app/lab/editor/page.tsx`, `components/lab/`). No sign-in, nothing stored. The address carries the choices: `?sample=case-study|gallery|research`, `?look=exhbt|classic|night`, `?v=mix|a|b`.

## The owner's decision (18 Nov 2026)

Rory tried versions A and B on the preview site and said: **"Flowchart on b works better, rest on a is better!"**

That is now the default, **Mix** (`?v=mix`): sections slide to make room, as in A; the flowchart is carried over a still page with a line, as in B; and the boxes inside the flowchart are carried over a still flowchart with a line too. A and B stay on the switch for comparing, and each now applies its own way to everything: in A sections and flow boxes all slide, in B sections and flow boxes all use a line. One line under the switch says what the chosen version does.

One thing to know when reading his verdict. When he tried it, the boxes inside the flowchart dragged the same way in A and in B (they slid in both). So what he felt as different can only have been moving the flowchart section itself. Carrying a box with a line is new in Mix and B, and he has not felt it yet. It was built because his words were read as "anything to do with the flowchart"; if he meant only the section, the boxes should go back to sliding (`boxStyle` in `components/lab/options.ts`, one line).

### Why the flowchart feels worse in A

Measured on the case study, on a Pixel 7 screen (412 by 839):

| Section | Height on the phone | Share of the screen | Height at 1440 wide |
|---|---|---|---|
| Flowchart (a column of five boxes on a phone) | 327px | 39% | 115px (a row) |
| Findings | 300px | 36% | 300px |
| Graph 2 | 278px | 33% | 310px |
| Graph 1 | 239px | 28% | 239px |
| Quote | 111px | 13% | 81px |

Three things follow from the flowchart being the tallest block on a phone and the first one on the page.

1. **Each slide is as big as the lifted section.** When the flowchart passes one section, that section jumps 371px (the flowchart's height and one gap) in 180ms. That is 44% of the screen. A quote passing a section moves it 155px.
2. **The finger has to travel most of the screen before anything happens.** The grip is at the section's top corner, and the place is worked out from where the finger is. To move the flowchart down one place the finger has to go past the flowchart's own 327px, the 44px gap, and half of the next section: about 520px, or 62% of the screen. The bottom fifth of the screen is where the page starts scrolling itself, so it cannot be done without the page starting to move. In A that is the page scrolling and sections jumping at once. In B it is only the page scrolling, and a line.
3. **A bug made it worse, in both versions, and is fixed.** The lifted copy made the page longer as it was carried past the foot of the page, so the page went on scrolling into empty space and the place ran on to the end by itself. A tall section reaches the foot first, because it hangs below the finger by its whole height. The lab page is now clipped at its own edges; a section held at the bottom edge stops the page at its real end (checked: page height 2999px before and during, scroll stops at 2160 of 2160).

So the cause is height, and where the place is measured from, more than anything about the flowchart as such. On a 1440px screen the flowchart is one of the shortest sections (115px) and none of this applies. A rule that follows from the cause, not built: **a section taller than about a third of the screen is carried with a line; shorter ones slide.** On a phone that is the flowchart, the findings and a large graph. On a desktop the flowchart is short and would slide, where Mix uses a line. The other way to fix A would be to work out the place from the lifted copy's leading edge instead of the finger, so a tall section needs no more travel than a short one. Neither has been tried on a real phone.

### Where the builder would differ

Built exactly as decided. Two places where the evidence points somewhere else:

- **Boxes in the flowchart.** They are all one size in one line, which is the case where sliding is exact and cannot mislead (finding 1 below is about sections changing shape; boxes never do). A line there shows less than the slide did. Worth Rory comparing A's boxes with Mix's before this is settled.
- **The flowchart on a desktop.** It is short there, and the reasons above do not apply. If the rule were by height, it would slide on a desktop and use the line on a phone.

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

(Written before Mix. "Version A" and "version B" below are the two ways of dragging, which Mix combines.)

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
