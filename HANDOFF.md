# Exhbt: developer handoff (Phase 1)

Phase 1 is everything up to a student or graduate receiving their free roadmap, plus the Premium waitlist. It is complete and tested with **no external services connected**: every service has a working local stand-in, and connecting the real one is a matter of setting environment variables (below).

The current shape is [docs/MAP.md](docs/MAP.md). Plan figures are `lib/entitlements.ts`. Hosts are `lib/hosts.ts`. In short:
- Domain **exhbt.co.uk**; portfolio pieces are **exhbts**.
- Builder order: job, CV (skippable), situation with education & skills. The email is asked for at the gate before the project ideas (decision 0004).
- The paid plans are Premium and Max (decision 0006). On the live site they're still waitlist-only; payments come with Phase 2 (below).
- Universities pay; employers are always free.
- A portfolio is a subdomain of the apex (`lib/hosts.ts`). That split is decided and not routed yet.

## What Phase 1 does

```
Organic traffic:  Home "Describe the job you want" ─► /roadmap/new?role=…  (starts at step 2)
Directed traffic: /start (ads, social, QR): search bar only ─► /roadmap/new?role=… (+ utm_*)

Builder, one question per screen (/roadmap/new?step=1..3)
  1 Describe the job ─► 2 CV (skippable) ─► 3 Situation, education & skills
  └─ submit (server action startRoadmap)
       ├─ validate; a per-connection daily cap; the Free monthly limit only if signed in (lib/entitlements.ts)
       ├─ store the roadmap request
       ├─ set a signed cookie: "this browser may view roadmap X"
       └─ redirect to /roadmap/[id]

/roadmap/[id]
  ├─ no output yet ─► "Building your roadmap" screen
  │     └─ POST /api/roadmap/[id]/generate  (idempotent)
  │           ├─ match the job to the UK jobs dataset (lib/jobs) for its required skills
  │           ├─ cache hit for identical input, or call the AI (cost logged)
  │           └─ signed in only: send the "Your roadmap to {role}" email once (copy + sign-in link)
  └─ output ready ─► five click-through views (?view=)
        overview ─► gaps (radar) ─► strengths ─► projects ─► next (Premium waitlist)
        projects, no email yet ─► gate: name, email, LinkedIn (optional), prefilled from the CV
          └─ server action unlockProjects: Free monthly limit, store the details, send the email once
        projects, unlocked ─► the plan: three ideas, Swap each (AI, cost logged), "Keep this plan"
          └─ swaps run out or kept ─► "Your plan"

Email "See your full roadmap" ─► sign-in link ─► signed in on that device, roadmap claimed to the account
```

Who can view a roadmap: its signed-in owner, or the browser that created it (`lib/access.ts`). Anyone else is sent to log in (or gets a 404 if signed in as someone else).

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run check          # typecheck + lint + build + all e2e tests
npm run test:e2e       # e2e only (starts its own server on :3200)
```

Useful dev-only pages:
- **`/dev/emails`**: every email the app sent while no email provider is configured. Use it to see and restyle emails.
- **`/dev/figure-eval`**: the page the figure eval drives. It runs the draft page's own code on a PDF (draw the pages, choose which to send, ask the pick, cut the answer out). Start it with `npm run eval:figures`, not by hand (`evals/figure-pick/README.md`).
- The roadmap you get locally is a labelled placeholder until `ANTHROPIC_API_KEYS` is set.

## Where things live

| You want to change… | Go to |
|---|---|
| Colours, fonts, radius, focus ring | `app/globals.css` (`@theme` tokens) and the rules in `DESIGN.md` |
| Home page | `app/(marketing)/page.tsx`; its sections in `components/home/` (`HowItWorks`, `LookPreview`, `JobLinks`, `Faq`). Product pictures are the real components in `components/home/Preview.tsx`, never copies |
| Big "describe the job" field + button | `components/home/StartForm.tsx` |
| Search-only page for ads and links (`/start`, linked as "Quick start" in the footer) | `app/start/page.tsx` |
| Builder questions, hints, step order | `app/(app)/roadmap/new/RoadmapWizard.tsx` (`STEPS` at the top) |
| Builder validation and rate limits (server) | `app/(app)/roadmap/actions.ts` |
| CV reading (in the browser) | `lib/cv-client.ts` |
| "Building your roadmap" screen | `components/roadmap/Generating.tsx` |
| Roadmap result screens | `components/roadmap/RoadmapViews.tsx` (`VIEWS` at the top) |
| AI prompt and output shape | `lib/ai/roadmap.ts`, `lib/ai/schemas.ts` |
| Generation + email orchestration | `lib/roadmap-service.ts` |
| Email template | `lib/email/templates/roadmap-ready.ts` (sending: `lib/email/send.ts`) |
| Database access | `lib/store.ts` (one interface, Supabase + in-memory implementations) |
| Database schema | `supabase/migrations/` |
| Sign-in | `lib/auth.ts`, `app/auth/*` |
| Portfolio tiles and header (what employers scan first) | `components/exhbt/ExhbtTile.tsx`, `components/exhbt/PortfolioHeader.tsx` |
| Logo, seal, "made with exhbt" sign-off, catalogue numbers | `components/brand/` (`Logo.tsx`, `Seal.tsx`, `MadeWith.tsx`), `catalogueNo()` in `lib/exhbt.ts`; rules in `docs/brand.md` |
| Demo portfolio (`/demo`, fictional person, 4 projects), also pictured on Home and the what-is page | `app/(marketing)/demo/`, drawn by the real `PortfolioHome` and `ProjectView`; data in `lib/exhbt.ts` (`demoOwner`, `demoExhbts` in the new exhbt shape, `demoPortfolio`), kept within the product's limits by `e2e/home.spec.ts` |
| Tier checklists (pricing page, home) | `planFeatures()` in `lib/entitlements.ts`, rendered by `components/site/FeatureList.tsx` |
| The exhbt card (methodology flow, chart, skills) | `components/exhbt/Exhbt.tsx`, `MethodFlow.tsx`, `BeforeAfterChart.tsx`; data shape and example in `lib/exhbt.ts` |
| The skill radar (roadmap Gaps and Projects screens, home example) | `components/charts/SkillRadar.tsx`; the Now / After switch is in the same component; the rules (markers, lists) in `lib/roadmap/radar.ts`; the after-projects rule in `lib/roadmap/skills.ts`; the level scale in `lib/ai/roadmap.ts`; home data in `components/home/SkillsGapExample.tsx` |
| Plans and limits (Free, Premium, Max, Universities), tier names | `lib/entitlements.ts`; pricing page `app/(marketing)/pricing/page.tsx` |
| "We've read N UK job profiles" line | `lib/jobs/claim.ts` (shows only when `NEXT_PUBLIC_JOBS_DATASET_ROLES` ≥ 1,000) |
| Premium waitlist (interest value `premium`) | `components/waitlist/` (form + server action), `waitlist` table |
| UK jobs data (skills per role) | `lib/jobs/`; importer `scripts/import-jobs.mjs` |
| Legal text (drafts, need a solicitor) | `app/(marketing)/legal/[doc]/page.tsx` |

Copy lives next to the component that shows it. Follow the writing rules in `DESIGN.md` (plain British English, no hype words).

## Connecting the real services

Each service switches on when its environment variables are set; until then the stand-in is used. Full list in `.env.example`.

| Service | Variables | Without it |
|---|---|---|
| **Supabase** (database, sign-in, files), EU (Paris, eu-west-3) live; the preview project is London | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | In-memory store (lost on restart), a password kept in memory for `/login`, and a dev sign-in link. **Production refuses to start without it.** |
| **Anthropic** (roadmap generation, `claude-haiku-5-5`) | `ANTHROPIC_API_KEYS` | Labelled placeholder roadmap |
| **Resend** (roadmap email) | `RESEND_API_KEY`, `EMAIL_FROM` | Emails go to `/dev/emails` |
| Cookie and link signing | `EXHBT_COOKIE_SECRET` | Dev default; **required in production** |
| Public URL (used in email links) | `NEXT_PUBLIC_SITE_URL` | Taken from the request |

Supabase setup:
1. Create a project in an EU region (live is Paris, eu-west-3; the preview project is London, eu-west-2) and run every file in `supabase/migrations/` in date order.
2. Under Auth, enable the email provider (password sign-in), set the Site URL, and add `https://<domain>/auth/callback` and `https://<domain>/auth/confirm` as redirect URLs.
3. `/login` is an email or username plus a password (`lib/password-auth.ts`), with a button to create an account. Google appears above the form when the public Supabase URL and anon key are set. It works only after the Google provider is switched on in Supabase (`LAUNCH.md`). A new account gets one confirmation email, and setting a password on an older account gets one reset email. Both are sent by the app through Resend, not by Supabase's SMTP, and their links go to `/auth/confirm` so they work on any device. The roadmap email still includes its own sign-in link (`signInLinkFor` in `lib/auth.ts`).
4. Verify your sending domain (exhbt.co.uk) in Resend.
5. When the UK jobs dataset is available, load it with `node scripts/import-jobs.mjs path/to/jobs.csv` (needs the Supabase URL and service-role key in the environment; see the header of the script for the expected columns). Until then a small sample of roles in `lib/jobs/seed.ts` is used.

Then deploy. The intended route is Cloudflare building from GitHub on every push to `main`; **[LAUNCH.md](LAUNCH.md)** has the click-by-click steps. Manual alternative: `npm run deploy`, with secrets set via `npx wrangler secret put <NAME>`.

**Private preview vs public:** the site is private by default: `noindex` everywhere, `robots.txt` disallows all, and a preview bar shows. It only goes public when built with `EXHBT_PUBLIC=1` (`lib/site.ts`, `next.config.ts`). Production sets it in `wrangler.jsonc` `vars` (and the production build step must too); the preview Worker does not. In production a missing `ANTHROPIC_API_KEYS` or `RESEND_API_KEY` fails loudly (logged); it never falls back to placeholder roadmaps or the dev outbox.

## Phase 2: services and settings

Phase 2 (portfolios, the exhbt editor, uploads and AI drafts, paid plans) is on the `phase-2` branch; the plan is `docs/phase-2.md` and the shape is in `docs/MAP.md`. Like Phase 1, it runs locally with nothing connected.

| Service | Settings | Without it |
|---|---|---|
| **Phase 2 switch** | `EXHBT_PHASE2=1`, a runtime variable (not a build one) | Always on in development and tests. In production, Phase 2 pages return 404 until it's set, so turning it off hides them without a redeploy |
| **Stripe** (checkout, billing portal, webhook) | Secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Price ids `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_MAX` in `wrangler.jsonc` `vars` (not secret) | Billing page can't take payments. The e2e suite sets test values in `playwright.config.ts` |
| **Supabase Storage** | Buckets `sources` and `evidence`, both private, created by `supabase/migrations/20261114000000_phase2_schema.sql`. Uses the Supabase keys above | Uploads go to an in-memory stand-in (`/dev/upload`, `/dev/files`) |
| **The editor switch** | `EXHBT_EDITOR`, a runtime variable set in the Cloudflare dashboard, never in `wrangler.jsonc` or `next.config.ts`: `page` or `classic`, for everyone | `DEFAULT_EDITOR` in `lib/editor-kind.ts` decides: the classic editor (below, "The editor switch") |

`/api/health` reports these under `phase2`: each Stripe setting (present or not, never the value), whether the Stripe key and both price ids work, and whether both buckets exist and are private. None of it changes the overall `ok` yet. Fold it in when payments are meant to be live.

Prices and limits are `lib/entitlements.ts`. The Stripe dashboard steps are in `LAUNCH.md`.

Development pages for Phase 2 (all 404 in production and when Supabase is connected):
- **`/dev/portfolio?username=amara&plan=premium&count=2`**: makes a fictional portfolio with published exhbts and opens it. The owner is the dev sign-in user `<username>@example.com`, so sign in with that address (`/auth/dev?email=amara@example.com`) to edit the same portfolio. Add `look=night` (any look or colourway id, decision 0018), `rich=1` (every profile field and section filled in), `name=` (try a long one), `graphs=none` and `with=open-banking` to see every look with real-world content. `with` is a comma list: `with=gallery` publishes a gallery at `/p/<username>/freshers-campaign`, `with=research` a research poster at `/p/<username>/walk-and-recall`, and `with=formats` both (decision 0024).
- **`/dev/plan?plan=max&next=/exhbts`**: puts the signed-in dev user on a plan without Stripe.
- **`/dev/upload/<id>`** and **`/dev/files/<id>`**: the in-memory stand-in for Storage. Uploads PUT to the first; portfolio pages read from the second. Files are gone when the server restarts.
- **`/dev/editor?kind=page`**: stands in for `EXHBT_EDITOR` in this browser alone. `kind=classic` and `kind=default` (the variable not set) are the other settings, and an empty `kind=` clears it.
- **`/dev/admin?role=admin`**: makes the signed-in dev user an admin (`role=user` takes it back), for `/admin` and the admin's own editor switch.

### The editor switch

The edit-on-page editor (decision 0026) is on the live site switched off: everyone gets the classic editor. Rory decided to launch it this way on 24 Nov 2026, because three iPhone behaviours cannot be tested without a real iPhone. He tries it on his own iPhone, and it is switched on for everyone the same day. The rule and its one constant are `lib/editor-kind.ts`; decision 0026 has the detail, under "The classic editor: the switch, the fallback, the escape" and "Going live: switched off, then on".

- **Switched off by default.** `DEFAULT_EDITOR` in `lib/editor-kind.ts` is `"classic"`. `/api/health` reports what an ordinary person gets, as `editor`.
- **An admin's own switch.** An admin can turn the new editor on for themselves. On a phone:
  1. Log in with your own account.
  2. Open `/admin` on the same site. If the overview opens, the account is an admin there; if the page is not found, it is not, and the button will not be there.
  3. Open "Your exhbts" and open any exhbt. It opens in the classic editor.
  4. At the very top of the page is a line that starts "Admins only". Press "Try the new editor" in it.
  5. That exhbt, and every one opened in that browser afterwards, is in the new editor.
  6. To go back: Menu (the three dots at the end of the editor's bar), then "Use the classic editor". That is remembered too.

  Nobody who is not an admin is sent the button, and the cookie that remembers the choice counts for nothing in their browser: whether the person signed in is an admin is checked on every request.
- **On for everyone.** With no deploy, set `EXHBT_EDITOR` to `page` on the live Worker in the Cloudflare dashboard. Or in the code: change `DEFAULT_EDITOR` to `"page"`, and `SHIPPED_DEFAULT` at the top of `e2e/editor-admin-switch.spec.ts` to match (the one test that pins the default), then deploy.
- **Everyone back to the classic editor.** Set `EXHBT_EDITOR` to `classic`. It needs no deploy and works after either way of switching on. An admin's own choice still comes first.

`npm run dev` serves the classic editor, as the live site does. To work on the new one, put `EXHBT_EDITOR=page` in `.env.local`, or open `/dev/editor?kind=page` once in the browser.

Where Phase 2 lives:

| You want to change… | Go to |
|---|---|
| Blocks, limits, word count | `lib/exhbt/blocks.ts` (decisions 0007 and 0009) |
| How an exhbt looks | `components/portfolio/ProjectView.tsx` |
| An exhbt's layout (case study, gallery, research) | `lib/exhbt/formats.ts`, `lib/exhbt/layouts.ts` (the order and rows), `components/portfolio/LayoutMain.tsx` with `layout-rows.ts` (the renderer), `components/editor/LayoutPicker.tsx` (decision 0024) |
| The editor | `app/(app)/exhbts/[id]/edit/`, `components/exhbt-editor/` (the page itself, decision 0026; `css/` holds each owner's styles), `components/editor/` (the classic editor, for one release) |
| Which editor a person gets | `lib/editor-kind.ts` (the rule and `DEFAULT_EDITOR`), `lib/editor-kind-server.ts`, `app/api/exhbts/editor/route.ts` (an admin's own choice) |
| Uploads and AI drafts | `app/(app)/exhbts/new/`, `lib/uploads.ts`, `lib/files.ts`, `lib/ai/exhbt-draft.ts`, `lib/exhbt/verify.ts` |
| The portfolio builder (profile, look, projects, address) | `app/(app)/portfolio/` (decision 0016) |
| Portfolio pages | `app/(portfolio)/` (hosts: decision 0001; the subdomain routing is being built separately) |
| Billing | `app/(app)/account/billing/`, `lib/stripe.ts`, `app/api/stripe/webhook/route.ts` |
| Which plan someone is on | `lib/plan.ts` (`getPlan`), rules in `lib/plan-rules.ts` |

## Known limits and decisions

- **Hosting plan:** Cloudflare's free Workers plan allows about 10 ms of CPU per request, and server rendering can exceed that. Budget for **Workers Paid ($5/month)**. CV parsing already happens in the browser to keep server work light.
- **Email links expire** (Supabase default: 1 hour). After that, the email tells people to open the roadmap URL and log in with their email, which works.
- **Marketing consent** is an unticked opt-in at the project-ideas gate, stored as `pending_marketing_opt_in` on the roadmap and copied to the profile on sign-in. Every email has an unsubscribe link (`/api/email/unsubscribe`, signed token, also one-click). Have the privacy policy reviewed before sending any marketing.
- **Fake emails are accepted** (the roadmap shows without verifying the address). That was a product decision; rate limits contain abuse.
- **Scanned-image PDFs** have no text to read; the builder asks people to paste instead. There's no OCR.
- **JavaScript is required** for the builder (steps and CV reading are client-side). Server-side file parsing was removed to keep the Worker small and fast.
- **Phase 1 has no checkout:** the pricing page and the roadmap's last screen collect a waitlist for Premium (`waitlist` table). With Phase 2 on, they point to the plans and checkout instead.
- **The jobs seed is illustrative.** Its skills are placeholders until the real dataset is imported; confirm the dataset's licence allows this use before importing.
- **Per-employer links** are a path on the person's host, with a short random suffix so the company name cannot be guessed. See `lib/hosts.ts`.

## Tests

`e2e/` (Playwright, run by CI in `.github/workflows/ci.yml`):
- `phase1.spec.ts`:
  - job pre-fill, `/start` entry, per-step validation, Back keeps answers
  - jobs data shapes the gaps; Premium waitlist
  - instant result through the free views to the project-ideas gate, then the plan
  - the gate's CV prefill and validation; swapping ideas until it's your plan
  - email in the outbox, with a working sign-in link
  - other-browser protection
  - email sent once
  - Free monthly limit, unsubscribe
- `password-login.spec.ts`: create an account, log in with the email or the username, and set a new password from the reset link
- `a11y.spec.ts`: axe WCAG 2.1 AA on every public page, every builder step and every result view.
- `responsive.spec.ts`: the home CTA is above the fold on desktop and phone; no sideways scrolling.
- `preview.spec.ts`: private-preview noindex, robots and banner.

- Phase 2: `phase2-account.spec.ts` (usernames, profile), `phase2-portfolio.spec.ts` (blocks, plan rules, portfolio pages), `phase2-draft.spec.ts` (uploads, AI draft), `auto-figure.spec.ts` (the figure picked from an uploaded PDF: the work's own graph taking the place of the drafted one, scans, and the line the editor says after a draft), `phase2-editor.spec.ts` (editor, publish), `phase2-billing.spec.ts` (Stripe), `phase2-hardening.spec.ts` (account export, privacy and terms).
- The edit-on-page editor (decision 0026): `editor-inplace.spec.ts` (every field typed in place and stored at its path, the jump to each kind of issue path, Undo, files, publishing in order, the editing page against the visitor's box for box in every look, axe), `editor-smooth.spec.ts` (the smoothness checks that gate CI: one render per key, nothing moving on focus), `editor-classic.spec.ts` (the switch, the escape and the crash fallback), `editor-admin-switch.spec.ts` (the new editor switched off for everyone, an admin's own switch, `EXHBT_EDITOR` both ways, and what `/api/health` reports). The suite's server runs with `EXHBT_EDITOR=page` (`playwright.config.ts`), so every spec tests the new editor as it is once on for everyone, and `editor-admin-switch.spec.ts` sets the switched-off state for its own browser. Their page object is `e2e/page-editor.ts`, which holds `EDIT_ONLY_IN_FLOW`, the one list of what is in the flow in the editor only. `/dev/editor-timing` draws the editor on a sample with no sign-in, for the box tests and the timing script.

Tests run against the dev server with no services connected. They use the build folder `.next-e2e`, so they can run while `npm run dev` is up.

The e2e tests use the stand-in for every AI call, so they say nothing about how well the model does. Two evals measure that with the real model, and never run on a push because each run is paid for: the draft eval (`npm run eval:drafts`, `evals/exhbt-draft/README.md`) and the figure eval (`npm run eval:figures`, `evals/figure-pick/README.md`). Both run from the Actions workflow "Exhbt draft eval", which asks which suite to run.

To run the suite beside another one (a second worktree, or a dev server on the default port), give it its own port and keep it to one browser at a time:

```bash
E2E_PORT=3236 npx playwright test --workers=1
```

**AI request shapes are checked against the real API, not by these tests.** Every AI call asks for a structured answer: the API compiles its JSON schema into a grammar first, and refuses a schema that is too large with a 400. The tests use the stand-in AI, which never sends a request, so they can't see a refusal; that is how drafting broke on 17 Nov unseen (decision 0029: the shapes the API accepts today imply drafts failed from 17 Nov; that has not been checked against the live log). `scripts/probe-ai-shapes.ts` (`npm run probe:ai`) sends each module's own `output_config` with a one-line prompt and a tiny `max_tokens`, and fails if any is refused. It also checks "draft with planned growth", the draft with the fields already built for later releases, so a release can't take the draft over the limit unseen. Nothing starts it automatically: `.github/workflows/ai-shapes.yml` runs it only when a person starts that workflow by hand (Actions tab > "AI request shapes" > Run workflow), and the draft eval, also started by hand, runs it first. Automatic runs were switched off on 23 Nov 2026 at the owner's request (Rory), after test runs used up the key's monthly allowance; before that the workflow was set to run on every push or pull request that changed `lib/ai/`, the layout or graph lists, the probe or the lockfile, and weekly. Run it before a release that changes anything under `lib/ai/` or a schema it uses, such as the layout and graph lists, and only with Rory's say-so, having told him the cost first. One run uses the `ANTHROPIC_API_KEY` secret and starts both of the workflow's jobs: the probe, at a fraction of a penny, and the token-room check below, at about 12 US cents. `npm run probe:ai -- --dry` prints each schema's size with no key; `--explore` adds the measuring ladders. When you add a field to an AI answer, keep it non-null (empty string, empty list or false) and check the count `--dry` prints against the limit in decision 0029; that makes no API call, and the probe itself runs before the release, as above.

**Each call's `max_tokens` must hold the model's thinking as well as its answer.** `scripts/measure-ai-room.ts` (`npm run measure:ai`) sends each call's own request (the `...Request` builder beside it) with a typical and a heavy input, three times, and prints the cap, the stop reasons and the tokens used. It fails if any answer was cut off. The same workflow runs it, by hand only and under the same rule (about 72 calls and 12 US cents a run); its weekly run was switched off with the others on 23 Nov 2026. When you change a prompt or a cap, keep each cap at least three times the largest total measured (decision 0029), and have the workflow run before the release to check that still holds; `npm run measure:ai -- --dry` prints each request's cap and size with no API call.

On a machine with Chromium already installed (Claude Code cloud), add `PW_CHROMIUM_PATH=<path to chrome>`. The full suite takes about six minutes. If the dev server adds a `.next-*/types` line to `tsconfig.json` while it runs, don't commit it.

## What comes next

Phase 2 is above. Per-job links on Max are built and their public page is connected (`JOB_LINKS_LIVE`). Still to come: the subdomain routing (being built separately; decision 0001), and the originality check, which is sold as "coming soon" until `ORIGINALITY_CHECK_LIVE` is true in `lib/entitlements.ts`. The decisions are in `docs/decisions/`.
