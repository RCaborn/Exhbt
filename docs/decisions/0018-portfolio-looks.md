Status: accepted
Date: 17 Nov 2026
Supersedes: 0012 (the list of looks, their faces, the kit-only colours, the band-only contrast test)
Amends: 0016 (the look's variables, graphs on a dark look), 0022 (where the look's variables sit, the --xp-* names)

# Portfolio looks: eight looks, one token set, both pages

Rory, 16 Nov 2026: the sixteen looks of decision 0012 "all look the same in different colours". Not everyone wants mint. His spec is `docs/design/portfolio-and-exhbt-layouts.pdf`, pages 3 and 4: eight looks, Classic professional, Notebook, Exhbt, Night, Studio, Mono, Ledger and Bloom. And: "make sure that the users' themes continue over to the exhbts too! It must look sharp for any user!"

So a look now differs in more than colour (faces, corners, rules, how the top of the page and the list of work are laid out), and it styles the portfolio home, every exhbt page, the previous and next cards, the sign-off and the per-job page.

## The eight

In plan order (the order is the plan split, below). The data is `LOOKS` in `lib/portfolio-themes.ts`; the PDF's caption is each look's `blurb`.

| Look | Faces (display / body) | Ground, text, accent | Corners | Treatments (hero, band, work) | Colourways |
|---|---|---|---|---|---|
| **Exhbt** (default) | Bricolage Grotesque 600 / Inter | white, ink, mint button, jade links, wash band | 16px, pill buttons | portrait, bleed, cards | none |
| **Classic professional** | Newsreader 600 / Inter, with the headline, intro and context line in Newsreader | white, ink, one deep accent | square | masthead (a 3px rule over the name), ruled, cards; "See how I did it" as an underlined link | deep green `#14463a`, burgundy `#7b1f2c`, black, ochre `#80621a` ("Your accent") |
| **Notebook** | Inter 600 / Inter | white, ink, grey chips, a pale yellow highlight | 10px | notes (property rows: Looking for, Based in, Education, Skills), inset callout, a list of links | none |
| **Mono** | JetBrains Mono 700 / JetBrains Mono | white, ink, no colour; the highlight is ink with white text | square, ink hairline boxes, dashed rules | terminal (`~/username` over the name, skills in hairline boxes), inset outline, a numbered index | none |
| **Night** | Inter Tight 700 / Inter | ink ground `#0e0f12`, white type, white buttons, mint ticks, links and last flowchart box | 16px, pills | portrait, bleed (a raised panel), cards | none |
| **Studio** | Inter Tight 900 / Inter | white, ink, black square buttons, one loud block of the person's colour | square, 2px ink edges | block (the colour block holds the photo or the initials, the name stacked very heavy), bleed in the colour, cards | vermilion `#d3381c`, green `#087a56`, pink `#fb4a98`, mint, black ("Your colour") |
| **Ledger** | IBM Plex Sans 600 / IBM Plex Sans | white, deep green `#0c3b2e` headings, rules and buttons, tabular figures | 2px | ledger (a 6px green bar along the top, ruled rows with figures on the right, "Pieces of work", a double rule), ruled, cards | none |
| **Bloom** | Nunito 800 / Nunito | a pastel ground, white cards, a deep partner colour for buttons, ticks and the last box | 22px, pills | greeting ("Hi, I'm" beside a photo in a dashed ring), inset white panel, cards | pink, mint, lavender, blue ("Your pastel") |

A colourway is stored as `<look>-<colourway>` (`classic-burgundy`, `studio-pink`); the first colourway is the look's own id. Every colourway is a full, resolved palette, checked like a look.

## One token set

A look sets each colour once. `themeStyle(theme)` in `components/portfolio/themeFonts.ts` writes them as CSS custom properties on the wrapper of a portfolio page, and `lookAttrs(theme)` adds `data-look`, `data-theme` (the stored id), `data-hero`, `data-band`, `data-work` and, for a dark ground, `data-dark`. The wrappers are the home page's root (`PortfolioHome`), the frame round an exhbt (`app/(portfolio)/p/[username]/[slug]/layout.tsx`, which now also holds the page ground, the pager and the sign-off) and the per-job page (`JobLinkView`).

**Decision: one prefix, `--pf-*`, with the band and the graphs in their own small groups. The exhbt page keeps its `--xp-*` names, mapped from `--pf-*` in `app/globals.css`** (`[data-look] { --xp-ink: var(--pf-ink); … }`, declared on the wrapper itself, because a `var()` on `:root` resolves before the look is seen). The `--xp-*` defaults stay on `:root` for the editor's preview, which has no look round it. Renaming every `--xp-*` would have touched the editor and the coming exhbt formats for nothing; anything new should read `--xp-*` on the exhbt page and `--pf-*` everywhere else.

The set, with the palette key in `lib/portfolio-themes.ts` it comes from:

| Variable | Key | Paints |
|---|---|---|
| `--pf-ground` | `ground` | the page, behind everything, on both pages |
| `--pf-ink` | `ink` | body text |
| `--pf-heading` | `heading` | the name, titles, section headings (Ledger's green) |
| `--pf-soft` | `soft` | the intro, summaries, labels |
| `--pf-faint` | `faint` | captions, years, flowchart arrows |
| `--pf-line` | `line` | hairlines between rows and facts |
| `--pf-rule` | `rule` | the strong rule (under "What I found", Classic's masthead, Ledger's rows, Bloom's ring) |
| `--pf-edge` | `edge` | card and box edges |
| `--pf-card` | `card` | project cards, flowchart boxes, the pager |
| `--pf-well`, `--pf-well-edge` | `well`, `wellEdge` | the quiet fill: the sidebar's person card, the link card, a key figure's well |
| `--pf-figure` | `figure` | the card a graph or image sits in |
| `--pf-accent` | `link` | links on the ground (decision 0016's name kept) |
| `--pf-button-bg`, `--pf-button-text` | `button`, `buttonInk` | small buttons ("Get in touch") |
| `--pf-action`, `--pf-action-ink`, `--pf-action-hover` | `action…` | the one main button ("See the work") |
| `--pf-highlight`, `--pf-highlight-ink` | `highlight…` | the highlighted gap in the context line |
| `--pf-tick`, `--pf-tick-ink` | `tick…` | filled ticks and the quote's rule |
| `--pf-pill`, `--pf-pill-ink`, `--pf-pill-edge` | `pill…` | skill pills and chips |
| `--pf-flow-end`, `--pf-flow-end-ink`, `--pf-flow-end-soft` | `flowEnd…` | the flowchart's last box and its detail line |
| `--pf-avatar`, `--pf-avatar-ink` | `avatar…` | initials when there's no photo |
| `--pf-radius`, `--pf-radius-lg`, `--pf-radius-box`, `--pf-radius-pill`, `--pf-radius-button` | `shape` | corners: cards; panels and the sidebar card; flowchart boxes; pills; buttons |
| `--pf-edge-width`, `--pf-rule-style` | `shape` | card edges (Studio's 2px); hairlines solid or dashed (Mono) |
| `--font-display`, `--pf-font-body`, `--pf-font-lead` | `type` | the heading face (the site's own variable, so every heading inside follows), the body face, the lead face (Classic's serif intro and context line) |
| `--pf-display-weight`, `--pf-tracking` | `type` | display weight and tracking; smaller headings take a fraction of the tracking |
| `--band-bg`, `--band-text`, `--band-soft`, `--band-accent`, `--band-edge` | `band…` | the best-work band (Studio's block too) |
| `--band-initials-bg`, `--band-initials-text` | `avatar…` | the same as `--pf-avatar`, kept for the demo's `PortfolioHeader` |
| `--chart-strong`, `--chart-soft`, `--chart-1` to `--chart-4`, `--chart-wash` | `chart…` | the graphs' two shades, their ramp, a highlighted table row |

Removed: none of 0016's names. Gone from the exhbt page's list is `--xp-page-ground` (the frame paints the ground with `--pf-ground`). New on it: `--xp-heading`, `--xp-flow-end-soft`, `--xp-edge-width`, `--xp-lead-font`.

### The exhbt page's names, and what they read

For anyone building on the exhbt page (the coming gallery and research formats included): draw with the `--xp-*` names below, never a Tailwind colour class. On a portfolio each one is the `--pf-*` value on the right, set by the look on the frame; in the editor's preview (no look) it is the Exhbt default on `:root`.

| `--xp-*` | reads | `--xp-*` | reads |
|---|---|---|---|
| `ground` | `--pf-ground` | `accent`, `accent-hover`, `accent-ink` | `--pf-action`, `-action-hover`, `-action-ink` |
| `ink` | `--pf-ink` | `outline-ground`, `outline-ink`, `outline-edge` | `--pf-ground`, `--pf-ink`, `--pf-edge` |
| `heading` | `--pf-heading` | `highlight`, `highlight-ink` | `--pf-highlight`, `-highlight-ink` |
| `muted` | `--pf-soft` | `flow-ground`, `flow-ink`, `flow-edge`, `flow-muted` | `--pf-card`, `--pf-ink`, `--pf-edge`, `--pf-soft` |
| `rule`, `rule-strong` | `--pf-line`, `--pf-rule` | `flow-end`, `flow-end-ink`, `flow-end-soft` | `--pf-flow-end…` |
| `card`, `card-ink`, `card-muted`, `card-edge` | `--pf-well`, `--pf-ink`, `--pf-soft`, `--pf-well-edge` | `arrow` | `--pf-faint` |
| `figure`, `figure-ink`, `figure-muted`, `figure-edge` | `--pf-figure`, `--pf-ink`, `--pf-soft`, `--pf-edge` | `avatar`, `avatar-ink`, `avatar-edge` | `--pf-avatar…` (the edge is the avatar's own colour, ink in Exhbt and Mono) |
| `pill`, `pill-ink`, `pill-edge` | `--pf-pill…` | `radius-card`, `radius-box`, `radius-pill`, `radius-button` | `--pf-radius-lg`, `-radius-box`, `-radius-pill`, `-radius-button` |
| `tick`, `tick-ink` | `--pf-tick…` | `edge-width` | `--pf-edge-width` |
| `link` | `--pf-accent` | `font`, `title-font`, `lead-font`, `title-weight`, `title-tracking` | `--pf-font-body`, `--font-display`, `--pf-font-lead`, `--pf-display-weight`, `--pf-tracking` |

### What in decision 0022 no longer holds

- "Keep the figure ground white or near it, even on a dark look: the graphs colour themselves for white." Graphs now take the look's shades and sit on the look's own figure card (Night's is dark).
- "Set `--xp-page-ground` from the root with `:root:has(…)`." The variable is gone; the frame round the page carries the look and paints `--pf-ground`.
- "The sign-off and the previous and next cards keep their own colours; a dark look has to restyle those as well." They sit inside the frame now and take the look.
- "A look overrides the `--xp-*` names on `[data-theme="<id>"]`." A look sets `--pf-*` only; the `--xp-*` names are read from them on `[data-look]`. Setting an `--xp-*` name directly on an element inside the page still works.

The few things a token can't carry are **treatments** (`Treatment` in `lib/portfolio-themes.ts`): `hero` (portrait, masthead, notes, terminal, block, ledger, greeting), `band` (bleed, inset, ruled), `work` (cards, list, index) and `cta` (the band's "See how I did it" as the band turned round, the main button, or a link). `PortfolioHome` switches markup on them; `globals.css` has the exhbt page's few signatures keyed on `data-hero` (Classic's rule over the title, Ledger's bar and double rule, Bloom's ringed photo, Studio's sidebar card in the block colour). A new look picks from these or adds one.

To add a look: add a palette and a base to `LOOKS`, at the end so Premium's set doesn't change, run `e2e/phase2-looks.spec.ts`, and run the palette validator on its ramp.

## Fonts

Bricolage Grotesque and Inter are self-hosted for the whole site. The look faces (Inter Tight, Newsreader, JetBrains Mono, IBM Plex Sans, Nunito) load with `next/font/google` in `components/portfolio/themeFonts.ts`: variable files, latin and latin-ext (for names with accents), no preload. Each is an `@font-face` rule, and a browser downloads a file only when text uses it, so a portfolio page fetches its own look's face and nothing else (the test checks the loaded families on both pages of every look). The builder's look step shows every look, so it fetches them all. The exhbt wordmark keeps Bricolage through a new `--font-brand`, whatever the look's `--font-display`. Marketing pages are unchanged.

## Graphs

The one-hue rule stands (decision 0011): one hue, two shades, values printed, a hidden table. What changed is whose hue. Each look sets a strong shade (the highlighted series, "after"), a soft shade ("before") and a four-step ramp; the chart components read `CHART_STRONG`, `CHART_SOFT` and `CHART_RAMP` from `components/charts/series.ts`, which are those variables with the brand's colours as fallbacks, so the editor, the radar and the admin panel don't change. Inside a graph on a portfolio, the brand colour variables the chart components use for text, gridlines and marker rings point at the look's (`[data-look] [data-chart]` in `globals.css`), so a graph's labels are the page's ink on the look's own figure card.

Night's graphs are drawn on its own dark card (`#17191d`) with mint as the strong shade and a dark green as the soft, so a dark look no longer has to keep white cards. A graph on a home card sits on the figure ground, never on the grey well. Every look's ramp passed the dataviz validator as an ordinal ramp on its card (`validate_palette.js "<lightest…strongest>" --ordinal --surface <figure>`, 17 Nov 2026); the ramp's lightest step runs towards white while it still clears 2.1:1, so saturated reds and pinks still get four distinct steps.

## Old ids

The data stays a text id in `profiles.portfolio_theme`; no migration. `LEGACY_IDS` maps each of 0012's ids to the look it looked most like:

| Old | Now | Old | Now |
|---|---|---|---|
| exhbt | Exhbt | pine | Ledger |
| ink | Night | editorial | Classic professional |
| jade | Studio, green | folio | Classic professional, black |
| mint | Exhbt | meadow | Bloom, mint |
| paper | Notebook | fresh | Exhbt |
| mist | Notebook | circuit | Mono |
| night | Night | drift | Ledger |
| deep-jade | Ledger | chalk | Notebook |
| studio | Studio | | |

Old `studio` was a quiet grey band and now means the loud Studio, because the id is reused; nothing live used it. An unknown id shows the default. A stored old id stays as it is until the person picks a look, which stores the new id.

## Plans

`portfolioThemes` in `lib/entitlements.ts`: Free has the first look (Exhbt), Premium the first four (Exhbt, Classic professional, Notebook, Mono), Max and universities all eight. A look's colourways come with it. Night went to Max: the PDF calls it "an extra idea, not one you've agreed". `canUseTheme` checks every save on the server; after a downgrade the public pages show the default and the stored choice is kept, as before. The pricing page lines read `looksLine()`: "N portfolio looks to choose from" with the figure, and "Every portfolio look, in every colour" on Max.

## The builder's "Your look" step

Each look is drawn large as the top of the person's own page (`PortfolioHome` with `thumbnail`: the top bar, the hero and the best-work band, at a laptop's width scaled to the card, inert and hidden from screen readers), with its name, faces, the PDF's line and who it suits. Classic, Studio and Bloom have a row of swatches under the picture. A locked look shows the plan that opens it on the picture and to screen readers, still previews in the live preview beside the steps, and shows the upgrade offer instead of saving. The live preview changes the moment a look or swatch is picked.

## Checks

- `e2e/phase2-looks.spec.ts`: every pairing in every look and colourway, worked out from the definitions (`contrastPairs`: text 4.5:1 on the ground, cards, wells and graph cards; buttons; pills; the highlight; ticks and the strong graph shade 3:1; the graph rules), every colour an opaque hex, the ramps in order; then for each of the eight looks axe on the home page and an exhbt page, the look's ground, title, last box, button and sign-off, and the faces loaded; Night's graphs on its dark card; Night printing on paper; a long name with no photo, no graphs and one exhbt on a phone in every look; an old id.
- `e2e/phase2-themes.spec.ts`: the eight in order, the old ids, the plan split, the builder's step with its locks, swatches and keyboard, a downgrade and back.

## Departures from the PDF, and calls it didn't make

- Exhbt keeps Bricolage Grotesque for the name, as the site does; the PDF's drawing looks like Inter Display. Night and Studio use Inter Tight, which matches the drawing.
- Mono numbers the work (`[01]`), as the PDF draws it. That is an exception to DESIGN.md's ban on decorative numbering: it is the work's order, in an ordered list. Notebook's property labels are an exception to "few labels", for the same reason: the look is a notes page.
- The PDF shows hero cards only. The rest of each page (band, cards, rows, the exhbt page) is extrapolated from the card: Classic and Ledger rule their band rather than fill it, Notebook and Mono put it in a callout or a hairline box, Bloom in a white panel.
- Studio's best-work band is the person's colour too, so the page has two loud blocks when both are on it; one block and a white band looked unfinished.
- The PDF's Studio and Bloom tones are kept as swatches; where a swatch can't carry text or a graph (Studio mint and pink, Bloom's pastels), a darker partner of the same hue does that job.
- Notebook's highlight is a pale yellow, the one colour on that page, so the gap still stands out.
- Classic's tagline is serif in the PDF; on the page the headline, intro, the band's sentence and the exhbt's context line are serif, and longer body text stays Inter for reading.
- Print: a dark look prints in the default look's colours (`printStyle`), and Mono prints a step smaller so a full exhbt stays on one A4 page.

## Not decided here

- The marketing home's "Looks" section reads `PORTFOLIO_THEMES`, and on this branch it still filters by decision 0012's ids, so it lists nothing until the new home page (its own branch) lands, which reads the list without ids.
- The demo passes the old `ink` id to `PortfolioHeader`, which now shows Night: a dark band and an Inter Tight name on that fictional portfolio. The demo is being redone on the same branch.
- The exhbt frame looks up the username, plan and profile to find the look, and the page looks them up again (both once per request). A shared loader would save a round trip.
- Axe runs on the eight looks in their first colourway; the other colourways are checked by the contrast maths only.
