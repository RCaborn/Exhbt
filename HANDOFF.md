# Exhbt: developer handoff (Phase 1)

Phase 1 is everything up to a student or graduate receiving their free roadmap, plus the Pro waitlist. It is complete and tested with **no external services connected**: every service has a working local stand-in, and connecting the real one is a matter of setting environment variables (below).

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
        overview ─► gaps (radar) ─► strengths ─► projects ─► next (Pro waitlist)
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
- The roadmap you get locally is a labelled placeholder until `ANTHROPIC_API_KEYS` is set.

## Where things live

| You want to change… | Go to |
|---|---|
| Colours, fonts, radius, focus ring | `app/globals.css` (`@theme` tokens) and the rules in `DESIGN.md` |
| Home page | `app/(marketing)/page.tsx`; product snippets in `components/home/Excerpts.tsx` |
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
| Demo portfolio (`/demo`, fictional person, 4 projects) | `app/(marketing)/demo/`; data in `lib/exhbt.ts` (`demoOwner`, `demoExhbts`) |
| Tier checklists (pricing page, home) | `planFeatures()` in `lib/entitlements.ts`, rendered by `components/site/FeatureList.tsx` |
| The exhbt card (methodology flow, chart, skills) | `components/exhbt/Exhbt.tsx`, `MethodFlow.tsx`, `BeforeAfterChart.tsx`; data shape and example in `lib/exhbt.ts` |
| The skill radar (roadmap Gaps and Projects screens, home example) | `components/charts/SkillRadar.tsx`; levels and the after-projects rule in `lib/roadmap/skills.ts`; home data in `components/home/SkillsGapExample.tsx` |
| Plans and limits (Free/Plus/Pro/Universities), tier names | `lib/entitlements.ts`; pricing page `app/(marketing)/pricing/page.tsx` |
| "We've read N UK job profiles" line | `lib/jobs/claim.ts` (shows only when `NEXT_PUBLIC_JOBS_DATASET_ROLES` ≥ 1,000) |
| Pro waitlist (interest value `premium`) | `components/waitlist/` (form + server action), `waitlist` table |
| UK jobs data (skills per role) | `lib/jobs/`; importer `scripts/import-jobs.mjs` |
| Legal text (drafts, need a solicitor) | `app/(marketing)/legal/[doc]/page.tsx` |

Copy lives next to the component that shows it. Follow the writing rules in `DESIGN.md` (plain British English, no hype words).

## Connecting the real services

Each service switches on when its environment variables are set; until then the stand-in is used. Full list in `.env.example`.

| Service | Variables | Without it |
|---|---|---|
| **Supabase** (database, sign-in, files), London region | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | In-memory store (lost on restart) and a dev sign-in link. **Production refuses to start without it.** |
| **Anthropic** (roadmap generation, `claude-haiku-5-5`) | `ANTHROPIC_API_KEYS` | Labelled placeholder roadmap |
| **Resend** (roadmap email) | `RESEND_API_KEY`, `EMAIL_FROM` | Emails go to `/dev/emails` |
| Cookie and link signing | `EXHBT_COOKIE_SECRET` | Dev default; **required in production** |
| Public URL (used in email links) | `NEXT_PUBLIC_SITE_URL` | Taken from the request |

Supabase setup:
1. Create a project in **London (eu-west-2)** and run every file in `supabase/migrations/` in date order.
2. Under Auth, enable email sign-in, set the Site URL, and add `https://<domain>/auth/callback` and `https://<domain>/auth/confirm` as redirect URLs.
3. Sign-in emails from `/login` are sent by the app through Resend, like the roadmap email (`sendMagicLink` in `lib/auth.ts`), so they don't depend on Supabase's SMTP or email templates. Their links go to `/auth/confirm` and work on any device.
4. Verify your sending domain (exhbt.co.uk) in Resend.
5. When the UK jobs dataset is available, load it with `node scripts/import-jobs.mjs path/to/jobs.csv` (needs the Supabase URL and service-role key in the environment; see the header of the script for the expected columns). Until then a small sample of roles in `lib/jobs/seed.ts` is used.

Then deploy. The intended route is Cloudflare building from GitHub on every push to `main`; **[LAUNCH.md](LAUNCH.md)** has the click-by-click steps. Manual alternative: `npm run deploy`, with secrets set via `npx wrangler secret put <NAME>`.

**Private preview vs public:** the site is private by default: `noindex` everywhere, `robots.txt` disallows all, and a preview bar shows. It only goes public when built with `EXHBT_PUBLIC=1` (`lib/site.ts`). In production a missing `ANTHROPIC_API_KEYS` or `RESEND_API_KEY` fails loudly (logged); it never falls back to placeholder roadmaps or the dev outbox.

## Phase 2: services and settings

Phase 2 (portfolios, the exhbt editor, uploads and AI drafts, paid plans) is on the `phase-2` branch; the plan is `docs/phase-2.md` and the shape is in `docs/MAP.md`. Like Phase 1, it runs locally with nothing connected.

| Service | Settings | Without it |
|---|---|---|
| **Phase 2 switch** | `EXHBT_PHASE2=1`, a runtime variable (not a build one) | Always on in development and tests. In production, Phase 2 pages return 404 until it's set, so turning it off hides them without a redeploy |
| **Stripe** (checkout, billing portal, webhook) | Secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Price ids `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_MAX` in `wrangler.jsonc` `vars` (not secret) | Billing page can't take payments. The e2e suite sets test values in `playwright.config.ts` |
| **Supabase Storage** | Buckets `sources` and `evidence`, both private, created by `supabase/migrations/20261114000000_phase2_schema.sql`. Uses the Supabase keys above | Uploads go to an in-memory stand-in (`/dev/upload`, `/dev/files`) |

`/api/health` reports these under `phase2`: each Stripe setting (present or not, never the value), whether the Stripe key and both price ids work, and whether both buckets exist and are private. None of it changes the overall `ok` yet. Fold it in when payments are meant to be live.

Prices and limits are `lib/entitlements.ts`. The Stripe dashboard steps are in `LAUNCH.md`.

Development pages for Phase 2 (all 404 in production and when Supabase is connected):
- **`/dev/portfolio?username=amara&plan=premium&count=2`**: makes a fictional portfolio with published exhbts and opens it. The owner is the dev sign-in user `<username>@example.com`, so sign in with that address (`/auth/dev?email=amara@example.com`) to edit the same portfolio.
- **`/dev/plan?plan=max&next=/exhbts`**: puts the signed-in dev user on a plan without Stripe.
- **`/dev/upload/<id>`** and **`/dev/files/<id>`**: the in-memory stand-in for Storage. Uploads PUT to the first; portfolio pages read from the second. Files are gone when the server restarts.

Where Phase 2 lives:

| You want to change… | Go to |
|---|---|
| Blocks, limits, word count | `lib/exhbt/blocks.ts` (decisions 0007 and 0009) |
| How an exhbt looks | `components/portfolio/ProjectView.tsx` |
| The editor | `app/(app)/exhbts/[id]/edit/`, `components/editor/` |
| Uploads and AI drafts | `app/(app)/exhbts/new/`, `lib/uploads.ts`, `lib/files.ts`, `lib/ai/exhbt-draft.ts`, `lib/exhbt/verify.ts` |
| Portfolio settings | `app/(app)/account/portfolio/` |
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
- **Pro has no price yet:** the pricing page and the roadmap's last screen collect a waitlist (`waitlist` table). Checkout comes with Pro.
- **The jobs seed is illustrative.** Its skills are placeholders until the real dataset is imported; confirm the dataset's licence allows this use before importing.
- **Per-employer links** are a path on the person's host, with a short random suffix so the company name cannot be guessed. See `lib/hosts.ts`.

## Tests

`e2e/` (Playwright, run by CI in `.github/workflows/ci.yml`):
- `phase1.spec.ts`:
  - job pre-fill, `/start` entry, per-step validation, Back keeps answers
  - jobs data shapes the gaps; Pro waitlist
  - instant result through the free views to the project-ideas gate, then the plan
  - the gate's CV prefill and validation; swapping ideas until it's your plan
  - email in the outbox, with a working sign-in link
  - other-browser protection
  - email sent once
  - Free monthly limit, unsubscribe
- `a11y.spec.ts`: axe WCAG 2.1 AA on every public page, every builder step and every result view.
- `responsive.spec.ts`: the home CTA is above the fold on desktop and phone; no sideways scrolling.
- `preview.spec.ts`: private-preview noindex, robots and banner.

- Phase 2: `phase2-account.spec.ts` (usernames, profile), `phase2-portfolio.spec.ts` (blocks, plan rules, portfolio pages), `phase2-draft.spec.ts` (uploads, AI draft), `phase2-editor.spec.ts` (editor, publish), `phase2-billing.spec.ts` (Stripe), `phase2-hardening.spec.ts` (account export, privacy and terms).

Tests run against the dev server with no services connected. They use the build folder `.next-e2e`, so they can run while `npm run dev` is up.

To run the suite beside another one (a second worktree, or a dev server on the default port), give it its own port and keep it to one browser at a time:

```bash
E2E_PORT=3236 npx playwright test --workers=1
```

On a machine with Chromium already installed (Claude Code cloud), add `PW_CHROMIUM_PATH=<path to chrome>`. The full suite takes about six minutes. If the dev server adds a `.next-*/types` line to `tsconfig.json` while it runs, don't commit it.

## What comes next

Phase 2 is above. Still to come: per-job links on Max (in progress), the subdomain routing (being built separately; decision 0001), and the originality check, which is sold as "coming soon" until `ORIGINALITY_CHECK_LIVE` is true in `lib/entitlements.ts`. The decisions are in `docs/decisions/`.
