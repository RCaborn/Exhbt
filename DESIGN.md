# Exhbt design system

## Idea
Proof, made quick to read. A white canvas, ink text, and one colour: **mint**, with jade as its text-safe partner. Brand kit v1 (9 Nov 2026): fresh and techy, fun but not flippant, credible first. Rory's rule: the colours are fixed; type, logo and layout can be improved where it helps.

## Design read (garden-skills format)
```yaml
artifact: marketing landing page + light app surfaces
audience: UK final-year students and recent graduates; secondarily hiring managers and universities
visual-language: white space, one mint accent, crisp type, rounded shapes
visual-variance: 5   motion-intensity: 3   information-density: 4   asset-dependence: 4
```

## Mode by surface
- Marketing (Home, Pricing, Universities): **Persuade**. The primary action is visible in the first viewport on every device.
- How to read an exhbt, Legal: **Read**. ~68ch measure.
- Roadmap builder/result, dashboard, editor, admin: **Operate**. White panels on mist, dense and calm.

## Colour
Tokens live in the `@theme` block of `app/globals.css`. The same values feed the Astryx theme in `themes/exhbt/exhbtTheme.ts`; change both together, then run `npm run theme`.

| Token | Value | Use |
|---|---|---|
| `mint` | `#4FE9B4` | **primary buttons** (ink text), the mark, the highlighter, ticks, the one mint band |
| `mint-press` | `#36DDA4` | button hover |
| `jade` | `#00755D` | links, tags, the focus ring, any mint-coloured text or line that must be read (5.6:1 on white) |
| `ink` | `#0E0F12` | text; the footer and portfolio band; buttons on mint |
| `surface` | `#FFFFFF` | every main ground |
| `mist` | `#F6F7F8` | the second ground: alternate sections, app pages behind white panels |
| `wash` | `#E3FCF0` | tags and soft fills |
| `graphite` | `#3E4044` | secondary text |
| `slate` | `#6F7278` | captions, placeholders (4.8:1) |
| `line` | `#E5E6E8` | hairlines and card edges |
| `field` | `#85888E` | input borders (3.5:1; not in the kit) |
| `error` | `#C92324` | errors |

**Rules**
- About 85% white and greys, 10% ink, 5% mint: one main button per screen, the logo and highlights.
- Mint always takes **ink** text (12.4:1). White on mint fails (1.5:1). Anything mint that has to be read as text or a thin line is jade instead.
- On a mint band the button switches to ink (`variant="ink"`) and the mark flips (`tone="on-mint"`).
- One mint band per page at most (Home: the closing band). No blue, purple or orange anywhere.
- One ink section on Home, and only there: "A site that's all yours", the address section, where the white browser frame round the portfolio stands out. Never next to the ink footer. Text on it is white, or `on-ink` (`#C9CBCF`) for secondary text; the address's name part is mint.
- The greys are neutral, with no colour cast.

## Type
- Display: **Bricolage Grotesque** (variable), weight 600, tracking −0.03em. Headings and the wordmark only.
- Everything else: **Inter** 400/500/600. Two typefaces only on the site: no serif, no mono. Figures use Inter with tabular numbers (the `font-mono` class). The exception is a portfolio look (below): on that person's portfolio and exhbt pages a look sets its own display and body faces (decision 0018). Marketing and app pages always use Bricolage Grotesque and Inter, and the wordmark keeps Bricolage everywhere (`--font-brand`).
- One heading scale, set on `h1`–`h3` in `globals.css` (36/48, 28/32, 22 px). Don't size headings per page. Marketing pages add two display steps: `.display` (the page's opening line) and `.display-2` (section titles).
- Body 16px; captions 13px. Self-hosted via `@fontsource`.

## Shape and depth
- Buttons, tags and the start form are pills. Inputs and small panels 14px; cards 16–24px.
- Shadows are soft and neutral, only on raised artifacts. Cards are otherwise flat with a `line` edge.
- One content width on marketing pages (`max-w-[72rem]`), so every section shares its left and right edges.

## Motion
Feedback only: buttons respond to hover and press (Astryx), link underlines darken, a linked card lifts 2px (`.card-link`), and a question's plus turns to a cross as it opens. Nothing moves because the page scrolled. Under `prefers-reduced-motion` everything rests.

## Focus
3px jade outline with a white gap and ink halo: visible on white, mist, mint and ink.

## Design system (Astryx)
`@astryxdesign/core` (Meta's open-source React design system, beta) is installed with an Exhbt theme.
- **Buttons are Astryx Buttons**, through `components/ui/Button.tsx`: `primary` (mint), `secondary` (white, ink edge), `ink`, `danger`; sizes `sm`–`xl`. With `href` it's a link. Don't write button classes by hand.
- The theme is `themes/exhbt/exhbtTheme.ts`. `npm run theme` builds `exhbt.css`/`exhbt.js` beside it (committed); `npm run check` fails if they're stale.
- `app/providers.tsx` wraps the app in the theme (light only) and makes Astryx links Next.js links. `globals.css` declares the layer order: Astryx sits under the site's own classes and Tailwind utilities.
- Other Astryx components (dialogs, menus, tabs, inputs) are there to use: `npm run astryx -- component --list`. Fields, tags and cards are still the site's own classes; move them over one at a time, with the e2e tests.

## Identity
Full rules, sizes and don'ts are in `docs/brand.md`. In short:
- **Mark** (`components/brand/Logo.tsx`): the kit's Frame route. A mint tile with ink viewfinder brackets and a dot: one piece of work in focus. `app/icon.svg` is the favicon.
- **Wordmark**: lower-case `exhbt`, Bricolage Grotesque 600. In running text the company is "Exhbt" and the pieces are "exhbts".
- **Catalogue numbers**: `EX·01`, `EX·02`… on tiles and the demo card (`Exhbt.tsx`), not on the exhbt page itself (decision 0022), from the exhbt's position in its portfolio (`catalogueNo` in `lib/exhbt.ts`). They are references an employer can use, so they're allowed; numbering marketing sections is still banned.
- **Seal** (`components/brand/Seal.tsx`): mark + "checked by exhbt" + date. Says the checks ran, not that results are true, so never "verified". Links to `/how-to-read-an-exhbt#checks` (except inside a tile, which is already a link).
- **Brand band**: the look's one coloured surface. On the portfolio home (`components/portfolio/PortfolioHome.tsx`, Rory's layout spec in `docs/design/`, decision 0016) it is the "My best piece of work" band, wash in the default Exhbt look; above a single exhbt it is the slim `PortfolioBar`. The home page's ground, text, cards, corners and buttons are CSS variables set by the look (`--pf-*`, `--band-*`, `--chart-*`, `--font-display`; the table is in decision 0018), never fixed colour classes, so a look restyles the whole page. Few labels, generous space; no catalogue numbers or headline figures on the home page.
- **Portfolio looks** (`lib/portfolio-themes.ts`, decision 0018, from Rory's spec pages 3 and 4): eight fixed looks (Exhbt, Classic professional, Notebook, Mono, Night, Studio, Ledger, Bloom), three of them with a few colourways picked from swatches. **Portfolio pages may leave the brand palette and faces**: a look sets its own ground, ink, accent, faces, corners, rules and graph shades, and arranges the top of the page, the band and the list of work its own way. It styles the portfolio home, every exhbt page, the pager, the sign-off and the per-job page through one token set (`--pf-*`; the exhbt page's `--xp-*` names read it). Nobody picks a free colour: every look and colourway is checked once, every pairing on both pages to WCAG AA (`contrastPairs`, tested in `e2e/phase2-looks.spec.ts`), with axe on both pages in every look. The default look is Exhbt: the brand's white page with a wash band.
- **Dragging** (the builder, decisions 0014 and 0016): the home page's sections are dragged in the live preview, each with a grip and a remove button in its top corner, the section itself a picture underneath; the exhbts are dragged as a list of rows in the Your page step. In both a real button with a grip icon is the handle; the tile itself never drags, so scrolling and links work. The lifted tile keeps its card and takes `shadow-pack` and a jade outline; the others slide (no scaling) in 180ms, and nothing moves under `prefers-reduced-motion`. Tile controls are small round icon buttons (36px, 44px on touch) with an `aria-label` and a tooltip; the preview inside a tile is inert. Status is quiet text ("Saved") with one Undo.
- **Ticks**: one tick everywhere, `components/ui/Tick.tsx` (an ink check on mint with an ink edge). Linked cards (project tiles, job-link tiles) lift with `.card-link`, which darkens the edge to ink; nothing lifts to jade.
- **Sign-off** (`MadeWith`): "Portfolio made with exhbt · Build your own roadmap" at the foot of every public portfolio and exhbt.

## Components
- `StartForm`: the role field + "Build my roadmap" button. GET to `/roadmap/new?role=`. Used in the hero and the closing band; the label never changes. The field is the button's height, so the button sits in the pill with the same gap on every side; the field shrinks and the button never does. Below `sm` they stack, the button full width. No icon in the button.
- `BrowserFrame`: adapted from garden-skills web-design-engineer; shows product screens as pages, not floating cards.
- `Preview` (`components/home/Preview.tsx`): a real product page as a picture on a marketing page: the real component (`ProjectView`, `PortfolioHome`) with the fictional demo data, in a `BrowserFrame` at its address, inert and hidden from screen readers with a caption that says what it shows. A CSS `zoom` draws a wide page smaller in a narrow column while it still lays out wide (its container queries read the unzoomed width); without one it renders at its real size, as a phone shows it. The example exhbt on Home is real size on phones and cropped to its first screen; the portfolio pictures are zoomed at every width, so the band shows on a phone too. Never a marketing copy of a product screen: it would drift from the product.
- **Pattern**: the viewfinder pattern (`.pattern-viewfinder` in `globals.css`): the mark's brackets, turned every other step, with the evidence dot, tiled flat in mint and jade on mist, as inline SVG (nothing downloads, nothing moves). Only behind a product picture, never behind text: on Home it is the panel round the example exhbt. It may also sit behind a product picture on another marketing page; not on the app, a portfolio or an exhbt page, and never on mint, ink or wash.
- `Faq` (`components/home/Faq.tsx`): each question a native `<details>` disclosure, closed to start, with a round plus that turns to a cross. Any number can be open.
- `Exhbt` / `TrustBadge`: the fixed exhbt template. Order:
  1. catalogue number (when it sits in a portfolio), then who
  2. title (display face)
  3. one-line outcome
  4. **methodology flow**
  5. key-result chart
  6. skills as plain boxes, with no label
  7. the work, as an attachment row
  8. verification: the seal (with the date), then the three ticks
  9. reflection, small, in the footer

  The same card is used everywhere; there's no preview variant.
- `MethodFlow`: the methodology as a pipeline of 3–6 step boxes joined by arrows. The last step (the result) is filled ink. It lays out by its container (`@container` on the card): a row at 42rem or wider, otherwise a vertical pipeline. Step numbers (01–06) are allowed here because the order carries meaning. Rendered as an `<ol>` labelled "Methodology".
- `BeforeAfterChart`: a dumbbell for before-to-after per measure (1–3 rows), drawn in the brand's one hue in two shades (mint before, jade after; `components/charts/series.ts`). They are 3.7:1 apart, so they stay distinct for colour-blind readers; checked by contrast maths. Every value is printed beside its dot (mint is 1.5:1 on white); legend for the two series; a hidden data table; the change is shown as a % on the right. The pair lives in `components/charts/series.ts`.
- **Graphs on an exhbt** (`Chart` in `components/charts/`, decision 0011): before and after, bars, grouped bars, stacked bars, a line, scatter, big numbers or a small table, and nothing else; anything more exotic goes in as an image. The rules every kind keeps:
  - **Values printed**, in text ink, never in the series colour: at the end of each bar, the total of a stacked bar with its parts listed underneath, every point of a line's highlighted series (first and last only on a narrow graph with many points) and the last value of the others where it fits, the labelled and highlighted points of a scatter. Whatever isn't printed is read off the ticks and is in the table.
  - **One hue.** Before and after keeps the mint/jade pair. Every other kind uses `SERIES_RAMP`: four steps of jade, darkest first (`#00755D`, `#179274`, `#2AAF89`, `#3DCC9F`). The highlighted series, bar or line takes jade; the rest take the next steps, and bars that aren't the highlighted one take the lightest. It passes the dataviz validator as an ordinal ramp on white (14 Nov 2026: one hue, steps at least 0.06 apart in lightness, the lightest 2.03:1). One hue can't tell series apart by colour alone, so each also has a legend entry and printed values, and lines add a dash and a marker shape (circle, square, triangle, diamond). Graphs sit on white, never mist: the lightest step is below 2:1 there. On a portfolio the look sets the hue (its strong and soft shades and a four-step ramp, `--chart-*`, decision 0018), and graphs sit on the look's own figure card, so Night's are light on dark; each look's ramp passed the same validator on its card. No other chart colours without re-running the validator.
  - **Axes from one scale**: clean ticks (1, 2, 2.5 or 5 times a power of ten), hairline gridlines in `line`, a graphite zero line. Bars start at zero and are at most 16px thick with a 4px rounded end; lines are 2px (2.5px highlighted) with 8px markers ringed in white; stacked parts have a 2px white gap.
  - **Accessible**: the drawing is one `role="img"` with a short summary, and a visually hidden table holds every figure. A table graph is a real table instead.
  - **Responsive and printable**: bar labels sit beside the bars from 28rem of container width and above them below it; the exhbt's `@container` decides, so the editor's preview matches. Two graphs sit side by side on wide pages and in print; line and scatter heights are fixed in mm for A4.
  - **Protected numbers** (for confidential work): the graph shows the change from the start in % (with a + on rises) or an index where the start is 100, and a line under it says the real figures aren't shared. Units are dropped; % ticks show a %.
- `SkillRadar` (decision 0023): one radar per roadmap, one axis per skill (3-6, fixed in the job's order), levels 0-4 from the centre. Two series, the same pair as the other charts: "What the job asks for" is always the dark outline, and "You" is the light fill. A segmented control (Astryx Buttons with `aria-pressed`, in a labelled group) sets "You" to **Now** or **After the projects**; it shows Now without JS, only appears when suggested projects exist, and nothing animates when it changes. After the projects, a skill a project closes goes to what the job asks, and the rest stay put. Grid in `line`. Labels are HTML over the SVG and show skill names only: **no numbers** (the levels are AI estimates; Rory, 9 Nov 2026). The meaning is carried in words instead. **Every axis has a marker** for the view shown: the green tick from the strengths screen when you meet the job, an ink arrow-up when you are below it; labels are ink semibold. Under the chart, `SkillHighlights` lists the two groups, "Level up next" and "In the bag", with every skill in each (no cap). One line gives where the skills came from (`SKILLS_SOURCE_NOTE`), and "If you do the suggested projects." is added in the After view. A hidden data table holds every level: now, after and the job's. Radars exaggerate area, so don't add shading, gradients or a third series (this is why the switch replaces a second chart).

## The exhbt in Phase 2
Phase 2 swaps the card above for the page Rory drew on 16 Nov 2026 (`docs/design/portfolio-and-exhbt-layouts.pdf`, page 2; decisions 0007, 0015 and 0022), drawn by `components/portfolio/ProjectView.tsx`. A recruiter skims it, so every part is short and mostly bullets. No catalogue number and no headline figure on it.

The sidebar, on the left (above the main column on phones and in the editor's preview): a mist card with the photo, the name, the short line under it and "All of <first name>'s work"; then "What it is" and "Where and when" as small graphite labels over semibold values, with hairlines between; "Can you trust it?" with filled jade ticks (hollow and graphite for a check that hasn't happened); "See the work: <file name>" as the one mint button, full width; "Save as PDF" as a text link.

The main column, in this order, always:
- skill pills, top right, on mist with no edge
- the title, which is the question, large in the display face (about 56px on a wide page)
- the context line in graphite at about 19px, its gap highlighted as a flat block of mint mixed with white (the bold run, drawn as `<mark class="xp-mark">`; not the `.highlight` stroke used on marketing pages)
- the process flowchart (`MethodFlow variant="page"`): boxes with a `line` edge and 12px corners, arrows between, the last box ink with white text, no step numbers. A row in print. On screen it is a row once the column is wide enough for the boxes: 36rem for 3 or 4, 42rem for 5, 48rem for 6, a column below that (decision 0022).

Below the flowchart, sections in the order the person sets. "What I found" is a display-face heading over an ink rule, with the points as a ruled list; next to a graph or image (straight before or after it) the two share a row, findings on the left. Graphs and images sit in a white card with a `line` edge (graphs never on mist); two of a kind next to each other share a row. The quote, under "Feedback", has a jade rule down its left; "What I'd do next" has a hairline above and a small graphite label; the link is a mist card with its label as a link and no address shown.

Every colour, radius and face on the page is a `--xp-*` variable (`app/globals.css`, listed in decision 0022), which a portfolio look sets through its `--pf-*` set (decision 0018), so a look restyles the whole page, ground, pager and sign-off included. Don't use Tailwind colour classes on it for anything a look might change.

150–200 words, and every word on the page counts, graph labels, captions, the quote's name, the summary and where and when included; only image alt text and link addresses are left out (decision 0009). The core's order never changes. Limits are `LIMITS` in `lib/exhbt/blocks.ts`.

In the editor each section is a card with a visible grip handle (the `GripVertical` icon, a round button), move up and down buttons, and remove. While a card is dragged it takes the `shadow-pack` shadow, and nothing animates for people who ask for less motion (`useReducedMotion` in `components/ui/`). The preview's "Arrange sections" draws the sections one under another with a grip and move buttons on each, a dashed edge round each, and a jade edge on the one being dragged.

### Layouts
An exhbt has one of three layouts (decision 0024, `lib/exhbt/formats.ts`); the sidebar, skill pills, title, context line and flowchart are on every one, and the case study is the page above, unchanged. In the product the word is "Layout"; "look" stays the portfolio looks. One renderer draws the main column of every layout (`components/portfolio/LayoutMain.tsx`, decision 0027): it lays the sections out in rows by each layout's rules (`lib/exhbt/layouts.ts`), with every row's classes in one place (`components/portfolio/layout-rows.ts`), so the pages below are the same rules, not separate pages.
- **Gallery**: the lead image across the column, uncropped (a portrait poster sits centred on the figure ground); "What I did" (the flowchart as a column) beside "What happened"; then the rest of the pictures in justified rows. Each picture keeps its own shape and nothing is cropped (`object-fit: contain`); the rows line up by sizing each tile from its shape, in DOM order, so reading order, tab order and what's on the screen agree: no CSS columns, no masonry, no `order`. Hover changes the edge only. No picture is lazy, because Chrome prints unscrolled lazy pictures blank.
- **Enlarged picture** (`ImageZoom.tsx`): a native dialog with one picture, a visible Close button and a caption. No Previous or Next, no carousel, nothing moves, no fade. The one fixed colour is its flat dimmed backdrop (80% near-black, no blur); everything else is `--xp-*`.
- **Research**, a poster read figure first: the aim or hypothesis (a jade rule down its left) and the method (a column) beside the key figure, large; further figures two to a row; Results beside the conclusion and the limitations; feedback; then References, an unnumbered list of links that never shows the address. No "Figure 1".
- Every colour, corner and face is a `--xp-*` variable, so all eight looks apply with no new variables. Print is one A4 page for the samples, with shorter rows and the dialog and zoom chips hidden.
- `--xp-error` is for the editing page only (decision 0026): the app's own red where it reads at 4.5:1 on a look's ground, cards and well, and a lighter red of the same hue on Night. The public page never uses it.

## Flow patterns
- **Click-through, not long pages**, for the roadmap builder and result. Marketing pages scroll normally.
- **Builder:** one question per screen inside a white card on mist. "Step N of 3" with a progress bar segment per step; Back (secondary) on the left, Continue (primary) on the right; the step is in the URL (`?step=`). Validation messages sit under the field and are announced. Step 2 (the CV) has a text button, "Skip for now", under the upload; it goes once a CV is in. Minimal words on every step: a title, the fields, at most one short line.
- **Result:** five views (`?view=`) in a white card: Overview, Gaps, Already strong, Projects, What next. Pill tabs on desktop, "N / 5 · Label" on mobile; the bottom bar has the previous view on the left and the next view as the primary button. Each view has its own `h1`.
- **Project-ideas gate:** Projects asks for name, email and LinkedIn (optional) before showing ideas, prefilled from the CV with "From your CV. Change anything that's wrong." There's no Next button past it.
- **The plan:** three idea cards, each with a secondary "Swap" button; the optional "Make some tweaks" note sits above them and steers swaps; "N swaps left" and "Keep this plan" (primary) sit below. Settled, the page reads "Your plan" with no controls.
- **Waiting and failure:** the building screen has an indeterminate bar (static under reduced motion) and honest copy. Failure offers "Try again" and says the answers are saved.

## Email
Same palette in plain hex; table layout; one primary mint button with ink text. The header is the mark as a PNG (`public/brand/exhbt-mark.png`, since email clients strip SVG) beside the wordmark. Every email has unsubscribe and privacy links. Template: `lib/email/templates/roadmap-ready.ts`; preview locally at `/dev/emails`.

## Banned
Eyebrow labels; decorative 01/02/03 numbering; icon+heading+text card grids; hero stat strips; fabricated metrics, testimonials or logos; gradients (the highlighter is a flat stroke); glass; emoji icons; stock photos of people; carousels; three or more consecutive left/right zigzag sections (garden "zigzag monotony"); a large headline beside a small floating paragraph (garden "split-header filler"); different labels for the same action.
