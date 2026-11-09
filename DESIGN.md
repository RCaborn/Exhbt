# Exhbt design system

## Idea
Proof, with warmth. A white and light-blue world, navy ink, light-blue pill buttons, and one fresh **green** used only for the ticks that mean "checked". Each exhbt stays a sober document (serif, square edges, one data chart) so it reads as *evidence* inside a lively site.

## Design read (garden-skills format)
```yaml
artifact: marketing landing page + light app surfaces
audience: UK final-year students and recent graduates; secondarily hiring managers
visual-language: friendly, confident "proof": white and light blue, navy ink, green only for "checked"
visual-variance: 6   motion-intensity: 3   information-density: 4   asset-dependence: 5
```

## Mode by surface
- Marketing (Home, Pricing, Universities): **Persuade**. The primary action is visible in the first viewport on every device.
- How to read a pack, Legal: **Read**. ~68ch measure.
- Roadmap builder/result, dashboard, editor, admin: **Operate**. White panels on sky, dense and calm.

## Colour
Built in OKLCH from one blue hue family (~240), following the garden-skills colour guidance, so tints, buttons and ink belong together.

| Token | Value | Use |
|---|---|---|
| `surface` | `#FFFFFF` | main ground (hero, most sections) |
| `sky` | `oklch(0.965 0.018 240)` | light-blue bands, the hero's right-hand field |
| `sky-2` | `oklch(0.915 0.045 237)` | chips, closing band |
| `blue` | `oklch(0.84 0.09 234)` | **primary buttons** (navy text), highlighter, rail nodes |
| `blue-press` | `oklch(0.79 0.11 236)` | button hover |
| `blue-edge` | `oklch(0.64 0.12 242)` | button border, focus ring |
| `ink` | `oklch(0.25 0.06 258)` | text; statement band; footer; buttons on light-blue bands |
| `ink-2` | `oklch(0.45 0.05 252)` | secondary text |
| `rule` / `field` / `quiet` | blue-tinted greys | hairlines / input borders / placeholders |
| `green` | `oklch(0.78 0.17 150)` | **accent only**: "checked" ticks |

**Rules**
- Buttons are light-blue pills with navy text and a deeper blue edge (visible on white). On a light-blue band the button switches to navy (`btn-ink`).
- Green appears only in the verification ticks. Never as text, decoration, a pattern or a section background.
- At most two colours per scene besides navy and white (garden-skills "Warm Humanist" guidance).

## Type
- Headlines: **Schibsted Grotesk 800**, tracking −0.03em, line-height ~1.02. Hero up to 4.9rem.
- Body and UI: Schibsted Grotesk 400/500/600.
- Inside packs only: **Newsreader** for the title, outcome and pack titles in lists. This marks "this is the document".
- Figures (word counts, weeks, dates): IBM Plex Mono. Never decorative.
- All self-hosted via `@fontsource`.

## Shape and depth
- Buttons and the start form are pills. Inputs, frames and panels 10–20px. Chips 6px. Packs keep 4px (a document).
- Shadows are soft and blue-tinted, only on raised artifacts.
- The hero's right side sits on a full-height light-blue field (layout, not a card), so the pack never sits in a nested container.

## Motion
One signature moment: on Home the example pack's three ticks fill green in sequence. Everything else is feedback only. Under `prefers-reduced-motion` the ticks render in their final state.

## Focus
3px mid-blue outline with a white gap and navy halo: visible on white, light blue, blue buttons and navy.

## Identity
Full rules, sizes and don'ts are in `docs/brand.md`. In short:
- **Mark** (`components/brand/Logo.tsx`): an exhibit frame broken at the lower right by its label. Frame in `currentColor`; label always light blue with a navy edge. `app/icon.svg` is the favicon.
- **Wordmark**: lower-case `exhbt`, Schibsted Grotesk 800. In running text the company is "Exhbt" and the pieces are "exhbts".
- **Catalogue numbers**: `EX·01`, `EX·02`… on tiles and full exhbts, from the exhbt's position in its portfolio (`catalogueNo` in `lib/exhbt.ts`). They are references an employer can use, so they're allowed; numbering marketing sections is still banned.
- **Seal** (`components/brand/Seal.tsx`): mark + "checked by exhbt" + date. Says the checks ran, not that results are true, so never "verified". Links to `/how-to-read-an-exhbt#checks` (except inside a tile, which is already a link).
- **Brand band**: the portfolio header is the page's one navy surface (`PortfolioHeader`, slim `PortfolioBar` above a single exhbt). White, `#c9d7e8` and the light-blue token on it; all at least 7:1.
- **Sign-off** (`MadeWith`): "Portfolio made with exhbt · Build your own roadmap" at the foot of every public portfolio and exhbt.

## Components
- `StartForm`: the role field + "Build my roadmap" button. GET to `/roadmap/new?role=`. Used in the hero and the closing band; the label never changes.
- `BrowserFrame`: adapted from garden-skills web-design-engineer; shows product screens as pages, not floating cards.
- `Exhbt` / `TrustBadge`: the fixed exhbt template. Order:
  1. catalogue number (when it sits in a portfolio), then who
  2. title (serif)
  3. one-line outcome
  4. **methodology flow**
  5. key-result chart
  6. skills as plain mono boxes, with no label
  7. the work, as an attachment row
  8. verification: the seal (with the date), then the three ticks
  9. reflection, small, in the footer

  The same card is used everywhere; there's no preview variant.
- `MethodFlow`: the methodology as a pipeline of 3–6 step boxes joined by arrows. The last step (the result) is filled navy. It lays out by its container (`@container` on the card): a row at 42rem or wider, otherwise a vertical pipeline. Step numbers (01–06) are allowed here because the order carries meaning. Rendered as an `<ol>` labelled "Methodology".
- **Monospace in the exhbt** is deliberate: tools, scales and skills are code-like, and it gives the card its technical feel. Don't spread mono to marketing copy.
- `BeforeAfterChart`: a dumbbell for before-to-after per measure (1–3 rows), drawn in one hue with two shades (`#6aa6ea` before, `#1a56b8` after). Both passed the dataviz palette validator (lightness band, chroma, CVD). Every value is printed beside its dot (the light shade is below 3:1 on white); legend for the two series; a hidden data table; the change is shown as a % on the right. No other chart colours without re-running the validator. The pair lives in `components/charts/series.ts`.
- `SkillRadar`: one axis per skill (3–6, fixed in the job's order), levels 0–4 from the centre. The same pair: "from" as a light fill, "to" as a dark outline. Grid in `rule`. Labels are HTML over the SVG and show skill names only: **no numbers** (the levels are AI estimates; Rory, 9 Nov 2026). The meaning is carried in words instead. "Level up next" skills get an ink arrow-up marker, and "In the bag" skills get the same green tick as the strengths screen; both are set in ink semibold. Under the chart, `SkillHighlights` lists the two groups (up to three skills each). One line gives where the skills came from (`SKILLS_SOURCE_NOTE`). A hidden data table holds every level. No animation. Radars exaggerate area, so don't add shading, gradients or a third series.

## Flow patterns
- **Click-through, not long pages**, for the roadmap builder and result. Marketing pages scroll normally.
- **Builder:** one question per screen inside a white card on sky. "Step N of 4" with a four-segment progress bar; Back (secondary) on the left, Continue (primary) on the right; the step is in the URL (`?step=`). Validation messages sit under the field and are announced. Step 2 (the CV) has a text button, "Skip for now", under the upload; it goes once a CV is in. Minimal words on every step: a title, the fields, at most one short line.
- **Result:** five views (`?view=`) in a white card. Pill tabs on desktop, "N / 5 · Label" on mobile; the bottom bar has the previous view on the left and the next view as the primary button. Each view has its own `h1`.
- **Waiting and failure:** the building screen has an indeterminate bar (static under reduced motion) and honest copy. Failure offers "Try again" and says the answers are saved.

## Email
Same palette in plain hex (email clients don't support OKLCH); table layout; one primary light-blue button. The header is the mark as a PNG (`public/brand/exhbt-mark.png`, since email clients strip SVG) beside the wordmark. Every email has unsubscribe and privacy links. Template: `lib/email/templates/roadmap-ready.ts`; preview locally at `/dev/emails`.

## Banned
Eyebrow labels; decorative 01/02/03 numbering; icon+heading+text card grids; hero stat strips; fabricated metrics, testimonials or logos; gradients (the highlighter is a flat stroke); glass; emoji icons; stock photos of people; carousels; three or more consecutive left/right zigzag sections (garden "zigzag monotony"); a large headline beside a small floating paragraph (garden "split-header filler"); different labels for the same action.
