# Brief J: the specs that gate release 2

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Opus |
| Branch | `phase-2-pf-j-specs`, made from `phase-2-pf2` |
| Port | 3330 |
| Starts when | E's milestone 2 and H are merged into `phase-2-pf2`. Start with the structure and safety specs; add the editor, visitor and smoothness cases as F, G and I land (the main session tells you, and you merge `phase-2-pf2` in) |
| Hours | About 9 |

## Goal

Write the specs that must pass before release 2 goes to `main`, across everyone's work: that what a person types is stored where it should be, that opening the editor changes nothing, that the step builder and the editor read each other's saves, that "See as a visitor" is exactly the public page, that typing stays cheap, and that the new structure takes a new student from sign-up to a published exhbt and back to their portfolio. You test; you do not fix. What fails goes in your report with the owner's letter.

## Read first

`docs/decisions/0031-portfolio-first.md` (all of it). `docs/briefs/portfolio-first/README.md` ("How each release is verified", R2). E's `e2e/portfolio-editor.ts` (yours from E's merge) and `e2e/portfolio-core.spec.ts`; F's, G's, H's and I's specs (so you do not repeat them). `e2e/editor-smooth.spec.ts`, `e2e/editor-inplace.spec.ts` (the box-for-box method), `e2e/data-safety.spec.ts` (the style of a safety spec), `e2e/editor-test.ts`. `e2e/fixtures/portfolio-pages.ts` (A's fixtures; import, never edit). `app/(app)/portfolio/actions.ts` and `lib/plan-rules.ts` (what the server accepts).

## You own

`e2e/portfolio-editor.ts` (from E's merge: add helpers, change none that others use without telling the main session), `e2e/portfolio-editor.spec.ts`, `e2e/portfolio-structure.spec.ts`, `e2e/portfolio-safety.spec.ts`, `e2e/portfolio-visitor.spec.ts`, `e2e/portfolio-smooth.spec.ts` (all new).

## You must not touch

Any product file. Other agents' specs. A's goldens and fixtures.

## What you build against

| Path | What | Drawn in | Edited as | Name read out |
|---|---|---|---|---|
| `profile.name` | the name | every hero | `text`, block | Your name |
| `profile.headline` | one line about you | every hero | `text`, block | One line about you |
| `profile.bio` | the intro | `Intro`, in the heroes that draw one | `paras` | Your intro |
| `profile.location` | where you are | `Meta` (five heroes), Notebook's facts, Ledger's rows | `text` | Where you're based |
| `profile.lookingFor` | what you're looking for | the same places | `text` | What you're looking for |
| `profile.linkedin`, `profile.github`, `profile.website`, `profile.contactEmail` | your links | Get in touch's rows | the "Your links" popover (`tools("contact")`) | LinkedIn, GitHub, Website, Email |
| `arrangement.header.linkedin` | show LinkedIn | the hero and Get in touch | a switch in the same popover | Show LinkedIn on your page |
| `arrangement.tiles.about.text` | About me's words | About | `paras` | About you |
| `arrangement.tiles.education.lines.N` | a course or qualification, and its year | About's rows | two `text` fields, `part` "label" and "year" | Course or qualification N; Year |
| `arrangement.tiles.education.tools` | the tools line | About's last row | `text` | Tools you use |
| `arrangement.tiles.experience.lines.N` | a job or role, and its years | Experience's rows | two `text` fields, `part` "label" and "year" | Role N; Years |
| `arrangement.tiles.quote.text` | the quote | Quote, between its marks | `text`, inline | The quote, word for word |
| `arrangement.tiles.quote.name`, `arrangement.tiles.quote.role` | who said it, their role | Quote's byline, on one line | `text`, inline | Who said it; Their role (optional) |
| `arrangement.sections` | the sections and their order | each section's frame; "Add a section" | toolbars and drag | (the section's name) |
| `arrangement.order`, `arrangement.featured`, `arrangement.hidden` | the exhbts' order, the band, the hidden ones | each tile's frame; the hidden row | tile controls and drag | (the exhbt's title) |
| `arrangement.themeId` | the look | the whole page | the Look menu | Look |

Every field carries `data-path`. A problem is shown at its path: `profileProblems` key `k` at `profile.k`; `checkTiles` key `kind.field` at `arrangement.tiles.kind.field` (a list's problem, `education.lines`, at `arrangement.tiles.education.lines`, which the list's own anchor carries). Heroes that repeat a line from About (Notebook's facts, Ledger's rows of education) draw it as words, not as a field: the line is typed in About.

The editing page matches the visitor's page box for box except for these, which the box-for-box tests allow by name (`HOME_EDIT_ONLY_IN_FLOW` in `e2e/portfolio-editor.ts`, the portfolio's twin of `EDIT_ONLY_IN_FLOW` in `e2e/page-editor.ts`):

1. **Placeholders.** An empty field shows its placeholder, one line of the type it sits in.
2. **Empty sections drawn whole.** An empty About, Experience, Quote or Get in touch draws its heading and its empty fields, where the visitor's page leaves the section out. (The step builder's dashed `EmptySection` outline is not used in the editor.)
3. **The vision.** With no exhbt yet and the band on the page, the band is drawn full size in the look's band colours: "Your best project goes here", with the look's own button, "Add an exhbt" (`owner("band")`).
4. **The end of the work.** After the last card (`owner("work-end")`), or after the last section when More of my work is off the page (`owner("page-end")`): owner-only tiles (a draft, an exhbt over the plan's limit), then the Add tile, then the hidden row.
5. **An empty More of my work.** When the only exhbt is in the band, More of my work draws its heading to hold the Add tile.
6. **Studio's name.** Studio sets the name one word per line; while it is being typed it is one field. Its box differs; nothing else on the page moves.

Everything else the editor adds is drawn over the page and takes no room: section and tile toolbars, "Add a line", the photo button, Suggest an intro, the "Your links" button. The bar, the first-run strip, the team notice and the note after a publish are app chrome above or below the page.

`/portfolio`, with the switch at `page`:

| In the address | What the editor does |
|---|---|
| `?builder=steps` | Serves the step builder for this request, whatever the switch says: the escape and the crash fallback. Wins over everything below. |
| `?open=look` · `address` · `job-links` · `team` · `links` | Opens that menu, sheet or popover once the page is up. |
| `?at=<exhbt id>` | Scrolls to that tile and marks it for two seconds. If the exhbt is live, the note at the foot of the window says "<title> is live at <address>" with Copy link. |
| `?full=1` | The Add tile gives the plan's reason in the alert tone (`canCreateExhbt`). With `open=team`, the team sheet gives it beside Make my own. |
| `?joined=1`, `?left=1` | Opens Team, with today's note from `/exhbts` (`TEAM_SAID`). |
| `?step=you` | Focuses `profile.name`. |
| `?step=look` | As `open=look`. |
| `?step=projects` | Scrolls to the work. |
| `?step=publish` | As `open=address`. |
| `#team-projects` | As `open=team` (sent emails carry it; browsers keep it across the `/exhbts` redirect). |
| `#job-links` | As `open=job-links`. |

Once acted on, the query and the hash are taken out of the address with `history.replaceState`, so a reload does not do it again. Unknown values are ignored. With the switch at `steps` the step builder reads `?step=` as it does today and ignores the rest.

```ts
// lib/portfolio-kind.ts  (the rule only: reads no request; copied from lib/editor-kind.ts, which it never imports,
// because that file is deleted with the classic exhbt editor)
export type PortfolioKind = "page" | "steps";

/**
 * THE SWITCH for portfolio first: "steps" is today's app for everyone (the step builder, the two nav items,
 * today's landings after sign-in); "page" is the one-page editor and the new structure. Pinned by
 * e2e/portfolio-switch.spec.ts (SHIPPED_DEFAULT): change both in one commit. The runtime variable
 * EXHBT_PORTFOLIO overrides it for everyone without a deploy.
 */
export const DEFAULT_PORTFOLIO: PortfolioKind = "steps";

/** An admin's own choice, for a year, honoured only while the signed-in person is an admin. Set by POST /api/portfolio/editor. */
export const PORTFOLIO_OWN_COOKIE = "exhbt-portfolio-own";
/** Development only: stands in for EXHBT_PORTFOLIO in one browser ("page", "steps", or "default" for not set). */
export const PORTFOLIO_KIND_COOKIE = "exhbt-portfolio-kind";

export const isPortfolioKind = (v: unknown): v is PortfolioKind => v === "page" || v === "steps";

export type PortfolioFacts = {
  /** process.env.EXHBT_PORTFOLIO as it is set, if it is. */
  variable: string | undefined;
  production: boolean;
  devCookie?: string;
  admin?: boolean;
  own?: string;
};

/** What an ordinary person gets, and what /api/health reports. */
export function portfolioForEveryone(f: PortfolioFacts): PortfolioKind;
/** What this person gets: an admin's own choice first, then what everyone gets. */
export function decidePortfolio(f: PortfolioFacts): PortfolioKind;
```

```ts
// lib/portfolio-kind-server.ts  (import "server-only"; reads cookies and process.env.EXHBT_PORTFOLIO on each request)
export async function portfolioKindForEveryone(): Promise<PortfolioKind>;
/** `admin` is isAdmin(user), checked on this request. */
export async function portfolioKind(admin: boolean): Promise<PortfolioKind>;
/** For code with no signed-in person to hand (the app layout's nav): asks isAdmin only when the own cookie is there. */
export async function portfolioServed(): Promise<PortfolioKind>;
```

- `EXHBT_PORTFOLIO` is never listed in `wrangler.jsonc` `vars` (every deploy would reset it) nor in `next.config.ts` `env` (it would be fixed at build).
- `POST /api/portfolio/editor` (form field `kind`: `page` or `steps`): 404 for anyone who is not an admin; otherwise sets `PORTFOLIO_OWN_COOKIE` (httpOnly, sameSite lax, one year) and redirects to `/portfolio`.
- `GET /dev/portfolio-kind?kind=page|steps|default`: sets `PORTFOLIO_KIND_COOKIE` in that browser and redirects to `/portfolio`; 404 in production.
- `/api/health` gains `portfolio: "page" | "steps"` from `portfolioKindForEveryone()`, never an admin's own choice; `?only=portfolio` answers at once.
- `isAdmin` in `lib/admin.ts` stays: this switch calls it, so the classic editor's removal must not delete it.

## The specs

Commit and push after each.

1. **`portfolio-structure`** (the flows, end to end, at `page` by the dev cookie, with the stand-in AI):
   - a new person signs up with no `next` and lands on `/portfolio`, the strip on step 1, the cursor in the name; types a name and a headline, picks a look, skips the photo; the strip moves to step 2; presses the vision band's "Add an exhbt", starts from a blank page, writes a title, goes back by "Your portfolio" and finds the tile with that title, marked Draft;
   - the same person on Free: the publish sheet's line; "See as a visitor" says visitors get "not found" and why;
   - on Premium: claims an address in the sheet, opens the draft tile, publishes, lands on `?at=` with the tile Live and the note with Copy link;
   - a returning person logs in and lands on `/portfolio`; the nav is "Your portfolio", "Roadmaps";
   - `/exhbts` with no query, `?full=1`, `?joined=1`, `?left=1` and `#team-projects` each arrive where 0031 says;
   - a roadmap idea's "Add as an exhbt" for a first exhbt and for a second;
   - with the switch at `steps`, the same journeys are today's (the step builder, the list, today's landings).
2. **`portfolio-safety`:**
   - opening the editor and leaving without a change writes nothing (compare the stored profile, layout and exhbt positions before and after);
   - a round trip both ways: arrange and type in the editor, open `?builder=steps`, and the step builder shows the same; change it there, open the editor, and it shows that; on each legacy fixture (0014's markers, held extras, a stored locked look, an over-limit exhbt), nothing changes shape until the first edit;
   - a failed save (the action answering an error) keeps the state on screen and says so; a stale action keeps it, says "The site was updated", and offers it back once after a reload;
   - the crash fallback (`?crash=change`) sends the words typed before it, then shows the step builder;
   - the exhbt editor's "Your portfolio" link waits for its save (type a title, press back at once, the tile has the new title);
   - two tabs: the note shows, and the last change saved wins.
3. **`portfolio-visitor`:** for every look, with the full fixture and with a hidden exhbt, a draft, a held extra and a previewed locked look all present: "See as a visitor" matches `/p/<name>` (the public page in development) box for box at 1440 and 412, and shows no draft, hidden exhbt, held extra or the locked look.
4. **`portfolio-editor`:** the editing page against the visitor's page box for box, but for `HOME_EDIT_ONLY_IN_FLOW`, in all eight looks, full and empty; every path in the table typed in place, stored at that path and there after a reload; Undo by name across a move and typing (the typing survives); locks (a locked look never saved, a locked section offered with its reason); axe on the editing page and on every sheet, in all eight looks; no control over any word (`toolbarClashes`).
5. **`portfolio-smooth`** (render counts from `window.__portfolioRenders`): a key in the headline draws the hero again and no tile, card or chart; a key in About's words draws About and nothing below it; a section move draws the moved sections' frames and no chart; nothing moves when a field takes the focus (no box changes).

## Done looks like

All five pass on `phase-2-pf2` with everyone's work merged, at one worker, in CI's Chromium for the markup and the sandbox's for the boxes, each under the time the README allows a shard.

## Report back

The branch head; each spec's result and time; every failure with the owner's letter and the smallest case that shows it; anything 0031 says that you could not test, and why.

Run: your five specs, then `e2e/portfolio-core.spec.ts`, `portfolio-arrange`, `portfolio-bar`, `portfolio-routes`, `portfolio-phone` (`--project=touch`), `portfolio-parity`, `home-slots`, and the old builder specs at `steps` (`phase2-builder`, `phase2-customiser`, `phase2-themes`).

## Rules for every agent

1. **Read first:** `AGENTS.md`, `DESIGN.md`, `docs/MAP.md`, `docs/decisions/0031-portfolio-first.md`, and the other records this brief names. The brief says what to build; the records say why.
2. **Branch:** work only on the branch named above, made from the base named above. Never commit to `main` or a release branch (`phase-2-pf0`, `phase-2-pf1`, `phase-2-pf2`, `phase-2-pf4`). Open no pull requests. The main session merges.
3. **Your files only.** Change the files this brief says you own. If something you need is in a file you must not touch, stop that part, carry on with the rest, and say exactly what you need in your report. Do not work round it with a copy.
4. **Commit and push after every working step.** The account's usage limit can stop you without warning, and only what is pushed survives. A step is small: one function with its test, one component that renders. Push each time (`git push -u origin <your branch>`).
5. **Before every commit, run all four:** `npx tsc --noEmit -p .` ; `npm run lint` ; `npm run check:docs` ; `npm run check:theme`. Then `git checkout -- tsconfig.json` if `next dev` rewrote it.
6. **Playwright:** run only the spec files this brief names, one worker, on your own port: `E2E_PORT=<your port> npx playwright test <file> --workers=1`. Never run the whole suite. Never skip, weaken or delete a test to make it pass, unless this brief names the case.
7. **Never run anything that calls the Anthropic API.** "Suggest an intro" and job-link matching use the stand-in with no key, as the suite does today; do not set `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEYS`.
8. **Commit messages:** plain British English, what changed and why, first line under about 70 characters. End with these two lines:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   `Claude-Session: https://claude.ai/code/session_01SXCVQu8yRBVXtcSEG6wWoZ`
9. **House rules that bite here:** on the portfolio page, colours, faces and corners come only from the look's variables (`--pf-*`, and `--xp-*` for the editor's field styles); app chrome uses the existing tokens and Astryx Buttons through `components/ui/Button.tsx`; lower-case "exhbt" in running text; plain British English with no hype words; no plan figures in prose or UI strings (read them from `lib/entitlements.ts`); hosts only from `lib/hosts.ts` (links to a person's page through `portfolioHref`); Claude Haiku is the only model the app names (`lib/ai/model.ts`); data access goes through the `Store` interface, on both implementations; never edit an applied migration (this build needs no new one); never commit a secret.
10. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), and do not regenerate the portfolio golden copies (`e2e/golden/portfolio/`; brief A writes them once). Brief L's one named edit under `app/(portfolio)/` is the only exception.
11. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
12. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
