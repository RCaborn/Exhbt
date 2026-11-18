# Edit on the page: the drag prototype

Status: work in progress (18 Nov 2026). This note is filled in as the prototype is built, so a later reader gets what was learned even if the build stops part-way. Sections marked "to come" have no result yet.

The lab page is `/lab/editor` (`app/lab/editor/page.tsx`, `components/lab/`). It is on in development, in tests and on the preview site (`EXHBT_LAB=1` in `env.preview.vars` of `wrangler.jsonc`), and not found on the live site (`isLabEnabled()` in `lib/site.ts`). No sign-in, nothing stored. The address carries the choices: `?sample=case-study|gallery|research`, `?look=exhbt|classic|night`, `?v=a|b`.

## What the two versions do

Both freeze the page when a section is picked up. Every section keeps its layout box until the drop; anything that moves, moves by a transform. The place the section would go is worked out from the page as it stood at pick-up and from where the pointer is, and from nothing that is shown during the drag (`components/lab/drag-plan.ts`). That is the reason neither version can flicker between two places: what the page shows never feeds back into where the pointer is taken to be, and another place has to be nearer by 10px before it takes over.

- **Version A, slide.** The other sections slide (180ms, translate only) to where they would sit, and a dashed box shows the room made for the lifted one.
- **Version B, line.** The page stays still. A line shows where the section would go: across the column between two rows, or upright beside a neighbour when the section would share that neighbour's row.

In both, a lifted copy follows the pointer on a card with the pack shadow and an outline in the look's link colour (jade in the Exhbt look). On drop, the section moves from where it was let go to its place and any neighbours that pair up again move with it (180ms, transforms only). With reduced motion nothing animates.

## What has been found so far

These are from building it; the measured checks and the recordings are still to come.

1. **Sliding cannot show a pair forming.** When a graph is dropped next to findings they share a row, and the findings get narrower. A slide that only translates (the Dragging rule: no scaling; and the rule here that layout boxes don't change until the drop) can move a section but cannot make it narrower. So version A shows where things go, in boxes that are still their old width, and the true shape arrives at the drop. Version B has the matching gap, more honestly: the line says "between these two" or "beside this one" and makes no claim about the shape.
2. **Today's page puts findings on the left even when the figure comes first in the order** (`runsOf` in `ProjectView.tsx`). In an edit-on-page editor that means a figure dropped to the left of the findings would land on the right. The lab draws a pair in the doc's own order. The design step has to choose one rule.
3. **Tiptap's own stylesheet changes the line.** It sets `white-space: break-spaces`, which breaks lines in different places from the published paragraph, and it switches ligatures off. It is unlayered, so it beats the site's layered CSS. The lab's context field turns it off (`injectCSS: false`) and writes the two rules it needs in `components/lab/lab.css`.
4. **The reset restyles Tiptap's inner paragraph** to 16px on a 24px line, whatever the line's own type is. The lab makes it inherit.
5. **A highlight that wraps is about 5px longer in the field than on the page.** A field keeps the space at the end of a wrapped line; a published paragraph drops it. Everything else on the case study (35 boxes: sidebar, pills, title, context line, flow boxes, findings, graphs, quote, what I'd do next, link) sits in exactly the same place and size in the lab as in the real `ProjectView`, on a 1440px screen and on a Pixel 7, in the Exhbt, Classic and Night looks.
6. **`ProjectView` has no place to put a field or a draggable flowchart**, so the lab composes the page frame itself with the same classes and uses the real parts (`Findings`, `Figure`, `SectionBlock`, `MethodFlow`, `runsOf`, the look wrapper) wherever nothing is typed. Findings, an image's caption and the flowchart are copies with a field in them. The rewrite of those files should give each a slot for its words.

## Stability, timing, typing, recommendation

To come.
