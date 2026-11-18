Status: accepted
Date: 18 Nov 2026
Amends: 0017 (a picked graph takes the place of the drafted one; the pick says what kind of visual it is; a scan's pages are looked at once the person agrees; a pick that finds nothing or fails is said; which pages count as plain text), 0024 (each layout says what it takes from the work; what the editor says after a draft)

# The key visual comes from the work

Rory, 17 Nov 2026: "When someone uploads their piece of work for the AI to suggest the best formats, things to put in… I also NEED it to take the key graph from the work, if there is one, rather than making its own… IT NEEDS TO HAVE THE AUTOMATIC AI SUGGEST FORMAT + TAKE THE KEY MAIN GRAPH OR VISUAL FROM THE WORK (unless not suitable, e.g. essay)."

Decision 0017 picked a figure from the person's PDF and put it on the exhbt. Four things were wrong with it:

1. The exhbt got both the picked figure and a graph the AI drew from numbers in the text. Rory wants the work's own graph, not a drawn one beside it.
2. The pick had only ever run with the stand-in. Nobody knew how well the real model chooses and crops.
3. A scanned PDF was never looked at for a figure.
4. When the pick found nothing or failed, nothing told the person.

## The rule: the work's own graph wins

The pick now says what the visual is, one of three kinds (`FIGURE_KINDS` in `lib/exhbt/blocks.ts`):

- **graph**: a graph or chart of results;
- **table**: a table of results;
- **other**: anything else, such as a photo, a screenshot, a diagram, a poster or a map.

When the figure is placed:

- **A graph or a table** removes every graph section the draft made, then goes where the layout wants its key figure. The exhbt has the real graph and no drawn one.
- **Another visual** goes in the same place, and the drafted graphs stay while the layout has room for both. When it hasn't, the picked visual comes first: graphs go, last first, until it fits.
- **Nothing picked**: the drafted graph stays. It is the fallback, so `lib/ai/exhbt-draft.ts` still drafts it every time.
- A person's own pictures are never taken off to make room. A layout whose images are full is left as it was, graphs included.

The rule is `withWorkVisual` in `lib/exhbt/sections.ts`. It runs in `/api/exhbts/[id]/figure`, where the figure is placed, because the draft and the pick run side by side and neither knows the other's answer until then. It runs once, straight after the draft and before the editor opens, so every graph on the exhbt at that moment is one the draft made. A number flagged "check this" that was only on a graph it removed leaves the list, since it is no longer on the page.

With the three layouts as they are and a fresh draft, room is never short: a case study and a gallery draft no images, and research drafts at most two graphs against a cap of three figures. The short-of-room branch is there for a later layout and for a figure placed on an exhbt that has been edited. Model-level tests cover it.

A kind the route doesn't recognise is refused. A request with no kind is treated as "other", which removes nothing, so a browser running an older copy of the page gets the old behaviour, not a lost graph.

## What each layout takes from the work

Each layout says what it takes from the person's own files, beside its other rules (`fromWork` in `FORMAT_RULES`, `lib/exhbt/formats.ts`):

| Layout | Takes | Where it goes |
|---|---|---|
| Case study | `figure`: its one key figure | straight after What I found |
| Gallery | `pictures`: the work's pictures | the lead image |
| Research | `figure` | the key figure, where the drafted graph was |

The third value is `none`: nothing is looked for and nothing is placed. No layout uses it yet. The essay layout that is coming will. A layout that says `none` gets no placement (the route refuses it and the page deletes the picture it uploaded) and nothing is said about a figure.

The pick itself can't always be avoided for such a layout. The draft chooses the layout, and the pick runs beside the draft to save the person twenty seconds, so the pages may already have been sent when the layout is known. The page drops the pick as soon as the draft answers. If the layout is ever chosen before drafting (0024 lists that as not done), the same rule can stop the pick being sent at all. In practice an essay rarely gets that far: a page of plain text is never sent, and the prompt tells the model that an essay has no figure.

`pictures` behaves as `figure` does today: one visual, placed as the lead. It is a separate value because a gallery will take several once pictures from Word, PowerPoint and the upload itself can be picked.

## The pick: what it is asked

The prompt in `lib/ai/figure-pick.ts` was written before the real model had run. It is changed where the aim asks for more than it said:

- **One figure, the main result.** It now gives an order: the main results graph or chart, then a results table, then another visual that shows what was made or found, then a diagram of the method or system only when nothing else is there. With several charts it asks for the one the work itself treats as the main result, not a chart that describes the sample, a check, or one in an appendix.
- **Never** a page or block of text, a logo, a cover, a contents page, a header or footer, decoration, a photo of a person, an equation, a form or a reference list. "Nothing is better than a logo or a page of text."
- **The crop** holds the whole visual: its title, both axes with tick labels and titles, the legend, every label on it, and a caption or source line directly above or below. It leaves out body text, headers, footers and other figures. On a slide the box is the chart, not the slide. When unsure, slightly too big: a figure with part cut off is no use.
- **The kind**, as above.
- **Only what is on the page.** The alt text and caption still use only words and figures printed in the work.

**The box is asked for in pixels.** The model used to give the box as fractions of the image. It now gives the left, top, right and bottom edges in pixels of the image it was sent, and each image's size is in its label. The model is trained to point at things in images in pixels; a fraction asks it to divide as well. The server reads each image's size from the file itself (`lib/figures/image-size.ts`), not from the browser, and turns the box into fractions in one function, `boxFromPixels` in `lib/figures/rules.ts`. If the eval shows fractions did better, that function and two lines of the prompt are all that change. This is a judgement, not a measurement: the real model had not run when it was made.

The server's checks on the answer (`toPick`): the image must be one that was sent; the kind must be one of the three, or it is "other"; edges the wrong way round are put right and the box is kept on the page; the caption and alt text are cut to their limits. A figure that is thin but real, such as a one-row diagram, used to become the whole page, because a box under 5% of the page's side was treated as a slip. A side between 1% and 5% is now widened a little about its middle. The eval's own diagram report found this.

## Which pages are sent

Only pages that paint a shape or a picture are sent (0017). Two things change.

**A clipping path is not a shape.** Word, browsers and LaTeX put clipping paths round ordinary text. They paint nothing, but they were counted, so most pages of a real text-only PDF counted as holding a figure and were sent. That cost little, but the privacy policy says only pages with charts, diagrams or pictures are sent. A path that ends without a fill or a stroke is now left out (`marksOf` in `lib/figures/pdf.ts`). The eval's reports, printed by Chromium, showed it: every text page had four "shapes", exactly the threshold. They now have two (the page's background), and are not sent.

**Scans, after consent.** A scan asks before it is sent to be read as text. The same question now covers the figure: "We can send it to our AI reader to turn it into text and to look for a figure, such as a graph, for your exhbt. Only the text and where the figure is come back, and the file stays private to you." If the person agrees, the scan's pages are drawn on the device and go with the draft like any other PDF's. Every page of a scan is a picture, so every page (of the first 30) is a candidate; the caps on images and bytes are unchanged. If they choose "Keep it without reading", nothing is drawn and nothing is sent. A scan's pages are left out of the count of "pages with pictures" that the draft uses to choose a layout, since a picture of a page of text says nothing about how visual the work is. The privacy policy says a scanned PDF's page images are sent only if the person chooses to send the scan (`app/(marketing)/legal/[doc]/page.tsx`; the date in `lib/legal.ts`).

## A seam for Word, PowerPoint and pictures

Those are a separate job. To leave room for it, the code that gathers the images a figure could be on no longer assumes a PDF page. A `Candidate` (`app/(app)/exhbts/new/figure.ts`) is a label, a small image to send, where it came from, and a function that cuts a box out at full size. `pdfCandidates` makes them from a PDF's pages. Nothing after that (the caps, the request, the cut, the upload, the placement) knows what a candidate came from. A picture inside a Word or PowerPoint file, or a picture uploaded with the work, needs its own function that returns Candidates and nothing else.

## What the person is told

When the editor opens after a draft it says one quiet line under the layout choice (`components/editor/LayoutPicker.tsx`, wording in `lib/exhbt/drafted.ts`):

> Laid out as Research because your work has an aim and results. Change layout. The figure is from page 3 of report.pdf. Tick that you may share it before you publish.

**The layout and why.** The draft returns, with the layout, one of a fixed set of signals (`LAYOUT_REASONS`): the notes name the layout; an aim and results; a hypothesis and results; a study with a method and results; work that is shown by its pictures; an upload that is mostly pictures; a question and what was found; or no reason. Each has fixed wording. The model never writes the reason. A signal is only said when the draft bears it out (`checkedReason`): "an aim and results" needs an aim and findings in the draft itself, "your notes name this layout" needs the layout's name in the notes, "mostly pictures" needs the upload counts to say so. Anything else gives no reason: "Laid out as Case study." It now shows for a case study too. "Change layout" puts the cursor on the choices just above.

**The figure.** Where it came from is read from the exhbt itself, so the address can't claim a figure that isn't there. When none went on, the draft page passes on which of three things happened, each with fixed wording:

- none found: "No figure was found in your files, so the graph uses numbers from your files and notes."
- it couldn't look (the request failed, ran past the 20-second wait, or the figure couldn't be put on): "We couldn't look for a figure in your files this time. You can add an image yourself."
- there was no PDF to look in: "A figure can only be taken from a PDF for now."

None of these is styled as an error. A pick that didn't run is never reported as "none found".

The line is said once. The draft page passes it in the address (`?drafted=research&why=aim-results&fig=none`) and the editor takes it off the address when it has read it, so a reload doesn't say it again. The editor is being rebuilt, so this line is the only thing added to it.

## Safeguards kept

Everything in 0017 stands: the image carries `picked` with `shareOk: false`; publishing waits for "I may share this figure on my portfolio"; crop and choose another page work from the stored file with no AI call; the caption's numbers go through the number check; one pick per draft, with the per-plan allowance. `picked` gains `kind`, which is dropped when the person chooses another page, since that is another figure.

## The eval

`evals/figure-pick/` runs the real model on fourteen made-up reports and marks each answer (`README.md` there has the detail). The reports are printed to PDF by headless Chromium from pages laid out as fixed sheets, so each figure's true box is measured, not guessed. They cover a bar chart, a line chart, a results table, a method diagram before the results chart, three charts with one headline result, a chart pasted in as a picture, a small figure in a two-column paper, a plain essay, a cover with a crest, landscape slides, a diagram with no chart, a scan, an essay with rules and boxes, and a poster.

A report passes when the pick is on the right page and is the right kind, and the picture the app cuts holds at least 95% of the true box and is at most twice a perfect cut; or, where there is no figure, when the pick says so. A request that failed is an error, never "no figure", and an answer from anything but the model asked for is an error.

It drives the app's own code in a real browser: the pages drawn at the app's size and quality, the choice of which to send, `/api/exhbts/figure-pick` with its checks, the real prompt, the server's checks on the answer, and the cut. It doesn't cover the upload or the placement (the e2e spec does, with the stand-in), the production runtime, or real people's files.

It runs in the existing workflow, `.github/workflows/eval-drafts.yml`, with the suite set to `figures`. Each run makes thirteen model calls (the plain essay sends no page, so it makes none), with 24 page images between them. By the prices in `lib/ai/model.ts` that should come to well under a penny; each line of the results carries the cost the API reported.

## Consequences

- **If the person can't share the picked graph, the exhbt has no graph.** A supervisor's or a company's chart may not be theirs to put online. They remove it, as 0017 intends, and the graph the draft drew is already gone. A case study can still be published on its findings. Research can't: it needs a figure. They must add a graph by hand. See below.
- Exhbts drafted before this keep both the figure and the drawn graph. Nothing goes back to change them.
- A draft's figure-related line needs the draft page: an exhbt drafted through the API alone gets no line.
- `figure_added` events now carry the kind and how many graphs were removed. No new event, log step or migration.

## To confirm with Rory

- **Putting the drafted graph back.** When someone removes a picked graph they can't share, should the graph the draft drew come back? It would need the removed graph to be kept with the exhbt and its numbers checked again. It isn't built, because the brief asked for no new editor controls and a graph parked out of sight would escape the number check.
- **A results table from the work.** It is treated like a graph: the picture of the table goes on and the drafted graph comes off. If the table is long, the drafted graph may read better at a glance than a picture of twelve rows. The kind is recorded, so this can be changed for tables alone.
- **A diagram as research's key figure.** When the work has no graph, a picked diagram or photo leads and the drafted graph sits after it. The person can move the graph first in the editor.
- **"A figure can only be taken from a PDF for now."** Said when the upload has no PDF. It goes when Word, PowerPoint and pictures can be picked from.

## Not done yet

- Word, PowerPoint and pictures uploaded with the work (the seam above is for them).
- Several pictures for a gallery, not one.
- The essay layout that takes nothing.
- Stopping the pick before it is sent when the layout is known first.
- Marking the alt text and caption in the eval, and running each report more than once.

Code: `lib/exhbt/sections.ts` (`withWorkVisual`), `lib/exhbt/formats.ts` (`fromWork`), `lib/exhbt/blocks.ts` (`FIGURE_KINDS`, `picked.kind`), `lib/exhbt/drafted.ts`, `lib/ai/figure-pick.ts`, `lib/ai/exhbt-draft.ts` (`formatReason`), `lib/figures/rules.ts` (`boxFromPixels`), `lib/figures/image-size.ts`, `lib/figures/pdf.ts` (`marksOf`), `app/api/exhbts/[id]/figure/route.ts`, `app/api/exhbts/figure-pick/route.ts`, `app/(app)/exhbts/new/DraftForm.tsx` and `figure.ts`, `components/editor/LayoutPicker.tsx`, `app/dev/figure-eval/`. Tests: `e2e/auto-figure.spec.ts`, `e2e/phase2-formats.spec.ts`. Eval: `evals/figure-pick/`, `scripts/eval-figures.ts`.
