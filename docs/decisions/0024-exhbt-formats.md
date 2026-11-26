Status: accepted
Date: 17 Nov 2026
Amends: 0015 (two new section kinds, used by research only; caps per layout; in a gallery or research page the page sets where each kind goes), 0017 (where a picked figure lands), 0022 (the page now has three layouts; the case study is the page 0022 describes, unchanged)
Amended by: 0025 (each layout says what it takes from the person's work: a figure, pictures or nothing; the editor's line after a draft now gives the layout, why it was chosen and what came of looking for a figure, for a case study too), 0027 (every layout is drawn in the doc's own order; picking a layout arranges the sections in its usual order, and Undo, not switching back, restores the order you had; the flowchart can be removed in a gallery), 0028 (four more layouts: Build, Essay, Before and after, Event or performance; "My part" is built as "My role"), 0030 (the caps per layout on each part's words in "The 200 words" are now the AI's targets, not limits for people; the counts stay), 0032 (what a layout needs is a suggestion and stops no one publishing; each heading a layout draws can be replaced or cleared by the person)

# Exhbt layouts: case study, gallery and research

Rory: "I want a gallery setting too, maybe one or two other exhbt options akin to that. People with different specialities will present things differently! Ie. a marketing student showing campaigns in gallery or a science student showing something else that I can't imagine."

Employers read different kinds of work in different ways. Campaigns, posters, buildings, films and products are judged by looking at them, so the pictures have to come first. Lab work, experiments and dissertations are judged on rigour: the question, the method, one clear figure and an honest conclusion. Today's page (decision 0022) suits analysis and business projects, and it stays as it is.

## One field, three layouts

An exhbt has a layout, stored as `format` in the jsonb doc: `"case-study"`, `"gallery"` or `"research"`. There is no migration. A doc without a layout is a case study, and that covers every exhbt saved before this. A value the code doesn't know (one written by a later release, say) is also read as a case study, so the page never breaks. In the product the word is "Layout"; "look" stays the name for the eight portfolio looks (decision 0018).

The person picks the layout at the top of the editor. There are three choices, each with a small sketch and one line on what it suits. The AI draft suggests one (below). Switching takes effect at once and deletes nothing.

| Layout | Suits | What the page leads with |
|---|---|---|
| Case study | analysis, business, data, software | the question, the flowchart, what I found beside the key chart (decision 0022) |
| Gallery | campaigns, design, architecture, film, products | the pictures |
| Research | lab work, experiments, studies, dissertations | the question, the aim, the method and one large key figure |

Every layout has the sidebar (the person, what it is, where and when, the checks, See the work, Save as PDF), the skill pills, the title, the context line and the flowchart. The flowchart stays permanent on all, as decision 0015 says.

## Gallery

Top to bottom in the main column:
- the skill pills and the title. The title names the work ("Freshers' Week campaign for the Law Society") and need not be a question.
- the brief: the context line, with the ask highlighted.
- the lead image: the first image, across the column, never cropped. A portrait poster sits centred on the figure ground rather than running down the page.
- a row of two: **What I did** (the flowchart, drawn as a column) and **What happened** (the findings, which are optional in a gallery, with the gallery's one graph under them). On a phone they stack.
- the rest of the images, in justified rows. Each keeps its own shape, the rows line up, nothing is cropped, and the reading order is the order on the screen. Each image has its caption under it.
- Feedback (the quote), What I'd do next, and up to two links ("Watch the 30-second film").

Every picture opens larger in a dialog, one at a time. Escape, the Close button or a click outside closes it, and focus goes back to the picture. There is no Previous or Next and nothing moves by itself, so it is not a carousel (DESIGN.md bans those). With JavaScript off the pictures still show; they just don't open larger.

A gallery needs at least two images, each with alt text. It doesn't need findings: for a poster or a film, the pictures are what came of the work.

## Research

A poster, read figure first:
- the skill pills, the title (the research question) and the background line, with the gap highlighted.
- a row of two. On the left, **Aim** or **Hypothesis**, then **Method** (the flowchart as a column). On the right, the **key figure**, large: the first graph or image. A graph prints its values and keeps its hidden table, as every graph does.
- any further figures, two to a row.
- **Results** (the findings) beside **Conclusion** and **Limitations and next steps**.
- Feedback, if there is any (a supervisor's words), then **References**: up to three links in a plain list with no numbers. Each shows the citation and an optional note, never the address.

A research page needs an aim or hypothesis, a conclusion, at least one figure and at least two results. Figures (graphs and images together) are capped at three.

## Two new sections, and limitations

Research needs two blocks the sections didn't have, so there are two new kinds: `aim` (with `heading`, "aim" or "hypothesis") and `conclusion`. Each is short formatted text, the same shape as "What I'd do next". Limitations don't get a block of their own. In research, "What I'd do next" is titled "Limitations and next steps" and holds both. A full research exhbt with the parts above measures 193 words (`researchDoc` in `lib/exhbt/sample.ts`). A separate limitations block of even fifteen words would take it past 200.

## The 200 words

The cap is 200 on every layout (decision 0009). Each layout sets its own caps for its parts, so a full one fits. The editor aims for 150 words, or 170 in research.

| | Case study | Gallery | Research |
|---|---|---|---|
| Context line | 40 words | 30 (the brief) | 25 (the background) |
| Findings | 2 to 4, 20 words each; findings or a graph required | optional; 1 to 3, 15 words each | required, 2 to 3, 15 words each |
| Graphs | 2 | 1 | 2 |
| Images | 2, caption 15 words | 2 to 8, caption 10 words | 2, caption 20 words |
| Graphs and images together | | | 1 to 3 |
| What I'd do next | 35 words | 35 words | 25 words, titled "Limitations and next steps" |
| Links | 1 | 2 | 3, titled "References" |
| Aim or hypothesis, conclusion | not shown | not shown | one each, required, 20 and 25 words |

The figures are `FORMAT_LIMITS` in `lib/exhbt/formats.ts`, merged over `LIMITS` by `formatLimits()` in `lib/exhbt/blocks.ts`. A case study's limits are `LIMITS`, unchanged.

## Switching keeps everything

Switching layout changes `format` and nothing else, so switching back gives the exhbt exactly as it was. Two rules follow:
- **A kind a layout doesn't draw is kept but not shown.** Outside research, this applies to the aim and the conclusion and nothing else. They aren't on the page, aren't counted in the 200 words and aren't checked for publishing, and `publicDoc` leaves them out of the copy employers see. The editor marks their cards "Not shown in this layout". Switch back to research and republish, and they are there again.
- **Having more of a kind than a layout allows is a publishing error; nothing is hidden.** A gallery of eight images switched to a case study says "Up to 2 images." until some are removed or the layout is switched back. Nothing is ever hidden without the person seeing why.

The number check (`lib/exhbt/verify.ts`) still reads every section, shown or not.

## Order

The case study keeps the person's order (decision 0015). In a gallery and in research the page sets where each kind goes, so the poster always reads the same way. The person's order still decides which image leads a gallery and which figure is research's key figure: it is the first in the list. "Make lead image" and "Make key figure" move one to the front. "Arrange sections" in the preview is for the case study only.

## Pictures

- Pictures open larger in a native `<dialog>` drawn inside the page (`components/portfolio/ImageZoom.tsx`), so it takes the look's variables. The Astryx `Lightbox` was tried on paper and not used: it paints itself from Astryx's own theme tokens, not the `--xp-*` variables, and brings its own close icon, zoom and gallery controls.
- Image sections keep their size in pixels (`w`, `h`, optional), so a page knows each picture's shape before it loads and nothing jumps. Images stored before this have no size and are drawn in a 4:3 frame, uncropped.
- The editor takes several pictures at once. Before upload, the browser shrinks any picture over 2,400 pixels on its long edge or over 1.5 MB, so a gallery stays well inside the plan's storage. A GIF is never changed. If shrinking fails, the original goes up and the server's caps still apply.
- Alt text is required on every image before publishing, as before. After an upload, the editor puts the cursor in the first empty description.
- No picture on these pages loads lazily, because Chrome prints pictures that were never scrolled to as blanks.

## Looks

Every colour, corner, rule and face on the new layouts is one of the `--xp-*` variables listed in decision 0022, so all eight looks apply with no new variables. The one fixed colour is the dimmed background behind the enlarged picture, which isn't part of any look.

## Print

Save as PDF prints one A4 page. To make the samples fit, the print rules give way in a fixed order (grid rows 22mm, captions 0.7rem, lead image 46mm, research key figure 68mm and its other images 34mm, tighter gaps between parts). The sample gallery fits: a lead image, seven more, two findings, four boxes and two links (`galleryDoc` in `lib/exhbt/sample.ts`). So does the sample research poster (the key graph plus one image). Both are checked in `e2e/phase2-formats.spec.ts`. In print the gallery's rows are short, with four or more pictures to a row, and the enlarge dialog never prints.

## The AI draft

The draft chooses the layout from the material and nothing else (`lib/ai/exhbt-draft.ts`, Claude Haiku as always):
- research when the material is an experiment, a study or a dissertation with a question, a method and results;
- gallery when it is mostly visual work whose outcome the work itself shows;
- a case study otherwise, and whenever it is unsure.

If the person's notes name a layout, that one is used. The browser also sends counts from the upload (picture files, PDF pages, and pages with pictures on them), because a gallery's material is mostly pictures with little text. Only the counts are sent for this, never the pages.

For research, the draft writes the aim or hypothesis, the conclusion and the limitations only as the material states them, and leaves them empty otherwise. It never invents a limitation. A reference is kept only when its https address appears in the material as written (`referencesFrom` in `lib/exhbt/references.ts`); anything else is dropped. In a gallery, the title names the work. Images and alt text are never drafted, because the AI hasn't seen the pictures.

The editor says "Drafted as a gallery. Change it any time; nothing is lost." "Back to the AI version" never changes the layout.

A figure picked from the upload (decision 0017) lands where the layout puts its key picture: straight after What I found in a case study, as the lead image in a gallery, and as the key figure in research. Publishing still waits for the share tick.

## Plans

Layouts are on every plan, and `lib/entitlements.ts` doesn't change. How many images a layout holds is a page rule, like the 200 words, not a plan figure. Storage is already capped by plan, per file and in total.

## Consequences

- Every exhbt saved before this is a case study and looks exactly as it did. Its doc gains no field until the person picks another layout.
- Code from before this decision can't read a doc that holds an aim or a conclusion. Phase 2 is live, so this matters as soon as someone uses research: the layouts ship together and are not cherry-picked apart. `normaliseDoc`, which the store runs on every read, drops a layout it doesn't know (read as a case study) and leaves out a section kind it doesn't know, so a doc written by a later release never breaks the page. The cost is that saving such a doc from this code loses the kinds it left out.
- A layout switch reaches the live page when the person republishes, like any other edit, because employers see `published_blocks`.
- `validateForPublish`, `wordCount` and `publicDoc` now read the layout. The number check, file clean-up and file signing still read every section, so a hidden section's numbers are still checked and its files are never orphaned.
- The "Exhbt layout" line in `AGENTS.md` describes the case study only and needs a pointer to this decision.

## To confirm with Rory

- **The flowchart in a gallery.** It is kept, as "What I did" under the lead image. If he'd rather a gallery had none, that amends 0015.
- **No Previous or Next in the enlarged view.** With eight pictures, that means opening each one in turn. Adding Next is a small change if he wants it.
- **Research at 200 words.** It fits: a full sample with no quote is 193 words. A poster with a supervisor's quote needs trimming elsewhere. Raising the cap for research would amend 0009.

## Not done yet

- **A "Build" layout for software**: the repository, a live demo, an architecture diagram, screenshots and the stack. It would go in `format` and the tables in `lib/exhbt/formats.ts`. Until then an unknown layout reads as a case study, so a doc from a newer release never breaks an older one.
- "My part": a line for what the person did on a team project.
- Wording on the confirm tick for each layout (for a gallery, "I'm allowed to show these pictures").
- Picking several figures from a campaign deck for a gallery, not just one.
- Suggested alt text. It would send the person's pictures to Anthropic, which needs consent and a privacy-policy line, as decision 0017 did for PDF pages.
- The gallery's lead image as the link preview and in the page's JSON-LD (`lib/seo.ts`).
- Demo exhbts in the new layouts (they need stored pictures).
- Enlarging the images on a case study.
- A smaller stored copy of each picture for the grid.
- Choosing a layout on `/exhbts/new` before drafting (the notes can name one for now).
- Rewrite for the aim and the conclusion (they aren't in `DRAFT_BLOCKS`).

Code: `lib/exhbt/formats.ts`, `lib/exhbt/blocks.ts`, `lib/exhbt/sections.ts`, `lib/exhbt/references.ts`, `components/portfolio/ProjectView.tsx`, `components/portfolio/formats/`, `components/portfolio/ImageZoom.tsx`, `components/exhbt/MethodFlow.tsx` (`stack`), `components/editor/LayoutPicker.tsx`, `components/editor/`, `lib/ai/exhbt-draft.ts`, `app/api/exhbts/[id]/figure/route.ts`, `lib/portfolio-home.ts`, `app/globals.css`. Tests: `e2e/phase2-formats.spec.ts`, `e2e/responsive.spec.ts`.
