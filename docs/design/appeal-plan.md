# The appeal plan: Astryx across the site, and what a person sees change

Written 26 Nov 2026 against `main` at b2ec870. The other branches it names were read at about 18:00 that day, and several are moving by the hour. The decision is `docs/decisions/0033-astryx-is-the-design-guide.md`: read it first. The page for Rory and Alex is `docs/design/for-rory-appeal.md`. The briefs for the first two phases are in `docs/briefs/appeal/`.

Rory needs a site he is proud to ship by **Wednesday 2 Dec**. His four goals are the design, the exhbt editor, the portfolio editor and the page flow. This plan is the design goal, written so that the other three, which are already being built, are built on Astryx the first time.

## How to read this

- **MUST** is on the path a new person takes: the home page, add an exhbt, the exhbt editor, publishing, the public pages (which must not change), and the portfolio structure and editor. It ships by 2 Dec.
- **AIM** ships by then if nothing slips. **AFTER** waits, and says why.
- **Model:** Opus for hard design and the core of a build, Sonnet for routine, well-specified work. The main session may run a brief on Fable.
- **Hours** are agent-hours. **How sure** is the chance the job is merged and green by the day given, as a plain guess.
- A job with a brief has it in `docs/briefs/appeal/`. The others get one from the main session when their gate opens; each row below holds what the brief needs.

## What is already moving, and what it means here

| Branch | What it is | What this plan does about it |
|---|---|---|
| `main` | Portfolio R0 and R1 are in (the parity gate, the switch, the page's edit slots), with the design playbooks (`.claude/skills/impeccable/`) and the Astryx agent guide | Agents read the guide before they build and the playbooks before they report |
| `phase-2-pf2`, with `phase-2-pf-e-core`, `-f-arrange`, `-g-bar` and `-h-structure` | Portfolio R2: the one-page editor and the new structure, behind the switch. E's first milestone is merged; F and G have each pushed a first commit, built from Astryx as `astryx.md` in that folder tells them to; H is nearly done; I has not started | Phase 4 is an amendment list for briefs E, F, G, H and I, checked against what F (a37258e) and G (1cdf20b) have pushed |
| `phase-2-design-lab` | The main session's design lab at `/lab/design`: four screens (Home, Finish, App, Kit) at three levels, on a proposed theme in `themes/exhbt-next/`. It changes no existing file, and answers only in development and on the preview site | Rory chooses from it. Job 1a makes the proposed theme the real one without moving a visitor's page. Until he has chosen, only look-neutral work starts |
| `phase-2-add-exhbt` | "Add an exhbt" as a chooser, the first screen built from Astryx. It edits the real theme (heading sizes, a phone step, heading tracking), `app/(app)/exhbts/new/` and `app/(app)/exhbts/page.tsx` | It goes into the appeal's release branch before job 1a starts, so the theme has one history. Its card pattern (a `Card` with one stretched `Button`, because Astryx's `ClickableCard` needs scripts) is the pattern for every card with one action |
| `phase-2-editor-freedom` (decision 0032) | Formatting anywhere, own section titles, nothing compulsory. It edits much of `components/exhbt-editor/` | No appeal job touches the exhbt editor until it is merged |
| The classic editor's removal (`docs/briefs/edit-on-page/r5-p-remove-classic.md`) | Edits the edit page, the editor's context and the top bar's menu | Same: phase 5 waits for it or goes before it, never beside it |

## Rules that keep visitors' pages and live data safe

Every job follows these. They come from attacking this plan before it was committed (see the end).

1. **Protected, as decision 0031 has it:** nothing edits `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected`), and nobody regenerates a golden copy.
2. **The theme reaches visitors' pages.** `app/layout.tsx` wraps every route in the Astryx theme, the built stylesheet sets bare `p`, `small`, `code`, `hr` and `h1` to `h6` from tokens in its lowest layer, and the public exhbt page draws one Astryx `Button`. So in `themes/exhbt/exhbtTheme.ts` whatever those rules or that button read changes only in job 1a's second milestone, one thing at a time, and only while both parity specs pass with boxes exactly as before: the type scale, the headings' weight and sizes, and the button's additions. The three font families, `--color-text-primary`, `--color-text-secondary`, `--color-border`, the three `--size-element-*` tokens and the `button` block's own size, padding, radius, border and weight are not changed at all. The rest of the voice is set through tokens only Astryx's own components read.
3. **`app/globals.css` is frozen where visitors' pages read it:** the `@theme` block, the base layer (headings, `:focus-visible`, selection), and every `.xp-*`, `.pf-*` and `[data-look]` rule. New styles go in a new file imported by the surface that needs them.
4. **`app/layout.tsx` and `app/providers.tsx` are frozen.** The skip link, the private-preview strip and the theme's wrapper are drawn for visitors' pages too.
5. **Parity with boxes, on the agent's machine.** CI compares markup only. Any job that touches the theme, `components/ui/Button.tsx`, or a file a public page imports runs `e2e/portfolio-parity.spec.ts` and `e2e/layout-parity.spec.ts` with `CI` unset, and `e2e/exhbt-page.spec.ts` and `e2e/phase2-looks.spec.ts`, before it reports.
6. **No migration, and nothing new stored.** No MUST or AIM job writes anything today's code cannot read. The one job that adds an event name checks first whether the events table constrains names, and stops if it does.
7. **One surface, one change.** A screen moves to Astryx whole, with its tests, in one merge that can be reverted as one. Nothing is left half on each system.
8. **A message a screen reader must hear keeps its live region.** Astryx's `Banner` is not live by default; a swap keeps `role="status"` or `role="alert"`, or announces through Astryx's `useAnnounce`.
9. **Never run anything that calls the Anthropic API.**
10. **Only the main session merges to a release branch, opens a pull request or deploys.** `main` is the live site.

## Branches, ports and who merges

- The main session cuts `phase-2-appeal` from `main` and merges `origin/phase-2-add-exhbt` and `origin/phase-2-design-lab` into it. The lab adds files only, and its theme is the source for job 1a. If add-exhbt cannot be merged yet, job 1a copies its three theme additions word for word instead, and add-exhbt later takes 1a's `exhbtTheme.ts` whole and runs `npm run theme`. The built theme files are always regenerated, never merged by hand.
- Each agent works on its own branch, made from `phase-2-appeal` when it starts: `phase-2-appeal-1a-theme`, `-1b-kit`, `-2a-shell`, `-2b-frame`, and so on.
- Ports 3351 to 3359, clear of the portfolio build's 3321 to 3332 and of 3344.
- Phase 4 changes nothing on these branches: its amendments are applied to the portfolio briefs on `phase-2-pf2`.
- Several jobs need brief H's changes under them (2b, 3a, 5a, 5b, M1, M2). H's branch is `main` plus portfolio R1 plus its own commits, all behind the switch, so once R1 is on `main` the main session can merge `phase-2-pf-h-structure` into `phase-2-appeal`. Until it has, those jobs wait.
- Phase 5's wiring also needs editor-freedom in its base, by the same route.

## The phases

In this order because each makes the next one cheap, and so that no screen ever shows two systems: the theme before any component, the frame before any page, the shared parts before the screens that use them, and the two editors' chrome moved to the same parts.

### Phase 1: the theme foundations

**What a person sees change:** nothing, and that is the point: no component may arrive looking like neutral Astryx, so the voice is set before anything uses it. It is half a day beside other work, not a release. Rory and Alex see the voice in the lab, under its proposed theme; `/dev/astryx` is the same parts under the real theme, and when the two pages match the theme has been moved across. The one thing a student might notice is the keyboard focus ring on buttons; job 1a checks whether it changes.

| Job | What | Files | Model, hours | Mark | Waits for | How sure |
|---|---|---|---|---|---|---|
| **1a The theme** (`1a-theme.md`) | The lab's proposed theme made the real one: display type, the focus and selection rings, shadows, motion, the status colours with no blue or orange, and a style for each component about to be used. Whatever in it reaches a visitor's page is taken only if the parity specs pass with boxes | `themes/exhbt/exhbtTheme.ts` and its built files | Opus, 5 | MUST | `phase-2-appeal` cut, with add-exhbt's theme lines and the lab in it. Starts tonight | 8 in 10 by Friday midday |
| **1b The kit and its checks** (`1b-kit-and-checks.md`) | `/dev/astryx`; the app's own wrappers in `components/ui/` so a swap is made once for the whole site; three check scripts and a spec | `app/dev/astryx/`, `components/ui/` (new files), `components/brand/Address.tsx` (new), `scripts/` (three new), `package.json`, `e2e/astryx-kit.spec.ts` (new) | Sonnet, 7 | MUST | `phase-2-appeal` cut. Starts tonight | 9 in 10 by Friday evening |

**Checked by:** both parity specs with boxes, `exhbt-page` and `phase2-looks`; `npm run check:theme`; a search of the built CSS showing the motion values changed and no blue is left; axe on `/dev/astryx`; `/dev/astryx` beside the lab's Kit page at 1440 and 390; a focused "See the work" button photographed in all eight looks before and after.

### Phase 2: the app frame and navigation

**What a person sees change:** the same header on every app and marketing page, with a proper menu on a phone; every signed-in page starting at the same left edge as the logo, in one of two widths, with sections lying flat; no marketing footer under the editors. This is the first change a student sees.

| Job | What | Files | Model, hours | Mark | Waits for | How sure |
|---|---|---|---|---|---|---|
| **2a The shell** (`2a-shell.md`) | Astryx `AppShell`, `TopNav` and its phone drawer on the app and marketing layouts, in two milestones: first today's header drawn by Astryx, then the footers and the frame's look from Rory's chosen mock-up. If `AppShell` cannot keep the document scrolling and the editors' bars sticking, the header is built from `TopNav` and `MobileNav` inside today's layouts | `components/site/` (the header, its links, the phone menu, the footer), `app/(app)/layout.tsx`, `app/(marketing)/layout.tsx`, `components/site/shell.css` (new), the seven specs that select the header | Opus, 8 | MUST, or left out whole | 1a's first milestone merged; Alex told (his files). Milestone 2 waits for Rory's choice | 7 in 10 by Saturday night, counting the fallback |
| **2b One content line** (`2b-page-frame.md`) | One frame for signed-in pages: the logo's left edge, one of two widths, one heading, flat sections, rows for lists | `components/ui/Page.tsx` (new), the account, billing, roadmaps, job-link and admin pages | Sonnet, 5 | AIM | 2a's first milestone and 1b; H's branch in `phase-2-appeal` (it edits lines in the same pages); Rory's choice of the frame | 6 in 10 by Monday |

**Checked by:** the seven specs that select the header (named in the brief), `e2e/a11y.spec.ts`, `e2e/responsive.spec.ts`, `e2e/seo.spec.ts` (marketing pages must stay static), both parity specs, and before and after screenshots of six pages at 1440 and 390.

**If 2a is not green by Sunday night it is left out whole.** The old header stays everywhere, nothing else in this plan depends on `AppShell`, and job 5b hides the footer on the editor routes by itself.

### Phase 3: forms, feedback and empty states

**What a person sees change:** one word for each thing wherever they meet it; every step ending on what happens next; forms that look like one product; a wait that shows their exhbt taking shape.

| Job | What | Files | Model, hours | Mark | Waits for | How sure |
|---|---|---|---|---|---|---|
| **3a The words** | One label per action across the app (0033's table). The next-step lines that need no new layout: sign-up says "Next: your page, then your first project"; "Add an exhbt" says, before anyone starts, that Free keeps an exhbt private; the roadmap's last view and its email say "Already finished a project? Add it as your first exhbt" | Strings in `app/(app)/login/new/`, `app/(app)/exhbts/new/`, `components/roadmap/RoadmapViews.tsx`, `components/roadmap/BuildThis.tsx`, `lib/email/templates/roadmap-ready.ts`, `app/(marketing)/demo/page.tsx`; a new `scripts/check-labels.mjs` that fails on a retired label | Sonnet, 5 | MUST | add-exhbt and H's branch in `phase-2-appeal`; Alex told (the login page is his) | 8 in 10 by Sunday |
| **3b Sign-up and log-in** | Astryx's `login-card` shape on the kit's fields, one main button, and a small picture of a portfolio beside the form on a wide window | `app/(app)/login/**` | Sonnet, 4 | AIM | 1b, 2a; Rory's choice; Alex reviews | 5 in 10 |
| **3c The draft form and the wait** | The upload form on the kit's fields and `FileInput`; the 20-second wait drawn as an outline of an exhbt that fills in, with its status still announced | `app/(app)/exhbts/new/DraftForm.tsx` | Sonnet, 5 | AIM | add-exhbt merged; 1b | 5 in 10 |
| **3d The roadmap on the kit** | Builder steps on `Stepper`, the result's views on `TabList` with links, the gate and the ideas on the kit; gate users offered "Create an account" with their email filled in | `app/(app)/roadmap/new/RoadmapWizard.tsx`, `components/roadmap/` | Sonnet, 6 | AIM | 1b; the builder's e2e helpers updated in the same change | 4 in 10 |
| **3e The paid step, account and job links** | Billing opens on "Put your portfolio online" with their own page in a browser frame at the address they would get, and after paying says "You're on Premium. Next: choose your address, then publish"; the three surfaces on the kit | `app/(app)/account/**`, `app/(app)/job-links/**` | Sonnet, 5 | AIM | 2b; Alex reviews billing | 4 in 10 |
| **3f Admin on Astryx's table** | The raw table and panels | `components/admin/Admin.tsx` | Sonnet, 3 | AFTER: nobody outside the team sees it | | |

Each job that touches a screen also moves that screen's status and error messages to the kit's `Notice`, under rule 8.

**Checked by:** each surface's existing specs, updated in the same change (`phase1`, `password-login`, `phase2-draft`, `radar`, `phase2-billing`, `phase2-joblinks`, and `add-exhbt` from the add-exhbt branch), `a11y`, and a before and after screenshot of every screen touched.

### Phase 4: the portfolio editor

**What a person sees change:** they land on their own page; a strip shows the account step already done and what is next; the best-work panel is drawn full size waiting for a project; one bar along the top holds everything else. All of it is being built now by the portfolio-first agents, and from Astryx: the main session's `astryx.md` in their folder already tells them to. So this phase is short: a list of what to change so that what they have built agrees with decision 0033.

Model and hours: none of its own. The main session sends the list to F and G tonight and writes it into the briefs. Mark: MUST. How sure: 9 in 10 that the list is applied; whether R2 itself lands by 2 Dec is the portfolio build's own plan, which this one does not shorten.

**The amendment list, for briefs E, F, G, H and I on `phase-2-pf2`.** It sits on top of `astryx.md` and `d-findings.md` in that folder: where this list and a brief disagree, this list wins; where it is silent, they stand. It was checked against F's first commit (a37258e) and G's (1cdf20b). Every item is chrome, wording or a test. No signature, slot, path or save rule changes.

*For all five*

- **A1. Rule 9** in each brief. Replace "app chrome uses the existing tokens and Astryx Buttons through `components/ui/Button.tsx`" with: "app chrome is built from Astryx components, through the app's own wrapper in `components/ui/` where one exists (the appeal plan's job 1b adds them; until it is in your release branch, import from `@astryxdesign/core/<Name>`), in the theme's tokens only".
- **A2. Where chrome stops: no change, and now written down** (decision 0033, "The line inside an editor"). What sits in the page's flow is the page and takes the look's variables: the Add tile, draft tiles, the hidden row, the band's button. What is drawn over or around the page is Astryx on the app's own surface: the corner toolbars, "Suggest an intro", "Your links", the photo button, and all they open. F and G have built it this way.
- **A3. No `Badge`.** 0033 keeps Astryx's `Badge` for counts; a status is a `Token`, or a `StatusDot` with `Text`. The appeal plan's check script will refuse the import. Two uses exist today, both G's (G1 and G2).
- **A4. A warning has no colour.** The brand has no amber, so under the real theme a `warning` `Banner` or chip is yellow today and ink on white later. Use `status="info"` for anything that is information, and keep `warning` for something that has gone wrong and can be put right.
- **A5. A message that must be heard keeps its live region.** An Astryx `Banner` is not live by default. Keep `say()` for what a screen reader must hear; the `Banner` is what is seen.
- **A6. One mint button.** In chrome only the bar's main button ("Claim your address", then "Share") is `primary`, as G has it. Keep it so.
- **A7. Words.** "Add an exhbt", "your portfolio", "your address", "its link" (0033's table).

*Brief E, the core (its first milestone is merged; these touch only what it has not reached)*

- **E1. `ui/Sheet.tsx` stays as built:** Astryx's `Drawer`, at the side on a wide window and the full width under 640px, with `data-sheet`. It matches the exhbt editor's side sheets. The one exception is a short list of actions on a phone, which is I1's.
- **E2. Steps 15 and 16.** "The site was updated. Reload to carry on" is an Astryx `Banner` (`status="warning"`, not dismissable) with Reload in `endContent`. "Put back the changes from before the reload" and the note that the page is open in another tab are `Banner`s (`status="info"`, dismissable). Each is also said through `say()`.
- **E3. Step 17.** The tile's two-second mark runs on the theme's motion tokens (`--duration-slow`, `--ease-entrance`) and rests under reduced motion. "The note at the foot of the window" lives in one file, `components/portfolio-editor/PublishedNote.tsx`: for now an Astryx toast through `useToast`, with `isAutoHide: false`, the body "<title> is live at <address>" and Copy link in `endContent`. The appeal plan's job 5a replaces that file's body with the finish (0033, the fourth of the six) and nothing else of E's.
- **E4. Step 18.** The line above "See as a visitor" when visitors would get "not found" is an Astryx `Banner` (`status="info"`, `container="section"`) with 0031's words and one action in `endContent`: "See plans", "Claim your address" or "Add an exhbt".

*Brief F, sections and tiles (first commit pushed)*

- **F1. Steps 1, 3, 4 and 10: as built.** Corner toolbars are Astryx `Toolbar` and `IconButton` with tooltips; "Add a section" and a tile's More are Astryx `DropdownMenu`s. Nothing to change.
- **F2. Step 8, the Add tile: one button.** Today it has a heading "Add an exhbt", a link "Upload your project" and a button "Or start from a blank page". Once `phase-2-add-exhbt` is in the release branch, `/exhbts/new` is a chooser that explains both ways, so the tile keeps one link, "Add an exhbt", to `/exhbts/new`, and drops the blank-page form. Its heading then says what the space is for, "Your next project goes here", which answers the band's "Your best project goes here"; a heading and a button must not both read "Add an exhbt". The line for a plan with no public page ("On your plan an exhbt stays a draft that only you can see") and the count stay. If add-exhbt is not in the release branch when F finishes, F leaves the two ways as they are and says so, and the main session makes this change when it lands.
- **F3. Step 9: as built,** per `d-findings.md`: the band's own button, "Add an exhbt". No Astryx `EmptyState` on the page: the band is the person's page.
- **F4. Step 11.** The spec finds every control by role and name, never by an Astryx class.

*Brief G, the bar, sheets and first minute (first commit pushed)*

- **G1. Step 1, the bar: as built** (Astryx `Toolbar`, `ToggleButton`, `Popover`, `DropdownMenu`, one `primary` button, a frame `--xe-topbar-h` tall), **but for the chip.** It is a `Badge` with a `warning` variant for "Not online yet". Make it a `Token`, or a `StatusDot` with `Text`: Live in the success colour, "Not online yet" and "Preview only" neutral. The report shows this bar beside the exhbt editor's at 1440 and 390: they must read as one product until the appeal plan's job 5c moves the exhbt editor's bar onto the same parts.
- **G2. Step 2, the Look menu: as built** (`RadioList`, with a `Banner` while a locked look is previewed), **but for the lock.** The plan's name beside a locked look is a `Badge` with a lock icon: make it a neutral `Token`, or plain `Text` with the icon.
- **G3. Step 5, the address sheet.** "Your address shows 'not found' until you publish an exhbt" is `status="info"`, not `warning`: it is how things stand, not a fault. Once there is an address, set it as display type: `components/brand/Address.tsx` if job 1b is in the release branch, else an Astryx `Heading` with `type="display-3"`. Copy link says "Link copied" in a toast.
- **G4. Step 6.** The compact job links are Astryx `List` and `Item` rows: the address as the label, a `StatusDot` with Live or Off, the views as supporting text (views, never "people"), Edit as the row's action. "New job link" is `secondary`.
- **G5. Step 8, the strip: three steps, not two.** `STRIP.steps` in `bar/FirstRun.tsx` gains a first entry, "Account", described "Done" and always done; the title becomes "Your portfolio in three steps". The first step is a true head start, and Astryx's `Stepper` is for three steps or more. On a phone the strip then reads "Step 2 of 3". A fourth step, "Online", was considered and left out: on Free it could never be ticked, and the bar's chip and main button already say it.
- **G6. Step 9.** The spec's strip cases read "Step 2 of 3"; controls are found by role and name.

*Brief H, the structure (nearly done: nothing to redo)*

- **H1. Step 3.** Superseded by `phase-2-add-exhbt`, which owns `app/(app)/exhbts/new/`. H adds no "Or start from a blank page". What is left for whoever merges second: at `page` the chooser's heading is "Add an exhbt to your portfolio", its way back is "Your portfolio", and signed out with no `into` it goes to `/login?next=/portfolio`.
- **H2. Step 5.** Nothing more in `PublishSheet.tsx` than H has pushed (3565fe2). How the sheet's end states look and read is the appeal plan's job 5a, which starts from H's merged file.
- **H3. Step 7.** Unchanged: "Add as an exhbt" is the agreed label. The closing card's "Make an exhbt" in `RoadmapViews.tsx` is renamed by job 3a, not by H.

*Brief I, the phone (not started)*

- **I1. Step 1.** `ItemMore`'s button is an Astryx `IconButton`, 44px, as F's toolbars are. Its sheet is an Astryx `BottomSheet` with `height="hug"` and `label="More for <name>"`, not E's full-width `Sheet`: a short list of actions belongs under the thumb. Its rows are Astryx `Item`s, 44px; an action that is `off` is a disabled item with its reason as the description.
- **I2. Step 2.** "Reorder sections" is a `BottomSheet` (`height="capped"`) of `Item` rows, each with Move up and Move down as `IconButton`s, and the grip.
- **I3. Step 4.** "Every sheet fills the screen" becomes: a sheet with fields is E's full-width `Sheet`; a list of actions hugs. Check that a focused field in a sheet stays above the phone's keyboard. Astryx promises that only for a `BottomSheet` with `height="tall"`, so if a field hides behind the keyboard in the drawer, that sheet becomes one. This needs the real iPhone.
- **I4. Step 6.** The strip's case reads "Step 2 of 3". Add a check that a `BottomSheet` opened over the editor is not covered by the bar.

*Not asked for, noted so they are not missed:* J's first-run and after-publish cases follow G5 and E3. K pastes 0033's `DESIGN.md` wording when it rewrites the portfolio paragraphs.

**Checked by:** each agent's own spec, J's gate specs, parity, and the screenshots `astryx.md` already asks for.

### Phase 5: the exhbt editor's chrome

**What a person sees change:** publishing ends on their page turning Live with the link ready to send; a first draft arrives with one line saying what it is and what to check; on a phone the page starts higher and the publish button fits on one line. Later, the bar and every sheet move like the rest of the site. The page itself, which Rory likes, does not change.

| Job | What | Files | Model, hours | Mark | Waits for | How sure |
|---|---|---|---|---|---|---|
| **5a The finish** | 0033's fourth: one component for the publish sheet's end and the portfolio's `?at=` landing. Milestone 1, in new files with a dev page: the panel, Free's version, the link preview, Copy link, the next step. Milestone 2: the publish step on the kit's `Sheet`, ending on the finish (an Astryx `Dialog` on a wide window, a `BottomSheet` on a phone), with Unpublish moved into a menu with a confirmation; and the finish in E's `PublishedNote.tsx`. Milestone 3, AIM: "where to put it" and Share on LinkedIn | `components/finish/` (new), `app/dev/finish/` (new), `e2e/finish.spec.ts` (new); then `components/exhbt-editor/sheets/PublishSheet.tsx`, `components/exhbt-editor/css/sheets.css`, `components/portfolio-editor/PublishedNote.tsx`, `e2e/editor.ts` | Opus, 7 | MUST | Milestone 1: 1a, 1b and Rory's choice. Milestone 2: H's branch and editor-freedom in its base, the classic editor's removal not in flight | 7 in 10 by Sunday night |
| **5b Less in the way** | Once per AI draft, under the bar: "Here's your first draft. We wrote it from your files and nothing else. Click any part to change it, check each number, then press Review and publish" (the line about the layout it chose is read out and sits in the Layout menu today, and is never shown on the page). The publish button on one line at 360 and 390 by giving it room, not a second label. The "add teammates" line into the menu if Rory agrees (0033, question 6). No footer on editor routes if 2a was left out | `components/exhbt-editor/topbar/`, `components/exhbt-editor/css/topbar.css`, `app/(app)/exhbts/[id]/edit/page.tsx`, `e2e/editor-topbar.spec.ts`, `e2e/editor-phone.spec.ts` | Sonnet, 4 | MUST | The same merges as 5a | 8 in 10 by Sunday night |
| **5c The two editors match** | The exhbt editor's bar on the same Astryx `Toolbar` parts as the portfolio's; the layout menu as a `Popover` with a `RadioList`; the menu as a `DropdownMenu`; the word bar as a `ProgressBar`; a failed save as a toast with Retry. And the buttons inside its corner toolbars as Astryx `IconButton`s on the app's surface, as the portfolio's are, which closes the one seam 0033 leaves open. The maths that places those toolbars is not touched | `components/exhbt-editor/topbar/`, the inside of `components/exhbt-editor/Toolbar.tsx`, `components/exhbt-editor/css/core.css`, the e2e page object | Opus, 8 | AIM, and the first job after 2 Dec if it misses | 5b; G merged | 3 in 10 by 2 Dec |
| **5d The other overlays, one a pull request** | The card, work and figure sheets, the "+" menu and the phone bar on the kit. The corner toolbars' placement and the drag engine stay as they are | `components/exhbt-editor/` | Opus, 10 | AFTER: each changes focus, Escape and the tests' page object in the editor Rory has just approved | | |

**Checked by:** `e2e/finish.spec.ts`; the editor specs named in each brief, on the desktop and touch projects; `publish-safety` and `publish-words` unchanged and green; axe with the sheet open; screenshots of the publish step at 1440 and 390, before and after, on Free and on a paid plan.

### Phase 6: the marketing pages

**What a person sees change:** Home shows a real portfolio in its first screen on a laptop and a phone, has one way in, and tells the story in seven beats; then the moments of the level Rory picks.

| Job | What | Files | Model, hours | Mark | Waits for | How sure |
|---|---|---|---|---|---|---|
| **6a Home tells the story** | 0033's seven beats; the product in the first screen at both widths; one action in the hero, with the header's button saying the same thing; "What you get" removed; no three zigzag sections in a row | `app/(marketing)/page.tsx`, `components/home/`, the one button constant in `components/site/SiteHeader.tsx`, `e2e/home.spec.ts`, and `e2e/landing.spec.ts`, `e2e/phase1.spec.ts` and `e2e/responsive.spec.ts`, which press the hero's button by name | Opus, 8 | MUST | Rory's choice; question 5 (Alex's page); 2a if it is in. The fallback is the first screen, the one action and beats 1, 2 and 7 | 6 in 10 by Monday night |
| **6b Home's moments** | By level. Restrained: the exhbt that assembles itself, and the highlighter stroke drawn once. Confident: the name in the address and the eight looks | `app/(marketing)/page.tsx`, `components/home/`, `app/(marketing)/home-motion.css` (new), `e2e/home-motion.spec.ts` (new) | Opus, 5 and then 6 | AIM | 6a; question 2 (the Motion rule) | 4 in 10 for restrained by 2 Dec, 2 in 10 for confident |
| **6c The other marketing pages on the kit** | Pricing's three card treatments made one, with the chosen plan marked by its edge; the questions on Astryx's `CollapsibleGroup`; universities given a picture; `/demo`'s "Get your own" starting a portfolio | `app/(marketing)/pricing/`, `what-is-an-exhbt/`, `universities/`, `demo/`, `components/home/Faq.tsx` | Sonnet, 5 | AIM | 1b, 2a | 4 in 10 |

**Checked by:** `home`, `landing`, `seo` and `a11y`; the home page's parity targets (its look pictures are golden copies); `home-motion.spec.ts` under reduced motion; screenshots of Home at 1440 and 390 with the first screen marked.

## The momentum jobs, in one place

Decision 0033 turns the methods chosen into jobs. Where each lives:

| Job | Where it is built | Mark |
|---|---|---|
| First run | Phase 4: G5 (the strip), F2 and F3 (the Add tile and the band), and 0031's landing | MUST |
| Progress | Phase 4: G5 and the bar's chip. A checklist past the first exhbt | MUST; the checklist AFTER |
| The finished moment | 5a, milestones 1 and 2 | MUST |
| Sharing | 5a: the preview and Copy link in milestone 2; "where to put it" and Share on LinkedIn in milestone 3 | MUST; milestone 3 AIM |
| Emails | **M2**: one email at a first publish, with the link. A new template beside `lib/email/templates/roadmap-ready.ts`, sent from the publish action. Sonnet, 2 hours, after H is merged. Reminders and the weekly count need a scheduler and a consent check | AIM; the rest AFTER |
| A true reason to return | **M3**: the owner's bar says how often the page was opened. A new `Store` method on both implementations, and a rule for leaving out the owner's own visits | AFTER |
| Measuring | **M1**: an `exhbt_published` event, and N1 and N2 on the admin page. `lib/store.ts` (`EventName`, both implementations), the publish action, `app/(app)/admin/page.tsx`. Sonnet, 3 hours, after H is merged. Until it lands both numbers are worked out from `exhbts.published_at` | AIM |

Free's publishing and what a downgrade does to links already sent are plan decisions for Rory (0033, questions 3 and 4), not jobs.

## The days to Wednesday 2 Dec

Two Opus agents run at once. The table assumes the appeal has one of those places from tonight, with its Opus jobs one after another and Sonnet jobs beside them. That is not certain: the portfolio build runs F beside E's second milestone, and I beside J, and each pair takes both places. While it does, an appeal Opus job waits, and every Opus row below slips by that wait, unless the main session runs it on Fable. With a third lane the AIM jobs become likely; with none, 2a and 6a are the first to miss.

| When | Opus lane | Sonnet lane | The main session |
|---|---|---|---|
| **Tonight, Thu 26** | 1a | 1b | Cuts `phase-2-appeal`; sends phase 4's list to F and G and writes it into the briefs; the lab's screens |
| **Fri 27** | 2a, milestone 1 | 1b ends; 3a when add-exhbt and H are in | Shows Rory and Alex the lab; asks the six questions |
| **Sat 28** | 1a, milestone 2; 5a, milestone 1 | 2b; 5b when the editor's merges are in | Takes Rory's choice, or the defaults at midday; writes the briefs for 5a, 5b, 6a and 3a from this plan |
| **Sun 29** | 5a, milestone 2; 2a, milestone 2 | 3b, 3c, M1 | Decides on Sunday night whether 2a ships or is left out |
| **Mon 30** | 6a | 3e, 6c, M2 | Merges everything into `phase-2-appeal`; the whole suite; the four reviews below |
| **Tue 1 Dec** | 6b at the restrained level, or fixes | Fixes | Rory and Alex on a laptop and a real iPhone; the pull request to `main` |
| **Wed 2 Dec** | | | Ships |

**What starts tonight is look-neutral on purpose.** Rory is to choose from mock-ups before anything is rebuilt, so tonight's work is plumbing: the parts of the proposed theme no visitor's page can feel, the wrappers, a dev page, the checks, and small changes to chrome the portfolio agents are already building. Nothing a student can see changes until he has chosen.

**Values that wait for his choice,** each in one place so the change is one line: the level; the size of a page's own heading (today's 48, 32 and 22px, or the lab's 31, 25 and 20px under its display steps); the display steps' sizes; motion's character and durations; whether the finish is a panel or a docked note; the header's look beyond today's; the hero's composition.

**The lab's levels and 0033's must agree first.** The lab's switch describes a level by type size and motion in general and puts scroll-led pages at maximal only; 0033 and Rory's page use the creative review's levels, which put the assembling exhbt at restrained. The main session settles which wording stands before he is asked.

## If it runs over

Cut in this order, and tell Rory each time:

1. 6b at the confident level, then 6b altogether.
2. 5c, then 3d, 3e, 6c, 3b, 3c and 2b.
3. 5a's third milestone.
4. 2a, left out whole.
5. 6a falls back to its first screen, the one action and beats 1, 2 and 7.
6. 5a falls back to the publish sheet's end state on the kit with no motion.

Never cut: the rules that keep visitors' pages safe, 1a's parity runs, and 3a's labels, which cost little and are what "it is not obvious what we do" asks for.

## How it is checked before it ships

- **Golden copies:** both parity specs, with boxes, on `phase-2-appeal` before the pull request.
- **axe:** `e2e/a11y.spec.ts`, plus each new screen with its sheet or menu open.
- **The browser tests:** the whole suite once on the release branch. Each agent runs only the specs its brief names, one worker, on its own port; the shared machine has been running out of memory.
- **Before and after screenshots** at 1440 and 390 for every screen a job touches, set side by side for Rory.
- **Four reviews, each finding checked by a sceptic before anyone acts on it:** the look against 0033's six; accessibility; a cold read for clarity (an agent that has seen neither the code nor the plan says what each screen is for and what to press); and visitors' pages, before and after, in all eight looks.
- **A real iPhone.** Nothing here has been seen on one. Rory or Alex opens Home, signs up, adds an exhbt, publishes, and opens the menu, a sheet and a field with the keyboard up.
- **Size:** `npx opennextjs-cloudflare build` and `npx wrangler deploy --dry-run` on the release branch, with the Worker's size written down against its limit. More of Astryx is imported with each phase.

## The plan attacked from three sides

Done before this was committed. What each attack found, and what changed.

**Would a student or an employer see a difference after each phase, or is it only tidier code?**
- Phase 1 shows a student nothing. That is now said plainly and it is held to half a day. Rory sees the voice in the lab; the dev page is there to prove the real theme matches it.
- The first draft of phase 3 was a sweep of about a hundred fields, which a student would barely notice. It was split: the words (3a) are MUST because they answer "not obvious what we do", and the restyles are AIM.
- An employer sees no change in any phase, by design. What reaches an employer is indirect: more students finish and send a link.
- The six had grown to nine across the reviews. They were cut to six, each with something a person can see and a test.

**Can each job be built and tested as written against `main`?**
- Three things the reviews suggested do not survive the installed Astryx (0.7.11). `SelectableCard` is announced as a checkbox, so one-of-many choices use `RadioList` or add-exhbt's card pattern. `Stepper` needs three steps, which settled the first-run strip. `Banner` is not live, which became rule 8.
- `AppShell` draws its own skip link and its own main region with a generated id, and is a client component. The root layout's skip link points at `#main`. The shell brief deals with both, and names the seven specs that select the header.
- The theme still carries blue: the neutral theme's information colour and its selection ring are in the built stylesheet. Job 1a removes it and proves it by search.
- The neutral theme sets its own durations, which outrank Astryx's `tempo` knob, so 1a sets durations outright and checks the built file.
- The reviews said `main` would be on Astryx 0.7.17. It is on 0.7.11, and stays there until after 2 Dec.
- The first draft of this plan assumed F and G had not started and that the theme's values were still to be invented. While it was being written both agents pushed a first commit, built from Astryx, and the lab gained a proposed theme. Phase 4's list was rewritten against their code: about half of it turned out to be done already, and one item (corner toolbars in the look's own colours) was dropped because they had, rightly, built the opposite. Job 1a became moving the lab's theme across, not writing one.
- Every path named here was checked against `main`, or is marked new, or names the branch it lives on.

**Does anything put a visitor's page or live data at risk?**
- Yes, the theme: this was the largest find. Public pages sit inside the Astryx theme and take paragraph, heading and small-text styles from its tokens, and CI would not see a box move. Rules 2 to 5 exist because of it. The lab's proposed theme changes the type scale and the headings' weight, which is safe in the lab, where it is scoped to the lab's own pages, and is exactly what must be proven before it becomes the real theme.
- The public exhbt page draws one Astryx button, so a change to focus tokens or to the button reaches it. 1a photographs it in all eight looks.
- The root layout serves public pages, so the shell leaves it alone.
- Showing owners how often their page was opened, and the scheduled emails, were first marked AIM. They need new stored reads, a consent check and a scheduler, so they are AFTER.
- An event name is the only new thing written, and its job checks the table first.
- Free's publishing and broken links after a downgrade are real problems the momentum review found. Both would mean editing the files that decide what visitors see, on a plan decision nobody has made. They are questions for Rory, not jobs.
