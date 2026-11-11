Status: accepted
Date: 9 Nov 2026

# Mint brand, Astryx for buttons, and Haiku as the only model

## Brand
The site takes the look of brand kit v1 (9 Nov): mint `#4FE9B4`, jade `#00755D`, ink `#0E0F12` on white, with neutral greys; Bricolage Grotesque for display and Inter for everything else. It replaces the blue palette and Schibsted Grotesk. Rory ruled out blue, purple and orange, and said the colours are the fixed part: the rest can be improved.

Choices made within that:
- The logo is the kit's Frame route. The kit hadn't picked between Frame and Stack; its in-use example shows Frame. It is still a sketch, and the trade mark search is still to do.
- The kit's web type scale stops at 48px. Marketing pages add two larger display steps, because a 48px opening line read as timid.
- Two typefaces only. The serif and the mono face are gone; figures use Inter with tabular numbers.
- Charts use mint and jade, the brand's one hue in two shades. This was checked by contrast maths, not re-run through the dataviz validator.
- The home page's three-panel rail is replaced by one step a section, on one content width.

## Astryx
`@astryxdesign/core` (Meta's open-source design system; beta, MIT, React 19) is installed with an Exhbt theme (`themes/exhbt/`). **Buttons** are the first thing moved onto it, through `components/ui/Button.tsx`. Fields, tags, cards and charts stay the site's own for now.

Why only buttons: Astryx is in beta, its stylesheet adds about 42 KB (compressed) to every page, and moving form fields changes the markup the end-to-end tests rely on. Buttons were 18 usages and a clean swap. The rest can move one component at a time.

Costs to know: the theme's built files are committed and `npm run check` fails when they're stale; a major Astryx release may need its codemods (`npm run astryx -- upgrade`).

## Haiku only
Every AI call uses Claude Haiku (`claude-haiku-5-5`), named once in `lib/ai/model.ts`. `npm run check:docs` fails if the app's code names any other Claude model. The key itself is the `ANTHROPIC_API_KEYS` secret on the Cloudflare Worker; without it the live site refuses to generate, and it never falls back to placeholder roadmaps.
