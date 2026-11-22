Status: accepted
Date: 19 Nov 2026
Amends: 0007 (the editor is the page itself, not cards beside a preview), 0015 (sections are edited, added, removed and dragged on the page; a removed image can be put back), 0022 ("Arrange sections" goes; the editing page is the page), 0017 and 0025 (where a picked figure is managed; taking a figure by hand; the drafted chart can come back), and `DESIGN.md` (the Dragging rule, the exhbt page paragraph, the editor paragraph: the new wording is under "What DESIGN.md says from release 3")

# The exhbt editor is the page itself

Rory, 17 Nov 2026, with a screenshot of the editor: the cards on the left and the preview on the right are "confusing, misleading… even I'm confused". He wants one screen: "you can edit it as you would see it… add the bits to the flowchart on that right-hand side… drag the sections up and down… I think we do need to go for the full plug and play… It is the edit-on-page editor with drag and drop that I am dying for. I need it to be super smooth."

So the editor becomes the exhbt page, drawn by the same code that draws it for a visitor, in the person's own look, with every word typed where it sits and every section dragged where it goes. A prototype on a sample page settled how dragging feels (`docs/briefs/edit-on-page/drag-prototype.md`); Rory tried it on his phone on 18 Nov. How the page is laid out is decision 0027; the four new layouts are 0028.

## One page, one renderer

`ProjectView` and its parts take one optional prop, `edit`. No public page passes it, so the public page is drawn exactly as now: on the server, with no hooks and no editor code sent to the visitor. The editor is a client component that draws `ProjectView` itself and passes `edit`, an object of functions that return the editing version of each thing.

A page part asks one question: `ctx.edit ? ctx.edit.text({ … }) : value`.

Two other ways were turned down:
- **A React context.** Server components cannot read one, so every part would have to become a client component on the public page too.
- **A second renderer for editing.** Two drawings of one page drift apart. The prototype had to copy three parts to put fields in them, and its report asks for slots instead.

The adapter, in full. It is types only, in `components/portfolio/page-ctx.ts`:

```ts
// components/portfolio/page-ctx.ts  (types only: no "use client", no values, safe to import anywhere)
import type { ReactNode } from "react";
import type { RichText, SectionKind } from "@/lib/exhbt/blocks";
import type { Format, PageKind } from "@/lib/exhbt/formats";
import type { ItemAs } from "@/lib/exhbt/layouts";

export type Sub = "h2" | "h3";
export type ImageUrls = Record<string, string | null>;

/** The path validateForPublish reports for a field: "title", "gap", "flow.2.step", "sections.3.items.1", "sections.4.alt". */
export type FieldPath = string;

/** Plain text typed in the page's own type. The adapter returns a labelled field with no box of its own. */
export type TextSlot = {
  path: FieldPath;
  value: string;
  /** The field's accessible name: "Box 3", "Who said it". */
  label: string;
  placeholder: string;
  /** A fixed DOM id, where the tests rely on one: "title", "context", "whereWhen", "myRole", "flow-box-2". */
  id?: string;
  /** A hard cap in characters, where the model has one. */
  maxChars?: number;
};

/** Formatted text (bold, italic, links; or the highlight). The adapter renders a <div> with `className` and the field in it. */
export type RichSlot = {
  path: FieldPath;
  value: RichText;
  label: string;
  placeholder: string;
  /** The classes of the element the page draws this text in, when that element is a <p>: the adapter's <div> takes its place. "" when the page keeps its own element (<li>, <figcaption>) and the field goes inside it. */
  className: string;
  /** The context line: bold is drawn as the highlight and the one button says Highlight. */
  highlight?: boolean;
};

/** One page item. Every value is a string, a number or a boolean, so the frame can be memoised. */
export type ItemSlot = {
  id: string;
  kind: PageKind;
  as: ItemAs;
  /** The classes the read-only page puts on this item's root for its place in the column (the row's margin). The frame carries them and the part inside is drawn without them. "" inside a pair, a stack or a group. */
  rowClass: string;
  /** Its place among the page's items, from 0, and how many there are. */
  index: number;
  count: number;
};

/** The "+" before the page item at `at`. `end` is the one after the last item. */
export type InsertSlot = { at: number; end?: boolean };

/**
 * Edit-only things that belong to a part but are not on the published page: an image's description and picked-figure label, a link's "Web address", a graph's "Edit figures", the aim or hypothesis switch.
 * "above" is drawn over the part's top edge and "over" over a corner: they take no room (decision 0026, "Edit-only controls take no room").
 * "below" is an image's description field, in the flow under the picture and its caption: one of the two edit-only fields 0026 allows in the flow (`EDIT_ONLY_IN_FLOW`).
 */
export type ExtraSlot = { sectionId: string; kind: SectionKind; where: "above" | "below" | "over" };

/** Controls for point `index` of a list (move up, move down, remove). `index === n` is the control that adds a point. All of them are drawn over the list and take no room. */
export type ListSlot = { path: FieldPath; index: number; n: number };

/** The flowchart's own slots, so MethodFlow keeps its markup and classes. */
export type FlowEdit = {
  /** Wraps the whole list (the adapter returns the <ol> it is given, inside whatever it needs round it). */
  list(o: { count: number; stack: boolean; children: ReactNode }): ReactNode;
  /** One box. The adapter renders the <li> itself with `className`, so it can be the thing that is dragged, and gives it a key that lasts. */
  box(o: { index: number; last: boolean; className: string; children: ReactNode }): ReactNode;
  /** Inside a box, out of the flow: its grip and its remove button. */
  tools(o: { index: number; count: number }): ReactNode;
  /** In the arrow after box `after`: the "+" that adds a box there. `after === count - 1` is the one at the end. */
  add(o: { after: number; count: number }): ReactNode;
};

/** A part of the page with no frame of its own: the title with the facts, the context line, the skills. */
export type ShellTools = { block: "header" | "gap" | "skills" };

export type EditAdapter = {
  text(o: TextSlot): ReactNode;
  rich(o: RichSlot): ReactNode;
  item(o: ItemSlot): ReactNode;
  insert(o: InsertSlot): ReactNode;
  extra(o: ExtraSlot): ReactNode;
  list(o: ListSlot): ReactNode;
  flow: FlowEdit;
  /** The skill pills, each with remove, then the "Add a skill" box (id `skill-new`) at their end, in the flow: one of the two edit-only fields 0026 allows there. Takes the place of the read-only list, and is drawn even when there are no skills, when the box alone is the block's placeholder. */
  skills(): ReactNode;
  /** The sidebar's control for the work. Takes the place of "See the work". */
  work(): ReactNode;
  /** A shell part's corner toolbar, out of the flow: "More actions" (rewrite, back to the AI version) where the AI drafted it. */
  tools(o: ShellTools): ReactNode;
};

/** What every page part is given. `edit` is absent on every public page. */
export type PageCtx = { Sub: Sub; imageUrls: ImageUrls; format: Format; edit?: EditAdapter };
```

Rules for the page parts when `edit` is there:
- **Nothing is left out for being empty.** Where the read-only page hides an empty part (the context line, a caption, "Where and when", the skills), the editing page draws the part with its field, and the field's placeholder is what shows. Each placeholder takes exactly the room the part takes once it has words.
- **Two edit-only fields are in the flow, as the original design had them.** An image's description is a field under the picture and its caption, and the skills end with an "Add a skill" box. Both are things a person fills in, not controls, so they sit where they are filled in and are always drawn while editing. Each picture is one line taller while editing than on the visitor's page, and the pills have one more box at their end.
- **Edit-only controls take no room.** Everything else the editor adds is drawn over the page, absolutely positioned inside the part it belongs to, or in a native popover: the section toolbar, the "+", the flowchart's grips and "+", a finding's controls and "Add a finding", the picked-figure label, a link's "Web address" button, a graph's "Edit figures", the aim or hypothesis switch, the shell parts' toolbars, the formatting buttons and every issue message. "Add a finding" shows whenever the pointer or the focus is in the findings section, and always on a touch screen (`pointer: coarse`); it sits in the gap below the last finding, as the "+" sits in its gap, and covers no words. So a page whose optional parts all have words is the visitor's page box for box, with only the two fields above allowed for. Each edit-only element carries `data-edit-only`.
- **Nothing navigates.** "All of Amara's work", a link section and the work button are drawn the same but do not open. A picture does not open larger.
- **A part never knows which editor it is in.** It calls the slot and draws what comes back.
- **The read-only page is byte for byte what it was.** The slots add nothing to it (the parity gate, 0027).

What is in the flow in the editor only, the whole list.

The placeholders, each there only while its part is empty, drawn in the part's own element and type with its words in `--xp-muted`:
- the context line;
- the sidebar's facts: What it is, Where and when, My role;
- "Add the work", in place of "See the work";
- a flowchart box's detail;
- an image's caption;
- a quote's role;
- a link's description;
- an aim or a conclusion with no words.

The two edit-only fields, always there while editing:
- an image's description: one line in the caption's type, under the caption, inside the figure (its placeholder "Describe it for people who can't see it", its name "Image n: describe it for people who can't see it", id `image-N-alt`). It is marked "Needs a description" in `--xp-error` until filled; the mark sits at the field's end and takes no room;
- the "Add a skill" box (id `skill-new`), the size of a pill, as the last of the pills. On an exhbt with no skills it is the skills block's placeholder: the visitor's page draws no skills block then, and without the box there would be nothing to add a skill with.

The list lives once in the code, as `EDIT_ONLY_IN_FLOW` in `e2e/page-editor.ts` (a name, a selector, and whether it is always there or only while its part is empty), and every box-for-box test reads it. Box for box is run twice. On samples with every optional part filled (My role included), the editing page and the visitor's page differ in nothing but the highlight's wrap (below) and the two edit-only fields. On a sparse fixture (a new exhbt), the editing page equals the loading stand-in exactly (below, "The crash fallback"), and differs from the visitor's page only by what is on the list.

**How a box-for-box test allows them.** A part on the list may be there in one and not the other. The box that holds it may grow by its height (a figure by its description's line, the skills block by a line of pills if the box wraps to one), and whatever sits below moves down by the same amount. On the pills' own line, the pills may move aside for the "Add a skill" box: on a wide page they are set to the right, so they move left by its width. Nothing else may differ. This is what the original design asked of the description field: the test allows its own height and nothing else.

## What re-renders

The editor keeps the doc in a store outside React, as the prototype did, and each part of the page reads its own slice. There are three kinds of unit:

- **the shell:** the title, the context line, the sidebar's facts and the skills. It renders again when one of those changes, or when the page's structure does (`structureKey`, 0027);
- **the flowchart;**
- **each section,** in its frame.

In edit mode `LayoutMain` does not draw a section itself. It calls `edit.item` with the section's id and how it is to be drawn, all plain values. The frame that comes back reads that one section from the store and draws it with `ItemView`, the same function the read-only page uses. So typing in a finding renders that section's frame again and nothing else on the page: not the shell, not the flowchart, not another section.

## Fields, and the path each one has

Every field carries `data-path`, and the path is exactly the one `validateForPublish` reports. "Things to fix" jumps to the field by that path. Names and ids the browser tests rely on are kept (`test-contract.md`).

| Path | What | Typed as | Name read out | Id |
|---|---|---|---|---|
| `title` | the title | plain | the layout's own ("Your question (the title)") | `title` |
| `gap` | the context line | formatted, with Highlight | the layout's own ("Context", "The brief", "Background") | |
| `context` | What it is, in the sidebar | plain | What it is | `context` |
| `whereWhen` | Where and when | plain | Where and when | `whereWhen` |
| `myRole` | My role (0028) | plain | My role | `myRole` |
| `skills.N` | a skill pill | pill with remove; one box to add, after the last pill, always drawn | Skills | `skill-new` (the box) |
| `flow.N.step`, `flow.N.detail` | a flowchart box and its detail | plain | Box n, Box n detail | `flow-box-N` |
| `sections.N.items.K` | a finding | formatted | Finding k | |
| `sections.N.caption` | an image's caption | formatted | Image n caption | |
| `sections.N.text` | what I'd do next, the aim, the conclusion | formatted | the part's heading | |
| `sections.N.text`, `.name`, `.role` | a quote | plain | The quote, word for word; Who said it; Their role (optional) | |
| `sections.N.text` | a pull quote (0028) | plain | Pull quote | |
| `sections.N.label`, `.description` | a link | plain | What the link is; One line about it (optional) | |

"Formatted" means bold, italic and https links, as decision 0007 allows, stored as runs. Every text stored as runs keeps its formatting: none is flattened to plain text.

## What the page does not draw, and where it is edited

| What | Where |
|---|---|
| An image's description (`sections.N.alt`) | A field under the picture and its caption, in the editor only: "Image n: describe it for people who can't see it" (id `image-N-alt`). Marked "Needs a description" until filled. It is in the flow: one of the two edit-only fields (above) |
| A link's address (`sections.N.href`) | A "Web address" button over the link's corner, always shown (not only on hover or focus) and marked while the address is missing, opens a popover holding the field. A link just added opens that popover with the cursor in the field |
| A graph's figures (`sections.N.chart`, `sections.N.chart.*`) | Click the graph, or "Edit figures" over its corner: a sheet at the side holds the existing `ChartEditor`, and the graph on the page redraws behind it. A graph with no numbers yet shows "Add your numbers" over it, not an empty axis. A graph just added opens its sheet |
| A picked figure's tick, crop and other pages (`sections.N.picked.shareOk`) | A small label over the top of the picture ("From your report, page 3") opens a popover holding the existing `PickedFigure` strip: Crop, Choose another page, and the tick. While the tick is not ticked, the label holds the tick itself ("From your report, page 3 · [ ] I may share this"), so it is set on the page, where it is seen |
| The aim or hypothesis switch | Over the aim's top edge |
| The work (`evidence`) | The sidebar's button opens a small panel: a link or a file, and the name on the button |
| The card's summary and headline number (`summary`, `headline`) | "Card and link details" in the top bar: a sheet with the portfolio tile drawn live beside the fields |
| Numbers to check | In "Things to fix", in a list named "Numbers to check", each with "That's right" and "Show me". The top bar's button shows whenever there is an issue or a number to check ("1 number to check" when that is all). The same rows are in the publish sheet |
| The publish tick, Publish, the live link | "Review and publish": a sheet |
| Unpublish, Delete, Use the classic editor; Reorder sections on a touch screen (`pointer: coarse`: a phone or a tablet) | The menu at the end of the top bar |
| Rewrite, Back to the AI version | "More actions": on a section, in its toolbar; on the title, the context line and the skills, in their own corner toolbar (`edit.tools`), out of the flow, with the test ids `tools-header`, `tools-gap` and `tools-skills` as now |
| Sections the layout keeps but does not draw | A list at the foot of the page: "Kept, not shown in this layout", each with Remove |
| How many of a kind (path `sections`), the flowchart's count (`flow`), the skills (`skills`), the findings' count (`sections.N.items`), the word total (path `""`) | Each has an anchor that "Things to fix" jumps to: the "+" at the end of the page carries `data-path="sections"` and opens its menu; the flowchart's list `flow`; the skills block `skills`; a findings list's "Add a finding" `sections.N.items`; the word bar `""`. Every frame also carries `data-path="sections.N"`, so a path with no field of its own still lands on its section |
| Teammates | Above the editor, as now (`TeamStrip`, `MatchPrompt`) |

**Issues.** A field with an issue gets an outline in the look's error colour (`--xp-error`, below) and `aria-invalid`, and is tied to its message (`aria-describedby`). The message is visually hidden until the field has the focus, when it shows in a small popover under the field. It is never put in the flow: `visibleIssues` shows an over-limit issue while the person types, and a message in the flow would push the page down mid-word. Every message is also in "Things to fix".

## The chrome

**The top bar**, one row that stays at the top: back to Your exhbts; the Layout menu; Undo, named for what it undoes ("Undo: remove graph 1"); the word bar; "3 things to fix"; See as a visitor; the save status; Card and link details; the menu; Review and publish. On a phone it keeps back, the word count, the things to fix, the save status and "Review and publish" (one label for one action, everywhere); the rest is in the menu.

**See as a visitor** draws the same doc with no adapter, in a region named "Preview". It is the truth about what a visitor gets, and it is what the editing page is tested against.

**On each section**, a small toolbar at its top corner, outside the flow so it takes no room: the grip, move up, move down, the layout's own action where there is one (Make lead image, Make key figure, Before or After), More actions where the AI drafted the part, and Remove (the flowchart has no Remove in a case study or research, which always have one). With a mouse it shows when the pointer is over the section or the focus is in it. On a touch screen (`pointer: coarse`) wider than 48rem, a tablet or a phone turned sideways included, it is always shown and its buttons are 44px; elsewhere they are 36px. On a phone (narrower than 48rem, with touch) only the grip shows, and the other actions are in the bar at the foot of the screen (below). Each button has a tooltip. The frame is an outline, not a border. Rory: "Grip thing good." The grip is the only thing that drags, so words can be selected and the page scrolled by touch.

**On the title, the context line and the skills**, which have no frame, the same kind of toolbar sits at the part's corner, out of the flow: "More actions" (rewrite, back to the AI version) where the AI drafted the part. A skill is added in the "Add a skill" box at the end of the pills, in the flow, not from this toolbar.

**The "+"** sits in the gap above each row and after the last. It lists every kind the layout can hold, in the layout's own words, with the flowchart when it is off the page. Whatever is chosen goes where that "+" is, the flowchart included: it goes back at the place chosen, not at its usual place (`restoreFlow(doc, at)`, 0027). A kind with no room is listed, dimmed, with the reason under it ("Up to 2 graphs in a case study"). The list and the reasons come from one function (`blockOptions`), which reads the product's own caps. When every kind is full, one line at the top says so: "This case study is full. Remove a section to add another, or try another layout." The words left are at the top too. The end one is named "Add a section"; the one in each gap "Add a section before <label>". A new text section opens with the cursor in it; a new graph opens its figures sheet; a new link opens its "Web address" popover with the cursor in it. Image opens the file picker: several pictures at once, placed there in the order they were picked, with "Uploading 2 of 5" said and shown at once in a small status line at the foot of the window (out of the flow; on a phone, just above the bar at the foot of the screen, so the two never overlap), and a failed upload's reason under it (`role="alert"`).

**The tray**, on a desktop only: a rail of the same blocks beside the page, to drag onto it. It is drawn from a window 77rem wide with a mouse or trackpad, fixed in the right margin, clear of the top and bottom fifths of the window where carrying something scrolls the page. A block dropped in a gap goes there, the flowchart included. Each block is also a button: Enter adds it after the section the focus was last in. It shows the words left and, when every kind is full, the same one line as the "+". Rory: "maybe tray only there on desktop". Between 64rem and 77rem there is no room for it, and the "+" is the way.

**On a phone:** one column. Each section shows its grip; the other actions for the section in focus are in a bar at the foot of the screen, with the formatting buttons when a formatted field has the cursor. After a remove, a move or a drop the bar shows "Undo <what>" until the next action, so a wrong thumb is put right where it happened. "Reorder sections" opens a sheet of short rows to drag or move with buttons. It is on the bar, and in the top bar's menu on a touch screen (`pointer: coarse`), phone or tablet, where a long drag is hard; it is not offered with a mouse and keyboard, where the grip, Move up and Move down do the job and the editing page stays the one way to arrange sections. Sheets fill the screen. Targets are 44px. There is no tray.

## Dragging

As Rory decided on 18 Nov: "Flowchart on b works better, rest on a is better!"

- **A section slides.** The other sections move aside, by transform, to show where it will land, and a dashed box shows the room made for it.
- **The flowchart is carried over a still page,** and a line shows where it will land.
- **A box inside the flowchart** is carried with a line too. Rory has not yet said whether he prefers that to sliding (when he tried it, boxes slid in both versions). It is one line to change.

The three choices are three constants in `components/exhbt-editor/drag/options.ts`.

The engine is the prototype's, built again on the real page:

1. **Freeze at pick-up.** Every section's box is measured once. Until the drop, no section's layout box changes. Anything that moves, moves by a transform.
2. **The place comes from the frozen page and the pointer,** and from nothing shown during the drag. Another place must be nearer by 10px before it takes over. So a drag cannot flicker between two places.
3. **Sliding or a line is only what is drawn.** For sliding, where the others would sit is measured, not guessed: empty boxes of the sections' sizes are laid out in a hidden copy of the page's own rows (`rowsFor`, `rowClass`), so pairs, the grid and the gaps are the real CSS.
4. **The drop** moves the section from where it was let go to its place, 180ms, transforms only. With reduced motion nothing animates.

A lifted copy follows the pointer on a card with the pack shadow and an outline in the look's link colour. It is never scaled. Near the top or bottom edge the page scrolls itself.

- **Mouse:** picks up after 6px of movement, so a click on the grip stays a click.
- **Touch:** a press of 150ms picks up. A swipe that starts on the grip does nothing; a swipe anywhere else scrolls.
- **Keyboard:** Space or Enter on the grip picks up, the arrows move one place at a time, Space or Enter drops, Escape cancels. Each step is read out ("Quote would go to place 3 of 7"). Move up and Move down do the same without picking up.

The prototype follows the pointer itself and uses dnd-kit only for its sensors and the press delay, because dnd-kit's own position leaves scrolling out for something fixed to the window (a block from the tray). A section that changes row becomes a new DOM node, so the engine finds sections by id and never keeps a reference to one.

## Typing in the page's own type

Plain fields are textareas with no box of their own: no border, padding or ground, and the face, size, weight, spacing and line height of whatever they sit in. They grow with `field-sizing: content`; where a browser lacks it, a hidden mirror of the words in the same grid cell sets the height (setting it from `scrollHeight` was up to 3.4px out). Enter does not start a new line. The focus ring is an outline, so nothing moves when a field takes focus.

Formatted fields are Tiptap, one small editor per field. What the prototype found, and what follows:

- **Tiptap's stylesheet must be off** (`injectCSS: false`). It sets `white-space: break-spaces` and turns ligatures off, which breaks lines in different places from the published paragraph. The editor writes the two rules the field needs.
- **Tiptap's wrapper is a `div`,** which cannot go in a `p`. So a formatted slot renders its own `div` with the paragraph's classes in place of the `p`.
- **Tiptap starts after the first paint.** Until its editor exists, a field is drawn as the page draws it and swapped when ready; nothing moves in the swap. Editors are made one at a time in idle moments after the page is up, and at once for a field the person clicks. A full gallery has about a dozen.
- **The highlight** is stored as bold and drawn as the page's `mark`, so the line being typed is the line that will be published.
- **The formatting buttons** (Highlight on the context line; bold, italic and link elsewhere) float above the line's right end while it has the cursor, out of the flow; on a section's first line, where the toolbar sits, they go below the line instead, so the two never overlap.
- **The title stays plain text.** `text-wrap: balance` works in a textarea, so it wraps as the published title does; the cost is that lines re-balance as you type.

The known differences from the visitor's page on a full page, written into the box-for-box test by name: a highlight that wraps is about 5px longer in the field; each image's description field; the "Add a skill" box. Empty parts are the placeholders. Both lists are under "One page, one renderer", with how the test allows them.

## Undo

Undo reverses the last structural action. It never throws away typing, so it is done by reversing actions, not by restoring a snapshot.

- On the list, up to 30: add, remove or move a section; a layout switch; add, remove or move a flowchart box or a finding; an AI rewrite; a confirmed number; removing the work.
- Not on it: typing. Within a field the browser's own undo works.
- Each entry is keyed by section id (a flowchart box by a key that lasts for the visit), so typing done since does not break it.
- **What an entry holds.** A structural action (add, remove, move, a layout switch, the flowchart off or on) holds the whole structure before it: the sections' ids in stored order, the content of any section it took out, whether the marker was there, `flowOff` and the layout. Undo restores exactly that, the marker absent if it was absent (0027, "Layouts are starting templates"); sections still on the page keep their words. Any other entry (a rewrite, a confirmed number, the work removed, a patch with a name) holds the before and after of exactly what it changed: for each section it touched, the fields that changed; for the doc, the top-level keys other than `sections` that changed. Undo writes back only those, so typing done since in any other field is kept. A whole-doc snapshot is never used: it would throw typing away.
- **The numbers to check.** Taking out a section never prunes the flags; a rewrite does, as now (`replaceBlock`). Undo brings the list back as the list now joined with the list before the action, limited to numbers on the page after the undo. So undoing a rewrite brings back the old "18%" still flagged: the server publishes only when the list the page sends is empty, so a number nobody checked must not lose its flag.
- **Files.** Each entry says which stored files it could bring back, for the file rule below.
- Ctrl or Cmd and Z runs it only when the cursor is not in a text field.
- The list lasts for the visit. After an Undo the focus goes to the first field of the section it brought back or moved; when there is no such section it stays on Undo while Undo can still be pressed, and otherwise goes to the top bar's heading.

## Saving, and what may delete a file

Saving is `useAutosave`, unchanged: about a second and a half after the last change, at once when the tab is hidden or focus leaves the editor, one save at a time, three tries, a copy kept in the browser until the server has it. The status is quiet text: "Saved", "Saving…", or "Not saved. Retry". Nothing spins and nothing blocks typing. The server actions (`saveDraft`, `publishExhbt`) are unchanged.

Two things go round React, because React can lose them:
- **The browser copy is written by the store,** in the same change that sets the words (`writeBackup`, under the key `useAutosave` uses), before anyone is told of the change. If the editor throws while drawing that change, React drops the render, so a backup written in an effect would never be made. The store also keeps the newest doc for `flushPending()`, which the crash fallback awaits.
- **A save the server has no action for** (after a deploy or a rollback the page's server actions no longer exist on the server, and Next throws its `UnrecognizedActionError`) does not retry three times and then say "Not saved". It says "The editor was updated. Reload to carry on; your changes are kept in this browser." with a Reload button. Every other failure, a server error, a timeout or a gateway's error page as much as a dropped connection, is tried three times like any save that did not land, and says "Not saved. Retry" if none of them works (`Autosave.tsx`; the release 3 review's data-safety-2 found every non-network error being taken for a stale editor).

**The offer of the browser copy.** When the page opens with a copy in this browser newer than the server's, it is offered back ("Restore them" or "Discard them"). The offer is for that one copy (the release 3 review's data-safety-3): it goes as soon as the doc changes, since the store then writes the new doc over the copy, and as soon as a save or a publish clears the copy or another tab replaces it. So Restore can never put an older copy over work done since. Restore is one undo entry, "restore the kept changes", so Undo gives back what the server had. Discard takes the copy out only while it is still the one offered.

Typing never writes the flow marker; the first structural change does (0027).

A stored file (a picture, or the work) is deleted only when all four are true:

1. the last doc the server saved does not point at it;
2. the published copy does not point at it;
3. the doc in the editor now does not point at it;
4. no undo entry could put it back.

A picture that has finished uploading but is not on the page yet is held, and no run of the check touches it until it is placed or given up: several pictures finishing out of order (each waits for those picked before it), a replaced picture whose size is still being read, a figure from the report on its way in (`files.ts`, the release 3 review's data-safety-1). Without this, the save that follows the first picture's placement deleted the later ones that had finished first.

The check runs after each save lands, when an undo entry falls off the end of the list, on `pagehide` when the page is not being kept (`event.persisted` is false), and when the editor unmounts (the person leaves or switches to the classic editor). It never runs when the page is merely hidden (`visibilitychange`), nor on a `pagehide` that keeps the page in the back-forward cache: in both the visit, and its undo list, comes back. So a removed picture can be put back with Undo for as long as the visit lasts, which the classic editor could not do. If the tab is killed outright, a removed picture's file is left behind; it is harmless and counts against storage, as an orphan does today.

**The server has the last word.** Each editor decides from what it saw, and two can be open on one exhbt (two tabs, or the new one and the classic one after the switch or the escape). So `DELETE /api/files/[id]` deletes nothing, and answers as if it had, while any of the person's exhbts points at the file in its working copy or its published copy. This ships in release 2, where it changes nothing: today's editor never deletes a file either copy still uses.

A picture replaced by a new crop or another page is not an undo entry: the old file goes when the save without it lands, as now.

## The key visual, and pictures by hand

- **Pictures by hand** are as now: several at once, shrunk in the browser, placed in the order picked, with the cursor then put in the first empty description. They can also be dropped onto the page.
- **A picked figure** keeps its strip: where it came from, the share tick, Crop, Choose another page. It opens from the label over the picture, and the tick is on that label itself until it is ticked.
- **When nothing was picked** and the layout takes a figure from the work, the "+" also offers "Take a figure from my report": the page chooser that `PickedFigure` already has, with no AI call. It needs the stored PDF, so it is listed only when there is one. When the layout has no room for another image it is still listed, dimmed, with the image's reason ("Up to 2 images in a case study"), so the person learns it is there.
- **Removing a picked graph or table** offers the chart the draft drew: "Put back the chart drafted from your numbers". The offer shows only once no image on the page has a picked graph or table: while the report's own figure is on the page the drafted chart stays away, as 0025 rules. When the figure was placed, the graphs it replaced are kept with the exhbt's AI version (`ai-version.json`, beside the blocks kept for "Back to the AI version"), not in the doc. Reading and rewriting the AI version keeps them (`loadAiVersion` returns `graphs`, so a rewrite of another part does not wipe them). Putting one back goes through the server, which checks its numbers against the source again, so a parked graph cannot escape the number check. The graphs are kept from release 2 on; an exhbt drafted before that has none, and gets no offer.

## The person's own look

The editing page sits in the person's look: the wrapper carries `lookAttrs(theme)` and `themeStyle(theme)` (`components/portfolio/themeFonts.ts`), as the public frame does. The frames, grips, the line and the lifted copy take the look's own variables, so they hold on a dark look. The top bar and the sheets stay in the app's own style.

Two marks on the page need colours each look must pass: the placeholders, which use `--xp-muted` (already checked in every look as "secondary text on the ground", on cards and on the well); and issues ("Needs a description", an invalid field's outline, words over the cap, a kind that is full), which use a new `--xp-error`, from a new `error` colour in every look's palette (`--pf-error`), added to `contrastPairs` on the ground, the cards and the well. `AGENTS.md` says not to invent colours, so its value is the app's own error colour (`#C92324`) in every look where that passes 4.5:1 on all three. Only where it fails does a look get a value of its own, the nearest red or deep orange that passes, and those values go to Rory before release 3 (question 10). It ships in release 2, unused, so the looks' contrast test covers it before the editor exists.

## The classic editor: the switch, the fallback, the escape

The old editor stays for one release as "classic". It is the safety net for going straight to everyone.

- **The switch.** `editorKind()` in `lib/editor-kind.ts` returns `"page"` unless the runtime variable `EXHBT_EDITOR` is `classic`. It is read on each request, so setting it in the Cloudflare dashboard flips everyone back with no deploy. In development only, a cookie (`exhbt-editor-kind`, set by `/dev/editor?kind=`) overrides it, so each browser test has its own and a failed test cannot leave the switch set for the next. It ships, unused, in release 2, so the switch is proven on the preview site before there is an editor to switch to. It has a file of its own, marked server only, because it reads the request's cookies (`next/headers`) and client code imports `lib/site.ts`.
- **The escape.** "Use the classic editor" opens the same exhbt with `?editor=classic`, for that visit. The classic editor shows a line with the way back.
- **The crash fallback.** An error boundary sits round the new editor. If it throws, the boundary shows "Something went wrong with the new editor. Your work is saved.", waits for `flushPending()` (the store's newest doc sent to the server, three seconds at most; the browser copy was already written), and reloads the page with `?editor=classic`. It reloads, and does not swap editors in place, because the page's props are from when it was opened: an editor mounted on them could save over newer work.
  - An error boundary cannot catch a throw while the server draws the page. So the new editor is never drawn on the server: it loads in the browser, inside the boundary. Until it has loaded, the person sees the editing page drawn by a static stand-in adapter: the same slots, with everything on `EDIT_ONLY_IN_FLOW` drawn inert (the placeholders as text; the description fields and the "Add a skill" box as they will be, not yet usable) and every other control left out (they take no room). The visitor's page would not do, because it leaves out empty parts and those two fields, and they would pop in when the editor arrived. With the stand-in the fields come alive in place and nothing moves, which a test checks on a blank new exhbt.
  - If the page itself fails on the server, the route's own error page says the same and links to the classic editor.

Both editors use the same doc, autosave and actions, and the classic editor keeps what it does not edit (0027), so moving between them mid-exhbt loses nothing. How the switch is proven is in `docs/briefs/edit-on-page/README.md`.

## Smoothness

Rory asked for "super smooth". These exact checks gate CI. They count things; they do not time them, so they do not flake. They run on the sample of every layout the editor offers (`OFFERED_FORMATS`), so when release 4 offers seven, they cover seven with no change to the specs, and release 4 adds flicker cases for its new rows (a Before and after pair forming, Build's row of buttons, Essay's key points beside the pull quote).

1. **Typing re-renders only what was typed in.** A counter on each unit (the shell, the flowchart, each section). A key typed in a finding, a caption or a quote adds one to that section and none to anything else. A key in a flowchart box adds one to the flowchart only. A key in the title or the context line adds one to the shell and none to any section.
2. **Nothing moves when a field takes focus.** Every frame, pill, flowchart box, finding and figure is in the same place before and after, on every layout.
3. **Nothing moves when a drag starts, and until the drop sections change only by transform.** Layout boxes are compared; the drop's motion is transforms only; with reduced motion `document.getAnimations()` is empty.
4. **No flicker on a boundary.** Resting on a boundary and trembling 2px either side 40 times never changes the place.

Frame times during a scripted drag and keystroke-to-paint on the longest sample, with the processor slowed four times, are measured from a production build and sent to Rory with recordings. They are reported, not gating: shared runners are too noisy for hard limits. The prototype's figures were a median frame of 16.7ms and a median keystroke of 12ms under that slowdown.

## Accessibility

- Every field is a real, labelled control, found and named like any form field.
- Everything the pointer can do has a keyboard way: the grip, the move buttons, the "+", the tray by Enter, the sheets.
- Each move, add and remove is said in a live region, and the focus goes somewhere sensible after it (the moved section's button; what took a removed section's place).
- Sheets are native `<dialog>`s: focus is trapped, Escape closes, and focus goes back to what opened them.
- An issue is tied to its field (`aria-describedby`) and marks it invalid.
- The toolbar shows on focus as well as on hover, and is always shown on touch.
- Every "+" has its own name: "Add a section" at the end, "Add a section before <label>" in each gap.
- axe runs on every layout at rest, with a section lifted, in a dark look, while typing, on a phone and with each sheet open; and at rest on a blank and on a full exhbt in all eight looks, because on a blank exhbt the placeholders are all there is to read.
- The editing page keeps the page's heading order: the screen's own heading is "Edit exhbt", and the exhbt's title is drawn one level down.

## What DESIGN.md says from release 3

This decision departs from three passages of `DESIGN.md`. The editor's agent pastes this wording in at release 3, so a reviewer judging the look against `DESIGN.md` judges it against this.

- **Dragging** (replaces the sentences after the builder's): "On the exhbt editing page, sections slide to make room, and the flowchart section is carried over a still page with a line showing where it lands (decision 0026). A box inside the flowchart is carried with a line by default; Rory has not yet confirmed that against sliding (`FLOW_BOX_STYLE`, one line to change; open question 1 in `docs/briefs/edit-on-page/open-questions.md`). The lifted copy keeps its card, takes `shadow-pack` and an outline in the look's link colour (jade in the Exhbt look), and is never scaled; the others move only by transform, 180ms, and nothing moves under `prefers-reduced-motion`. Toolbar buttons are small round icon buttons, 36px, 44px on any touch screen, each with an `aria-label` and a tooltip. Status is quiet text ("Saved"); the exhbt editor's Undo keeps up to 30 steps, named for what each undoes."
- **The exhbt page** (replaces "The core's order never changes."): "The flowchart is a section like the others: it can be moved, and removed in the layouts that let it go (decision 0027). Every layout is drawn in the doc's order by one engine."
- **The editor** (replaces the paragraph that starts "In the editor each section is a card"): "The exhbt editor is the page itself, in the person's own look (decision 0026). Each section has a toolbar at its top corner, out of the flow: a grip (the only thing that drags), move up and down, the layout's own action, More actions, and Remove. Edit-only controls take no room. In the flow are only an empty part's placeholder and two fields a person fills in: an image's description, under the picture, and the "Add a skill" box at the end of the pills. The top bar and the sheets are app chrome, in the app's own style."

## Not done, on purpose

- Placing things freely, resizing, or columns of the person's own. Sections go in an order; the layout's rules draw the rows.
- Undo for typing across fields.
- Two tabs on one exhbt merging their changes. The newest save wins, as now.
- A formatted title.
- A tray on a phone or a tablet.
- The first-visit checklist the classic editor shows on a blank exhbt. The placeholders on the page and "Things to fix" do its job.
- Sweeping up files left by a killed tab.
- Dragging a section from one exhbt to another.

## Not sure, and risky

- **The prototype drew all three samples with the case study's pairing and an even 4:3 grid.** The gallery's justified rows, research's stacks and a pair forming or splitting under a slide have not been tried. Sliding there may look wrong in shape though it is stable. The engine is one for both styles, so the fallback is the line for those rows; that would be a change to what Rory chose and goes to him first.
- **A dozen Tiptap editors on one page** has not been measured on a phone. The prototype had one.
- **Only Chromium was tested.** Safari and Firefox need a person: `field-sizing`, and whether a container query's element becomes the containing block for fixed things.
- **No real finger has tried the final rules.** Touch was driven through Chromium's touch input.
- **A screen reader has not been heard.** The announcements are checked as text.
- **`keep_vars`** should keep a dashboard variable across deploys. The plan put that at about three in four; the preview test settles it before release.
- **The shell re-renders on every key in the title.** It is light, but it is the largest unit.
- **The description field under each picture.** It makes the editing page one line longer per picture than the visitor's, which the box-for-box tests allow by name. The other way, a strip over the foot of the picture, keeps the page its size but covers the person's own picture while they edit, which matters most in the layouts that lead with pictures. Rory may choose it (question 11). The picked-figure label sits over the picture's top either way.
- **Popovers** (the link's address, the picked figure's strip) use the native popover element. Safari and Firefox support it in their current versions; older ones need a person to check.

Code: `components/portfolio/page-ctx.ts`, `components/portfolio/ProjectView.tsx`, `components/portfolio/LayoutMain.tsx`, `components/exhbt-editor/`, `lib/editor-kind.ts`, `app/(app)/exhbts/[id]/edit/page.tsx`, `app/(app)/exhbts/[id]/figure-actions.ts`. Kept and reused: `components/editor/useAutosave.ts`, `media.ts`, `model.ts`, `ChartEditor.tsx`, `PickedFigure.tsx`, `BlockTools.tsx`, `ConfirmAction.tsx`. Tests: `e2e/editor-inplace.spec.ts`, `editor-smooth`, `editor-drag`, `editor-flow`, `editor-classic`. Briefs: `docs/briefs/edit-on-page/`.
