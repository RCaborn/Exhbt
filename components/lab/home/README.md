# The lab's Home screen

The home page as a design mock-up (`/lab/design/home`), for Rory and Alex to choose from before it is promoted into `app/(marketing)/page.tsx`. Real components on the made-up person's sample data; no sign-in, no database, no AI, and nothing typed is sent anywhere. The lab's own rules are in `components/lab/README.md`; this screen follows them and touches nothing outside `app/lab/design/home/` and this folder.

## The story

The agreed story is decision 0033's seven beats (`docs/design/for-rory-appeal.md` on `phase-2-appeal-plan`). The page tells it in this order:

| # | Beat | The proof on screen | File |
|---|---|---|---|
| 1 | A website of your own, built from your projects. | Her real portfolio (`PortfolioHome`) in the first screen at both widths; from confident, your name in its address | `Hero.tsx` |
| 2 | One project, one page. | One real exhbt (`ProjectView`), the width of the page, that puts itself together as it scrolls into view, its four parts named in a row under it | `Assemble.tsx` |
| 3 | One page, eight looks. | The same page, with your name, through the eight looks; the names are the control | `Looks.tsx` |
| 4 | A CV says it. An exhbt shows it. | A CV's line beside that project's exhbt, and what an employer sees | `Employer.tsx` |
| 5 | Start with the file you already have. | The file, the first draft with its note, the page live at its address (a film at maximal) | `HowItWorks.tsx`, `Film.tsx`, `steps.tsx` |
| 6 | Not sure what to make? Build your roadmap. | The real radar beside the job field | `Roadmap.tsx` |
| 7 | Free to start. Pay to put it online. | A line with the prices (from `lib/entitlements.ts`), and Draft beside Live | `Prices.tsx` |
| | The close | The address, with your name, on the page's one ink band, and the one action | `Close.tsx` |

Where it departs from the agreed seven: "An address that's yours" (beat five there) is split. The typing moved into the hero, as the job asked, and the looks came up to third, straight after the exhbt, as the job's own order has them. The CV beat carries "what an employer sees". The questions (FAQ) are left out; the prices link to the pricing page.

## What each level adds

The level's own token values (type sizes, curves, durations, the frame's shadow) come from `components/lab/lab.css`. What the screen contains:

| | Restrained | Confident | Maximal |
|---|---|---|---|
| The hero's highlighter stroke, drawn once on load | yes | yes | yes |
| The exhbt that assembles as it scrolls (moment 2) | yes | yes | yes |
| "Your name" in the hero, the address and the page take it | | yes | yes |
| The eight looks pinned and led by the scroll | | yes | yes |
| "How it works" as a film the scroll plays | | | yes |
| The hero's page works: its best project opens into its exhbt, the title travelling (a shared-element view transition) | | | yes |

At restrained the looks are still there, picked by hand only. With Motion off (the lab bar), the device's reduced-motion setting, or a browser without scroll timelines, everything rests in its finished state: the exhbt whole, the looks unpinned, the still steps instead of the film.

## How the moments are built

- **The stroke** (`.hl-stroke`, home.css): the site's `.highlight`, one span a word, each word's draw taking its share of `--duration-slow` by its length, so the stroke runs across the line breaks in reading order. A CSS animation, so it runs once, when the page first draws.
- **The exhbt assembles** (`.hl-assemble`): one named view timeline, `--hl-exhbt`, on the frame's wrapper (the frame's own clipping boxes would capture a plain `view()`), read through `timeline-scope` by the parts' names beside it. The targets are hooks the page already has: `.xp-mark`, `.xp-flow > li` and the last box, the graph's connector and after dot under `[data-part="graph"]`, and `.xp-tick`. `ProjectView` isn't touched.
- **The looks** (`Looks.tsx`): `position: sticky` on the stage, one marker per look in the track behind it, one `IntersectionObserver` watching the middle of the screen, and `document.startViewTransition` (type `hl-look`) that names only the page in the frame, so the rest of the page stays live while it scrolls. A radio pressed by hand latches: the scroll leaves the look alone until the scene has left the screen. Nothing advances by itself.
- **The film** (`Film.tsx`): a section several screens tall whose stage sticks; one named view timeline, `--hl-film`, and its `contain` range (the stretch while the stage is stuck) split into scenes.
- **The tile** (`HeroPage.tsx`, maximal): the hero's frame becomes a working window. Its links are caught; "See how I did it" swaps the page for the exhbt inside `document.startViewTransition` (type `hl-open`), with the band's title and the exhbt's title given one `view-transition-name`, so the title travels; "All of her work" comes back. Only the frame's page is captured, so the rest of the page stays live.
- **The name** (`address.ts`, `HomeName.tsx`): lower case, accents and apostrophes dropped, ł, ø, ß and the like spelt out, a hyphen between words, at most 30 characters cut at a word, then `usernameProblem()` from `lib/hosts.ts`. An address the rule refuses is never shown; the pictures keep the made-up person's and a line says what the address needs. The address is read out by Astryx's `useAnnounce` once typing pauses.

## Promoting it

What it would replace, and what to watch, is in the screen's report (26 Nov 2026). In short: `app/(marketing)/page.tsx` and `components/home/` (`LookPreview`, `HowItWorks`, `SkillsGapExample`), on the real theme once `themes/exhbt-next` is promoted. The home page then holds two `[data-portfolio-home]` (the hero's and the looks') and its look radios are Astryx radios without a wrapping `label`, so the `home-look-*` targets in `e2e/portfolio-parity.spec.ts` need their root scoped to the looks scene and their click moved to the radio; the golden copies themselves don't change, because the looks draw her page with today's props. The helpers here (`address.ts`) belong beside `lib/hosts.ts`.
