# Edit on the page: the drag prototype

Written 17 to 19 Nov 2026, for the design step of the edit-on-page editor. It records what was built, what Rory decided after trying it, what was measured, and what the builder would recommend.

The lab page is `/lab/editor` (`app/lab/editor/page.tsx`, `components/lab/`). No sign-in, nothing stored, never indexed. The address carries the choices: `?sample=case-study|gallery|research`, `?look=exhbt|classic|night`, `?v=mix|a|b`. It works on three fictional samples held in memory, drawn with the real page parts, and has a Reset button.

## Decisions so far

Rory tried the prototype on the preview site on 18 Nov 2026. In his words, and what was done with each:

| He said | What it became |
|---|---|
| "Flowchart on b works better, rest on a is better!" | **Mix**, now the default: sections slide to make room (A); the flowchart is carried over a still page with a line (B); the boxes inside the flowchart are carried with a line too. A and B stay on the switch. |
| "Grip thing good." | The handle is unchanged: a grip button in a corner toolbar, the only thing that drags. |
| "Plug and play maybe not quite there with the options yet!" | The "+" between sections now offers every kind a real exhbt can hold, by the product's own caps, each as a filled placeholder. A tray of blocks was added to drag from. Every section has Remove. |
| "maybe tray only there on desktop" | The tray is drawn from a 77rem window with a mouse or trackpad, and not at all on a phone. |

One thing to know when reading the first line. When he tried it, the boxes inside the flowchart dragged the same way in A and in B (they slid in both). So what he felt as different can only have been moving the flowchart section itself. Carrying a box with a line is new, and he has not said yet whether he prefers it to sliding. It is one line to change (`boxStyle` in `components/lab/options.ts`).

## What the builder recommends

1. **Keep the one engine under both styles.** The page is frozen when a section is picked up, the place is worked out from that frozen page and the pointer, and sliding or a line is only what gets drawn. Both styles pass every check below, so the choice between them is about what a person sees, not about which is safe.
2. **Slide where it tells the truth, and use the line where it can't.** Sliding is exact when nothing changes shape: a full-width section moving among full-width sections, a tile moving within the image grid, a box in the flowchart. It is wrong in shape when the drop would change a section's width (a pair forming or splitting, a section going into or out of the grid), because a slide may not resize anything. There the line is the honest picture. See "Where each is stable" for the still that shows it.
3. **Go by height, not by kind, for the flowchart.** What makes the flowchart feel worse sliding is that on a phone it is the tallest block on the page. A rule that follows from that: a section taller than about a third of the screen is carried with a line. On a phone that is the flowchart, the findings and a large graph. On a desktop the flowchart is short and would slide. Mix as decided treats the flowchart the same everywhere, which is simpler to explain and is what is built.
4. **Let flow boxes slide.** They are all one size in one line, the case where sliding cannot mislead. Built with a line in Mix as decided; A still slides them, so the two can be compared.
5. **Draw a pair in the order of the doc.** Today's page puts the findings on the left even when the figure comes first (`runsOf` in `ProjectView.tsx`). With drag and drop that would make a figure dropped to the left of the findings land on the right.

None of points 2 to 4 has been tried on a real phone. They come from measurements and stills.

## What each version does

Both styles freeze the page when a section is picked up. Every section keeps its layout box until the drop; anything that moves, moves by a transform. The place the section would go is worked out from the page as it stood at pick-up and from where the pointer is, and from nothing that is shown during the drag (`components/lab/drag-plan.ts`). What the page shows never feeds back into where the pointer is taken to be, and another place has to be nearer by 10px before it takes over. That is why neither style can flicker between two places.

- **Slide (version A).** The other sections slide (180ms, translate only) to where they would sit, and a dashed box shows the room made for the lifted one. Where they would sit is measured, not guessed: at pick-up each section's size is noted, and for each place tried, empty boxes of those sizes are laid out in a hidden copy of the page's own rows, so the pairing, the grid and the gaps are the real CSS.
- **Line (version B).** The page stays still. A line shows where the section would go: across the column between two rows, or upright beside a neighbour when the section would share that neighbour's row. The line is drawn above the lifted copy.
- **Mix.** Slide for every section but the flowchart; line for the flowchart and its boxes.

In all of them a lifted copy follows the pointer on a card with the pack shadow and an outline in the look's link colour (jade in the Exhbt look, mint in Night). It is never scaled. On the drop the section moves from where it was let go to its place, and neighbours that pair up again move with it (180ms, transforms only). With reduced motion nothing animates: slides and drops are instant.

From the keyboard (Space or Enter on the grip, arrows, Space, Escape) there is no pointer to carry a copy, so the section itself takes the lifted card. Sliding, it moves to each place in turn. With the line, it stays put and the line moves. Each arrow press moves one place in the order and is read out ("Quote would go to place 3 of 7"). Move up and Move down do the same without picking up.

Flow boxes are dragged by a grip on each box, along a row from 36rem of column width and down a column below that. A "+" on each arrow adds a box there, up to the limit of six.

## Where each is stable, and where not

"Stable" here means the place does not change unless the pointer crosses a boundary, checked by resting on a boundary and trembling 2px either side 40 times.

| | Slide | Line |
|---|---|---|
| Full-width sections | Stable. The slide is exact. | Stable. |
| Beside or inside a pair | Stable, but the picture is wrong in shape. Sections keep their old widths until the drop, so the landing box can lie across a neighbour's words, and a full-width graph that is about to become half-width sticks out past the page edge. Still: `desktop-a-pair-between.png`. | Stable and clear. The line stands between the two halves. It does not show how the row will re-form. Still: `desktop-b-pair-between.png`. |
| Inside the image grid | Stable. The best case for sliding: tiles are one size, so the shuffle is exact. | Stable. A line between two tiles. |
| Into or out of the grid | Stable. Same shape problem as a pair when the tiles change size. | Stable. |
| Touch (Pixel 7 profile) | Works. A tall section makes big jumps: see below. | Works. The lifted copy of a tall section fills a third of the screen under the finger. |
| Keyboard | Works. The section moves place to place. | Works. The section stays and the line moves. |
| Reduced motion | Sections jump to their places with no animation. | Nothing moves at all until the drop. |

The one bug found in use: the lifted copy made the page longer as it was carried past the foot of the page, so the page went on scrolling into empty space and the place ran on to the end. It was in both styles and worst for tall sections. Fixed by clipping the lab page at its own edges.

### Why the flowchart feels worse sliding

Measured on the case study, on a Pixel 7 screen (412 by 839):

| Section | Height on the phone | Share of the screen | Height at 1440 wide |
|---|---|---|---|
| Flowchart (a column of five boxes on a phone) | 327px | 39% | 115px (a row) |
| Findings | 300px | 36% | 300px |
| Graph 2 | 278px | 33% | 310px |
| Graph 1 | 239px | 28% | 239px |
| Quote | 111px | 13% | 81px |

1. **Each slide is as big as the lifted section.** When the flowchart passes one section, that section jumps 371px (the flowchart's height and one gap) in 180ms, which is 44% of the screen. A quote passing a section moves it 155px.
2. **The finger travels most of the screen before anything happens.** The grip is at the section's top corner, and the place is worked out from the finger. To move the flowchart down one place the finger has to pass the flowchart's own 327px, the 44px gap and half of the next section: about 520px, or 62% of the screen. The bottom fifth of the screen is where the page starts scrolling itself, so it cannot be done without the page moving. Sliding, that is the page scrolling and sections jumping at once. With the line it is only the page scrolling.

So the cause is height, and where the place is measured from. On a 1440px screen the flowchart is one of the shortest sections and none of this applies. Besides the height rule above, the other fix would be to work out the place from the lifted copy's leading edge instead of the finger, so a tall section needs no more travel than a short one. Not built.

## Adding blocks: the "+", Remove and the tray

All three read one list (`components/lab/blocks.ts`), which takes the kinds a layout draws from `FORMAT_RULES` and the room left for each from `roomFor` and `formatLimits`. Nothing is counted by hand in the lab.

- **"+" between sections.** Lists every kind the layout can hold, with an icon and its name in the layout's own words: findings, graph, image, quote, what I'd do next, link; research adds aim and conclusion; the flowchart is offered when it has been taken off the page. A kind with no room is listed, dimmed, with the reason under its name: "Up to 2 graphs in a case study", "One quote in a case study", "Up to 3 graphs and images together in research". Each kind arrives filled in (a small sample bar graph, a placeholder picture with a caption, a line of words), so the page still reads as an exhbt.
- **Remove.** A fourth button in every section's toolbar, the flowchart included. The focus moves to what took the section's place. There is no Undo in the lab; Reset puts the sample back.
- **The tray.** A rail of the same blocks, to drag onto the page.

### The tray's design, and why

- **Where.** Fixed to the window, upright, in the margin to the right of the page's 64rem frame, in the middle of the window's height. It never covers the page, it is there however far the page is scrolled, and it is clear of the top and bottom fifths of the window, where carrying something scrolls the page. A bar along the bottom was rejected for that last reason: picking a block up from it would start the page scrolling at once.
- **From what width.** 77rem (1232px). The rail is 6.5rem wide and starts 0.75rem after the page's content; 77rem is the narrowest window that leaves it clear of both the content and the window's edge with a scrollbar showing. It also needs a mouse or trackpad (`pointer: fine`), so a large tablet does not get it. Below that there is no room beside the page without covering it, and the "+" is the way to add.
- **Dragging.** What is carried is the block's own small tile; the dashed box on the page shows the size it will be. The block has no place while it is still over the tray. Once over the page it is placed by the same rules as a moved section, in the same style (slide, or a line in B and for the flowchart in Mix), and it pairs or joins the grid as a moved section would. Let go off the page and nothing is added.
- **Keyboard.** Every block is a button in the tab order. Enter adds it after the section the focus was last in, or at the end, and says so ("Image added after findings, place 3 of 9."). The focus stays on the tray.
- **Full kinds.** Dimmed, cannot be dragged, and the reason shows beside the block when it is pointed at or focused. Pressing it reads the reason out.
- **Phone.** No tray. The "+" sits at the left of each gap there, because four 44px toolbar buttons at the right reach the middle of the screen.

What should be different in the real editor: a new image should open the upload, and a new text block should open with its field focused, where the lab drops in stand-in words; Remove needs the one Undo the current editor has; and between 64rem and 77rem a desktop has no tray, which the design step should either accept or solve by giving the page's sidebar column to the editor while editing.

## Typing in the page's own type

The title, findings, flow boxes and image captions are textareas with no box of their own, so they take the face, size, weight, spacing and line height of what they sit in. The context line is a Tiptap field with one button, Highlight. Typing re-renders only the section being typed in, because each section reads its own slice of an outside store (`components/lab/store.ts`).

What was hard, and what was found:

1. **The page being edited matches the published page box for box.** On the case study, 35 boxes (sidebar, pills, title, context line, flow boxes, findings, graphs, quote, what I'd do next, link) sit in exactly the same place and size in the lab as in the real `ProjectView`, on a 1440px screen and a Pixel 7, in the Exhbt, Classic and Night looks. The one difference is item 4.
2. **Nothing moves on focus.** The focus ring is an outline, and the Highlight button sits outside the flow above the line's right end.
3. **Tiptap's own stylesheet changes the line.** It sets `white-space: break-spaces`, which breaks lines in different places from the published paragraph, and it switches ligatures off. It is unlayered, so it beats the site's layered CSS. The lab turns it off (`injectCSS: false`) and writes the two rules the field needs. The reset also restyles Tiptap's inner paragraph to 16px on a 24px line; the lab makes it inherit.
4. **A highlight that wraps is about 5px longer in the field than on the page.** A field keeps the space at the end of a wrapped line; a published paragraph drops it.
5. **Tiptap in a heading was not built.** The title is a textarea, which is enough for plain words. Tiptap's wrapper is a `div`, which cannot go inside a `p` or an `h1`; the context line had to become a `div` carrying the paragraph's classes. A rich title would need the same treatment and its own heading role.
6. **Tiptap starts after the first paint.** Until it has, the context line is drawn as the page draws it and swapped when the field is ready. Nothing moves in the swap, but for that moment the line cannot be typed in.
7. **`text-wrap: balance` works inside a textarea** (Chromium 153), so the title wraps as the published title does. The cost: the lines re-balance as you type, so a word typed at the end can pull a word down from the line above.
8. **Auto-grow.** `field-sizing: content` does it with no script. For browsers without it, setting the height from `scrollHeight` was up to 3.4px out on the title (whole pixels, and it counts the overhang of a tight line height). The fallback used instead is a hidden mirror of the words in the same grid cell, which comes out the same size to the pixel. `?grow=mirror` forces it.
9. **The caret** is the browser's own in every field. Enter is blocked, since each text is one paragraph. Undo works within a field and not across fields.
10. **An empty caption** shows a placeholder line in the lab; the published page draws no caption at all, so an image with no caption is one line taller while being edited.

## Measured

### The exact checks

`e2e/lab-editor.spec.ts`, written to be carried over to the real editor. Run on 19 Nov 2026 against the development server: **desktop project 45 passed** (7 touch tests skipped there), **Pixel 7 project 9 passed** (43 desktop tests skipped there).

- Typing in one section re-renders only that section: one render a keystroke, counted on `window.__labRenders`, for a finding, the title, a flow box, a caption and the context line.
- Nothing moves when a field takes focus: every section, pill, flow box, finding and figure compared before and after, on all three samples.
- Nothing moves when a drag starts, and until the drop the layout boxes (offsets summed to the board, and offset sizes) do not change: all three versions on all three samples. Slide moves sections by transform and never resizes one; the line moves nothing.
- The drop's motion is transform only, 180ms.
- Mix on all three samples: the flowchart with a line over a still page, by mouse and keyboard; any other section slides.
- A flow box: slides in A; in B and Mix every box stays where it is, the line is in the right gap and a copy the size of the box is carried.
- Dropped into a pair and into the image grid, the order is the place shown.
- No flicker on a boundary: across a pair's gap, down the side of a pair, along a row of the grid and between two rows of it, in all three versions.
- The keyboard moves a section across a pair, splits a pair, and goes into and out of the image grid, with each step read out and the order checked.
- The page scrolls itself with the pointer still, and stops at its end.
- With reduced motion `document.getAnimations()` is empty during and after a drag.
- The frames, handles, line and lifted copy take the look's colours, in Exhbt and Night.
- The "+" menu's kinds, caps and reasons on a case study and on research; filled placeholders; Remove.
- The tray: beside the page and clear of the scroll zones on all three samples, shown at 77rem and gone at 76rem; a block dragged into a gap, between the findings and a graph, and into the image grid; the line in version B; the keyboard route; a full kind refused by keyboard and by mouse.
- On the Pixel 7 project: handles always shown and at least 44px; a swipe on a section's words and on a picture scrolls the page and moves nothing; a quick swipe that starts on a grip picks nothing up; a 260ms press picks up; a flow box dragged down the column; no tray, and the "+" menu offers the same kinds as the tray would.
- axe (WCAG 2.1 A and AA): nothing found on any sample in any version, at rest, with a section lifted, in Night, while typing, and on the phone.
- The gate: off in production unless `EXHBT_LAB=1`, and `wrangler.jsonc` sets that for the preview Worker only.

### Timing

`node scripts/lab-timing.mjs`, against a production build, Chromium 153, CPU slowed four times through CDP, the gallery sample (the longest: eleven items), three runs. The drag picks up the lead image, carries it to the bottom edge, lets the page scroll itself to its end and drops it last. Frame times are the gap between one animation frame and the next, so they come in steps of 16.7ms.

| | Longest frame during the drag | Longest frame at the drop |
|---|---|---|
| Mix | 67, 67, 67ms | 67, 83, 67ms |
| A, slide | 67, 83, 67ms | 67, 83, 83ms |
| B, line | 67, 67, 100ms | 83, 133, 117ms |

In every drag the median frame was 16.7ms, the 95th centile 16.7 to 16.8ms, and one frame was over 50ms: the pick-up, when the page is measured and the lifted copy drawn. The drop is one React commit, a layout, and the start of the slide into place; the line's drop is a little longer because every section starts moving at the drop, where sliding has already moved them.

Typing 40 characters into a finding: keystroke to paint median 10.7, 11.7 and 11.6ms; 95th centile 18.1 to 18.3ms; longest 26.8, 19.1 and 20.4ms. No other section rendered.

There is no measurable difference between the styles while dragging. Without the slowdown these frames are about a quarter as long.

### The gate

`isLabEnabled()` in `lib/site.ts`: on when `NODE_ENV` is not production, or when `EXHBT_LAB=1`. That variable is in `env.preview.vars` of `wrangler.jsonc` only. The page is `force-dynamic`, so the answer is read at request time and one build serves both.

Checked on 18 Nov and again on 19 Nov on the final build (`next build`, then `next start -p 3213`):

| Run | `/lab/editor` | With a `workers.dev` Host header |
|---|---|---|
| No `EXHBT_LAB` | 404 | 404 |
| `EXHBT_LAB=1` | 200 | 200 |

With the lab on, a portfolio host still gets 404, because the middleware rewrites it to the portfolio routes. The page carries `noindex` in a meta tag and in the `X-Robots-Tag` header. `/lab` is left out of the page-view counter (`lib/page-views.ts`), so nothing at all is stored.

## Recordings

Made by `node scripts/lab-record.mjs` against the production build: a 1440 by 900 desktop with a mouse, and a Pixel 7 profile with touch input. A red dot marks the pointer or finger. Eighteen videos, each with a few stills: for desktop and phone, `a-pair`, `b-pair`, `a-grid`, `b-grid`, `mix-flowchart`, `flow-box-line`, `flow-box-slide` and `typing`; plus `desktop-tray` and `phone-plus-menu`.

They were read as stills and as contact sheets of frames a quarter of a second apart, not watched as moving video. Smoothness is judged from the frame timings above, not by eye. What the stills show:

- **Slide at a pair looks broken although it is stable.** Carrying the quote between the findings and the graph beside them, the landing box lies across the findings' words, and the second graph, still at full width, runs off the right of the page.
- **The line at the same place is clear.** One upright line between the two halves, the page untouched.
- **Slide in the grid is the picture one would want.** Tiles shuffle along by one slot and the dashed box is the size of a tile.
- **On a phone the lifted copy of a tall section covers the place it is going.** With the flowchart, the copy fills a third of the screen below the finger. The line was hidden under it in the first recordings and is now drawn above it.
- **The tray reads well.** The carried tile is small and the dashed box shows the real size, including beside the findings.
- **Four 44px buttons on every section crowd a phone.** They reached the "+" in the middle of the gap, which is why the "+" moved to the left there.

## Not verified

- **A real phone.** Touch was driven through Chromium's touch input on a Pixel 7 profile. Only a real finger can tell: whether a 150ms press feels like a deliberate pick-up or a delay; whether the finger hides the grip, the line or the landing box; whether a copy that hangs down and to the left of the grip suits both hands; whether the page scrolling under a held section is the right speed; whether the grips, which sit down the right edge where a thumb scrolls, get in the way (a swipe that starts on a grip does not scroll); and how any of it feels with the on-screen keyboard open.
- **Safari and Firefox.** Only Chromium is installed here. Two things to look at first: `field-sizing` (the mirror fallback is tested, but only in Chromium), and whether a container query's element becomes the containing block for fixed things there, which would misplace the flow box's lifted copy and the tray. Both are drawn in the look's wrapper to avoid it.
- **A screen reader.** The announcements are checked as text in a live region, not heard.
- **The deployed preview Worker.** The gate was checked with `next start`, not on Cloudflare.
- **Print, and the five other looks.**

## What the real editor will need

- **Slots in the page parts.** `ProjectView` has no place to put a field or a draggable flowchart, so the lab composes the page frame itself with the same classes and uses the real parts (`Findings`, `Figure`, `SectionBlock`, `MethodFlow`, `runsOf`, the look wrapper) wherever nothing is typed. Findings, an image's caption and the flowchart are copies with a field in them. The rewrite of those files should give each a slot for its words.
- **A place for the flowchart in the order.** A stored exhbt keeps it fixed above the sections. The lab makes it an item in the order so it can be dragged and removed.
- **Find a section by its id, never by a kept reference.** A section that changes row is a new DOM node, because React cannot move a keyed child from one parent to another. Focus, the slide into place and the render counters all go by id.
- **Follow the pointer directly.** dnd-kit's sensors, press delay and page scrolling are used as they are, but the lab reads the pointer itself: dnd-kit's own figure includes scrolling for a section and leaves it out for something fixed to the window, such as a block from the tray.
