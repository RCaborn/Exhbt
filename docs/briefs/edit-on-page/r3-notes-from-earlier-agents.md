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
