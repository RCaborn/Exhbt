# Exhbt design system

## Idea
An evidence pack is an exhibit label: a short, fixed, factual card that sits next to the real work. The whole site borrows that voice. It's sober, editorial and exact, and lets the content carry the weight. Every pack looks identical so a reader learns the layout once.

## Mode by surface
- Marketing pages (Home, Pricing, Universities): **Persuade**. One idea per section, the real artifact always visible.
- How to read a pack, Legal: **Read**. Narrow measure (~68ch), clear headings.
- Roadmap builder/result, dashboard, editor, admin: **Operate**. Dense, quiet, keyboard-first.

## Colour (light only; readers are in daylight on laptops and phones)
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F1F2F0` | page ground: cool stone, deliberately not cream (cream is a recognised AI default) |
| `--surface` | `#FFFFFF` | packs, forms, raised items |
| `--ink` | `#16161A` | text, primary rules |
| `--ink-2` | `#4F534D` | secondary text (≥4.5:1 on paper) |
| `--rule` | `#D8DBD6` | hairlines, borders |
| `--field` | `#A3A8A1` | form field borders (3:1 non-text contrast) |
| `--quiet` | `#646862` | placeholders, disabled marks |
| `--verify` | `#1E4D3B` | trust badge, confirmed states, primary button. Nothing else. |
| `--verify-tint` | `#E4ECE6` | badge ground |
| `--error` | `#8A2A1F` | errors, flags |

No purple, cyan, gradients, glass, glow or gradient text.

## Type
- Display: **Newsreader** 400/500 (headlines, pack titles, outcome lines).
- Text and UI: **Schibsted Grotesk** 400/500/600.
- Figures only (word counts, prices in tables, dates on packs): **IBM Plex Mono** 400. Never as decoration.
- Self-hosted via `@fontsource`. Body 17px/1.55; headlines set tight (-0.01em), no all-caps labels.

## Shape and depth
- Radius 4px maximum; most edges square.
- 1px hairline rules carry structure. Shadow only on the raised pack: `0 1px 2px rgb(22 22 26 / .06), 0 8px 24px rgb(22 22 26 / .06)`.

## Motion
Buttons press (translateY 1px), links draw their underline, focus rings are 2px `--verify` with 2px offset. Nothing loops. Everything honours `prefers-reduced-motion`.

## Banned
Eyebrow/kicker labels above headings; 01/02/03 numbering for decoration; grids of icon+heading+text cards; big-number stat strips; coloured left-border callouts; emoji or Unicode icons; stock photos of people; shader or animated backgrounds; carousels.

## Icons
Lucide, 1.5px stroke, 16–20px, only where the icon adds information (file type, external link, check).

## The pack (fixed template)
Title (≤80 chars) · Outcome (1 sentence) · Method (2 sentences) · Results (3 lines) · Underlying work (one link) · Reflection (2 sentences) · Trust badge. About 200 words in total. Same layout everywhere; no user styling.
