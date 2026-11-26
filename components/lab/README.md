# The design lab

Design mock-ups for Rory and Alex to choose from (26 Nov 2026): real pages built with the real components on sample data, at `/lab/design`. Not part of the product. The chosen version is promoted into the real pages afterwards.

## Where it answers

Only in development, and where `EXHBT_LAB=1` (the preview Worker, set in `wrangler.jsonc`). On the live site every lab address is not found. The rule is `labEnabled()` in `server.ts`, called by `app/lab/design/layout.tsx` on each request. The layout also marks every lab page noindex.

No sign-in, no database, no AI. Sample data only: `samples.tsx`.

## What a lab page gets for nothing

A page under `app/lab/design/` is already inside:

1. the proposed theme (`themes/exhbt-next`), through a nested Astryx `Theme` in `LabFrame.tsx`;
2. the lab's root element, `<div data-lab-root data-level="…" data-motion="on|off">`;
3. the lab bar (`LabBar.tsx`).

So a page starts at `<main id="main">` and uses Astryx components directly. It never renders `Theme` itself and never imports the theme.

## Level and motion

| Where | How |
|---|---|
| CSS | `[data-level="restrained"] .thing`, `[data-level="maximal"] .thing`; confident is the default and needs no selector. |
| A server component | `const { level, motion } = await readLab()` from `@/components/lab/server`. |
| A client component | `const { level, motion, moves } = useLab()` from `@/components/lab/LabFrame`. `moves` is false when Motion off is set or the device asks for less motion; script-driven motion checks it. |
| A test or a screenshot | Cookies on `/lab/design`: `lab-level=restrained|confident|maximal`, `lab-motion=off`, `lab-bar=hidden|none`. |

Every authored animation is written so that the resting style is the finished state, and inside both guards:

```css
@layer components {
  @media (prefers-reduced-motion: no-preference) {
    [data-motion="on"] .thing {
      animation: thing-in var(--duration-slow) var(--ease-entrance) both;
    }
  }
}
```

Scroll-driven CSS also goes inside `@supports (animation-timeline: view())`. Nothing loops.

Motion off also drops the theme's duration tokens to 1ms on the lab's root, so every transition that reads them is still, Astryx's own included. It can't reach motion Astryx runs from script under a finger (a sheet's drag, a segment's slide).

## CSS

All lab CSS is inside a cascade layer (`@layer components { … }`, or `@layer base`). `app/globals.css` declares the layer order, and CSS outside a layer beats every layer, Tailwind's utilities included.

The Tailwind bridge to Astryx's tokens isn't loaded in this repo, so use the tokens through arbitrary values (`shadow-[var(--shadow-high)]`, `duration-[var(--duration-medium)]`, `rounded-[var(--radius-container)]`) or in a layered stylesheet. The site's own colour utilities work as everywhere (`bg-mint`, `text-jade`, `border-line`).

Inside the lab the site's `--radius` and `--radius-sm` are re-pointed at the theme (`lab.css`), so `rounded-[var(--radius)]` in a real component follows it. Tailwind's `shadow-pack` utility does not read a variable, so it stays today's shadow everywhere except on a `Frame`, where `lab.css` sets the theme's `--shadow-high`. For a raised thing of your own, write `shadow-[var(--shadow-high)]`.

`.lab-content` (`lab.css`) is the one content line: the theme's content width and gutter (`--exhbt-content-width`, `--exhbt-gutter`). The themed `TopNav` pads itself to the same edge, so a page whose content sits in `.lab-content` lines up with the bar above it at every width.

## The work, and today

- `Frame` (`Frame.tsx`): a person's page in the site's real browser frame. The one thing in the flow of a page that casts a shadow.
- `PersonPage` (`LabFrame.tsx`): puts a person's own page back under today's theme and tokens. `Frame` uses it. A person's page is never restyled by the lab.
- `SampleExhbt`, `SamplePortfolio`, `sample`, `lookOf`, `exhbtOf`, `sectionsAll` (`samples.tsx`): the made-up person from `/demo`, drawn by the real `ProjectView` and `PortfolioHome` in any of the eight looks.
- `Today` (`LabFrame.tsx`): wraps a sample of the site as it is now, for a comparison.

## Files

| File | What it is |
|---|---|
| `lab.ts` | Levels, cookie names, the list of screens. Plain data. |
| `server.ts` | `labEnabled()`, `readLab()`. Server only. |
| `LabFrame.tsx` | `LabFrame`, `useLab()`, `Today`, `PersonPage`. |
| `LabBar.tsx` | The lab bar. |
| `lab.css` | The lab's root, the three levels' tokens, Motion off, the bar. |
| `Frame.tsx`, `samples.tsx` | The raised frame and the sample data. |
| `Coming.tsx` | The placeholder a screen shows until it is built. |
| `kit/` | The kit page's sections. |
