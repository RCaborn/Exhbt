# Notes for the release 3 agents from the agents before them

Written by the main session, 19 Nov 2026, from the release 2 agents' reports and agent A's. Where a note and a brief differ, the note is newer: say in your report which you followed.


From agent C (part 1 report, 19 Nov 2026):
- layout-rows.ts also exports stackItemClass, stackEditClass, cellClass, cellItemClass and stackIsRow. The grid's tiles, the gallery's link columns and research's reference lines each have a cell that LayoutMain draws on both pages, so G's frame sits inside the cell.
- In a stack every part is in its own frame; spacing between stacked parts in edit mode comes from xp-stack-edit-method / xp-stack-edit-closing (rules in globals.css).
- G's frame must carry min-w-0 as well as rowClass (a frame without it can grow to its content's width in a one-column grid).
- The image caption's field name cannot say "Image n caption": ItemView gets only { item, as, ctx }. Proposal: the adapter's rich() names it from the path (sections.N.caption), since the adapter has the doc. (Or PageItem gains its number.) Decide in G's brief.
- structureKey doesn't read an image's w and h, but a grid tile's cell shape (--r) depends on them. A picture replaced by one of another shape keeps the old tile shape until the structure changes. J (replace picture) or G must re-render the tile when w/h change; or B's structureKey includes w/h. Decide before J starts.
- The harness's work() draws the button (the sidebar sits above the main column on a phone, so a missing button would move everything). G's WorkButton stub draws the button too.
- Error colour: #c92324 in every look but Night, which gets #e25958 (5.30 ground / 4.86 cards / 4.51 well). Open question 10.
- MethodFlow draws nothing for an empty flowchart unless it is being edited.

From agent B (final report):
- structureKey also covers kept sections.
- moveItem, removeItem and restoreFlow return the same object when there is nothing to do.
- GET /dev/parity?id= answers { working, published, aiVersion }. POST /dev/parity { username, slug, doc, working?, publishedAt?, plan?, extraFiles? } answers { id, url, files }. An image section with fileId "" gets no picture.

From agent C (final report):
- Build's links use xp-outline-button; "Before"/"After" labels sit above each card; the public page shows a My role fact when myRole has words; Build's picture rows keep each card's own height; Gallery, Build and Event set the title closer to the top; an over-cap gallery's second graph is a plain full-width row.
- A placeholder in --xp-muted cannot be read on the flowchart's dark last box (K must handle the last box's placeholder colour).
- The image description line wraps to two or three lines in a narrow gallery tile (J/G: allowed in box-for-box by name; check it looks right).
- B's edge case: an arranged case study whose image has no file draws graph then findings as a mirrored pair; harness fixture case-missing-image, left out of the box tests.
- edit-slots: 78 tests, about 3.8 minutes; portfolio-card about 25 s.

From agent A (the gate; branch phase-2-r3-a-gate, head 881ad32):
- standInAdapter's signature is standInAdapter(doc: ExhbtDoc, base: Omit<PageCtx, "edit">), not standInAdapter(): the item, skills, work and description slots carry ids, not content. The ctx must have Sub "h3" under headingLevel "h2". G owns it after A's merge.
- StandInPage passes ProjectView the look's photo shape, homeHref: liveBase ?? "/portfolio", confirmed={false} and no checkedOn. G must match these or change both.
- The stand-in carries no ids or data-path, so a test or a jump never lands on it.
- The image description takes its caption's type by the item's `as`: text-sm normally, 0.8125rem on a gallery tile, inset px-1 on the lead image. J must match.
- In development the editor's chunk is _app-pages-browser_components_exhbt-editor_EditorShell_tsx.js, so page.route(/EditorShell/) holds it back or fails it.
- Contrast: --xp-muted placeholders are nearly invisible on the dark last flowchart box. G or K must settle it (same as C's note).
- reportFiles is filled from store.listFiles(user.id, id), kind source, mime application/pdf, minus draft helper files, each with a signedFileUrl link.
- The crash fallback's address drops drafted, why, fig and crash, because classic Editor.tsx:160 replaces the address with the bare path (which dropped editor=classic). The draft's one-line note is not shown after a crash.
- The "Back to the new editor" line shows only when the address asked for classic and editorKind() is page.
- After A is merged, these specs reach a bare /edit and will get the new editor: auto-figure, exhbt-page, file-ownership, phase2-billing-polish, phase2-draft-tools, phase2-editor-media, phase2-editor, phase2-formats, phase2-graphs, phase2-polish-2, phase2-sections, phase2-teammates, possibly phase2-draft and phase2-saved-ideas. For N's milestone 0: set the /dev/editor?kind=classic cookie in the helpers after sign-in (most reach /edit by redirect, so changing addresses won't keep them on classic).
- Specs: editor-classic 8 tests 2.0 min; editor-classic-keeps 15 tests 2.5 min; edit-slots 78 tests 4.7 min.

## From agent G's milestone 1 (c1bb09d, merged into phase-2-r3)

The interfaces in the briefs are built word for word: `store.ts` (`EditorStore`, `useStore`, `useDoc`, `useSection`, `useRenderCount`), `context.ts` (`PageEditorProps`, `SheetName`, `Ui`, `ActiveRich`, `useActiveRich`, `useUi`, `useEnv`, `useIssues`, `useSave`), `files.ts` (`Files`, `useFiles`), `drag/index.ts` (`Board`, `DragBoard`, `useBoard`), `drag/options.ts` (`SECTION_STYLE` "slide", `FLOW_SECTION_STYLE` "line", `FLOW_BOX_STYLE` "line"), and every plug with its stub.

Additions you may use:
- `Frame.tsx` exports `useFrame()`, returning `{ id, kind, as, index (stored), place, count }` or null. J uses this for `ImageExtras` and `LinkExtras` rather than changing `ExtraSlot`.
- `ui/Sheet.tsx`: `<Sheet name title>` is a native `<dialog>`, opened by `ui.open(name)`; it draws its children only while open and returns focus on close. I's and J's sheets wrap their content in it.
- `context.ts` also exports `STALE_EDITOR` (the stale-editor words carried by `useSave().status.error`), `useUiState(select)` and `useRuntime()`.
- `store.ts` exports `useStoreInternal()`: `shell()`, `version()`, `section(id)`, `listAdd`, `listRemove`, `listMove` (each one undo entry for a finding), `entries()`, `onDropped`, `onUndone`, `replace(doc)`. The pure core is in `store-core.ts` and `undo.ts`, with relative imports so specs can test them in-process.
- `labels.ts`: `labelOf(doc, id)`, `labelAt(doc, place)`.
- `geometry.ts`: `PILL`, `descriptionClass(as)`, `DESCRIPTION_PLACEHOLDER`, `descriptionLabel(n)`, `workWords`, shared by the stand-in and the editor (J's description field must use them).
- `jump.ts`: `jumpTo(path)`, `targetOf(path)`; each jump sends a bubbling `xe-jump` event.
- `files.ts` controller: `useFilesController()`, `useImageUrls()`, `pickAt()`.
- Development only: `window.__exhbtEditor` (the store) and `window.__exhbtUi` (the view's actions, e.g. `setVisitor(true)`).
- CSS classes other agents may restyle: `xe-tools`, `xe-tool`, `xe-insert`, `xe-chip`, `xe-over`, `xe-above`, `xe-status`, `xe-sheet`. Toolbar buttons carry `data-grip`, or `data-tool` = `up`, `down`, `action`, `more`, `remove`.
- Page object `e2e/page-editor.ts`: everything the brief lists, plus `typeIn(page, path, words, {append})` (waits for a formatted field's editor), `docNow`, `undoLabel`, `differences`, `canon`, `settle`, `freshName`, `READY`. `boxes()` measures the "Add a skill" box under the key "the Add a skill box".

Where G departed from the brief, or followed these notes over it:
1. Fields whose words the page sets inline (a quote's words, name and role; a pull quote; a link's words) are inline `contenteditable="plaintext-only"` spans, because a textarea cannot flow inside quotation marks or along the "name, role" line. Every other plain field is a textarea with `field-sizing` and the mirror fallback.
2. `rich()` names a caption from its path ("Image 2 caption").
3. The frame carries `min-w-0`.
4. `standInAdapter(doc, base)` keeps its two arguments.
5. A picture's `w` and `h` change the shell, so a grid tile's `--r` redraws.
6. A placeholder in the last flowchart box uses `--xp-flow-end-soft`. K may change it.
7. "More actions" reuses the classic `BlockTools` unchanged, with its `DraftTools` built on the store in `draft-tools.tsx`, so a rewrite and "Back to the AI version" are each one undo entry.
8. The top bar stub's button reads "Review and publish" (0026's one label), so it does not clash with the sheet's own Publish.
9. `RichField` makes its Tiptap editor only on click or focus (idle start-up comes in G's milestone 2). In tests use `typeIn()`, or wait for `.ProseMirror` to have focus before typing.
10. No stored file is deleted yet; the deletion rule comes in G's milestone 2.

## From agent H (the top bar, merged into phase-2-r3)

- `components/exhbt-editor/topbar/`: `TopBar.tsx`, `LayoutMenu.tsx` (with `MENU_LINES`), `UndoButton.tsx`, `WordBar.tsx`, `ThingsToFix.tsx`, `SaveStatus.tsx`, `MenuButton.tsx`, `Popover.tsx` (the shared panel button and `useNarrow`).
- On a phone (under 48rem) the row keeps only the back link, the word count, things to fix (icon plus count), the save status, the menu and "Review and publish". The phone's menu holds the layout menu, Undo, "See as a visitor" and "Card and link details": a test at phone width must open "Menu" first.
- Under 100rem some buttons are icon-only with full accessible names; the word bar's "aim for N, at most M" shows from 88rem; "Review and publish" wraps under 64rem; the row is full window width.
- Names: the layout button is "Layout: <name>"; Undo's accessible name is always "Undo: <label>" (visible label from 100rem); issue buttons in the panel carry `data-issue-path`; the layout status line is `[data-layout-status]`; "Show me"; "That's right: <number>".
- Things to fix: before publishing has been tried, its count and visibility come from `useIssues().shown` plus the numbers to check, so a blank exhbt shows no button.
- Right after an AI draft, `LayoutMenu.tsx` says the layout line once and removes `drafted`, `why` and `fig` from the address.
- The `h1` (`#xe-heading`, `tabIndex={-1}`) is visually hidden until 100rem; Undo sends focus to it when nothing is left to undo, otherwise to the first field of the section brought back, or its frame.
- The Draft/Live chip and "Unpublish" read `env` props from page load; G is adding a live status that I's publish sheet updates.

## From agent I (the sheets, merged into phase-2-r3)

- `sheets/PublishSheet.tsx` ("Review and publish"), `sheets/CardSheet.tsx` ("Card and link details": summary `#summary` / `data-path="summary"`, the headline pair `data-path="headline"`, and a live `ExhbtTile` with `exhbtSummary(doc)` under it as `data-testid="tile-summary"`), `sheets/WorkPanel.tsx` ("The work"), `sheets/WorkButton.tsx` (`data-path="evidence"`, reads "See the work: <name>" to match the page).
- `sheets/live.ts`: a small atom for the live status, `setLive(id, status, slug)` and `useLive()`. Publish and Unpublish each call `setLive`. G is to make this the editor's live status (or re-export its own from here) and the top bar's chip read it.
- `sheets/paths.ts`: `sheetOf(path)` and `useShowMe()` ("Show me" closes the publish sheet, waits 50 ms, opens the right sheet and focuses the field).
- Known gaps for G: `ui.jumpTo(path)` does not open a sheet for sheet paths (`summary`, `headline`, `evidence`); `ui/Sheet.tsx`'s `onClose` closes whatever sheet is open, so a late close can shut the next sheet.

## From agent G, milestone 2 (merged into phase-2-r3 at db74802)

What it built:
- Plain fields are textareas wrapped in `.xe-field`; the inline fields (a quote's words, name and role, a pull quote, a link's words) are editable spans in `.xe-field-inline`.
- Formatted fields start their Tiptap editor in idle moments, or at once on click. In tests reach them with `textbox()` or `typeIn()`. The focus is on the `.ProseMirror` inside the `[data-path]` box, so use `focusedPath(page)` to read the focused field's path.
- A field with an issue has an outline in the look's error colour and `aria-invalid`; the message shows only while it has the focus.
- `ui.jumpTo(path)` lands on every kind of issue path. Card, work and chart paths open their sheet first; a link's address opens its popover; a path with no field lands on its anchor's button.
- One live status lives in `context.ts`: `setLive`, `useLive` and `useStatus()` (which also gives `liveUrl` and `set`). `sheets/live.ts` re-exports it. The publish sheet calls `setLive(id, "published", slug)`, Unpublish calls `setLive(id, "draft", slug)`. I's `useShowMe` can call `ui.jumpTo(path)`.
- A sheet's late `close` no longer shuts the next sheet, and takes the focus back only if nobody has moved it.
- The file rule: a stored file is deleted only under 0026's four conditions. When the visit ends (unmount, or a `pagehide` that doesn't keep the page) the undo list stops protecting a file.
- The crash fallback's pending doc is kept per exhbt.
- The kept-sections list, the offer to restore a copy kept in the browser, pictures dropped on the page, focus after Undo, and `/dev/editor-timing` (404 unless `EXHBT_LAB=1`; `noindex`).
- `EDIT_ONLY_IN_FLOW` now also names the title, a flowchart box and a finding (each shows a placeholder the visitor's page doesn't have), and `allowEditOnly()` applies the list.
- `pickAt()` defaults to the end of the page. `waitSaved` needs a `role=status` that reads exactly "Saved".
- CI's e2e job runs on 6 shards.
- DESIGN.md, MAP.md, HANDOFF.md and AGENTS.md describe the editor as it is at release 3.

Tests (one worker): `editor-smooth` 7/7; `editor-classic` 10/10; `editor-inplace` 93 tests, about 14 minutes. A whole-file run of `editor-inplace` on db74802 is still to do; the main session runs it at integration.

Known faults for others:
- H's `e2e/editor-topbar.spec.ts:203` is a race: it expects `data-path` on the focused element, but a started formatted field puts the focus inside the box. Fix it with `focusedPath(page)`.
- The "Edit figures" chip covers the end of the graph's title (J).
- At phone width the grid tiles' section toolbars overlap until `phone.css` shows only the grip, and the formatting buttons below the last finding run into them (L).

For K: box and finding actions and their undo are tested on the store without a page. The last box's placeholder uses `--xp-flow-end-soft`.
For J: the description must stay the figure's last direct child, with `data-edit-only="image-description"`, and use `descriptionClass(as)` from `geometry.ts`. The shell already handles pictures dropped on the page.
For L: hide `.xe-format` wherever your bar holds the formatting buttons; a finding's controls stay small under touch, so your bar should carry them on a phone.

Not verified by G: Safari, Firefox, a real phone, a screen reader, the Worker build.

## From agent N, list 1 milestone 0 (merged into phase-2-r3 at 617b9e5)

- `e2e/editor.ts` exports `keepClassic(page)`. It visits `/dev/editor?kind=classic`, which sets the `exhbt-editor-kind` cookie, and checks the answer is `{editor:"classic"}`. `signInAs`, `signInToDraft` and `draftAndOpen` call it.
- Every spec on both of N's lists also has `test.beforeEach(({ page }) => keepClassic(page));`, because many sign in inline or reach `/edit` by redirect. No assertion changed. Milestone 1 removes these spec by spec as each moves to the new editor.
- Counts, one worker, every test passing: phase2-editor 10, auto-figure 32, phase2-draft 11, phase2-formats 81, phase2-editor-media 15, phase2-graphs 16, phase2-draft-tools 11, phase2-sections 15, phase2-polish-2 13, phase2-teammates 7, phase2-billing-polish 7, exhbt-page 16, file-ownership 1, phase2-saved-ideas 7 (`docs/briefs/edit-on-page/r3-n-milestone-0-counts.md`).
- Flaky from sandbox memory or cold compile, not the switch: phase2-sections "stand-in AI drafts a quote" passes alone in about 54 s but once hit the 90 s timeout on a cold compile.
- The baseline run on `phase-2-r2` was not done (no memory for a second server).

## From agent F, drag, the "+" and the tray (merged into phase-2-r3 at 97222cf)

What it built (`components/exhbt-editor/drag/`, `Insert.tsx`, `Tray.tsx`, `scripts/editor-timing.mjs`):
- Pick-up freezes the page. The place is worked out from the frozen boxes and the pointer, using the layout's own rows, with 10px of stickiness. Sections slide by transform, with a dashed box showing the room made. The flowchart section is carried over a still page with a line. The drop moves everything into place in 180ms, transforms only; nothing animates under reduced motion.
- The lifted copy is drawn with `ItemView` and no adapter, on a card in the look's link colour, never scaled, and clipped so it can't make the page longer.
- dnd-kit is used only for its sensors: a mouse picks up after 6px, a finger after a 150ms press with 8px of give. The engine scrolls the page near the edges itself (there is no `DndContext`).
- Keyboard: pick up, move one place at a time, drop, cancel; Tab drops. Move up and Move down use the same motion and keep the focus. Every step is read out.
- The hidden measuring copy lays out the rows as empty boxes in the real main column; it matches every sample to within 1px.
- The "+" lists every kind from `blockOptions` with an icon and the words left, a full kind dimmed with its reason. "Take a figure from my report" calls J's `canTakeFigure`, which returns false until J builds it. A new graph opens its figures sheet, a link jumps to its address, an image opens the picker. On touch the "+" sits at the left of the gap.
- The tray shows from a 77rem window with a mouse, fixed beside the page. Blocks drag in (the flowchart's included); Enter adds after the section last in focus, or at the end. Its words-left id is `tray-words-left`.
- Markup that differs from G's stub: the end "+"'s `data-path="sections"` is on a span round the button; menu items and tray blocks carry `data-block`, not `data-kind`. G's `.xe-insert-button` and `.xe-insert-menu` rules in `core.css` are now unused.

Tests (local merge with e3a70dd, one worker): `editor-drag` 48 desktop + 1 touch; `editor-smooth` 7/7; `editor-inplace` 93/93 after F's fix. One `fixme` in `editor-drag`: a new link opening its "Web address" popover, waiting on J.

Timing (production build, 4x slower processor, gallery sample, 3 runs): drag median frame 16.7ms, 95th 16.8 to 33.3ms; key to paint median 34 to 43ms. **The drop's longest frame is 183 to 267ms** (the prototype's was 67 to 117ms). F traced it to re-rendering, not to its own code (about 4ms):
- every frame whose stored index shifts draws again, about 10ms each, because its fields' paths are built from `at` (G's `Frame.tsx`, C's parts);
- `LayoutMain.tsx` keys each row by its first item, so 9 frames remount on a big move.
Being fixed next (G).

For L: `useBoard()` works outside `DragBoard` (one engine per store); the phone bar and reorder sheet should use `moveBy`, `remove` and `add` for the same motion, read-outs and focus. `[data-xe-drag]` sits on the main column during a drag (hide the phone bar with it). `window.__exhbtDrag.state()` exists in development for tests. On narrow grid tiles a tile's toolbar overlaps its neighbour's.
For K: read `FLOW_BOX_STYLE` from `drag/options.ts`; hide box tools while a section is carried (`[data-xe-drag] …`); reuse `MOVE_MS` and `EASE` from `drag/engine.ts` and the `.xe-line` and `.xe-card` styles; don't use `data-grip` or `.xe-grip` on box grips.

Departures and open points: sliding at a pair keeps the sections' widths until the drop (stable, never flickers); grid tiles have half-tile anchors, so pointing over a tile goes before or after it (a change from the prototype Rory tried); a new block's room is a guess. Still to check with a real finger: whether the 150ms press feels deliberate, whether the finger hides the grip or line, edge-scroll speed, grips at the right edge, the on-screen keyboard. Not checked: Safari, Firefox, a screen reader.

## From agent K, the flowchart (merged into phase-2-r3 at b5701c1)

What it built (`components/exhbt-editor/flow/FlowEdit.tsx`, `FlowList.tsx`, `FlowBox.tsx`, `geometry.ts`, `css/flow.css`, `e2e/editor-flow.spec.ts`):
- Type in each box; a "+" over each arrow and one after the last box (gone at 6); Remove on each box (off at 3, with `aria-disabled` so it can be focused and says "The flowchart needs at least 3 boxes."); drag a box by mouse after 6px, a finger after a 150ms press, or the keyboard from its grip. Line style by default, slide by `FLOW_BOX_STYLE`. Every step is said through `uiApi.say`; dnd-kit's own announcements are off.
- A box lands where its middle is nearest the pointer, with 10px of stickiness; more than 80px to the side of the flowchart means "not over a place", and letting go puts it back.
- `MethodFlow.tsx` is unchanged. The `list` slot's wrapper carries `data-path="flow"`, `tabIndex=-1`, `aria-describedby`, the `--xp-error` outline and the count message.
- An empty flowchart shows a single "Add a box" button in the flow.
- Tools sit over the box's right edge in a column, along its foot at the right in a row; chips are 28px to the eye with 44px targets. Under touch in a row, a box's tools show only while it has the focus (0026 says always on touch; always-on would sit under the next section's toolbar).
- "Things to fix" for the count issue lands in box 1 (G's `land()` puts the cursor in the first field).

Hooks for tests and for L: `data-flow-grip`, `data-flow-remove`, `data-flow-add` (with `data-end` on the last), and on the list `data-axis` (row or column), `data-flow-style`, `data-flow-drag` while a box is carried; classes `.xe-flow`, `.xe-flow-tools`, `.xe-flow-chip`. Nothing of K's carries `data-grip` or `data-tool`. On a phone the flowchart is always a column with tools and "+" always shown. The copy and line draw at z-index 40.

Tests (one worker): `editor-flow` whole file, line style, 41 passed (5.9 min); slide style 37 passed + 4 spec assumptions fixed and re-run 4/4; `layout-parity` 24/24; `editor-smooth` 7/7. Not run on K's branch: `editor-inplace`, `edit-slots`, anything with F merged.

For tests: dnd-kit starts listening for arrow keys only after a short delay, so wait until "Picked up box n of N" has been said before pressing an arrow.
For G: undo of a box action moves the focus a frame or two late; box undo entries have no subject, so the focus never lands back in the flowchart. `EDIT_ONLY_IN_FLOW` has no entry for the empty flowchart's "Add a box" button.

## From agent J, figures, pictures and links (merged into phase-2-r3; head 938bb05)

What it built (`components/exhbt-editor/figures/`: `ChartSheet`, `DraftedGraph`, `FigureSheet`, `GraphExtras`, `ImageExtras`, `LinkExtras`, `take.ts`, `anchor.ts`; `css/figures.css`; `app/(app)/exhbts/[id]/figure-actions.ts`; `e2e/editor-figures.spec.ts`):
- Graphs: the "Edit figures: Graph N" chip sits on the card's bottom-right edge, clear of the title (tested). Clicking the graph opens the sheet too. A graph with no numbers shows "Add your numbers". `ChartSheet` ("Edit figures: <label>") holds `ChartEditor` with `bare`; each change is a `store.patch` with no undo name, so the page redraws as you type. The sheet adds `data-path` to `ChartEditor`'s fields after each draw so the jump lands on the exact field.
- The picture description is the figure's last child with `descriptionClass(as)`. "Needs a description" sits after the placeholder's last word; where it doesn't fit (a narrow gallery tile) it becomes a red dot, with the words kept for screen readers.
- The picked figure: a label on the picture's top edge holds "From your report, page N" and, while unticked, the tick "I may share this" (`data-path="…picked.shareOk"`). Its button opens a native popover with the existing `PickedFigure` strip (Crop, Choose another page; no AI call). On the gallery lead image the label sits just inside the top edge.
- Links: the "Web address: Link N" chip is always shown and marked while the address is missing or not full https. It opens a native popover with the cursor in the field; Enter closes it; the issue shows inside. On a reference line the chip sits on the rule between lines. `figures/anchor.ts` keeps popovers on screen at 390px.
- "Take a figure from my report": `canTakeFigure` is true when the layout takes something from the work (not Essay), there is a stored report and no picked image yet. `FigureSheet` (choose page, crop) uploads the picture and makes one `patchDoc` named "take a figure" through `withKeyFigure`. The figure starts unticked and removes no graph.
- "Put it back": owner-only, read-only server action `draftedGraph(id, index)`. `DraftedGraph` offers it only when a graph was kept, the exhbt has no graph, no picked image is a graph or table, and the layout has room. One `patchDoc` named "put the drafted chart back"; research puts it first among the figures. Its unconfirmed numbers join the numbers to check.
- Shared-file changes: `components/editor/PickedFigure.tsx` exports `sourceBytes`, `asFile`, `PagePicker` and `Cropper` (nothing else changed). F's link-popover `fixme` in `editor-drag` is now a real test and passes.
- Tests (one worker, chained run at 938bb05, 141 passed, 21.2 min): `editor-figures` 9/9, `auto-figure` 32/32 (classic), `editor-inplace` 93/93, `editor-smooth` 7/7; the `editor-drag` tests touching J's work pass.
- For G: `Files` has no method to register an upload not placed through `addImages`; `FigureSheet` sets the address through `useFilesController().state` and calls `files.settle()`. A proper method would be better.
- Open: only the first kept graph comes back (a case study can draft two); a picked results table replaces the drafted chart like a graph (for Rory to confirm); the picked label wraps to two lines in a narrow case-study figure; a duplicate tick shows in the popover while unticked (kept in sync).

## From agent L, the phone (merged into phase-2-r3 at f2e0300)

What it built (`components/exhbt-editor/phone/PhoneBar.tsx`, `ReorderSheet.tsx`, `usePhone.ts`; `css/phone.css`; `e2e/editor-phone.spec.ts`, `e2e/editor-tablet.spec.ts`). A phone is `(max-width: 47.99rem) and (pointer: coarse)`; `usePhone()` is that test in code.
- On a phone each section shows only its 44px grip, half over its top-right edge; a picture's grip sits in its own corner; the flowchart's grip sits left of K's box tools. `[data-tool]`, `.xe-list-tools`, `.xe-shell-tools` and `.xe-format` are hidden.
- `PhoneBar` at the foot follows the part with the focus or the part last tapped, and names it: Move up, Move down (`board.moveBy`), the layout's action, More actions, Remove (`board.remove`), Reorder; for the title, context line or skills, their More actions; with nothing chosen, "Add" (opens the end "+" with its menu in view) and Reorder. "Undo: <label>" shows in a row above after a move, remove or drop. While a formatted field has the cursor: Highlight or Bold and Italic, Link, a finding's own move and remove, and Done (focus to the section's grip). `--xe-phonebar-h` on `:root` lifts G's `.xe-status` above the bar. The bar hides under `[data-xe-drag]` and in "See as a visitor".
- The bar follows `visualViewport` and lifts only when the viewport loses height but not width; it scrolls the caret clear of itself.
- `ReorderSheet` ("Reorder sections", full screen on a phone): one 3.5rem row per page item, flowchart included, with grip, name, Move up and Move down; a 150ms press picks up; each drop or button is one `store.move` (not `moveBy`, because the page behind the modal is inert); its own live region.
- Fixes: sheet close buttons 44px on every touch screen; link prompt controls 44px; a "+" opened at the foot of the screen brings its menu into view; no tooltips under `(hover: none)` (a hovered right-edge tooltip had widened and zoomed the page).
- Other owners' selectors restyled in `phone.css`: `.xe-frame .xe-over` and `.xe-above` clear the grip (provisional until J's markup was in); `.xe-chip::before` 44px press; `.xe-link-ask` 44px; `BlockTools` in the bar with `!important`; `.xe-add-finding` moved `left: 3.25rem` on coarse pointers because F's "+" covered it (G or F to confirm).
- New interface words: "Tap a section", "Add", "Reorder", and "Hold a grip to drag a section, or use the arrows. Each move can be undone."
- Tests: `editor-phone` 25/25 (touch), `editor-tablet` 5/5, `editor-smooth` 7/7, `editor-inplace` 92/93 plus 1 alone after the server was killed for memory.
- Requests: G, export `actionsFor` from `Toolbar.tsx` (the bar re-derives the layout action); `.xe-pill-remove` is an 18px press under touch; after an Undo on a phone, focusing the grip rather than the first field may stop the keyboard opening. F: on a phone the "+" at the left of a small gap covers the first letters of the next heading (research's "Hypothesis"). K: the last box's Remove press is trimmed by "Add a box at the end". H: "Delete this exhbt" in the phone menu may be under 44px.
- For Rory to try with his thumb: the bar with the keyboard open (Android Chrome and an iPhone); the 150ms press; thumb reach; the corner grips while scrolling the right edge; scrolling while a section is held; Undo popping the keyboard open.
- Not verified: Safari on an iPhone (`visualViewport`, fixed positions, `:has()`), Firefox, a screen reader, pinch zoom.

## From agent K, follow-up beside F's drag (merged into phase-2-r3 at 3c50016)

- On a touch screen in a column, a box's grip sits on its right edge and Remove on its left, near the top and 15px out into the page's gutter, clear of the "+" between sections and the next section's toolbar. Desktop is unchanged.
- K's tools and box "+" are hidden, and take no pointer, while F carries a section (`[data-xe-drag]`) and while one of K's boxes is carried.
- Remove's larger target reaches down, not up, so it no longer trims the "+" before a case study's flowchart. Every flowchart chip measures as a full 44px press by L's method, so L's `KNOWN` list can drop `.xp-flow-box[data-last] [data-flow-remove]`.
- Tests on the merged branch: `editor-flow` + `editor-phone` (touch) 30 passed; the 27 flowchart tests of `editor-inplace` passed; `editor-flow` (both projects) 52 passed; `editor-drag` 47 passed, 2 failed from Chrome crashes when memory ran out.
- For whoever owns `e2e/editor-drag.spec.ts` now: F's eight-looks contrast test (about line 749) can run past its 90s limit on a busy machine. Split it into one test per look, as K did for the flowchart.
- G's `RichEditor.tsx` (line 111) took the focus when an editor finished loading, even after the person had moved on; G's 2caae8c addresses it.

## From agent L, follow-up after J and K (merged into phase-2-r3 at 020dfa5)

- J's parts at 390px: the "Edit figures" and "Web address" chips sit mid-foot and cover no grip, "+" or flowchart chip. L's provisional `.xe-frame .xe-over` rule is gone; `.xe-above` stays. When a picture has a picked label, its grip moves down to sit under the label (`.xe-frame[data-kind="image"]:has(.xe-fig-picked) > .xe-tools { top: 2.25rem }`), because the grip had covered the tick. Both popovers open on screen; the address popover sits above the bar. `ChartSheet` and `FigureSheet` fill the screen with a 44px close; on a phone every control in a sheet (the classic `ChartEditor` fields, buttons, graph-type cards, checkbox labels) is at least 44px.
- F's "+" in a gap on a phone is 32px to look at with a 44px press, in the top 32px of its gap, so it no longer covers research's "Hypothesis". In the gallery the first "+" still sits over the lead picture's top corner (no words).
- Every button in the top bar's menu, and "Yes, delete" and "Cancel", is 44px on any touch screen.
- `KNOWN` in `e2e/editor-phone.spec.ts` is `[".xe-pill-remove"]`; empty it once G's 44px press for the skill remove lands.
- Other owners' selectors L now restyles: `.xe-sheet` controls, `.xe-plus` in gaps, `.xe-menu-items button`, plus the earlier `.xe-above`, `.xe-chip::before`, `.xe-link-ask`, `.xe-add-finding`, `.xe-sheet-close` and `[data-tip]::after` under `(hover: none)`.
- Tests: `editor-phone` 28/28, `editor-tablet` 5/5, `editor-drag` (touch) 1/1, `editor-flow` (touch) 5/5.
- Open: in a narrow gallery tile a picked label that wraps still has its two presses (open and tick) overlapping (J's CSS).

## From G's last drop pass, fixes-2, and N's lists 1 and 2 (all merged into phase-2-r3 at 712a028)

- G: the grabbing cursor is now a fixed full-window layer on `body` during a mouse drag (`.xe-drag-cursor`), not a rule on the main column. On a phone, a tapped skill is named on the bar with "Remove <skill>"; `.xe-pill-remove` is hidden on a phone; `KNOWN` in `editor-phone` is empty. `PhoneBar` uses `actionsFor`. Drop timing at 4x on the gallery sample: 133 to 150ms at e937c8a against 183 to 217ms at 901a435 (target 120ms not met; React render of renumbered pictures, two re-parented frames and one page-wide style pass remain). Typing 29 to 34ms median.
- fixes-2: `drawnFlow(flow)` in `lib/exhbt/layouts.ts` drops blank steps (all of them drawn if every one is blank); the classic preview and "See as a visitor" both use it. `components/team/MatchPrompt.tsx` draws the file-match prompt as its own modal `<dialog>` when a modal sheet is open.
- N: every old spec now drives the new editor; no `keepClassic(page)` call is left in a spec (the helper stays for `editor-classic*`). `e2e/editor-classic-helpers.ts` holds the old page object for the classic specs. Removed: the first-visit checklist test, and "Arrange sections is for the case study only" (both features are gone). Counts (desktop): phase2-editor 10, phase2-graphs 16, phase2-editor-media 14, phase2-formats 80, auto-figure 32, phase2-draft 11, phase2-draft-tools 11, phase2-sections 15, phase2-polish-2 13, phase2-teammates 7, phase2-billing-polish 7, exhbt-page 16, file-ownership 1, phase2-saved-ideas 7.
- Behaviour changes the tests now assert: the title field stops at 80 characters (`maxLength`), and over-length is set through `window.__exhbtEditor.setAt`; a removed picture's file is deleted when the person leaves the editor, not on the next save.
- Open, found by N: `files.ts` puts the cursor in a new picture's description only if the focus is on `body` or the file input; it checks `[data-xe-adds]`, which nothing sets. `EditorShell`'s status line always draws an empty `role="alert"` paragraph.

## From agent K: boxes slide (22 Nov 2026)

- Rory answered open question 1 on 22 Nov 2026: "Boxes sliding is better". `FLOW_BOX_STYLE` in `drag/options.ts` is now "slide". The flowchart as a whole section is still carried with a line (`FLOW_SECTION_STYLE`, unchanged). The line path stays for release 3, one constant away, since Rory judged the prototype and not yet the real editor; release 5 removes whichever is unused.
- In slide style the box itself is carried; there is no overlay, because dnd-kit holds a box in place whenever an overlay is rendered, even an empty one. The others make room with the editor's own 180ms transform and easing (`MOVE_MS`, `EASE` in `flow/FlowBox.tsx`), and dnd-kit's own layout animation is off.
- The drop is the editor's motion (`settle` in `flow/FlowList.tsx`): every box still on its way goes from where it was drawn to its place, the dropped one from where it was let go, transforms only, none under reduced motion. A drop with no place, and Escape, settle back the same way.
- The keyboard moves the box by the distance between the two places, measured at pick-up, so an arrow pressed at once is never lost.
- `e2e/editor-flow.spec.ts` expects slide by default, and the drop-motion check runs in slide; line's own checks (the copy, the line, its contrast) run only when the page says `data-flow-style="line"`.
