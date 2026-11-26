# Brief B: the portfolio switch, the nav and landing seams, and the session path

| | |
|---|---|
| Release | R0, guard rails |
| Model | Sonnet |
| Branch | `phase-2-pf-b-switch`, made from `phase-2-pf0` |
| Port | 3322 |
| Starts when | The new exhbt editor is on for everyone and `phase-2-pf0` is cut from `main` |
| Hours | About 5 |

## Goal

Lay the rails the rest of the build runs on, changing nothing anyone sees: the switch that will carry the one-page editor and the new structure (unused yet), the two places the structure changes in Alex's files (the nav and where sign-in lands) behind that switch, `/portfolio` in the session paths, the in-memory store's roadmap prefill, and a check that stops a change to visitors' pages.

## Read first

`docs/decisions/0031-portfolio-first.md` ("The structure", "The switch", "Data"). `lib/editor-kind.ts`, `lib/editor-kind-server.ts`, `app/api/exhbts/editor/route.ts`, `app/dev/editor/` and `e2e/editor-admin-switch.spec.ts`: the exhbt editor's switch, which you copy and never import (they are deleted with the classic exhbt editor). `lib/admin.ts` (`isAdmin`). `app/api/health/route.ts`. `components/site/SiteHeader.tsx`, `app/(app)/layout.tsx`. `lib/auth.ts` (`safeNext`) and its callers: `app/(app)/login/actions.ts`, `login/page.tsx`, `login/new/page.tsx`, `login/link/page.tsx`, `app/auth/callback/route.ts`, `app/auth/confirm/route.ts`, `app/auth/dev/route.ts`. `middleware.ts` (`SESSION_PATHS`). `lib/store.ts` (`claimPendingRoadmaps` in both implementations). `.github/workflows/ci.yml`.

## You own

`lib/portfolio-kind.ts`, `lib/portfolio-kind-server.ts`, `lib/landing.ts`, `components/site/app-nav.ts` (all new); `app/api/portfolio/editor/route.ts`, `app/dev/portfolio-kind/` (new); `app/api/health/route.ts` (the `portfolio` line and `?only=portfolio`); `components/site/SiteHeader.tsx`; `app/(app)/layout.tsx`; the sign-in fallbacks in the seven files above (the fallback argument only); `middleware.ts` (`SESSION_PATHS` only); `lib/store.ts` (the in-memory `claimPendingRoadmaps` only); `scripts/check-protected.mjs` (new); `package.json` (the `check:protected` script); `.github/workflows/ci.yml` (one step); `e2e/portfolio-switch.spec.ts`, `e2e/portfolio-landing.spec.ts` (new).

## You must not touch

`lib/editor-kind.ts` and `lib/editor-kind-server.ts` (read, copy, never import or edit), `lib/hosts.ts`, `app/(app)/portfolio/`, anything under `app/(portfolio)/`, the Supabase `claimPendingRoadmaps`, any migration. These are Alex's files (the header, the app layout, the login pages and actions, the auth routes, `middleware.ts`): change only the lines this brief names. Alex reviews this pull request.

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

```ts
// lib/landing.ts  (no request reading: callers pass what they know)
import type { PortfolioKind } from "./portfolio-kind";
/**
 * Where someone goes after signing in when no `next` says otherwise; safeNext's fallback.
 * "steps", or Phase 2 off: today's places (log-in "/roadmap", sign-up "/account", password "/account").
 * "page" with Phase 2 on: "/portfolio" for all three.
 */
export function landingAfterSignIn(how: "log-in" | "sign-up" | "password", kind: PortfolioKind, phase2: boolean): string;
```

```ts
// components/site/app-nav.ts
import type { PortfolioKind } from "@/lib/portfolio-kind";
export type NavItem = { href: string; label: string };
/**
 * The signed-in nav. Phase 2 off: Roadmaps only.
 * "steps": Roadmaps (/roadmap), Your exhbts (/exhbts), Portfolio (/portfolio), as today.
 * "page": Your portfolio (/portfolio), Roadmaps (/roadmap).
 */
export function appNav(kind: PortfolioKind, phase2: boolean): NavItem[];
```

`SiteHeader` takes `portfolio?: PortfolioKind` (default `"steps"`) and draws `appNav(portfolio, phase2)` when signed in. `app/(app)/layout.tsx` passes `await portfolioServed()`. Marketing pages still call `SiteHeader` bare and stay static. The landing follows what everyone gets (`portfolioKindForEveryone()`), not an admin's own choice.

## Steps

Commit and push after each.

1. **The rule** (`lib/portfolio-kind.ts`): copy `lib/editor-kind.ts`'s shape and comments, with the names above. `portfolioForEveryone`: the variable when it is exactly `page` or `steps`, otherwise `DEFAULT_PORTFOLIO`; outside production a development cookie of `page`, `steps` or `default` stands in for the variable. `decidePortfolio`: an admin's valid own cookie first.
2. **The request side** (`lib/portfolio-kind-server.ts`, `import "server-only"`), copying `editor-kind-server.ts`; `portfolioServed()` asks `isAdmin(await getCurrentUser())` only when the own cookie is a valid kind, because asking is a call to the sign-in service on the live site.
3. **The routes.** `POST /api/portfolio/editor` and `GET /dev/portfolio-kind`, as the block says, copying `/api/exhbts/editor` and `/dev/editor`. `/api/health` gains `portfolio` beside `editor`, and `?only=portfolio`.
4. **`e2e/portfolio-switch.spec.ts`:** the rule run directly over every combination (variable unset, `page`, `steps`, rubbish; production or not; each dev cookie; admin or not with each own cookie), `SHIPPED_DEFAULT = "steps"` checked against `DEFAULT_PORTFOLIO`; in the browser, the dev cookie, the admin route (404 for someone who is not an admin, the cookie set for an admin, the cookie ignored once that person is not an admin), and `/api/health`.
5. **The nav seam.** `appNav` in `components/site/app-nav.ts`; `SiteHeader` takes `portfolio?: PortfolioKind` and uses it; `app/(app)/layout.tsx` passes `await portfolioServed()`. At `steps` the header's markup is exactly today's (check with the existing `home`, `responsive` and `a11y` specs, unchanged).
6. **The landing seam.** `landingAfterSignIn` in `lib/landing.ts`. Each caller of `safeNext` that relies on its default passes `landingAfterSignIn(<how>, await portfolioKindForEveryone(), isPhase2Enabled())` as the fallback: "log-in" in `login/actions.ts` (the log-in and the magic link), `login/page.tsx`, `login/link/page.tsx`, `auth/callback`, `auth/confirm` and `auth/dev`; "sign-up" in the sign-up action and `login/new/page.tsx`; "password" where `savePassword` continues to `/account`. `safeNext` itself does not change. At `steps` every one lands where it does today.
7. **`e2e/portfolio-landing.spec.ts`:** at `steps` (no cookie), log-in, sign-up and password set land where they do today; at `page` (dev cookie) all three land on `/portfolio`; a `next` wins both ways; the signed-in nav both ways; with Phase 2 off, Roadmaps only.
8. **The session path.** Add `/portfolio` and `/api/portfolio` to `SESSION_PATHS`. Only those paths refresh the session cookie, and a server component cannot write it (`lib/auth.ts`). Say in your report that this cannot be proven in e2e (it signs in with the development cookie); the main session tries it on the preview.
9. **The in-memory prefill.** The Supabase `claimPendingRoadmaps` copies the newest gate name and LinkedIn into an empty profile; the in-memory one only attaches the roadmaps. Make the in-memory one do what the Supabase one does, no more, and test it in `portfolio-landing` (a gate name and LinkedIn fill an empty profile at sign-in; an existing name is not overwritten).
10. **The protected check.** `scripts/check-protected.mjs` lists the files changed against `origin/main` (fetching it if the checkout is shallow) and fails if any is under `app/(portfolio)/`, or is `lib/portfolio.ts` or `lib/plan-rules.ts`, or is a file under `e2e/golden/portfolio/` that already exists on `origin/main` and is changed or deleted (adding goldens is brief A's job and passes). It prints each file and why. `npm run check:protected` runs it; one CI step runs it on pull requests. Prove it fails on a scratch commit that touches `lib/portfolio.ts`, then drop that commit. The clean-up (brief L) is the one change allowed to edit a protected file, and it edits this script to say so.

## Done looks like

With no variable and no cookie, the app behaves exactly as today, and the existing suite passes unchanged. The switch, its admin route, its dev route and the health line work and are tested. At `page` (only by cookie or variable) the nav and the landings are the new ones, and `/portfolio` still serves the step builder (the editor does not exist yet).

## Report back

The branch head; the exact lines changed in each of Alex's files, so he can review them in one read; the specs you ran and their times; the step where you proved `check:protected` fails.

Run: `e2e/portfolio-switch.spec.ts`, `e2e/portfolio-landing.spec.ts`, `e2e/password-login.spec.ts`, `e2e/phase2-account.spec.ts`, `e2e/home.spec.ts`, `e2e/responsive.spec.ts`.

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
10. **Visitors' pages are protected.** Do not edit `app/(portfolio)/**`, `lib/portfolio.ts` or `lib/plan-rules.ts` (`npm run check:protected` fails if you do), and do not regenerate the portfolio golden copies (`e2e/golden/portfolio/`; brief A writes them once). Brief L's named edits (the owner preview's words, and the two parity targets they change) are the only exception.
11. **If something you wait for lands after you started,** the main session will tell you. Then merge the release branch into yours (`git fetch origin && git merge origin/<release branch>`); never rebase a branch you have pushed.
12. **If you are resumed after a stop:** run `git status` and `git log --oneline -5` first, commit and push anything on disk that works, then carry on from the step list.
