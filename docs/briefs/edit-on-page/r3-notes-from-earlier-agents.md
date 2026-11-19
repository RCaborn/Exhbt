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
