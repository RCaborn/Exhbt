Status: accepted
Date: 16 Nov 2026
Amends: 0022 (the key figure beside What I found is now filled in when the exhbt is drafted)
Amended by: 0024 (where a picked figure lands depends on the layout: after What I found, the lead image, or the key figure), 0025 (a picked graph or results table takes the place of the graph the draft drew; the pick says what kind of visual it is and gives its box in pixels; a scan's pages are looked at once the person agrees to send it; a clipping path no longer counts as a shape; a pick that finds nothing or fails is said in the editor; the real model is measured by `evals/figure-pick/`)

# The figure from the report, picked when the exhbt is drafted

Rory, 16 Nov 2026: when someone uploads their project file and Exhbt drafts the exhbt, the most relevant chart or figure in it should be picked and put on the exhbt as its key figure, beside What I found (`docs/design/portfolio-and-exhbt-layouts.pdf`, page 2). Decision 0022 left the hook for it, `withKeyFigure`; nothing filled it until now.

## How it works

**In the browser, as files are added.** A PDF the browser read itself has its first 30 pages drawn as JPEGs with a long edge of 768 px (`pdfPages` in `lib/figures/pdf.ts`). It uses `unpdf`, the reader that already gets a PDF's text in the browser (`lib/doc-readers.ts`), so there's no new library. Each page also records how many shapes and pictures it draws besides text. A page of plain text draws none, so it is never sent and never picked (`mayHoldFigure` in `lib/figures/rules.ts`). A scan is never sent for this: the person agreed to send a scan to be read as text, not to have its pages looked at, and every page of a scan is a picture anyway.

**Beside the draft.** "Draft my exhbt" sends the draft request as before, and at the same time sends the pages that draw something to `/api/exhbts/figure-pick` (multipart, at most 30 images and 6 MB together, each labelled "report.pdf, page 3"). Haiku answers with the image, a crop box as fractions of the page, alt text and a one-line caption, or no figure (`lib/ai/figure-pick.ts`). The prompt says a page of text, a logo, a cover, a photo of a person or decoration is not a figure, prefers a result over a method diagram, and allows only words and figures printed in the report (AGENTS.md: only facts the person supplied). The server checks every value: the image must be one it was sent, the box is kept on the page, the caption is cut to the image caption limit and the alt text to 400 characters.

**Back in the browser.** The chosen page is drawn again so the crop's long edge is 1,600 px, cut out with a small margin, and uploaded as an image through the editor's upload path (`uploadForExhbt` in `components/editor/media.ts`, kind `image`). Once the draft is saved, `/api/exhbts/[id]/figure` puts it on the exhbt with `withKeyFigure` and attaches the file. The caption is the AI's words on the page, so its numbers go through the draft's number check (`lib/exhbt/verify.ts`) against the kept source text: one that isn't in the material joins the numbers the editor asks the person to check. Only then does the editor open, so its first save already has the figure. The page waits up to 20 seconds after the draft for the figure; a pick that fails, finds nothing or runs late leaves the draft without one, and nothing shows as an error. The drafting view lists "Picking a figure from your report" while it runs.

## Safeguards

A figure in a student's report may be their supervisor's, a client's or a company's. So:
- The image section carries `picked`: the file's name, its stored id, the page, the crop box and `shareOk`. It is part of `ImageSectionSchema`, so the editor's saves keep it; it lives in the jsonb doc, with no new column. `publicDoc` leaves it out of the published copy.
- The editor's image card says "Picked from your report. Check you're allowed to share it.", with where it came from and the tick "I may share this figure on my portfolio" (`components/editor/PickedFigure.tsx`).
- `validateForPublish` refuses an image whose `picked.shareOk` is false, at `sections.N.picked.shareOk`, so the server blocks publishing and the list of things to fix links to the card. The route that places the figure always stores `shareOk: false`.
- **Crop** draws the page with the box on it: drag across the page, or move each edge with its slider. **Choose another page** shows the report's first 30 pages; a click puts that page in, whole, ready to crop. Both draw the page in the browser from the stored PDF (a signed link the editor page makes only for the person's own files) and make no AI call. Another page is another figure, so the tick, the alt text and the caption start again. **Remove** is the card's own button, as for any image.

## Cost and plans

It is part of the draft: it uses none of the person's drafts or rewrites (`lib/entitlements.ts`, `lib/plan-rules.ts`). One pick per draft. The page sends one pick per "Draft my exhbt"; the server allows as many picks in the drafts window as the plan has drafts, plus two for drafts that failed and were tried again (`figure_picked` events). About 550 input tokens a page, so a 30-page report costs well under a penny.

The call is logged in `ai_call_logs` as its own step, `figure_pick`, so the admin panel's AI-by-step view shows it apart from drafting (it lists whatever steps the log holds). The step check is replaced by `supabase/migrations/20261124000000_figure_pick.sql`, with the full list from 20261121 plus `figure_pick`; the one-paste file for the live project is `supabase/launch/apply-figure-pick-live.sql`, to run after 20261121. Until it runs, the log write fails and is reported, and the person still gets their figure.

The privacy policy says page images from an uploaded PDF are sent to Anthropic to choose a figure (`app/(marketing)/legal/[doc]/page.tsx`).

## Tests

`e2e/auto-figure.spec.ts`, with `e2e/fixtures/report-with-chart.pdf` (three pages of text and a bar chart drawn in vector shapes) and `report-text-only.pdf`, made by `e2e/fixtures/make-figure-pdfs.mjs`. Without an API key the stand-in picks the first page image it is sent, which is the first page that draws shapes or pictures, with a box that covers the fixture's chart. The spec covers: the chart page is the only one sent and lands beside the findings; the warning shows and publishing is blocked until the tick, then the live page shows the figure and nothing about where it came from; another page, a new crop and removing it, with no AI call; a PDF of plain text sends nothing and gets no figure; a failed pick leaves the draft as it is.

## Not done yet

Word (.docx) and PowerPoint (.pptx) files. PowerPoint isn't accepted as project material at all yet: `DOC_ACCEPT` in `lib/doc-readers.ts` leaves it out and `lib/uploads.ts` stores it only as the work (kind `evidence`), so it needs a reader and a stored type first. Their pictures are in `word/media/` and `ppt/media/`; the plan is to list them in the browser with JSZip (already used for reading Word files), skip small ones and logos, send a few to the same route, and upload the chosen picture as it is, with the same safeguards (`picked.media` already exists for it). A chart drawn natively in Word or PowerPoint (DrawingML, not a picture) can't be shown without rendering the document, so those would still need a PDF.
