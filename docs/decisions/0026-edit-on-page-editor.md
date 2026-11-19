Status: accepted
Date: 19 Nov 2026
Amends: 0007 (the editor is the page itself, not cards beside a preview), 0015 (sections are edited, added, removed and dragged on the page; a removed image can be put back), 0022 ("Arrange sections" goes; the editing page is the page), 0017 and 0025 (where a picked figure is managed; taking a figure by hand; the drafted chart can come back)

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
 * Edit-only controls that belong to a part but are not on the published page: an image's description and picked-figure strip, a link's address, a graph's "Edit figures", the aim or hypothesis switch.
 * Each is drawn over the part and takes no room (decision 0026, "Edit-only controls take no room"): "above" over its top edge, "below" over its foot, "over" over a corner.
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
  /** The skill pills, with a way to add and remove one. Takes the place of the read-only list. */
  skills(): ReactNode;
  /** The sidebar's control for the work. Takes the place of "See the work". */
  work(): ReactNode;
  /** A shell part's corner toolbar, out of the flow: "More actions" (rewrite, back to the AI version) where the AI drafted it, and for the skills "Add a skill". */
  tools(o: ShellTools): ReactNode;
};

/** What every page part is given. `edit` is absent on every public page. */
export type PageCtx = { Sub: Sub; imageUrls: ImageUrls; format: Format; edit?: EditAdapter };
```

Rules for the page parts when `edit` is there:
- **Nothing is left out for being empty.** Where the read-only page hides an empty part (the context line, a caption, "Where and when"), the editing page draws the part with its field, and the field's placeholder is what shows.
- **Nothing navigates.** "All of Amara's work", a link section and the work button are drawn the same but do not open. A picture does not open larger.
- **A part never knows which editor it is in.** It calls the slot and draws what comes back.
- **The read-only page is byte for byte what it was.** The slots add nothing to it (the parity gate, 0027).

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
| `skills.N` | a skill pill | pill with remove; one box to add | Skills | `skill-new` (the box) |
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
| An image's description (`sections.N.alt`) | A field under the picture, in the editor only: "Image n: describe it for people who can't see it" (id `image-N-alt`). Marked "Needs a description" until filled |
| A link's address (`sections.N.href`) | "Web address", under the link, in the editor only |
| A graph's figures (`sections.N.chart.*`) | Click the graph, or "Edit figures": a sheet at the side holds the existing `ChartEditor`, and the graph on the page redraws behind it |
| A picked figure's tick, crop and other pages (`sections.N.picked.shareOk`) | A strip above the picture (the existing `PickedFigure`) |
| The work (`evidence`) | The sidebar's button opens a small panel: a link or a file, and the name on the button |
| The card's summary and headline number (`summary`, `headline`) | "Card and link details" in the top bar: a sheet with the portfolio tile drawn live beside the fields |
| Numbers to check | In "Things to fix", each with "That's right" and a jump to the field that holds it |
| The publish tick, Publish, the live link | "Review and publish": a sheet |
| Unpublish, Delete, Use the classic editor | The menu at the end of the top bar |
| Rewrite, Back to the AI version | "More actions" on the part it rewrites, as now |
| Sections the layout keeps but does not draw | A list at the foot of the page: "Kept, not shown in this layout", each with Remove |
| How many of a kind (`sections`), the word total (path `""`) | The "+" at the end of the page; the word bar |
| Teammates | Above the editor, as now (`TeamStrip`, `MatchPrompt`) |

## The chrome

**The top bar**, one row that stays at the top: back to Your exhbts; the Layout menu; Undo, named for what it undoes ("Undo: remove graph 1"); the word bar; "3 things to fix"; See as a visitor; the save status; Card and link details; the menu; Review and publish. On a phone it keeps back, the word count, the things to fix, the save status and Publish; the rest is in the menu.

**See as a visitor** draws the same doc with no adapter, in a region named "Preview". It is the truth about what a visitor gets, and it is what the editing page is tested against.

**On each section**, a small toolbar at its top corner, outside the flow so it takes no room: the grip, move up, move down, the layout's own action where there is one (Make lead image, Make key figure, Before or After), More actions where the AI drafted the part, and Remove (the flowchart has no Remove in a case study or research, which always have one). It shows when the pointer is over the section or the focus is in it. The frame is an outline, not a border. Rory: "Grip thing good." The grip is the only thing that drags, so words can be selected and the page scrolled by touch.

**The "+"** sits in the gap above each row and after the last. It lists every kind the layout can hold, in the layout's own words, with the flowchart when it is off the page. A kind with no room is listed, dimmed, with the reason under it ("Up to 2 graphs in a case study"). The list and the reasons come from one function (`blockOptions`), which reads the product's own caps. A new text section opens with the cursor in it. Image opens the file picker: several pictures at once, placed there in the order they were picked.

**The tray**, on a desktop only: a rail of the same blocks beside the page, to drag onto it. It is drawn from a window 77rem wide with a mouse or trackpad, fixed in the right margin, clear of the top and bottom fifths of the window where carrying something scrolls the page. Each block is also a button: Enter adds it after the section the focus was last in. Rory: "maybe tray only there on desktop". Between 64rem and 77rem there is no room for it, and the "+" is the way.

**On a phone:** one column. Each section shows its grip; the other actions for the section in focus are in a bar at the foot of the screen, with the formatting buttons when a formatted field has the cursor. "Reorder sections" opens a sheet of short rows to drag or move with buttons. Sheets fill the screen. Targets are 44px. There is no tray.

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
- **The formatting buttons** (Highlight on the context line; bold, italic and link elsewhere) float above the line's right end while it has the cursor, out of the flow.
- **The title stays plain text.** `text-wrap: balance` works in a textarea, so it wraps as the published title does; the cost is that lines re-balance as you type.

Known differences from the visitor's page, all small and all listed in the box-for-box test: a highlight that wraps is about 5px longer in the field; an image with no caption is one line taller while editing, because the empty caption field is there.

## Undo

Undo reverses the last structural action. It never throws away typing, so it is done by reversing actions, not by restoring a snapshot.

- On the list, up to 30: add, remove or move a section; a layout switch; add, remove or move a flowchart box or a finding; an AI rewrite; a confirmed number; removing the work.
- Not on it: typing. Within a field the browser's own undo works.
- Each entry is keyed by section id (a flowchart box by a key that lasts for the visit), so typing done since does not break it.
- Ctrl or Cmd and Z runs it only when the cursor is not in a text field.
- The list lasts for the visit.

## Saving, and what may delete a file

Saving is `useAutosave`, unchanged: about a second and a half after the last change, at once when the tab is hidden or focus leaves the editor, one save at a time, three tries, a copy kept in the browser until the server has it. The status is quiet text: "Saved", "Saving…", or "Not saved. Retry". Nothing spins and nothing blocks typing. The server actions (`saveDraft`, `publishExhbt`) are unchanged.

Typing never writes the flow marker; the first structural change does (0027).

A stored file (a picture, or the work) is deleted only when all four are true:

1. the last doc the server saved does not point at it;
2. the published copy does not point at it;
3. the doc in the editor now does not point at it;
4. no undo entry could put it back.

The check runs after each save lands, when an undo entry falls off the end of the list, and when the editor goes away (the page is hidden, or the person leaves or switches to the classic editor). So a removed picture can be put back with Undo for as long as the visit lasts, which the classic editor could not do. If the tab is killed outright, a removed picture's file is left behind; it is harmless and counts against storage, as an orphan does today.

A picture replaced by a new crop or another page is not an undo entry: the old file goes when the save without it lands, as now.

## The key visual, and pictures by hand

- **Pictures by hand** are as now: several at once, shrunk in the browser, placed in the order picked, with the cursor then put in the first empty description. They can also be dropped onto the page.
- **A picked figure** keeps its strip: where it came from, the share tick, Crop, Choose another page.
- **When nothing was picked** and the layout takes a figure from the work, an image "+" also offers "Take a figure from my report": the page chooser that `PickedFigure` already has, with no AI call. It needs the stored PDF, so it is offered only when there is one.
- **Removing a picked graph or table** offers the chart the draft drew: "Put back the chart drafted from your numbers". When the figure was placed, the graphs it replaced are kept with the exhbt's AI version (`ai-version.json`, beside the blocks kept for "Back to the AI version"), not in the doc. Putting one back goes through the server, which checks its numbers against the source again, so a parked graph cannot escape the number check. The graphs are kept from release 2 on; an exhbt drafted before that has none, and gets no offer.

## The person's own look

The editing page sits in the person's look: the wrapper carries `lookAttrs(theme)` and `themeStyle(theme)` (`components/portfolio/themeFonts.ts`), as the public frame does. The frames, grips, the line and the lifted copy take the look's own variables, so they hold on a dark look. The top bar and the sheets stay in the app's own style.

## The classic editor: the switch, the fallback, the escape

The old editor stays for one release as "classic". It is the safety net for going straight to everyone.

- **The switch.** `editorKind()` in `lib/site.ts` returns `"page"` unless the runtime variable `EXHBT_EDITOR` is `classic`. It is read on each request, so setting it in the Cloudflare dashboard flips everyone back with no deploy.
- **The escape.** "Use the classic editor" opens the same exhbt with `?editor=classic`, for that visit. The classic editor shows a line with the way back.
- **The crash fallback.** An error boundary sits round the new editor. If it throws, the boundary shows "Something went wrong with the new editor. Your work is saved.", lets the waiting save finish, and reloads the page with `?editor=classic`. It reloads, and does not swap editors in place, because the page's props are from when it was opened: an editor mounted on them could save over newer work.
  - An error boundary cannot catch a throw while the server draws the page. So the new editor is never drawn on the server: it loads in the browser, inside the boundary. Until it has loaded, the person sees their exhbt as a visitor would, and the fields then come alive in place.
  - If the page itself fails on the server, the route's own error page says the same and links to the classic editor.

Both editors use the same doc, autosave and actions, and the classic editor keeps what it does not edit (0027), so moving between them mid-exhbt loses nothing. How the switch is proven is in `docs/briefs/edit-on-page/README.md`.

## Smoothness

Rory asked for "super smooth". These exact checks gate CI. They count things; they do not time them, so they do not flake.

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
- axe runs on every layout at rest, with a section lifted, in a dark look, while typing, on a phone and with each sheet open.
- The editing page keeps the page's heading order: the screen's own heading is "Edit exhbt", and the exhbt's title is drawn one level down.

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

Code: `components/portfolio/page-ctx.ts`, `components/portfolio/ProjectView.tsx`, `components/portfolio/LayoutMain.tsx`, `components/exhbt-editor/`, `lib/site.ts`, `app/(app)/exhbts/[id]/edit/page.tsx`, `app/(app)/exhbts/[id]/figure-actions.ts`. Kept and reused: `components/editor/useAutosave.ts`, `media.ts`, `model.ts`, `ChartEditor.tsx`, `PickedFigure.tsx`, `BlockTools.tsx`, `ConfirmAction.tsx`. Tests: `e2e/editor-inplace.spec.ts`, `editor-smooth`, `editor-drag`, `editor-flow`, `editor-classic`. Briefs: `docs/briefs/edit-on-page/`.
