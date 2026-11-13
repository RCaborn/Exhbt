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
- The greys are neutral, with no colour cast.

## Type
- Display: **Bricolage Grotesque** (variable), weight 600, tracking −0.03em. Headings and the wordmark only.
- Everything else: **Inter** 400/500/600. Two typefaces only: no serif, no mono. Figures use Inter with tabular numbers (the `font-mono` class).
- One heading scale, set on `h1`–`h3` in `globals.css` (36/48, 28/32, 22 px). Don't size headings per page. Marketing pages add two display steps: `.display` (the page's opening line) and `.display-2` (section titles).
- Body 16px; captions 13px. Self-hosted via `@fontsource`.

## Shape and depth
- Buttons, tags and the start form are pills. Inputs and small panels 14px; cards 16–24px.
- Shadows are soft and neutral, only on raised artifacts. Cards are otherwise flat with a `line` edge.
- One content width on marketing pages (`max-w-[72rem]`), so every section shares its left and right edges.

## Motion
Feedback only: buttons respond to hover and press (Astryx), link underlines darken, a linked card lifts 2px (`.card-link`), and on Home the example exhbt's three ticks fill mint in sequence. Nothing moves because the page scrolled. Under `prefers-reduced-motion` everything rests.

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
- **Catalogue numbers**: `EX·01`, `EX·02`… on tiles and full exhbts, from the exhbt's position in its portfolio (`catalogueNo` in `lib/exhbt.ts`). They are references an employer can use, so they're allowed; numbering marketing sections is still banned.
- **Seal** (`components/brand/Seal.tsx`): mark + "checked by exhbt" + date. Says the checks ran, not that results are true, so never "verified". Links to `/how-to-read-an-exhbt#checks` (except inside a tile, which is already a link).
- **Brand band**: the portfolio header is the page's one ink surface (`PortfolioHeader`, slim `PortfolioBar` above a single exhbt). White and `#C9CBCF` text on it.
- **Sign-off** (`MadeWith`): "Portfolio made with exhbt · Build your own roadmap" at the foot of every public portfolio and exhbt.

## Components
- `StartForm`: the role field + "Build my roadmap" button. GET to `/roadmap/new?role=`. Used in the hero and the closing band; the label never changes.
- `BrowserFrame`: adapted from garden-skills web-design-engineer; shows product screens as pages, not floating cards.
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
- `BeforeAfterChart`: a dumbbell for before-to-after per measure (1–3 rows), drawn in the brand's one hue in two shades (mint before, jade after; `components/charts/series.ts`). They are 3.7:1 apart, so they stay distinct for colour-blind readers; checked by contrast maths, not yet re-run through the dataviz validator. Every value is printed beside its dot (mint is 1.5:1 on white); legend for the two series; a hidden data table; the change is shown as a % on the right. No other chart colours without re-running the validator. The pair lives in `components/charts/series.ts`.
- `SkillRadar`: one axis per skill (3–6, fixed in the job's order), levels 0–4 from the centre. The same pair: "from" as a light fill, "to" as a dark outline. Grid in `line`. Labels are HTML over the SVG and show skill names only: **no numbers** (the levels are AI estimates; Rory, 9 Nov 2026). The meaning is carried in words instead. "Level up next" skills get an ink arrow-up marker, and "In the bag" skills get the same green tick as the strengths screen; both are set in ink semibold. Under the chart, `SkillHighlights` lists the two groups (up to three skills each). One line gives where the skills came from (`SKILLS_SOURCE_NOTE`). A hidden data table holds every level. No animation. Radars exaggerate area, so don't add shading, gradients or a third series.

## The exhbt in Phase 2
Phase 2 swaps the card above for a fixed block layout (decision 0007), drawn by `components/portfolio/ProjectView.tsx`. A recruiter skims it, so every part is short and mostly bullets. Top to bottom:
- the person's photo and name top left, skill boxes top right
- the title, then a one-line context
- the question: what the gap was and why it mattered
- the process flowchart (`MethodFlow`), straight after the question
- findings, as bullets
- up to two graphs (`BeforeAfterChart`, with the chart rules above) and up to two images with captions
- the work, one click away, and the trust badge

150–200 words, and every word on the page counts, graph labels and captions included; only image alt text is left out (decision 0009). The order never changes. Limits are `LIMITS` in `lib/exhbt/blocks.ts`.

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
