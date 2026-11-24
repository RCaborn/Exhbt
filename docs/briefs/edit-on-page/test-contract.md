# Browser tests and the exhbt editor: what the tests rely on today

Status: facts about the code on `phase-2-e2e-page-object`, written before the edit-on-the-page editor replaces `components/editor/`. Nothing here is a decision about the new editor; it says what the tests will notice.

## Where the tests touch the editor

Every helper that drives the editor, or gets a test to it, is in `e2e/editor.ts`. The selectors those helpers use (field ids, role names, labels, text, test ids) are in one block at the top of that file, called `SEL`. A rewrite that changes a selector changes `SEL` and nothing else, for every test that goes through a helper.

Some tests still write an editor selector inline in the test body. Those are listed at the end, under "Not behind a helper".

### How the counts were made

- A count is a number of `test(` blocks in `e2e/*.spec.ts`. A test written once inside a loop counts once, although Playwright lists it several times (`phase2-formats.spec.ts` has 63 blocks and Playwright lists 80 tests).
- A test counts as using an item if its body matches the selector, or it calls an `e2e/editor.ts` helper that uses it, or it calls a helper defined in its own spec that does.
- Only tests that reach the editor are counted: they open `/exhbts/<id>/edit`, press "Start from scratch", or call `startFromScratch`, `startEditor`, `draftAndOpen`, `startWithCore` or `startWithBasics`. Where the same text or markup also appears on other pages, the tests that never open the editor are left out, and the number left out is given in brackets.
- 85 test blocks reach the editor, in 14 spec files: `phase2-formats` 19, `phase2-editor-media` 14, `phase2-draft-tools` 8, `phase2-sections` 8, `phase2-graphs` 7, `phase2-polish-2` 6, `phase2-teammates` 6, `phase2-editor` 4, `auto-figure` 4, `phase2-billing-polish` 3, `exhbt-page` 3, `file-ownership` 1, `phase2-draft` 1, `phase2-saved-ideas` 1.
- The counts include `auto-figure.spec.ts` and `phase2-draft.spec.ts`, which were not migrated (see the report that came with this branch).

## (a) Should stay the same in the new editor

These are not tied to the form cards. They are page-level signals or markup shared with the public exhbt page.

| Selector | What it is in the code | Tests using it |
| --- | --- | --- |
| `[data-ready=true]` | `data-ready` on the editor's root `div` once hydrated (`Editor.tsx`). `startFromScratch`, `startEditor` and `draftAndOpen` wait for it. The draft form and the portfolio builder use the same attribute on their own forms (`form[data-ready=true]`), which is a separate selector. | 62 (39 more, in tests that never open the editor) |
| "Saving…" then "Saved" status text | A `span` in the top bar showing `Saving…` and then `Saved` (`Editor.tsx`, matched with `getByText`, exact for "Saved"). `waitForSave` needs both; `waitForSaved` needs only "Saved". | 15 |
| `[data-word-bar]` | The word bar (`Editor.tsx`, `WordBar`); also `data-over` when over the cap. `wordsOnBar` reads the number from text that starts "N words". | 3 |
| test id `words-left` | Words left in the sections area (`Sections.tsx`). | 3 |
| test ids `tools-<block>` | The rewrite tools of a drafted block (`BlockTools.tsx`), with `<block>` one of `header`, `skills`, `gap`, `flow`, `findings`. | 9 |
| test id `rewrites-left` | "N of M rewrites left" inside the tools (`BlockTools.tsx`). | 4 |
| Publish confirm checkbox, label "This is my work, and the numbers are true" | The checkbox a person ticks before Publish (`Editor.tsx`). | 20 |
| radiogroup named "Layout" | `LayoutPicker.tsx`, `role="radiogroup" aria-label="Layout"`. | 1 |
| Layout radios named "Case study", "Gallery", "Research" | Radios in that group, matched by the start of the name. | 15 |
| `article[data-format]` and `article[data-exhbt-page]` | The drawn exhbt in the preview (`ProjectView.tsx`); `data-format` holds the layout. `previewArticle` finds it inside the Preview region. The public page uses the same markup. | 9 (2 more, in tests that never open the editor) |
| `[data-part]` | A part of the drawn exhbt: `lead`, `did`, `happened`, `grid`, `link`, `process`, `findings`, `quote`, `reflection` and so on (`exhbt-parts.tsx`). `pageOrder` reads them in order. Shared with the public page. | 11 (12 more, in tests that never open the editor) |

## (b) Tied to the form cards, likely to change

| Selector | What it is in the code | Tests using it |
| --- | --- | --- |
| Region "Sections" (exact) | The area holding the section cards. `sectionsArea` and `card` (a region inside it, by the card's name). | 14 |
| Region "Preview" | `section aria-label="Preview"` (`Editor.tsx`). `previewRegion`, `previewArticle`. | 26 (1 more) |
| Button "Add a section" and `#add-section` | The menu button for adding sections (`Sections.tsx`). `addSection`, `openAddSectionMenu`, `addGraphSection`, `addGraph`. `pickImages` focuses `#add-section` before choosing files, because the app moves focus there. | 26 (8 more, in tests that never open the editor) |
| List named "Sections, in page order", items with `data-kind` | The ordered list of cards (`Sections.tsx`). `listOrder` reads the kinds. | 5 (1 more) |
| Buttons "Arrange sections" and "Done arranging" | The toggle above the preview for dragging sections there (`Editor.tsx`, `PreviewArrange.tsx`). Only the case study layout shows it. | 4 |
| Buttons "Edit" and "Preview" | The two view buttons shown below the `lg` width (`Editor.tsx`, class `lg:hidden`). | 1 |
| `#title` | The title input. | 29 |
| `#context` | The "What it is" input. | 2 |
| Textbox named "Context" (exact) | The question field, a rich-text field that loads in its own chunk. `startFromScratch` waits for it unless told not to. | 35 |
| Labels "Box 1", "Box 2", ... | The process flowchart's boxes (`FlowEditor.tsx`). | 20 |
| Textboxes "Finding 1", "Finding 2" | The findings (`Sections.tsx`). | 20 (1 more) |
| Hidden file input labelled "Choose an image" | The input behind the image sections (`Editor.tsx`). | 14 |
| Fields "Image N: describe it for people who can't see it" | The image description field (`Sections.tsx`). | 9 |
| Group "Graph N" and its type radios | A `fieldset` with the legend "Graph N" (`ChartEditor.tsx`). `graph`, `pickGraphKind`, `addGraph`. | 9 (7 more, in tests that never open the editor) |
| Button "More actions for <card name>" | The per-card menu on a drafted exhbt. Card names today: "Your question and details", "Skills", "Context", "Process", "Findings". `cardMenuButton`, `openCardMenu`, `startRewrite`. | 8 |
| Buttons "Rewrite this block" and "Back to the AI version" | Inside a card's tools. | 7 |
| Region "Things to fix before publishing" | The list of problems after a failed Publish, with links to cards. | 6 |
| Buttons "Move <section> up" and "Move <section> down" | The reorder buttons on a card (and in the preview while arranging). | 5 (14 more, in tests that never open the editor) |

## (c) Used by the tests, not in the list I was given

These are page-level and are probably kept, but nobody has said so.

| Selector | Tests using it |
| --- | --- |
| Button "Start from scratch" on `/exhbts` | 38 |
| Heading "Edit exhbt" (level 1) | 11 |
| Button "Publish" or "Publish changes" | 19 |
| Text "It's live." or "Your changes are live." | 17 |
| Button "Unpublish" | 1 (1 more) |

## Helpers in `e2e/editor.ts` and which option keeps an old behaviour

| Helper | One line | Option |
| --- | --- | --- |
| `signInAs(page, username, plan = "premium")` | Makes a dev user with a username on a plan and no exhbts, signs in, waits for "Your exhbts". | |
| `startFromScratch(page, opts)` | Presses "Start from scratch", waits for the editor, returns the id. | `waitForContext: false` skips the wait for the Context field. |
| `startEditor(page, username)` | `signInAs` on Premium, then `startFromScratch` without the Context wait. | |
| `signInToDraft(page, tag)` | Signs in as a new address on `/exhbts/new` and waits for the draft form. | |
| `draftAndOpen(page, tag, opts)` | Drafts through the API and opens the editor, returns the id. | `waitForForm: false` skips waiting for the draft form. |
| `fillCore`, `fillFindings`, `startWithCore`, `startWithBasics`, `fillValid` | Fill the fields a publish needs; three text variants the tests were already using. | |
| `waitForSave(page, opts)`, `waitForSaved(page)` | "Saving…" then "Saved", or "Saved" only. | `mustSeeSaving: false` |
| `publish(page, opts)` | Ticks the confirmation, presses Publish, waits for the live message. | `changes: true` accepts "Publish changes" and "Your changes are live." |
| `chooseLayout`, `layoutGroup` | Layout radios and the radiogroup. | |
| `sectionsArea`, `card`, `previewRegion`, `previewArticle`, `images`, `pickImages` | The areas of the editor and the image input. | |
| `wordsOnBar`, `listOrder`, `pageOrder` | Read the word bar, the list's kinds, the preview's parts. | |
| `openAddSectionMenu`, `addSection`, `graph`, `pickGraphKind`, `addGraphSection`, `addGraph` | Add and find sections and graph cards. | |
| `findingsField`, `rewritesLeft`, `cardMenuButton`, `openCardMenu`, `startRewrite`, `backToAiVersion` | The rewrite tools on a drafted exhbt. | |

## Not behind a helper

These tests write an editor selector inline, so the rewrite has to change the spec as well as `e2e/editor.ts`:

- `exhbt-page.spec.ts` (3 tests): "Arrange sections", "Done arranging", the Preview region and `/edit` URLs.
- `phase2-saved-ideas.spec.ts` (1 test): waits for the `/edit` URL after a build.
- `phase2-teammates.spec.ts` (6 tests): "Start from scratch", the `/edit` URL, the "Edit <title>" link on the list.
- `phase2-polish-2.spec.ts`: the Preview button, the card menus and the arrange controls inside tests; also its own email-only `signInAs`.
- `phase2-draft-tools.spec.ts`, `phase2-billing-polish.spec.ts`, `phase2-formats.spec.ts`: a few inline `Start from scratch` clicks and `waitForURL` calls, and labels such as "Add a section" in assertions.
- Specs other people were editing during the move and left alone: `auto-figure.spec.ts` (4 tests reach the editor) and `phase2-draft.spec.ts` (1). They keep their own copies of the old helpers.
