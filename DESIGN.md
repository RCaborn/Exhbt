# Exhbt design system

## Idea
Proof, with warmth. A white and light-blue world, navy ink, light-blue pill buttons, and one fresh **green** used only for the ticks that mean "checked". The evidence pack itself stays a sober document (serif, square edges) so it reads as *evidence* inside a lively site.

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

## Components
- `StartForm`: the role field + "Build my roadmap" button. GET to `/roadmap/new?role=`. Used in the hero and the closing band; the label never changes.
- `BrowserFrame`: adapted from garden-skills web-design-engineer; shows product screens as pages, not floating cards.
- `Pack` / `TrustBadge`: the fixed template; green-filled ticks with navy marks. `variant="preview"` shows title, outcome, results and the work (hero only).

## Banned
Eyebrow labels; decorative 01/02/03 numbering; icon+heading+text card grids; hero stat strips; fabricated metrics, testimonials or logos; gradients (the highlighter is a flat stroke); glass; emoji icons; stock photos of people; carousels; three or more consecutive left/right zigzag sections (garden "zigzag monotony"); a large headline beside a small floating paragraph (garden "split-header filler"); different labels for the same action.
