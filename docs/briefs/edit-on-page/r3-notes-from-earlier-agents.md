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
