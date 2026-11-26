# Brief 1a: the theme, so every Astryx part arrives in Exhbt's voice

| | |
|---|---|
| Phase | 1, the theme foundations |
| Model | Opus |
| Branch | `phase-2-appeal-1a-theme`, made from `phase-2-appeal` |
| Port | 3351 |
| Starts when | The main session has cut `phase-2-appeal` from `main`, with `origin/phase-2-add-exhbt` and `origin/phase-2-design-lab` merged in (or see step 1). Tonight. Milestone 2 waits for Rory's choice in the lab, or the defaults in decision 0033 at midday on Saturday 28 Nov |
| Hours | About 5: milestone 1 about 3, milestone 2 about 2 |

## Goal

The real theme sets the brand's colours and a pill button and nothing else. So any other Astryx component arrives looking like neutral Astryx: a blue selection ring, a blue information colour, a mint focus ring that cannot be seen on white, a 28px page heading and a display step in a regular weight.

The main session's design lab already holds the answer: a proposed theme, `themes/exhbt-next/exhbtNextTheme.ts`, that sets the display type, the rings, the status colours, the shadows, the motion and a style for every component the lab's screens use. It is safe there because every rule is scoped to the lab's own pages.

Your job is to make it the real theme, `themes/exhbt/exhbtTheme.ts`, without moving a page a visitor reads by half a pixel and without changing what a student sees before Rory has chosen. The real theme is not scoped: it wraps every route, public pages included. Read "What you build against" before you change a line.

## Read first

`docs/decisions/0033-astryx-is-the-design-guide.md` (all of it; "The theme reaches visitors' pages", the six, and "Not decided" items 1 and 11 are your specification). `docs/design/appeal-plan.md` ("Rules that keep visitors' pages and live data safe"). `DESIGN.md` (Colour, Type, Shape and depth, Motion, Focus, Design system). `docs/brand.md`. `docs/decisions/0005-brand-astryx-and-haiku.md`. `themes/exhbt-next/README.md` and `themes/exhbt-next/exhbtNextTheme.ts` (in your base if the lab was merged; otherwise `git show origin/phase-2-design-lab:themes/exhbt-next/exhbtNextTheme.ts`). With the CLI: `npm run astryx -- docs author-a-theme --full`, `docs motion`, `docs elevation`, `docs color`, `docs typography/type-scale`, `docs tokens/tokens-focus`, `theme targets`. Then the code: `themes/exhbt/exhbtTheme.ts`; `themes/exhbt/exhbt.css` (the built file: read its `@layer reset` block and the `:scope` block under it); `app/globals.css` lines 1 to 125 (the layer order, the `@theme` block, the base layer) and its `.xp .xp-work-button` rule; `app/layout.tsx`; `app/providers.tsx`; `components/ui/Button.tsx`; the header comments of `e2e/portfolio-parity.spec.ts` and `e2e/layout-parity.spec.ts`.

## You own

`themes/exhbt/exhbtTheme.ts`, and the five files `npm run theme` writes beside it (`exhbt.css`, `exhbt.css.d.ts`, `exhbt.d.ts`, `exhbt.js`, `exhbt.variants.d.ts`). You never edit those five by hand, and nobody merges them by hand: after any merge that touches the theme, run `npm run theme` and commit what it writes.

## You must not touch

`themes/exhbt-next/` and everything under `app/lab/` and `components/lab/`: the lab is the main session's, and it must go on working while you move its theme across (it extends the real theme, so what you add it simply inherits). `app/globals.css` (its `@theme` block, its base layer and its `.xp-*`, `.pf-*` and `[data-look]` rules are what visitors' pages are drawn from). `app/layout.tsx`, `app/providers.tsx`. `components/ui/` (`Button.tsx` is frozen; the new files are 1b's). `app/dev/astryx/` (1b's). `lib/portfolio-themes.ts`. Any spec, any golden copy. Everything in the README's frozen list.

## What you build against

**The theme reaches visitors' pages.** Three facts from `main`:

1. `app/layout.tsx` wraps every route, `/p/*` included, in `Providers`, which is the Astryx `Theme`.
2. The built `exhbt.css` has, in `@layer reset`, rules for bare `h1` to `h6`, `p`, `small`, `code`, `pre` and `hr` inside the theme's scope, each reading tokens (`--text-body-size`, `--text-body-leading`, `--text-heading-4-size`, `--text-supporting-size`, `--font-family-heading`, `--color-text-primary`, `--color-border` and the rest). `app/globals.css` says as much where it resets a look's text colour: "Astryx's reset on every paragraph".
3. The public exhbt page draws one Astryx `Button`: "See the work" (`components/portfolio/ProjectView.tsx`, with the class `xp-work-button`).

CI compares only markup on the parity specs. Boxes are compared only where the golden copies were written, which is this sandbox. So you are the check.

**So the lab's theme sorts into two piles.**

*Pile one: only Astryx's own components read it. Take it in milestone 1.* The four `--focus-outline-*` tokens; every `--shadow-*` token; the status colours (`--color-info*`, `--color-success*`, `--color-warning*`, the error additions) and the greyed categorical colours; the grounds and lines it re-sets (`--color-overlay*`, `--color-skeleton`, `--color-track` and the rest); the radius tokens; `motion`; `localTokens` and the `type:hero` heading; `onDark`; the display steps' weight, leading and tracking; and every `components` entry except `button`.

*Pile two: a visitor's page, or a screen a student uses today, can feel it. Leave it for milestone 2.*
- `typography.scale` (the lab's ratio is 1.25; today's is 1.2), the two `adaptations` rules that set a scale, and `typography.heading.weight`. They change the font sizes and weights the reset layer gives bare text on every page.
- The size and leading of `Heading` levels 1 to 3. `phase-2-add-exhbt` sets them to the site's 48, 32 and 22px, so a page built from Astryx headings reads like today's; the lab's scale gives 31, 25 and 20px under its display steps. Both cannot hold, and which one does is Rory's choice (0033, "Not decided", item 11).
- The `button` block's additions (the primary's hover colour, the ghost's text, the destructive pair). 85 files and one public page draw that button.
- Leave exactly as they are in both milestones: `--color-text-primary`, `--color-text-secondary`, `--color-border`, the three `--size-element-*` tokens, the three font families, and the `button` block's size, padding, radius, border and weight.

**What `phase-2-add-exhbt` added to the real theme.** It should be in your base. If it is not, add it word for word before anything else:

```ts
// in tokens:
    // Astryx's Heading takes the site's one heading scale (h1 to h3 in app/globals.css: 48, 32 and 22px),
    // so a page built from <Heading> reads the same as a page of plain headings. Phones step down below.
    "--text-heading-1-size": "3rem",
    "--text-heading-1-leading": "1.05",
    "--text-heading-2-size": "2rem",
    "--text-heading-2-leading": "1.1",
    "--text-heading-3-size": "1.375rem",
    "--text-heading-3-leading": "1.15",

// a new field after tokens:
  // The same step the site's headings take below 640px: h1 to 36px and h2 to 28px.
  adaptations: {
    rules: [{ when: { width: { below: "sm" } }, value: { tokens: { "--text-heading-1-size": "2.25rem", "--text-heading-2-size": "1.75rem" } } }],
  },

// in components, after button:
    // The display face's tracking, as the site's h1 to h3 have it.
    heading: {
      "level:1": { letterSpacing: "-0.03em" },
      "level:2": { letterSpacing: "-0.03em" },
      "level:3": { letterSpacing: "-0.02em" },
    },
```

Those six heading tokens equal what the site's base layer already sets on `h1` to `h3`, and the base layer wins over Astryx's reset, so they move no bare heading. Keep them through milestone 1. Where the lab's `heading` entry and add-exhbt's both set a key, add-exhbt's stands until Rory has chosen.

**Astryx facts that decide how you write it.**
- Explicit `tokens` win over a scale; a duration scale wins over `tempo`. The neutral theme you extend sets durations only (`{fast: 125, medium: 300, slow: 700, ratio: 0.75}`), and the built file has no `--ease-*` token today.
- A component's theming keys are in `npm run astryx -- theme targets`; its public variables are in `npm run astryx -- component <Name>`, under Theming. A public variable the component does not define compiles to CSS that never applies and the build does not warn; a private one (`--_…`) fails the build. The lab's theme was built against the same version, so its keys should hold, but check any you change.
- The lab's theme extends the real one; the real one extends the neutral theme. Moving a setting across means writing it into `themes/exhbt/exhbtTheme.ts`. Leave the lab's copy where it is: a duplicate there is harmless, and the main session trims it when you report.
- The site is light only: both halves of a colour pair are the light value.

## Steps

Commit and push after each.

**Milestone 1: everything no visitor's page can feel** (merged before 2a builds on it)

1. **Your base.** Check `exhbtTheme.ts` holds add-exhbt's lines above. If not, add them, run `npm run theme`, commit.
2. **Before you change anything, take the "before".** Run `e2e/portfolio-parity.spec.ts` and `e2e/layout-parity.spec.ts` with `CI` unset, then `e2e/exhbt-page.spec.ts` and `e2e/phase2-looks.spec.ts`. They should pass. If a box check fails on the untouched branch, the machine is under load or the goldens were written elsewhere: note exactly which targets fail, and hold your "after" to that same list. Then photograph keyboard focus, at deviceScaleFactor 2: a primary and a secondary `Button` on `/pricing`, and "See the work" on a published exhbt page in each of the eight looks (the fixtures `e2e/phase2-looks.spec.ts` seeds will give you the pages). If `e2e/add-exhbt.spec.ts` is in your branch, photograph `/exhbts/new` too: it is the one real screen built from Astryx, so the one a student could see change.
3. **Move pile one across,** a group at a time, building and committing after each: the focus tokens; the selection and status rings; the status and categorical colours; the grounds and lines; the shadows; the radius tokens; `motion`; `localTokens` and `type:hero`; `onDark`; then the `components` entries, all but `button` (and, in `heading`, only the keys add-exhbt does not already set).
4. **The display steps, without the scale.** The lab gets its display sizes from the ratio you are not taking yet. Set them outright, as explicit tokens: `--text-display-1-size` 3.8125rem, `--text-display-2-size` 3.0625rem, `--text-display-3-size` 2.4375rem; and in the `below: "sm"` rule that is already there, 3rem, 2.5rem and 2.0625rem. Those are the lab's 61, 49 and 39px, and 48, 40 and 33px on a phone. Weight, leading and tracking come across with pile one.
5. **Check the focus ring where it matters.** Photograph the elements of step 2 again. The app's ring must now be jade: Astryx's default takes the accent, which is mint, at 1.5:1 on white. On the public page's button the ring must be no worse than before in any look. If in Night, Studio or any other it loses contrast against its ground, put the focus tokens back and report it: the cure is in the looks' own variables, which you do not own. The lab's `onDark` block turns the ring mint on a dark surface; say whether that reaches a dark look or only Astryx's own dark surfaces.
6. **Check the motion took.** Search the built `exhbt.css`: `--duration-fast`, `--duration-medium` and `--duration-slow` must read the lab's 140ms, 320ms and 720ms, and `--ease-entrance` and `--ease-move` should now be in the file. If the curves are not there, `character` did nothing: say so, and do not force it with a curve of your own.
7. **Check no blue is left where a person can meet it.** In the built file, `--color-info`, `--color-text-info`, `--shadow-inset-selected` and `--shadow-inset-hover` must hold no blue. Work out the contrast of each status pair (text on its pale fill, text on its strong fill) and put the figures in your report.
8. **Build and prove.** `npm run theme`, `npm run check:theme`, and the four visitor specs of step 2 again, with boxes. The results must equal the "before". Photograph `/exhbts/new` again if you could before, and say what changed on it. Push, and tell the main session milestone 1 is in.

**Milestone 2: what a visitor's page can feel** (after Rory's choice)

9. **The type scale.** Try the lab's `typography.scale` (ratio 1.25), its two scale rules in `adaptations` and `typography.heading.weight`. Build, then run the four visitor specs with boxes. If every box is where it was in every look, keep them, take out step 4's explicit display sizes, and say so. If one box moves, put the scale back, keep step 4's sizes, and report which element moved and by how much: the display type is the same either way.
10. **A page's own heading.** If Rory chose the lab's sizes (31, 25 and 20px), take the lab's heading tokens and leadings in place of add-exhbt's, and photograph `/exhbts/new` before and after. If he chose today's, or said nothing, change nothing.
11. **The button.** Take the lab's three additions to `button` one at a time. After each, the four visitor specs, `e2e/landing.spec.ts`, and a photograph of "See the work" at rest, on hover and focused in three looks. The public page's button has its own hover rule, so it should not change: prove it.
12. **Look at all of it** on 1b's `/dev/astryx` at 1440 and 390, beside the lab's Kit page at the same level. They should match. Anything that still reads as another product's control is not done.
13. **Prove it again:** step 2's list, `e2e/a11y.spec.ts`, `e2e/landing.spec.ts`, and `e2e/add-exhbt.spec.ts` if present.

## Done looks like

Every Astryx component the plan names can be dropped onto a page and read as Exhbt with no local styling, exactly as it does in the lab. The built stylesheet's information colour and selection ring are no longer blue. A focused control in the app shows the jade ring. Both parity specs pass with boxes exactly as they did before your first change. After milestone 1 no screen a student can reach looks different, except, as you report it, the focus ring and the "Add an exhbt" chooser.

## Report back

The branch head after each milestone. A table of what moved across in each group, and anything in the lab's theme you left behind, with why. The visitor specs before and after. The focus photographs, named, and what `onDark` does on a dark look. The duration tokens and curves before and after. The contrast figure for each status pair. For milestone 2: whether the scale was kept, and the box that decided it. What the main session can now delete from `themes/exhbt-next/`. Anything in `app/globals.css` you would change if you owned it.

Run: `e2e/portfolio-parity.spec.ts`, `e2e/layout-parity.spec.ts`, `e2e/exhbt-page.spec.ts`, `e2e/phase2-looks.spec.ts`, `e2e/a11y.spec.ts`, `e2e/landing.spec.ts`, and `e2e/add-exhbt.spec.ts` if present.

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, and the decision records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `main` or a release branch (`phase-2-appeal`, or the portfolio build's `phase-2-pf0` to `phase-2-pf4`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. An Opus agent ends with these two lines:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`
   Any other model names itself in the first line and keeps the second as written.
8. **House rules that bite here:** on a person's own page, colours, faces and corners come only from the look's variables (`--pf-*`, `--xp-*`); everywhere else every control is an Astryx component in the theme's tokens, with no fixed colour, pixel size or timing; buttons are Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose or in a UI string (read them from `lib/entitlements.ts`); Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface; never edit an applied migration; never commit a secret.
9. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
10. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
11. **Never run anything that calls the Anthropic API.** Do not set `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEYS`.
12. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), never regenerate a golden copy, and keep to the frozen list in this folder's README. The theme, `app/layout.tsx` and `components/ui/Button.tsx` all reach a page an employer reads.
13. **Read Astryx before you build with it.** `docs/design/astryx-agent-guide.md`, then `npm run astryx -- docs principles`. Read each component you use with `npm run astryx -- component <Name>`: take prop names, theming keys and public variables from there, never from memory or from a review. `npm run astryx -- theme targets` lists every theming key. The installed version is 0.7.11; do not raise it.
14. **Look at what you build.** Open it in the browser at 1440 and at 390 wide, take screenshots (deviceScaleFactor 2), read them, and fix what looks rough before you report. Save them under `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/1a/`, or the folder the main session gives you, and name each file in your report. If `.claude/skills/impeccable/` is in your branch, read its `reference/craft-floor.md` before you build and `reference/polish.md` before you report.
15. **The shared machine** has four cores and 15 GB, and has been running out. Run one spec file at a time, stop your dev server when you are not testing, and do the reading and writing first. A test that fails with "Page crashed", "Target crashed" or `ERR_ABORTED` is run once more on its own before you treat it as a failure.
