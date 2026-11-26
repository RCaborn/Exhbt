# Brief H: the new structure, behind the switch

| | |
|---|---|
| Release | R2, editor and structure, switched off |
| Model | Sonnet |
| Branch | `phase-2-pf-h-structure`, made from `phase-2-pf2` |
| Port | 3328 |
| Starts when | B is merged; the new exhbt editor is on for everyone; the classic exhbt editor's removal (`docs/briefs/edit-on-page/r5-p-remove-classic.md`) is merged, or the main session has said it waits until R2 is merged. The two are never in flight together |
| Hours | About 6 |

## Goal

Make the app hang together round the portfolio, behind the switch: the exhbts list goes (its address redirects), the upload says it adds to the portfolio, the exhbt editor's way back says "Your portfolio" and a first publish returns there, the account and job-link pages point at the portfolio, and a roadmap idea is "Add as an exhbt". With the switch at `steps` every page does exactly what it does today. The editor itself is E's, F's and G's; the nav and where sign-in lands are already behind the switch (B).

## Read first

`docs/decisions/0031-portfolio-first.md` ("The structure", all of it; "Continuity with the exhbt editor"; "The switch"). `lib/portfolio-kind.ts` and `-server.ts` (B's). `app/(app)/exhbts/page.tsx`, `exhbts/new/page.tsx`, `exhbts/[id]/actions.ts`, `exhbts/[id]/edit/page.tsx`, `exhbts/[id]/team/page.tsx`; `components/exhbt-editor/topbar/TopBar.tsx`, `sheets/PublishSheet.tsx`, `context.ts`, `pending.ts` (`flushPending`, read only); `components/editor/PublishWhere.tsx` and `lib/exhbt/publish-words.ts` (read only); `app/(app)/account/page.tsx`, `account/portfolio/page.tsx`, `account/billing/page.tsx`; `app/(app)/portfolio/customise/page.tsx`; `app/(app)/job-links/page.tsx`, `new/page.tsx`, `[id]/page.tsx`; `app/(app)/team/actions.ts` and `team/accept/page.tsx`; `components/roadmap/BuildThis.tsx`, `RoadmapViews.tsx`; `app/(app)/roadmap/[id]/page.tsx`, `roadmap/saved/page.tsx`; `lib/duplicates.ts` (read only).

## You own

`components/team/TeamPanel.tsx` (new); `app/(app)/exhbts/page.tsx`; `exhbts/new/page.tsx`; `exhbts/[id]/actions.ts` (the idea redirects and the revalidations only); `exhbts/[id]/edit/page.tsx` (passing the switch to the editor only); `exhbts/[id]/team/page.tsx` (its back link only); `components/exhbt-editor/topbar/TopBar.tsx` (the back link only); `components/exhbt-editor/sheets/PublishSheet.tsx` (what follows a publish, and Free's line, only); `components/exhbt-editor/context.ts` (one optional prop, `portfolioFirst?: boolean`, on the editor's props); `app/(app)/account/page.tsx` (the link row); `account/portfolio/page.tsx`; `account/billing/page.tsx` (one button); `app/(app)/portfolio/customise/page.tsx`; `app/(app)/job-links/page.tsx`, `job-links/new/page.tsx` and `job-links/[id]/page.tsx` (back links only); `app/(app)/team/accept/page.tsx` (its `next` only); `components/roadmap/BuildThis.tsx`; `app/(app)/roadmap/[id]/page.tsx` and `roadmap/saved/page.tsx` (passing the switch to `BuildThis` only); `e2e/portfolio-routes.spec.ts` (new).

## You must not touch

The rest of `components/exhbt-editor/` (above all `store-core.ts`, `undo.ts`, `Autosave.tsx`, `pending.ts`) and `components/editor/` (the classic editor, `PublishWhere.tsx` included). `lib/editor-kind*.ts`. `lib/hosts.ts`, `middleware.ts`. `app/(portfolio)/**`, `app/(marketing)/**`. `lib/duplicates.ts` and `app/(app)/team/actions.ts` (their `/exhbts` links reach the portfolio through the redirect). `app/(app)/portfolio/` but `customise/`. The billing page and the account page are Alex's: change only the lines named. Alex reviews this pull request.

## What you build against

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
// components/team/TeamPanel.tsx  (server components; H moves them out of app/(app)/exhbts/page.tsx with no change in what they draw)

/** "Someone asked to join your exhbt": each request with Review. Draws nothing when there is none. */
export async function JoinRequests(props: { userId: string }): Promise<ReactNode>;

/**
 * "Team projects": the projects the person is on as a teammate, with today's buttons and server actions
 * (Open your own exhbt, Make my own exhbt from this project, View, Leave). `said` is today's note after
 * joining or leaving; `full` is today's upgrade prompt after a refused Make my own. Draws nothing when the
 * person is on no team project and `said` is null.
 */
export async function TeamProjects(props: { userId: string; host: string | null; said: "joined" | "left" | null; full: boolean }): Promise<ReactNode>;

/** Both, requests first: what the editor's Team sheet shows. */
export async function TeamPanel(props: { userId: string; host: string | null; said: "joined" | "left" | null; full: boolean }): Promise<ReactNode>;
```

The `/exhbts` list draws `JoinRequests` and `TeamProjects` where it draws those sections today, until the clean-up. The editor's page passes `<TeamPanel …/>` to the editor as its `team` prop.

## Every link to the exhbts list, and what happens to it

From a search of `app/`, `components/` and `lib/` at 5261c10. **Switch**: changed behind the switch, here. **Redirect**: left as it is; the `/exhbts` redirect takes it to the portfolio. **R4**: the clean-up deals with it.

| File | What | Treatment |
|---|---|---|
| `components/site/SiteHeader.tsx` | the nav | done by B |
| `app/(app)/exhbts/page.tsx` | the list | Switch: redirect; TeamPanel moved out (step 1) |
| `app/(app)/exhbts/new/page.tsx` | the upload's back link and title | Switch |
| `app/(app)/exhbts/[id]/actions.ts` | `createFromScratch`'s `?full=1`, delete's `/exhbts`, the idea redirects | Redirect for the first two; Switch for the ideas |
| `app/(app)/exhbts/[id]/team/page.tsx` | "Your exhbts" back link | Switch: back to that exhbt's editor |
| `components/exhbt-editor/topbar/TopBar.tsx` | "Your exhbts" back link | Switch |
| `components/exhbt-editor/sheets/PublishSheet.tsx` | "Back to your exhbts" | Switch |
| `app/(app)/team/actions.ts` | `?joined`, `?left`, `?full` | Redirect (the query is kept) |
| `app/(app)/team/accept/page.tsx` | `/exhbts#team-projects` | Switch: `/portfolio?open=team` |
| `lib/duplicates.ts` | the match email's `/exhbts#team-projects` | Redirect (browsers keep the hash; the editor reads it) |
| `app/(app)/account/page.tsx` | "Your exhbts · Build your portfolio" | Switch: "Your portfolio" |
| `app/(app)/job-links/new/page.tsx` | back to `/portfolio#job-links` | Switch: `/portfolio?open=job-links` |
| `app/(app)/portfolio/actions.ts`, `Builder.tsx`, `JobLinksSection.tsx`, `StepPublish.tsx`, `StepProjects.tsx` | the step builder's own | R4 |
| `components/editor/Editor.tsx` | the classic editor | left: it is deleted by brief P |
| `components/roadmap/RoadmapViews.tsx` | the closing card's "Make an exhbt" | left (it goes to `/exhbts/new`, which is right) |
| `app/(portfolio)/p/[username]/page.tsx` | the owner preview's link | Redirect now; R4 rewords it (protected until then) |
| `app/(marketing)/page.tsx`, `what-is-an-exhbt/page.tsx` | "Build your exhbt" to `/exhbts/new` | left: `/exhbts/new` does the new thing |
| `app/dev/plan/route.ts` | a development route | Redirect |
| `lib/hosts.ts` | `TOOL_PATHS` | left |

## Steps

Commit and push after each. Each changed page reads the switch with `portfolioKind(await isAdmin(user))` where there is a signed-in person, so an admin trying the new portfolio sees the whole structure.

1. **TeamPanel first** (it unblocks G): move the join requests and the team projects out of `app/(app)/exhbts/page.tsx` into `components/team/TeamPanel.tsx` as the block says, with no change to what the list draws (check with `phase2-teammates.spec.ts`). Push and tell the main session at once.
2. **`/exhbts`** at `page`: a 307 to `/portfolio`, query kept (`?full=1`, `?joined=1`, `?left=1`). At `steps`, the list as it is. The address is never deleted.
3. **The upload** at `page`: the heading "Add an exhbt to your portfolio"; the back link "Your portfolio" to `/portfolio`; under the upload, "Or start from a blank page" (a form posting `createFromScratch`). Signed out, it redirects to `/login?next=/portfolio`.
4. **The exhbt editor's way back.** The edit page passes `portfolioFirst` (the switch is `page`); `TopBar`'s back link then says "Your portfolio" and goes to `/portfolio?at=<id>`, and on click awaits `flushPending()` before it navigates (prevent the default, then `router.push`), so the portfolio never shows an old title. Without the prop, it is exactly today's link.
5. **What follows a publish.** With `portfolioFirst`: a first publish (the exhbt was not live before) goes to `/portfolio?at=<id>` once it has landed; publishing changes to a live exhbt stays in the editor with today's live panel, whose "Back to your exhbts" becomes "Back to your portfolio" (`/portfolio?at=<id>`). On Free the sheet says "This exhbt is on your portfolio as a draft only you can see", with "Back to your portfolio" beside the upgrade. "Choose one" (no username) is left: `/account/portfolio` now redirects to the address sheet.
6. **The team page's back link:** at `page`, "Back to the exhbt" to `/exhbts/<id>/edit`.
7. **Ideas.** `BuildState` (in `BuildThis.tsx`) gains `portfolioFirst?: true`, set by the two roadmap pages that build it; `RoadmapViews` and `PlanEditor` pass `build` on unchanged, so you do not edit them. With it, the button says "Add as an exhbt". In `createFromIdea` and `createFromSavedIdea`, at `page`: a person's first exhbt goes to `/portfolio?at=<id>`; anyone with exhbts already goes straight to the editor, as now. Signed out, as now (sign in, then back to the idea).
8. **Revalidations.** `publishExhbt`, `unpublishExhbt`, `createFromScratch`, `createFromIdea`, `createFromSavedIdea` and the delete action add `revalidatePath("/portfolio")`. These run at either setting; the step builder is a dynamic page too, so it is harmless there.
9. **The redirects and back links** at `page`: `/account/portfolio` to `/portfolio?open=address`; `/portfolio/customise` to `/portfolio`; `/job-links` to `/portfolio?open=job-links`, and the job-link pages' back links the same; `/team/accept`'s `next` to `/portfolio?open=team`; the account page's links "Your portfolio · Billing"; the billing page's success line gains a "Back to your portfolio" button.
10. **`e2e/portfolio-routes.spec.ts`,** each case at both settings (the dev cookie): `/exhbts` with each query; the upload's words and its signed-out redirect; the editor's back link (and that it waited: type a title, press back at once, and the tile has the new title); a first publish landing on `?at=` and a second staying; Free's publish line; each redirect and back link; the idea's first and second exhbt; the account and billing lines.

## Done looks like

At `steps` the app is exactly as today, and the existing specs that open `/exhbts` and the editor pass unchanged. At `page` every row in the table above does what it says.

## Report back

The branch head; the exact lines changed in Alex's files (the account and billing pages); every place you read the switch; the specs' results and times.

Run: `e2e/portfolio-routes.spec.ts`, `e2e/phase2-teammates.spec.ts`, `e2e/editor-topbar.spec.ts`, `e2e/editor-sheets.spec.ts`, `e2e/phase2-joblinks.spec.ts`, `e2e/phase2-billing-polish.spec.ts`, `e2e/phase2-account.spec.ts`.

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
