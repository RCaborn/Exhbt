Status: accepted
Date: 13 Nov 2026

# Portfolio looks

Rory's call: a small library of options for different kinds of person, close to the brand kit. A few fonts, a few colours, a smaller set for Premium and a wider one for Max, and everyone can change their profile photo.

## What a look is

One entry in `PORTFOLIO_THEMES` (`lib/portfolio-themes.ts`): the band's ground, its text colours, an accent for labels and link hovers, the heading face and the photo shape (round or rounded square). There are sixteen, in the order they unlock. Nobody picks colours or mixes parts, so each combination is checked once and a portfolio can't end up unreadable or off-brand.

- Colours are the tokens in `DESIGN.md` plus one darker jade, `#00513F`, used only as a band ground (documented in `DESIGN.md` and `docs/brand.md`).
- Heading faces: Bricolage Grotesque (the default), Inter Tight, Space Grotesk and Fraunces. The three extra faces load with `next/font/google` in `components/portfolio/themeFonts.ts`, 600 weight and latin only, with no preload, so a browser fetches one only when a heading on the page uses it. Body text is Inter in every look. This is the one place the site shows a face outside the kit, and Fraunces is its only serif; `DESIGN.md` says so.
- Every text on every band must reach WCAG AA. `e2e/phase2-themes.spec.ts` computes the contrast of each look's pairings, so a new look can't land below it.

## Who gets what

`portfolioThemes` in `lib/entitlements.ts` says how many looks, counted from the start of the list, a plan can use: the default alone on Free, a set on Premium, and `"all"` on Max and for universities. The pricing page lines read it through `planFeatures()`. Adding a look at the end of the list gives it to Max only and changes nothing for Premium. Moving the order would change who has what, so don't.

## Keeping a choice through a downgrade

The profile stores the chosen look's id (`profiles.portfolio_theme`, nullable; null means the default). `themeFor(profile, plan)` returns the chosen look if the plan has it, else the default. Nothing clears the stored id, so someone who drops to a smaller plan sees the default on their portfolio and the settings page says their look is held, and it comes back when they upgrade. Saving checks the plan on the server (`saveThemeAction`), not only in the picker. An id that no longer exists falls back to the default.

## Where it shows

- The portfolio's top band (`PortfolioHeader`, and `PortfolioBar` when it is given a look) takes the colours and photo shape. The band stays inside the framed panel; a full-width band is separate work.
- The heading face reaches the whole project page through `--font-display` on a wrapper in `app/(portfolio)/p/[username]/[slug]/page.tsx`.
- `Avatar` takes a `shape` prop, round by default.
- Settings, "Look" on `/account/portfolio`: a live preview of the band, then a grid of looks as a radio group. A look the plan doesn't have still previews and shows a lock; choosing it shows the usual upgrade prompt instead of the save button.

The profile photo upload already existed and is open to every plan.

## Not decided here

Per-job links (Max) don't use a look yet. Print styles are unchanged: the band prints as it shows.
