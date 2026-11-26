# The proposed Exhbt theme ("the voice")

Used only inside the design lab (`/lab/design`). The live site's theme is `themes/exhbt/` and is not changed by anything here.

| File | What it is |
|---|---|
| `exhbtNextTheme.ts` | The source. It extends today's theme (`../exhbt/exhbtTheme.ts`), so the brand's colours and the pill button keep one owner. |
| `exhbt-next.css` | Built. Every rule is scoped to `[data-astryx-theme="exhbt-next"]`, so it does nothing outside the lab. |
| `exhbt-next.js` | Built. The theme object for Astryx's `Theme`. |
| `exhbt-next.variants.d.ts` | Built. Types for what the theme adds: `<Heading type="hero">`. |
| `index.ts` | Hand-written. Exports the built theme with its type. Import the theme from here. |

## Rebuild

After any change to `exhbtNextTheme.ts`:

```bash
npm run astryx -- theme build themes/exhbt-next/exhbtNextTheme.ts && rm themes/exhbt-next/exhbt-next.d.ts
```

The build also writes `exhbt-next.d.ts`. It is deleted because its triple-slash reference fails `npm run lint` anywhere but `themes/exhbt/` (the lint config ignores generated files only there, and the lab changes no existing file). `index.ts` gives the theme the same type. When this theme becomes the real one it moves into `themes/exhbt/`, where `npm run theme` builds it and nothing needs deleting.

## Use

```tsx
import { Theme } from "@astryxdesign/core/theme";
import { exhbtNextTheme } from "@/themes/exhbt-next";
import "@/themes/exhbt-next/exhbt-next.css";

<Theme theme={exhbtNextTheme} mode="light">…</Theme>
```

Inside the lab this is already done: `app/lab/design/layout.tsx` loads the stylesheet and `components/lab/LabFrame.tsx` renders the `Theme`. A lab page does nothing to get it.

## What it sets

The kit page (`/lab/design/kit`) shows all of it beside today's. In short:

- **Type**: ratio 1.25 from 16px. `Heading type="display-1|display-2|display-3"` are semibold and set tight (61, 49 and 39px; 48, 40 and 33px below 640px). `Heading type="hero"` is Home's own step, `--exhbt-hero-size`.
- **Motion**: `--duration-fast` 140ms (feedback), `--duration-medium` 320ms (something arriving), `--duration-slow` 720ms (a moment that is watched); `--ease-entrance` and `--ease-move` overshoot a little, `--ease-exit` never does.
- **Shadow**: `--shadow-high` is the work's (the site's `shadow-pack`) and a dialog's; `--shadow-med` a toast's; `--shadow-low` a menu's or popover's. Nothing else in the flow of a page is raised.
- **Rings**: focus is `--focus-outline-*`, 3px jade, 2px clear; a chosen thing takes an ink edge (`--shadow-inset-selected`). Neither is ever blue.
- **Radius**: `--radius-inner` 8, `--radius-element` 14, `--radius-container` 20, `--radius-page` 28; buttons, tokens and the segmented control are pills.
- **Status**: go, live and checked are mint and jade; information is ink on mist; a warning is ink with an edge; an error is the one red. The categorical colours Astryx offers (blue, purple, orange and the rest) all come out grey.
