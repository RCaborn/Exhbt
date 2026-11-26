# Brief 2b: one content line for every signed-in page

| | |
|---|---|
| Phase | 2, the app frame and navigation |
| Model | Sonnet |
| Branch | `phase-2-appeal-2b-frame`, made from `phase-2-appeal` |
| Port | 3354 |
| Starts when | 2a's milestone 1 and 1b are merged into `phase-2-appeal`; brief H of the portfolio build is in `phase-2-appeal` too (it edits lines in the same pages; the main session merges `phase-2-pf-h-structure` in once portfolio R1 is on `main`); and Rory has chosen the frame's mock-up, or the defaults below apply from midday on Saturday 28 Nov |
| Hours | About 5 |

## Goal

Alex called the app's look "huge margins on the side... block block". The screenshots show why: each signed-in page sets its own column (40, 42, 48, 52 and 84rem wide), so the text's left edge moves on almost every screen, forms float as shadowed cards, the ground flips between mist and white, and each record gets a card of its own.

Give every signed-in page that is not an editor one frame: the same left edge as the header's logo, one of two widths, one heading with one line under it, flat sections divided by a hairline, and rows for lists. You change each page's outer frame and its section wrappers. You do not change a field, a button's meaning, a word, or what any form posts: the fields are the plan's phase 3.

## Read first

`docs/decisions/0033-astryx-is-the-design-guide.md` ("The order of authority"; the second of the six, "Only the work is raised"; "What DESIGN.md says as each part lands", the Operate line). `docs/design/appeal-plan.md` (the safety rules; phase 2). `DESIGN.md` (Mode by surface; Shape and depth; Flow patterns). With the CLI: `npm run astryx -- docs layout`, then its `structure`, `layout-spacing`, `headers-and-footers` and `responsive` guides; `docs principles`; `component Layout`, `component Section`, `component Stack`, `component Heading`, `component Text`, `component Divider`, `component List`; `template settings-sidebar --skeleton` and `template table-page --skeleton` (for their spacing, not their side panel). Then the code: `components/site/SiteHeader.tsx` as 2a left it (its container sets the left edge you match); each page under "You own"; `components/admin/Admin.tsx` (`Panel`: read only); `components/ui/Button.tsx`.

## You own

`components/ui/Page.tsx` (new). The outer frame and the section wrappers, and nothing inside them, of: `app/(app)/account/page.tsx`, `app/(app)/account/billing/page.tsx`, `app/(app)/roadmap/page.tsx`, `app/(app)/roadmap/saved/page.tsx`, `app/(app)/job-links/new/page.tsx`, `app/(app)/job-links/[id]/page.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/admin/accounts/page.tsx`. `e2e/page-frame.spec.ts` (new). `scripts/check-raised.mjs`: only to take a file off its list when you have flattened it.

## You must not touch

The roadmap builder and result (`app/(app)/roadmap/new/`, `app/(app)/roadmap/[id]/`, `components/roadmap/`): `DESIGN.md` gives them a card on mist, and they move in phase 3. `app/(app)/login/`, `app/(app)/exhbts/`, `app/(app)/portfolio/`, `app/(app)/job-links/page.tsx` (it redirects). Any form component (`DeleteAccountForm`, `NewJobLinkForm`, `IntroForm` and the rest): you wrap them, you do not open them. `components/admin/Admin.tsx`. The lines brief H changed in these pages (the account page's row of links, billing's "Back to your portfolio" button, the job-link pages' back links, the switch passed on the saved-ideas page): leave each exactly as H left it, inside your frame. 2a's files. Everything in the README's frozen list.

## What you build against

```ts
// components/ui/Page.tsx  (no "use client": a server component can use it)
/**
 * The frame of a signed-in page (decision 0033): the header's left edge, one of two widths, one heading,
 * one line saying what the screen is for, and flat sections. Built from Astryx Layout, Heading, Text and Stack.
 */
export function Page(props: {
  /** The page's one heading: an <h1>. */
  title: string;
  /** One line under it. */
  lead?: ReactNode;
  /** Above the heading. Leave it out where the page keeps its own way back. */
  back?: { href: string; label: string };
  /** At the end of the heading's row: the page's one main action. */
  action?: ReactNode;
  /** "form": settings and forms. "list": rows and tables. */
  measure?: "form" | "list";
  children: ReactNode;
}): ReactNode;

/** One flat section: a heading (an <h2>), an optional line, then its content. A hairline divides it from the one above. No card, no shadow. */
export function PageSection(props: { id: string; title: string; lead?: ReactNode; tone?: "plain" | "danger"; children: ReactNode }): ReactNode;
```

**The frame's numbers,** each in one place in `Page.tsx` so Rory's choice is a one-line change. Defaults if he has said nothing:

| | Default |
|---|---|
| Left edge | The header's: whatever container 2a's header uses, the same one, so the heading's first letter sits under the logo |
| `measure="form"` | 44rem |
| `measure="list"` | 64rem |
| Ground | White on every page here. No mist behind a form |
| Between sections | Astryx's spacing step 10, with a `line` hairline |
| Heading | Astryx `Heading` at level 1, which the theme draws as the site's `h1` |

**Facts that bite.**
- The specs find these pages by their headings and labels (`getByRole("heading", { level: 1, name: "Account" })` and the like). Titles and labels do not change by a letter, and each section keeps the `id` its heading is tied to (`aria-labelledby`).
- Astryx's rule is rows for lists, and a card only for a thing that stands alone. A record in a list is a row with a hairline.
- Nothing in the page's flow is raised. If a wrapper you remove carried `shadow-pack`, take that file off the list in `scripts/check-raised.mjs`.
- Billing shows a dashed "Development: set plan" box on a local server. It is not a product screen: leave it as it is, last on the page.

## Steps

Commit and push after each.

1. **`Page.tsx`**, with one example of each measure added to `/dev/astryx` (ask the main session to pass that line to 1b if 1b is still running; if 1b is merged, add it yourself in `app/dev/astryx/`, which is then yours for that one section).
2. **`e2e/page-frame.spec.ts` first,** failing: for each page under "You own", at 1440, 1024 and 390 wide, the `h1`'s left edge equals the left edge of the header's logo, within one pixel, and so does the first element of the content; the page does not scroll sideways; there is one `h1`.
3. **Account** (`measure="form"`): the two boxed panels (your portfolio address; refer a friend) become `PageSection`s. "Delete account" is a `PageSection` with `tone="danger"`. H's row of links stays as it is.
4. **Billing** (`measure="form"`): "Your plan" and "Change plan" as `PageSection`s. The two plan columns stay side by side: each plan is a thing that stands alone, so each may keep an edge, but no shadow.
5. **Roadmaps and saved ideas** (`measure="list"`): each roadmap and each saved idea is a row.
6. **A job link's page** (`measure="list"`) and **New job link** (`measure="form"`): Address, Your picks, Intro and Delete become flat `PageSection`s on white; each pick is a row with its controls at the end. The back links stay H's.
7. **Admin and its accounts page** (`measure="list"`): the frame only. `Panel` and the table are phase 3's.
8. **Photograph** each page at 1440 and 390 before and after, set side by side. Read them: one left edge down the whole set; no card inside a card; one main button a screen.
9. **Prove it:** `e2e/page-frame.spec.ts`, and each page's own spec unchanged: `e2e/phase2-account.spec.ts`, `e2e/phase2-billing.spec.ts`, `e2e/phase2-billing-polish.spec.ts`, `e2e/phase2-saved-ideas.spec.ts`, `e2e/phase2-joblinks.spec.ts`, `e2e/admin.spec.ts`, `e2e/a11y.spec.ts`. If one of those fails because it selected a wrapper you removed, change the selector to a role and a name, and say so; never loosen what it checks.

## Done looks like

Eight signed-in pages share one left edge with the header at every width, in one of two widths, on one ground, with flat sections and rows. Every form posts what it posted before, every heading and label reads as it did, and the pages' own specs pass.

## Report back

The branch head. `Page`'s signature as built. The frame's numbers and where each is set. The before and after photographs, named. Which files came off the raised list. Any spec selector you changed, old and new. Anything about a page's contents that still looks wrong inside the new frame: that is phase 3's list.

Run: `e2e/page-frame.spec.ts`, `e2e/phase2-account.spec.ts`, `e2e/phase2-billing.spec.ts`, `e2e/phase2-billing-polish.spec.ts`, `e2e/phase2-saved-ideas.spec.ts`, `e2e/phase2-joblinks.spec.ts`, `e2e/admin.spec.ts`, `e2e/a11y.spec.ts`.

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
14. **Look at what you build.** Open it in the browser at 1440 and at 390 wide, take screenshots (deviceScaleFactor 2), read them, and fix what looks rough before you report. Save them under `/tmp/claude-0/-home-user-Exhbt/8f68944d-9b6a-5167-8a40-0d82c10fe3df/scratchpad/appeal-build/2b/`, or the folder the main session gives you, and name each file in your report. If `.claude/skills/impeccable/` is in your branch, read its `reference/craft-floor.md` before you build and `reference/polish.md` before you report.
15. **The shared machine** has four cores and 15 GB, and has been running out. Run one spec file at a time, stop your dev server when you are not testing, and do the reading and writing first. A test that fails with "Page crashed", "Target crashed" or `ERR_ABORTED` is run once more on its own before you treat it as a failure.
