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

## From agent Y: where a section's toolbar sits (23 Nov 2026; `components/exhbt-editor/Toolbar.tsx`, `css/core.css`)

- The rule (Rory, 23 Nov): a toolbar never sits on any words, its own section's included, nor on another section or a chip, and its grip is at the section's top right corner wherever it sits. Only a picture's toolbar lies over its own section, inside its corner, over the picture.
- `placeTools()` reads first, then writes `data-place` (above is no attribute) and, on the top edge, `--xe-tools-dx`/`-dy`. The places, in order:
  1. a row above the corner;
  2. `edge`: a row half over the top edge, up to 8px right and a little lower where the gap is short, never inside;
  3. `side`: a column in the gutter to the right, from the corner down, touching the section, inside the page's column;
  4. `rcol`: that column half over the right edge;
  5. `compact`: the grip and "More actions", half over the top edge. A flowchart's row and pair sit 2rem in, clear of its first box's grip.
- What counts:
  - every other section, by its frame;
  - the page's parts between sections: a field by its whole box, a layout label by its letters;
  - the chips that reach out of a section (`CHIPS`: a picked figure's label, "Edit figures", "Web address", the aim's switch);
  - the section's own words, word by word. A space hanging at a wrapped line's end is no word: on the CI runner's fonts it reached into the hypothesis's gutter (23 Nov). A `textarea` or `input` counts by its words on one line (`measureText`), and by its box where they wrap.
  - `toolbarClashes` in `e2e/page-editor.ts` checks the same way.
- The compact menu:
  - "More actions" (`data-tool="menu"`, `aria-expanded`) opens a card listing Move up, Move down, the layout's action, an AI draft's More actions and Remove, by name. Its first button takes the focus.
  - Escape, a press outside, the focus moving elsewhere, an item pressed, or an action that changes the section's words (an AI rewrite) closes it. Placement leaves it alone while it is open.
  - An AI draft's own menu opens inside it and takes its own Escape first.
  - `e2e/editor.ts` (`pressTool`, `openCardMenu`, `revealCardMenu`) opens it first where a toolbar is compact.
- The pair's two fallbacks, accepted:
  - just under another section's chip on its edge (research's second reference line, under the first's "Web address": dy 20px at 1440), over none of the section's words;
  - where nothing is clear, on the corner.
  - A new exhbt's flowchart, and a flowchart of three boxes in one row at 1440, are compact.
- Research's hypothesis: the gutter column at 1440 (a 36px gutter, 36px buttons); the compact pair on a tablet (44px buttons).
- A picture's toolbar (`shapeOf`): a row in its corner, or a column down its right edge on a narrow tile (grip, up, down, action, more, remove). Where the picture is too short, the column goes on at the foot of a second (`justify-content: flex-end`), so Remove is farthest from the grip.
- Tablet (coarse, 48rem and up): a toolbar above its section shows in full; any other, and every picture's, shows only its grip in its place until the section is touched or focused. Phones place their grips in `phone.css`.
- Placement runs again on:
  - a structural change (each toolbar's layout effect);
  - the main column resizing (`ResizeObserver`);
  - the end of a drop's settle;
  - fonts finishing loading (`document.fonts`: `loadingdone`, `ready`);
  - a section's words changing by any route (typing, Undo, an AI rewrite, a sheet). Each toolbar subscribes to its own section in the store (`doc.flow` for the flowchart). Where it lies over the section (`edge`, `rcol`, `compact`), `recheckSoon` checks those words once a frame (once more a frame later when not typed), and places again only on an overlap.
  - `window.__exhbtPlace` (development only) counts placements and checks.
- Keyboard: one Tab stop; the arrows follow the drawn order; a column (`aria-orientation="vertical"`) and an open menu take up and down too; the grip still carries a section.
- Left as it is: flowchart box chips (`.xe-flow-chip`) and "Add a box at the end" aren't obstacles, since with a mouse they show only on their box.
  - So Graph 1's toolbar covers box 3's chips on the "figure before findings" fixture.
  - On a drafted research page, the hypothesis's gutter column passes box 1's grip, and the results' toolbar covers box 3's Remove.
  - Next step: add them to `CHIPS`, then check every layout's placement again.

## From the Safari agent: the editor on WebKit (24 Nov 2026; branch `phase-2-r3-safari`)

What runs on WebKit:
- Three Playwright projects, listed only when `E2E_WEBKIT` is set, so a plain `playwright test` and CI's ten e2e groups are untouched (`playwright.config.ts`):
  - `safari`: Playwright's Desktop Safari at 1440 by 900, on every `editor-*.spec.ts` but the phone's and the tablet's.
  - `iphone`: Playwright's iPhone 14 (390 by 664, a touch screen), on the touch project's four specs.
  - `ipad`: Playwright's iPad (gen 7) (810 by 1080, a touch screen), on `editor-tablet.spec.ts`.
  - `safari` and `iphone` also run `e2e/*.webkit.ts`, the tests of what only Safari does. No other project matches that name, so adding a test there never moves CI's ten groups.
- `.github/workflows/webkit.yml` runs them on every push, in a workflow of its own: a red WebKit run never makes the CI run red.
  - One job in eight groups: the desktop specs in three, the phone's and the tablet's in one, and the same four again under Safari's rule about the focus (below).
  - A group takes about 15 minutes; the job's limit is 45.
  - A push whose last commit message has `[skip ci]` starts neither workflow.
- Reading a run from a machine with no WebKit (this one: the proxy blocks artifact downloads and `gh` has no token):
  - Each group's log ends with a summary (`scripts/e2e-summary.mjs`): failures grouped by the line they failed on, every error, the tests that passed only on a retry, what the pages said, and the slowest tests.
  - The phone's group also prints what its WebKit says it is (`scripts/webkit-probe.mjs`).
  - `get_job_logs` with a tail of about 150 lines shows both.
- Three switches for a machine with only Chromium:
  - `E2E_WEBKIT=chromium` runs the three projects' sizes and user agents on Chromium. What fails there too is a size or a user-agent assumption, not the engine.
  - `E2E_FOCUS=safari` gives every page Safari's rule about the focus.
  - `E2E_TOUCH=page` makes Chromium use touches made in the page, as the WebKit projects must.
- Every editor spec takes `test` from `e2e/editor-test.ts`, not from Playwright. A new editor spec must too, or it fails on WebKit at random (next dev's hot reload, below).

What is left out, and why:
- Tests left out by name are listed in `playwright.config.ts`, each with its reason; nothing else is skipped on WebKit.
  - `NOT_ON_WEBKIT`, for every WebKit run: one test, "while carrying: the page scrolls itself with the pointer still near the bottom edge and near the top edge" (`editor-drag.spec.ts`). It is open, not flaky (below).
  - `NOT_UNDER_SAFARI_FOCUS`, only for the runs under Safari's rule about the focus: empty.
- "A swipe scrolls the page" is checked only under real touches, which only Chromium has (`touch.native` in `e2e/page-editor.ts`).
  - Playwright's WebKit has a tap and nothing more, so there a touch is an event made in the page, and such a touch cannot scroll.
  - Four checks: two in `editor-drag.spec.ts`, one in `editor-flow.spec.ts`, one in `editor-phone.spec.ts`. The rest of each test still runs.
- Not in these projects: `edit-slots.spec.ts` and the specs that drive the editor for another feature (`phase2-*`, `auto-figure`, `exhbt-page`, `file-ownership`). The classic editor and the public pages have never run on WebKit either.
- What WebKit on Linux cannot show at all. Each needs a real iPhone:
  - the zoom when a field under 16px takes the focus;
  - a real finger: the long press on a grip, the drag, scrolling while holding;
  - the on-screen keyboard, and where the phone's bar sits above it;
  - Safari's own bars coming and going;
  - Safari's rule about the focus (it is given to the page by a script here);
  - anything older than the WebKit Playwright ships (26.6 on 24 Nov).

How Safari differs, as found here:
- A press on a button, a link or a tick box gives it no focus, and takes the focus from whatever had it. The blur has no `relatedTarget`.
  - True on a Mac and on an iPhone. WebKit on Linux does not do it, so no run here meets it by itself.
  - `safariFocus` in `e2e/editor-test.ts` gives a page the rule; `E2E_FOCUS=safari` gives it to every page.
  - It found the "+" menu closing under a press while the "+" had the focus: on an iPhone, every use of Add on the bar added nothing. Fixed in `Insert.tsx`.
  - Anything that closes or saves on a blur "to nowhere" must allow for a press on its own buttons.
  - Escape did not close the "+" menu after a press on the "+": the "+" hears the key only with the focus in it. It now takes the focus when pressed (`Insert.tsx`).
  - Not changed: a sheet gives the focus back to its opener, which in Safari never had it when it was pressed; `EditorShell` saves on every such blur, so Safari saves more often.
  - A test's check that a pressed button has the focus, or that a sheet gives the focus back to the button pressed to open it, is made only where `pressFocuses` is true (`e2e/editor-test.ts`).
- When a navigation starts, WebKit stops the loads of the page being left while that page is still alive.
  - A lazy chunk then fails with `ChunkLoadError`, the editor's crash fallback fired, and its `location.replace` to the classic editor beat the person's own navigation.
  - `components/exhbt-editor/again.ts` asks for a chunk again (twice, after 0.5s and 1.5s) before the fallback. Use it for any new lazy import in the editor.
- Safari has no `requestIdleCallback`. `fields/idle.ts` then starts the formatted fields' editors 50ms apart, so a page's fields go live over a second or two, later than on Chromium. A test that needs live editors waits for them (`waitLive`).
- Tiptap picks the Mac key map by the user agent ("Mac" and a touch screen), and ProseMirror by `navigator.platform`. Under an iPhone user agent on a Linux host there is no key for "select all". `chooseAll` in `e2e/page-editor.ts` selects through the page instead.
- A toolbar's placement lands a frame later than on Chromium. A test reads `toolbarClashes` with `expect.poll`.
- `text-wrap: pretty` (on `p`, `li`, `dd` in `globals.css`) pulls the last word down to keep an inline mark company. The "Needs a description" mark hung under a narrow gallery tile, on Chromium too at about 900px wide. The mark now takes no room on its line (`.xe-fig-needs-at`).
- Boxes land on different fractions of a pixel. A check for "over" counts an overlap past half a pixel each way, as the editor's own placement does.
- An iPhone zooms in on a focused field under 16px, and nearly every field here is under it. `phone/noZoom.ts` sets `maximum-scale=1` on the viewport while the editor is open, for an iPhone's user agent only. Not proven on a phone.
- Safari before 17 has no popovers. `figures/pop.ts` asks the browser, and gives the chips' panels a modal `<dialog>` instead. The sheets are native dialogs already, so the editor needs Safari 15.4 either way.
- next dev's hot-reload client reloads the page when its update fetch fails, and WebKit fails that fetch during a navigation. The fixture in `e2e/editor-test.ts` keeps the client quiet on WebKit. Development server only.

- The hand-over from a resting field to its editor (`RichField`'s `onReady`) runs from a microtask.
  - The editor says it is made from an effect, and there React refuses `flushSync` (every page logged "flushSync was called from inside a lifecycle method"). The swap was drawn late, the focus was on nothing for a frame, and a key typed then was lost: on WebKit "five six" came out "fivesix" once.
  - From a microtask the flush is honoured, and the editor's view takes the focus in the same step.
  - Seen on Chromium only: the focus goes from the one field to the other in one task, and the React line is gone. Its first WebKit run is the one after this note.

Still open, most serious first:
- While carrying a section with a mouse on WebKit, the page scrolls itself down near the bottom edge but did not scroll back up near the top edge (`editor-drag.spec.ts`, "while carrying").
  - 4 tries of 4 in the third WebKit run, with and without the focus rule, after passing in the first two. Chromium passes.
  - Cause not found. Between those runs the editor's changes were the "Needs a description" mark (its `ResizeObserver` refits it), the popover fallback and the iPhone's viewport rule.
  - The page ended at 704px in one run and 694px in the other, so the scroll stopped after one 10px step or none: either the carry had ended or `window.scrollBy` did nothing. The test now says which when it fails.
  - It is left out on WebKit by name. A Mac with Safari settles it in a minute: pick a section up at the foot of a long page and hold it near the top of the window.
- Under Safari's rule on WebKit only, "a picture: its file is not deleted while Undo can bring it back, and is once it cannot" failed (`editor-inplace.spec.ts`). Chromium passes it under the same rule, and WebKit passes it without the rule.
  - Either the press on a picture's Remove did nothing there, or the press worked and the file was never deleted. The test could not tell which; it now checks that the picture left the page first.
  - It is not left out: the next run under the rule says which.
- The hand-over on a real iPhone: whether the keyboard stays up when a person taps a formatted field before its editor is live. It should now (the focus no longer leaves the fields), but only a phone shows it.
- The zoom on focus (`phone/noZoom.ts`) and everything else in "What WebKit on Linux cannot show at all" above.

## From the green-CI agent, 24 Nov 2026 (branch `phase-2-r3-green`)

What was red in CI, and why:
- `e2e/r2-fixes.spec.ts`, the two layout-refusal tests (save and publish). Both came from release 2, where `e2e/editor.ts` was the classic editor's page object. Here it is the new editor's.
  - Publish: the tick and Publish are in the "Review and publish" sheet, so the test waited 90 seconds for a tick that was not on the page.
  - Save: `getByText` matched two elements, the top bar's visible words and its hidden live region. That pair is by design (`topbar/SaveStatus.tsx`). Find the visible words by `.xe-save-words` and what is said by `div[role=status].sr-only`.
  - The product was right. A refused publish shows the whole reason in the sheet, under Publish and on screen with it, and says it once. The tests now assert that.
  - Each test now runs in both editors.
- `e2e/key-order.spec.ts` came with the graph patch (`phase-2-r2-fix2`, merged here at 8389717). Its test of the offer of a copy kept in the browser failed under the new editor, and it was right to.
  - The patch fixed the comparison in the classic editor: a doc read from the database against one kept another way, as JSON text, which is always "different" on the live site.
  - The new editor had its own copy of that line (`BackupOffer.tsx`). It now uses `sameJson`. The test runs in both editors.
- `e2e/phase2-draft-tools.spec.ts`, "on Free the rewrites run out": the press on "Rewrite the process now" was refused, on and off.
  - A section's toolbar was drawn, and took presses, only while its section was under the pointer or held the focus. An open menu was no exception.
  - "Rewrite this block" hides the button that was pressed, so the focus falls to the page. Only the pointer then held the toolbar up.
  - At 1440 by 900 the form's button is drawn below the fold. A press scrolls the page first, the pointer stays where it was, and the toolbar went at once, the form with it. The row under the form took the press.
  - Whether the press landed was a race between the browser working the hover out again and Playwright's check. Here it passes with the processor up to 8 times slower and fails at 16 times. So a slow runner failed it and a quick one passed it. No merged commit caused it.
  - It was never the stacking. The form was see-through and took no presses; nothing lay over it. 5d308fa's raise did not fix it.
  - Fixed in `css/core.css`: a toolbar with a menu open stays, wherever the pointer and the focus are. `BlockTools` sets `data-open` on itself while its menu or its panel is open, and the CSS reads it. The same for the shell parts' corner toolbar and for the tablet's rule.
  - The section with the open menu is raised in every place, to 29. At 30 it was drawn over the editor's top bar once the page scrolled it there (seen in a screenshot). The test for it passes without the fix too, since the toolbar took no presses then; it was not run with 30 put back.
  - Five tests under "An open rewrite form stays up and takes the press". Four fail without the fix.
- `e2e/phase2-editor-media.spec.ts:316` ("File attached:" not seen in 20 seconds) did not fail here in three runs, one of them straight after the build folder was deleted, as CI's always starts. It is left as it was.
  - That cold run took 43 seconds and the next one 11: the dev server builds each page and route the first time a test uses it. On a slower runner one step could pass its 20 seconds that way. Not proven.

For whoever merges `main` into this line again:
- A spec written on `main` imports the classic page object under the name `./editor`. Here that name is the new editor's. Run each such spec before trusting it, and check every import.
- To run a test in the classic editor, take its helpers from `./editor-classic-helpers`: its `signInAs`, `signInToDraft` and `draftAndOpen` set the cookie. Or call `keepClassic(page)` first. Assert `[data-editor="classic"]` or `[data-editor="page"]`, so a test cannot run in the wrong editor without saying so.
- The classic editor is what everyone gets on launch day. A test of something both editors do should run in both; `r2-fixes` and `key-order` show two ways.
- A fix made to the classic editor on `main` may be missing from the new editor's own copy of the same thing. `BackupOffer.tsx` was one.

For tests of the toolbars and menus:
- Playwright counts an element with `opacity: 0` as visible. `toBeVisible` passes on a toolbar nobody can see. Use an unforced click, or `click({ trial: true })`, which checks where the press would land.
- A click scrolls its target into view and leaves the pointer where it was. Anything that shows on hover can go at that moment.
- To try a part without the pointer or the focus: `page.mouse.move(2, 2)`, then blur the active element. The tests under "An open rewrite form stays up and takes the press" do this.
- A test that opens a rewrite form closes it (`closeRewrite`) before it goes on to a part the form lies over.
- To see a failure that comes and goes with the runner's speed: `Emulation.setCPUThrottlingRate` through `page.context().newCDPSession(page)`.
- To try each place a toolbar can be in, hold `data-place` with a `MutationObserver` that puts it back. `placeTools` writes it again whenever any toolbar draws.
- A size container (`@container`) makes no stacking context in Chromium now. Where it still does, research's method stack is one, so whatever holds a raised section is raised with it. Not tried on Safari.

Still open:
- Outside the compact card, the rewrite form has no ground of its own. It is drawn straight over the page's words, squeezed to the width of its button's column, and the toolbar's other buttons move to its middle. Seen on the case study's findings, the gallery's flowchart and research's flowchart; the findings in the gallery and in research have their toolbars in the same places (above, and on the edge). It takes its press, but it is hard to read. The context line's form, in its corner toolbar, is drawn over the title in the same way; the title's and the skills' forms use the same toolbar.
  - Above its section, the toolbar grows upwards when the form opens, so "More actions" moves up, and can go under the top bar.
  - Next step: draw the form and its status line as a card under "More actions", as the compact form does.
- An open rewrite form now stays until it is cancelled or used, and takes the presses over whatever it lies on. Before, it went whenever the pointer left its section, which hid the point above. This is a change in what the editor does, and it is Rory's to decide.
  - The compact card closes at a press anywhere else, as before. A form in a row, in a column or in a corner toolbar closes only by Cancel or by a rewrite.
  - `phase2-formats`, "The rewrite names read right in every layout", opened four forms and walked on, and the flowchart's card then lay over the findings. It now closes each form (`closeRewrite` in `e2e/editor.ts`). No assertion changed.
  - A choice that would keep less on the page: close an open form at a press anywhere else, in the new editor only.
- The top bar cuts the reason for a failed save at 22rem with an ellipsis. "This couldn't be saved. Reload the page and try again." loses its second half. The whole of it is said to a screen reader. Under 64rem the words are not drawn at all.
- `store.setAt` still compares a stored value with what a field built as JSON text (`sameValue` in `store-core.ts`). On the live site a formatted field typed in and put back as it was may then count as a change, and be saved once more. Not tested with a doc in the database's key order. The editor's other comparisons of JSON text (the undo list, a layout switch, the toolbar's check of its own words) each set the store's doc against one made from it. Reading them, the database's order should not mislead them; none is tested for it.
- Not run here: `editor-drag` and `editor-flow`, and nothing on WebKit.

## From agent M, release 4: seven layouts and the AI draft (25 Nov 2026; branch `phase-2-r4-m-ai`)

What is offered, and to whom:
- The new editor offers all seven layouts (`OFFERED_FORMATS`). The classic editor offers three (`CLASSIC_FORMATS`, the only list of them): it can't edit what the other four add.
- `offeredIn(editor)` in `lib/exhbt/formats.ts` is the one rule. Three places ask it, each deciding the person's editor as the edit page does (`editorKind(isAdmin)`):
  - the classic picker (`components/editor/LayoutPicker.tsx`): three, plus the exhbt's own layout when it is one of the four, with a line saying where it is edited. Switching away there is one way, and says so: the server lets one of the four be saved only while it is the layout stored.
  - the draft route: seven layouts in the new editor, three in the classic one.
  - `layoutAllowed` (`app/(app)/exhbts/[id]/actions.ts`): one of the four is refused for a classic person unless stored. It reads the layout as sent, so a name the code doesn't know is refused too (it used to be stored as a case study without a word).

The draft:
- There are two requests. "three" is the default and is byte for byte what was sent before release 4 (39 fields). "seven" is new (41 fields: `pullquote` and `myRole` added). `e2e/layouts-new.spec.ts` holds both counts; the API's limit is about 52 to 56 (decision 0029).
- `references` holds three things by layout: research's references, an essay's sources (the address may be empty) and a build's links. That is what kept the count down.
- `toDoc` is now in `lib/ai/draft-answer.ts`, which is pure, so a spec can call it. The checks that keep only what the person supplied are in `lib/exhbt/references.ts`.
- Nothing here has been sent to the real API, and the eval was not run in any mode: both wait for the owner's say-so. `npm run eval:drafts -- --self-test` and `-- --mock` make no call and are the first things to run.

For tests:
- The test server is the new editor, so its stand-in drafts among seven. Material holding one of its cue words drafts that layout: "I built", "redesigned", "my role was", "this essay" (and "hypothesis", as before). Check a new test's material for them.
- `stand-in: layout <name>` in the notes names a layout. `stand-in: invent` makes the stand-in write a pull quote, a source, a link and a role the material doesn't hold, to show each is left off.
- "Things to fix" leaves out a layout's needs until publishing has been tried. `window.__exhbtUi.setTried(true)` is what a press on Publish does to it.
- `offered()` now returns seven, so `editor-drag`, `editor-flow`, `editor-inplace`, `editor-smooth`, `editor-phone` and `editor-tablet` loop over seven. None was run in this first run; the second run below ran them and fixed what failed.

Still open:
- The layout rules are decision 0028's, word for word in meaning. Rule 4 (before and after) fits any improvement that gives figures for before and after, not only a redesign shown in pictures; eval fixture 08 is one. Such a draft can't be published until two pictures are marked.
- `HANDOFF.md` (the layout row) and `DESIGN.md` (lines 130 and 135) still say three layouts, and "not offered until release 4".
- In the classic picker, one of the four is drawn with the case study's sketch (as brief E asked).

## From agent M's second run: CI with seven layouts (25 Nov 2026; branch `phase-2-r4-m-ai`)

Once `offered()` held seven, the editor's specs ran the four new samples through every placement and drag check. What failed, and what changed. Each was a fault in the editor unless it says the test was wrong.
- Toolbars (`Toolbar.tsx`):
  - A flowchart box's grip and Remove now count as chips (`CHIPS`), as agent Y's note above asked. In a row of boxes they hang half under the box's foot, and Build, Essay and Before and after put their findings straight under a three-box flowchart: the findings' toolbar sat on the middle box's chips.
  - A section's own words count just round its box too. An essay's pull quote, a large face set close, draws its first line a pixel above its box, and on a tablet a row above the corner (no strip under it there) lay on it. Only the buttons count against its own words, not the strip under them.
- The "+" (`placePluses`): it moves on until nothing is under it (at 700px Build's two links sit side by side, and it stopped on the second link's grip); the one after the last row is moved too (it lay on the last link's "Web address"); and under a finger a chip counts by its 44px press, not its box (that press took 3px of the "+").
- The drag's hidden copy (`drag/measure.ts`) keeps each of Build's buttons at its width. An empty box in a flex row has none, so every button after the first was measured at the row's start.
- A link drawn as a button (Build's demo and code) has its "Web address" just under its line (`figures.css`), not on it: there it took the press meant for the line's own field (`editor-smooth`, `editor-inplace`). Under a finger it is at the link's start: on a phone the buttons wrap one to a line, and centred it met the next one's grip.
- A flowchart of four boxes or fewer is a row on a tablet (MethodFlow), as the four new samples' are. Under a finger a row's box now has its grip and Remove on its top corners, as a column's has (`flow.css`), still shown only while the box has the focus. On its foot they were 4px apart (Remove's press took 12px of the grip's), they came within 4px of a box's second line, and they hung into the gap under the flowchart, so at 810px (an iPad), and on CI's tablet, the findings' toolbar after it had nowhere clear and its compact pair lay on the heading. The box just touched keeps them up too (`:hover`, as before): under Safari's rule a press on Remove takes the focus from the box, and without that the chip went from under the tap and nothing was removed (checked at the tablet's size with `safariFocus`).
- Tests that were wrong, each said in its commit:
  - `editor-drag`, "a new block lands where its + was": Build's, Before and after's and Event's samples have no room for a quote, a "What I'd do next", a link or a pull quote. It takes the quote out first.
  - `editor-drag`, "a click on a grip…": it pressed at the middle of the first flowchart box. The essay's first box wraps onto two lines, and the middle is the edge between them, where the drag selected nothing. It presses along the first line.
  - `editor-drag`, "no flicker…", down the side of a pair: it walked to 30px under the left side. In Event's sample the stack on the right is taller, so that is still inside the pair's row. It walks to 30px under the row. And Event's grid is one row of two, so the step between two rows of the grid runs only where there are two.
  - `editor-tablet`: it pressed every flowchart chip at rest. A row's chips show only while their box has the focus, so in a row each box's are pressed with the focus in it.
  - `auto-figure`, "a text-only PDF printed by a browser": the PDF says "this essay", so in the new editor the stand-in drafts an essay, which takes nothing from the work and never looks for a figure. Its notes name research now, so the PDF is looked through.
  - `phase2-formats`, "three radios named Layout": it drives the new editor, so the count is `OFFERED_FORMATS`.
  - `editor-admin-switch` took `test` from Playwright, not `./editor-test`, so on WebKit next dev's hot-reload client broke two of its navigations at random.
  - `safariFocus` (`e2e/editor-test.ts`) moved the focus with a scroll. A press never scrolls the page; here it scrolled 38px between the press and its release, and the click on a layout in the 390px menu landed elsewhere (`editor-topbar`, under Safari's rule only). It moves the focus with `preventScroll` now. That a press moves the focus without a scroll on a Mac or an iPhone is how Chromium and WebKit treat a press elsewhere; it has not been seen on a real Safari.

Still open:
- On a phone Build's buttons wrap one to a line, 12px apart (the page's own row gap). The first link's "Web address", under its line, then lies over the top of the second button, and its 44px press takes a tap on the middle of the second button's words: on the Pixel 7 that tap opens Link 1's address. It is the fault `editor-smooth` found on WebKit, moved to a phone: before, the chip lay on the first link's own line, on every pointer. Every place for it between two wrapped buttons meets something, and more room between them would change the visitor's page too. Rory's call.
- With seven layouts the narrow menu (390px) is taller than the screen under the bar while the page is at its top: the layout list ends below the fold.
- `editor-inplace`'s picture-deletion test on WebKit under Safari's rule is the other agent's, as before.
- On a tablet, in the first three layouts, a section's grip can cover "Remove finding 1" (seen by the main session). Left as it was: it did not fall out of these fixes. A finding's controls (`.xe-list-tools`) are not among `CHIPS`; adding them would be the next step, then every layout's placement checked again.
- Not run here: anything on real WebKit or a real iPhone; `E2E_WEBKIT=chromium` covered the Safari sizes and the focus rule only.

## From the polish agent, 25 Nov 2026 (branch `phase-2-r3-polish`)

Five rough edges, fixed before the editor is switched on for everyone. Each has a test that failed before its fix.

- The rewrite form's ground (`components/exhbt-editor/css/draft-tools.css`, new, unlayered for the reason given at the end of `app/globals.css`):
  - BlockTools now holds the form, "No rewrites left" and its status line in one box (`data-tools-panel`), and marks its menu (`data-tools-menu`). The classic editor draws them as before; `phone.css` follows the new box.
  - On the editing page both take the compact card's ground, edge and shadow (`--xp-card`, `--xp-outline-edge`), and the look's ink, secondary text and error colour. In the app's ink the words could not be read on Night's well, in the compact card too.
  - Outside the compact card the box is a card of its own under "More actions", out of the flow (to its left down a column, clear of Remove), so the toolbar keeps its size and place. A shell part with an open form is raised to 29, as a section is.
  - An open form now lies over the first words of its own section, not over the section above. The axe test in `phase2-draft-tools` types before it opens its forms.
  - Chromium can leave the card's box (`data-tools-panel`) marked as hovered when what the pointer was on goes from under it: a rewrite lands with the pointer still on "Rewrite now", the form goes, and the compact card round it closes. The mark outlasts the pointer leaving. Nothing styles that box on hover (and no rule reads hover through `:has()`), so the page is unchanged, but `leave()` in `phase2-draft-tools` waits for no hover in the article.
  - The Night "No rewrites left" test failed that way in CI at f7e8e5f, on both tries: CI runs Playwright's headless shell. On that build (here at `/opt/pw-browsers/chromium_headless_shell-1243`) it failed 4 times in 4; on the full Chromium this file's runs use (`PW_CHROMIUM_PATH`), 2 or 3 times in 6 to 8.
  - Its setup rewrites, and every press in a panel in the ground tests, are now made from the keyboard with the pointer away (`rewriteFromKeys`). `leave()` is unchanged. To run as CI does here, use `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and leave out `PW_CHROMIUM_PATH`.
  - Tests: one per look, under "An open menu or rewrite form has a ground of its own" in `phase2-draft-tools`. `takesThePress` checks the card as well as the button.
- Closing it, as 0026 has it ("it stays, wherever the pointer and the focus are"):
  - Escape closes the AI menu, the form and "No rewrites left", and gives the focus to "More actions". It works with the focus in the form or on nothing, as after "Rewrite this block", and on the phone's bar. In the compact card the form's Escape comes first, then the card's.
  - A press outside never closes the form. The compact card no longer closes round an open form at a press outside or when the focus moves on (`rewriteOpenIn` in `Toolbar.tsx`); before, it hid the form with it.
  - My choice, for Rory to undo if he wants: "No rewrites left" holds nothing and has no Cancel, so a press outside closes it, as it closes the menu. Before, nothing but a reload could.
  - While a rewrite runs, Escape leaves the form, as Cancel is off then.
  - The same BlockTools serves the classic editor: there the form is drawn where it was, in the app's colours, and Escape works the same way.
- Why a save failed (`topbar.css`): a small card hanging from the bar under the status, out of the flow, and as wide as the screen on a phone. At 1440 the cut reason had also pushed "Review and publish" off the window. The live region is unchanged. `r2-fixes` still says the reason sits beside "Not saved. Retry"; its assertions hold.
- The edit page's error page: a new `layout.tsx` for the route tells it which editor the switch serves (`editorServed` in `lib/editor-kind-server.ts`, `served.tsx`), so the classic editor is named, with Reload, whether it was asked for or served. Before, everyone on the live site was told the new editor had failed. It asks who is signed in only when an admin's own-choice cookie is there.
- The Safari picture file (`files.ts`, `Autosave.tsx`):
  - Under the focus rule, the blur at the press on Remove saved a doc with the picture. The removal then fell off the undo list while that save was out, and the DELETE was sent.
  - If the save landed first, the server kept the file and the editor forgot it. That was 5 failures in 10 under `E2E_WEBKIT=chromium E2E_FOCUS=safari`.
  - The rule now keeps whatever a save still on its way points at, until a task after its answer. The original test then passed 10 of 10 there.
  - A new test holds that save and orders the DELETE behind it, so the race is made rather than waited for.

Run at the end, on Chromium: `phase2-draft-tools` 29 passed, `editor-smooth` 8, `editor-topbar` 17, `editor-classic` 11, `editor-tablet` 12 (tablet), `editor-phone` 40 (touch), and `editor-inplace` with `-g "toolbar|menu|undo|save"` 28. Also run:
- `editor-admin-switch` (20 passed), and the two `r2-fixes` refused-save tests;
- the rewrite tests in `phase2-formats` and `phase2-polish-2`;
- every spec that checks stored files, whole: `data-safety`, `editor-figures`, `phase2-editor-media`, `file-ownership` and `editor-inplace` (141 passed, 1 skipped as before);
- the new top bar, classic and phone tests on the `safari` and `iphone` projects, under `E2E_WEBKIT=chromium E2E_FOCUS=safari E2E_TOUCH=page`.

For whoever merges this with release 4:
- `Toolbar.tsx` has two guards in the compact card's own close handlers (`rewriteOpenIn`), with no change to placement.
- `phone.css` and `topbar.css` had existing rules rewritten, not only new ones added: the "More actions" selectors in the former, the save status in the latter.
- Decision 0026 is not amended for the new Escape, the compact card staying open round a form, or the error page's words.

Still open:
- Nothing here ran on real Safari or an iPhone, nor on WebKit: the focus rule was the emulation's.
- The existing "An open rewrite form stays up and takes the press" tests still open their forms with the pointer, and so could meet the same stale hover. They passed in every run here.
- A message that a rewrite worked stays in its card under "More actions" until the next rewrite, shown whenever the toolbar is. It has a ground now; whether it should go sooner is a question for Rory.

## From the work-pictures agent, 25 Nov 2026 (branch `phase-2-r2-work-pictures`)

Pictures from Word, PowerPoint and uploads (decision 0025), brought up to date with release 4 and tested for the first time; then long files, read whole or by their start and end (`lib/material.ts`).

- `e2e/work-pictures.spec.ts` was written for the classic editor. In the new one its `li[data-section-id]` and Preview selectors found nothing, so two hostile-zip tests passed without checking anything. It now reads the page as `auto-figure` does (`${READY} article [data-section-id]`), the draft's line from the layout menu, and the picked strip from the label's popover.
- A picture taken out of a Word or PowerPoint file has no page. Its label over the picture is "A picture from your report", and its strip holds the tick and no crop (`figures/ImageExtras.tsx`). It used to say "From your report, a picture in it" and offer a crop and another page.
- Limits a draft-page test can meet: a Free account has one draft in 30 days, so a test that drafts twice needs Premium; `/api/files/transcribe` reads 12 files a day from one address, shared by every spec on a CI shard (work-pictures sends 8); the figure route takes at most 12 more pictures, and the draft page now sends only what the layout shows.
- Don't save files in the worktree while a Playwright run is going. Tailwind 4 scans the whole project, so saving a spec or a doc rebuilds the CSS in the dev server, and a page loading then may not hydrate, or a route may read a half-written manifest ("Unexpected end of JSON input"). Seen once here; with nothing saved during the run it did not come back.
- Long files: the draft page reads each file whole and gives the draft all of it while the files fit one budget together, otherwise each file's share, the start and the end of a long one, and the file's line says which ("We read all 15,028 words", "We read 39,000 of your 60,000 words: the start and the end"). The AI calls keep the start and end too if a request carries more. A scan read by the AI reader is unchanged: it stops at the reader's own limit.

Run here, Chromium, one worker, the `desktop` project: on 30d792a, `auto-figure` 32, `office-pictures` 14, `work-pictures` 22, `exhbt-page` 16, `phase2-billing-polish` 7, `phase2-draft-tools` 28, `phase2-draft` 12, `phase2-polish-2` 13, `phase2-teammates` 7, `r2-fixes` 27; on ec5790f, `auto-figure` 32, `work-pictures` 22, `long-files` 6, `phase2-draft` 12, `phase2-draft-tools` 28, `phase2-teammates` 7; on de6efbf (ec5790f's code and these notes), `layout-model` 34, `phase2-formats` 80, `key-order` 12, `editor-figures` 11 (11 more skipped by its own rule, mouse tests on desktop and touch tests on the `touch` project), `editor-phone` 56 on `touch`, `editor-inplace` 180; and with the test of a request over the budget, on the commit that added it, `long-files` 7, `r2-fixes` 27, `exhbt-page` 16. All passed. Also `npm run eval:figures -- --self-test`, which calls nothing.

Still open:
- The real model has not seen a Word, PowerPoint or uploaded picture (eval cases 15 to 18), or a long draft: four characters a token is an estimate until a long draft's input tokens are in `ai_call_logs`.
- Nothing here ran on WebKit or a phone.
- The new editor's "Take a figure from my report" for Word and PowerPoint files (0025 says what it needs).

## From the switch-on fixes agent, 26 Nov 2026 (branch `phase-2-switch-on-fixes`)

Two faults to fix before the editor is switched on for everyone. Which tests failed before the fixes: the Build test on `touch` (not run on `iphone` before); "nothing covers a control" for the gallery, research, essay, and event or performance; "the findings moved to the top" for research and the essay. The others passed before and after.

- Build on a phone (agent M's open item above):
  - The cause: Build's buttons wrap on a phone, 12px apart. A link's "Web address", just under its line, then lay over the top of the button on the next line, and its 44px press took a tap on the middle of that button's words.
  - The fix: `placeLinkChips` in `Toolbar.tsx`, run at the start of each placing pass. A button link's chip goes in the first place where it and its press meet no other section, no toolbar, no other chip and not its own button, inside the column: under its line, as before; on the button's line just past the link and its grip (`data-place="beside"`); or on the button's line at the link's right end, left of the grip (`"end"`). Where none is clear, under its line. The rules are in `figures.css`. A link's box is watched, so typing that widens it places it again. Where the row doesn't wrap (a tablet, a desktop) nothing moves.
  - The test: `editor-phone`, "a Build exhbt with three links". It taps the middle of each button's words and each "Web address" with the touchscreen, on the Pixel 7 and the iPhone emulation.
- Tablet and iPad: a grip or a toolbar over a control.
  - "Remove finding 1" under a grip did not show here on any full sample, at 820 or 810 wide on Chromium: the case was made by moving the findings to the top. That the main session's sighting is the same fault (research's 44px gap coming out a fraction short on WebKit) is a guess until the WebKit `ipad` job runs; several placements measured here clear by 0 to 2px, so that job's hit test is the likeliest to go red.
  - The cause of "Remove finding 1": nothing kept a finding's own controls (`.xe-list-tools`) and its section's toolbar apart. Where no heading sits over the findings (research), the first finding's controls sit just under the section's top edge, at its right end. A toolbar on that edge lay over them, and the grip on "Remove finding 1". In research's sample the row above the corner fits the 44px gap exactly, so that sample shows it only where the gap comes out a fraction short; moving the findings to the top of the page shows it anywhere.
  - The fix: the controls give way, and the toolbars stay exactly where they were, every grip at its section's corner (Rory's rule). `listsClear` in `Toolbar.tsx`, in each placing pass, moves a finding's controls along the rule to the left where its section's toolbar (the whole of it, as shown when touched) lies over their place, with their 44px presses under a finger (`--xe-list-dx`, `core.css`). The formatting buttons do the same where a toolbar lies over the line's right end (`clearOfToolbars` in `fields/RichEditor.tsx`, when the field takes the focus; `--xe-format-dx`): the last finding's, under its line, met the toolbar of the section below (an essay with its findings first). Decision 0026 says so.
  - A first try (commit 84c10aa) made the toolbars keep clear of those controls instead, and of where the formatting buttons go, and slid the compact pair along the top edge where nothing at the corner was clear. CI's Chromium then failed `editor-drag`'s corner test in the event layout at 1440 (graph-1's grip off its corner, under the findings, whose last formatting buttons hang into that gap), on both tries; here the same graph's toolbar had moved from the edge into the compact pair. That is all taken back: the toolbars' places are `main`'s again, compared sample by sample at 1440, 820 and 810 wide.
  - The same test found two more, neither a grip nor a toolbar. On a tablet a reference line's "Web address" sits just right of the middle of the rule, not on it (`figures.css`): the line about the link is a field as wide as the line, and the centred chip's press reached its middle. The flowchart's "+" after the last box of a column sits just under its foot, not a little into it (`flow.css`, tablet only): its press reached the middle of the last box's detail.
  - The tests: `editor-tablet`, for each of the seven layouts: "nothing covers a control" and "the findings moved to the top of the page". The first hit-tests the middle of every button and field shown (`coveredControls` in `e2e/page-editor.ts`) at rest, with each section touched and with the cursor in each finding. It allows nothing: 0026 draws no control over another on purpose on these pages (an open menu is never open here). The list (`ON_PURPOSE`) is in the spec, empty.

Run here on 1ff2a31's code, Chromium, one worker, on a machine short of memory (other agents' servers; many pages crashed while loading): `editor-tablet` 30 of 30 on `tablet` and on `ipad` (`E2E_WEBKIT=chromium`); `editor-phone` 56 of 57 on `touch` ("three pictures picked at once" waited out an upload under the load; it passed on the earlier code) and the Build and 390px figures tests, 4, on `iphone`; on `desktop`, `editor-drag` 110 passed and 1 skipped as before, the other 18 lost their page (the corner tests at 1440 and the seven no-flicker tests among the passes), `editor-smooth` 12 of 16 (4 lost their page). GitHub's CI and WebKit runs on 1ff2a31 passed in full.

The WebKit timeouts on e9880e4 ("safari 1/3": gallery's no-flicker drag at 90s, and `editor-figures` waiting for a drafted page) were not this work's: during a drag `placeTools` returns before any of it runs, the formatting buttons move only when a field takes the focus, and the new size watch is on Build's button links only. That run was slower all round: against an earlier passing WebKit run, test by test, about 1.3 times as long, as much in specs this work never touches (`editor-classic`, `editor-topbar`) as in the drag specs. Gallery's no-flicker drag takes about a minute on WebKit even then (52s here on Chromium), so it is the first to pass 90s on a slow runner; here, under the memory shortage, it timed out on Chromium too.

Still open:
- On a phone a section's grip sits half over its top edge, so where Build's buttons wrap it lies over the end of the line about the link above (the words, not the field's middle). The phone tests read words from text nodes only, and the line about a link is a text box, so none of them sees it.
- On a phone the flowchart's end "+" and a reference line's chip are where they were. Their presses may reach the middle of the field above them as they did on a tablet; the hit test runs only on the tablet and iPad projects.
- With the findings moved straight above research's hypothesis, "Add a finding" and the aim's Aim and Hypothesis switch sit at the same place on a tablet (both 3.25rem in, either side of the gap). Not a grip or a toolbar; not fixed here.
- Nothing here ran on real WebKit, a real iPhone or a real iPad: `E2E_WEBKIT=chromium` gave the iPhone and iPad sizes on Chromium.
- `flow.css` and `figures.css` changed; the flowchart drag branch (`phase-2-flow-lift`) changed neither when this was written.

## From the flow-lift agent, 26 Nov 2026 (branch `phase-2-flow-lift`)

The flowchart drag test failed now and then in "safari 2/3, the focus rule": `e2e/editor-flow.spec.ts`, "a box dragged along the flowchart lands where shown…", the box never lifting (`data-flow-drag` never "pointer"). It was at line 314 then, its failing check in `pickUp` at 103; both have moved.

What it was:
- Always the second pick-up: the box just dropped, picked up again with the pointer still on it. Never the first pick-up or the third.
- WebKit can lose the hover of a box that a drop moves in the page while the pointer is on it. The box then counts as not hovered while the pointer moves about on it, its own words included, until the pointer leaves the box. Chromium never does this.
- A box's grip and Remove show on hover or while the box has the focus (`flow.css`). Where a press focuses the button (Chromium, WebKit on Linux), the grip keeps the focus through the drop, as React gives it back after moving the box, so they stayed up. Under Safari's rule a press gives the grip no focus: it goes to the flowchart's list. With neither, the tools were hidden under the pointer and the press went to the box.
- Seen in WebKit's own logs. The test said what each press met, and a temporary test picked up the box just dropped ten times on each layout (both gone now). Before the fix (run 45726261188), under the rule, 5 of 67 such pick-ups failed, each with "the box hovered false; its tools 0/none" and the press on `div.xp-flow-box`, not taken by the drag. Without the rule 16 of 70 had the box not hovered at the press too, but the grip had the focus, its tools were up, and all 70 lifted.
- A real Safari user meets it: Safari on a Mac never focuses a pressed button, and the lost hover is WebKit's own, not the emulation's (the group without the rule shows it). After a box is dropped with a mouse, its grip and Remove stay hidden until the pointer leaves the box, and a press where the grip should be does nothing.

The fix (`components/exhbt-editor/flow/FlowList.tsx`, `keepGrip`): after a drag by mouse (a drop, a drop where it was, a cancel) the carried box's grip gets the focus, without a scroll. That is where other browsers leave it already, and where a drag from the keyboard leaves it. Touch and the keyboard are unchanged. After the fix (run 45727442555, with the same temporary test), under the rule, 0 of 70 failed; every one began with the focus on the grip, and 10 of them had the box not hovered at the press and lifted all the same. Without the rule, 0 of 70.

Runs of the final code:
- WebKit (run 45799050984, ae06cd5): "safari 2/3" 172 passed, none on a retry. "safari 2/3, the focus rule": all 103 flowchart tests that ran passed at the first try, the drag test on all seven layouts among them; the job then hit its 45-minute limit in `editor-inplace`, as installing WebKit had taken 30 minutes. The other six groups passed.
- Chromium, one worker, on 840062d (the fix, the test and #45; #46 since then only switches the default editor, which the test server sets already): `editor-flow` and `editor-drag` together, `desktop` 231 passed without the rule and 230 with it (the other one's page crashed while loading, in a test of Move up and Move down; it passed 3 of 3 again), `touch` 11 passed both ways (the rest are mouse tests); the drag test 56 of 56 under `E2E_WEBKIT=chromium E2E_FOCUS=safari`.

Tests:
- The drag test checks that the dropped box's grip has the focus, and that its tools stay shown with the pointer off the box. Under `E2E_FOCUS=safari` that fails without the fix every time (checked with the old `FlowList.tsx` put back); the old failure needed WebKit.
- A pick-up that doesn't lift fails with what the press met (`listen` in the spec): the box's hover, its tools and the focus before the pointer moves and from inside the press, what the press landed on, whether the drag took it, and what followed. It listens to no frequent event.
- Chromium never showed the failure, with or without load: 0 in 140 runs of the test under `E2E_WEBKIT=chromium E2E_FOCUS=safari` before the fix (one run did not open the editor under load), 0 in 35 with no `requestIdleCallback` (as WebKit) and the processor 4 times slower, 0 in 21 at 6 times. So that emulation can't show this kind of fault; read WebKit's runs.
- A way to read a WebKit run when its artifacts can't be downloaded: `gh api repos/RCaborn/Exhbt/actions/jobs/<job id>/logs` works without a token while the repository is public, once the job has finished.

Not the same cause: `editor-drag.spec.ts`, "a click on a grip, or a nudge under 6px…" (then at 583), failed in "safari 1/3", without the rule, at its last step (dragging across a box's words selected nothing); "a new graph opens its figures sheet…" (then at 1222) passed on a retry in the same group, its "full" note missing after a second `openDoc`, with a WebKit "access control checks" page error. Neither touches the flowchart's drag or the focus rule. Not looked into further.

Still open:
- A click on the grip with no drag (under 6px) puts the focus back on the list in Safari; after a lost hover the tools then hide again until the pointer leaves the box. Not seen in a test.
- The same hover dependence elsewhere, not tested: a section's toolbar (`.xe-frame:hover`) after a section is dropped with the mouse (the drag board moves sections in the page too), and a tablet's row chips after a box is dropped by touch.
- Not checked on a real Mac: whether a real mouse meets the lost hover, and whether the grip, focused by script after a drop, draws a focus ring or its tooltip in Safari. Under the emulation on Chromium the list showed a focus ring after a press, so the grip may show one there.
- In both runs with the temporary test, "the others slide aside" (Case study, the same test) failed on the first try in both groups and passed on the retry: the slide had not begun when the boxes were measured. With the temporary test and its log of every mousemove gone, the next run had no failed try in either group's flowchart tests. Watch for it.

## From the Safari hover agent, 26 Nov 2026 (branch `phase-2-safari-hover`)

The four risks the flow-lift agent left open (above), each read on WebKit's own runs. Run 45828414221 (b8cdadd) had temporary probes and no fix; run 45832960729 (ae42b2c) had the fix's first version and the same probes. Each probe round dropped something with the mouse (or a finger), went back to it, and wrote what the press met to the job's log, as the flow-lift agent's test did. The probes are gone now. The final version (e4a32c4) has no probe on WebKit: its evidence there is `editor-grip-focus`, which checks the same focus and tools.

What WebKit showed before the fix (run 45828414221, 42 rounds a case in each group unless it says):
1. A section dropped by mouse, under Safari's rule: after all 42 drops the focus was on nothing, so its toolbar showed only while the pointer was on the section. A section lands near the pointer, not under it, and in 32 rounds the drop left the pointer off it. 17 times a press where its grip is went to the page beneath, the toolbar hidden; in the other 15 the way to the grip crossed the section. Without the rule WebKit on Linux focuses the pressed grip: the grip had the focus after all 42 drops, and all 42 lifted. This is the focus rule's doing, and Chromium under the stand-in shows it as well. A lost hover on a section was not seen: in the 10 rounds that left the pointer on it, it kept its hover.
2. A tablet's row of boxes after a touch drop (build, essay, before and after at 810px; 12 rounds a group): picked up again 24 times in 24, with the rule and without. The focus stays in the dropped box's words through the drop (React gives it back after moving the box), so its chips show. Touches made in the page never set the hover, so these runs say nothing about the hover half.
3. A click on a box's grip after a drop, under the rule: 4 failures in 42 (essay 1, before and after 3). Each time WebKit had lost the box's hover with the pointer on it. `keepGrip` had focused the grip; the click moved the focus to the list; the tools hid; the next press went to the box. Without the rule the click focuses the grip: 42 of 42, with the hover lost in 6.
4. Everything else in `css/` shown only on hover or focus (14 rounds of the flowchart as a section; 3 of a skill, 3 of a finding):
   - The flowchart dropped as a section: in the 6 rounds that left the pointer on it, the list kept its hover, and its "+" showed (the case study's six boxes have none).
   - Seen and not explained: before and after's flowchart dropped at the top, then the pointer moved onto the list's middle, onto a "+". The list was hovered and the box that "+" belongs to was not, so its grip and Remove were hidden. It happened in that round in all four groups of both runs, which a lost hover (it came and went) does not do, and the pointer had come onto the list from outside. Most likely the probe's own doing: a "+" takes the pointer only once the list is hovered, so the move that first entered the list hovered what lay under the "+", and the next move would have put it right. One more small move before reading would settle it, or a hand check on a Mac.
   - A skill removed: the pills are keyed by their words, so none moves in the page; the badge is only faded, and still takes a press.
   - A finding moved: findings are keyed by place, so the same `li` stays under the pointer, hovered.
   - Not tried: "Make lead image" (its section moves away from the pointer) and a tablet toolbar after a touch drop (its grip is always shown there).

The fix:
- `drag/grip.ts`: a grip pressed with a mouse's main button has the focus once the press is over. The browser moves the focus first, as always; a task later, if that left the grip without it (Safari), the grip takes it. A finger's press is told apart by the pointerdown before it, and left as it was. Used by a section's grip (`board.grip` in `drag/engine.ts`) and a box's (`flow/FlowBox.tsx`).
- `drag/engine.ts`, `finish`: after a drag by mouse the carried section's grip has the focus, as after one from the keyboard. A section dropped into another row is drawn anew, and the focus its press gave the grip went with the old one. That happens in Chromium too, where the hover kept the toolbar up all the same.
- `keepGrip` in `FlowList.tsx` stays, as a backstop.
- The first version (ae42b2c) stopped the press's own move of the focus (`preventDefault`) and focused the grip from script. In Chromium a focus given that way matches `:focus-visible`, so the grip drew its focus ring and its tooltip after every press. Chromium's own focus from a press draws neither, which is why it now goes first.
- Run 45832960729 had that first version: case 1 lifted 42 of 42 under the rule and 42 of 42 without, the grip in focus after every drop; case 3 42 of 42 under the rule, 3 of them with the box's hover lost and the focus keeping its tools up (42 of 42 without, 5 with it lost). All 8 groups passed.

Tests (`e2e/editor-grip-focus.spec.ts`, new; desktop and `safari`). Each check moves the pointer off first, so it reads the focus, not the hover.
- Under Safari's rule (each page gets `safariFocus`, so Chromium's CI guards it), per layout, a section: a click and a nudge on its grip keep the focus; dropped at the top and back at the end, it keeps its grip in focus and its toolbar shown; a click after a drop; a drop out of a pair, where the section is drawn anew. And a section dropped where it was, or let go with Escape.
- Under the rule, per layout, a box: a click and a nudge on its grip; dropped, then clicked, then picked up again.
- Without the rule (skipped under `E2E_FOCUS=safari`, where the rule's stand-in moves the focus from script): a grip pressed or dropped with a mouse, a section's out of a pair too, draws no focus ring and no tooltip (`:focus-visible` false). The first version failed it.
- The 15 tests under the rule all failed without the fix, on Chromium. With only `grip.ts` in, the drop out of a pair failed on all seven layouts.

Runs of the final version:
- WebKit, run 45856454547 (e4a32c4, no probe): all 8 groups passed, none failing and none left unrun. `editor-grip-focus` 17 of 17 in "safari 2/3" without the rule, the two ring checks among them, so WebKit too drew no ring for a grip focused from script after a drop out of a pair; 15 of 15 under the rule, the two ring checks skipped. `editor-drag`: 128 tests, none failed, with the rule and without; the iPhone and iPad groups passed both ways.
- Passed there only on a retry, none of them new: "the others slide aside" (both "safari 2/3" groups, as in runs 45828414221 and 45832960729); the gallery's "+" menu (`editor-drag`, under the rule; run 45828414221 had the same first-try error, the menu not found); "a new graph opens its figures sheet" (`editor-drag`, "safari 1/3", as the flow-lift agent saw); and `editor-inplace`'s account deletion, whose first try had its move to `/account` cut short by the editor reloading as the classic one as the page was left.
- "safari 1/3" without the rule took 35.5 minutes of its 38.
- Chromium here, one worker: `editor-grip-focus` 17 of 17, some only after a crash; `editor-drag`'s click-or-nudge test and `editor-flow`'s mouse drag and keyboard tests, 21 of 21, the first on a warm server. CI's run on the final code (45859152403) was cancelled to free runners for the release.
- Merged `phase-2-pf1` (bf55009) after those runs, with no conflict. Its changes move a finding's controls, a field's formatting buttons and some chips clear of the toolbars (`listsClear`, `clearOfToolbars`, `placeLinkChips`); none changes what shows on hover or focus. `editor-grip-focus` passed 17 of 17 on the merged code here.

For whoever is next:
- This machine is shared with other agents' runs. Under their load Chromium pages crashed and a dev server died; each test that crashed passed when run again. Next's dev server also takes `/home/user/Exhbt` as its workspace root here (it finds more than one lockfile), which may be why some loads were aborted while other agents were saving files.
- `editor-flow`, "a box dragged along…", "the others slide aside" (Case study) failed its first try in both "safari 2/3" groups in run 45828414221, which changed no app code, and in 45832960729; it passed on the retry each time. As the flow-lift agent found, the slide has not begun when the boxes are measured. Not touched here.
- `editor-phone`, "Take a figure from my report", failed on both tries in "iphone-ipad, the focus rule" in run 45828414221 (the sheet at y 83, and a 502 from `/api/exhbts/figure-pick`). It passed in run 45832960729. Not looked into.

Still open (for a real Mac, iPhone or iPad):
- On a Mac: whether a real mouse meets the lost hover, and whether the grip, focused from script after Safari's own move of the focus (and after a drop), shows its focus ring or its tooltip there. WebKit on Linux drew none after a drop out of a pair, but there the press had focused the grip first; under the rule's stand-in the focus moves from script anyway, so nothing here can say.
- On an iPad: whether a tap leaves the hover on a box after a drag, and what a row's chips do after a touch drop when the focus was not in the box (a tap on its edge puts the focus on the list): then only the hover keeps them, and WebKit can lose it.
- On an iPhone and an iPad: that a tap on a grip still does what it did (the change is for a mouse only).
