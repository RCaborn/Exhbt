# Exhbt: developer handoff (Phase 1)

Phase 1 is everything up to a graduate receiving their free roadmap. It is complete and tested with **no external services connected**: every service has a working local stand-in, and connecting the real one is a matter of setting environment variables (below).

## What Phase 1 does

```
Home: "What role are you aiming for?" ─► /roadmap/new?role=…  (starts at step 2)

Builder, one question per screen (/roadmap/new?step=1..4)
  1 Role ─► 2 CV (upload PDF/DOCX or paste) ─► 3 Extras (optional) ─► 4 Email + marketing opt-in
  └─ submit (server action startRoadmap)
       ├─ validate, rate-limit (3/day per email, 10/day per IP)
       ├─ store the roadmap request
       ├─ set a signed cookie: "this browser may view roadmap X"
       └─ redirect to /roadmap/[id]

/roadmap/[id]
  ├─ no output yet ─► "Building your roadmap" screen
  │     └─ POST /api/roadmap/[id]/generate  (idempotent)
  │           ├─ cache hit for identical input, or call the AI (cost logged)
  │           └─ send the "Your roadmap to {role}" email once (copy + sign-in link)
  └─ output ready ─► five click-through views (?view=)
        overview ─► gaps ─► projects ─► strengths ─► next

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
- The roadmap you get locally is a labelled placeholder until `ANTHROPIC_API_KEY` is set.

## Where things live

| You want to change… | Go to |
|---|---|
| Colours, fonts, radius, focus ring | `app/globals.css` (`@theme` tokens) and the rules in `DESIGN.md` |
| Home page | `app/(marketing)/page.tsx`; product snippets in `components/home/Excerpts.tsx` |
| Big role field + button | `components/home/StartForm.tsx` |
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
| Example evidence pack | `lib/pack.ts`, rendered by `components/pack/Pack.tsx` |
| Legal text (drafts, need a solicitor) | `app/(marketing)/legal/[doc]/page.tsx` |

Copy lives next to the component that shows it. Follow the writing rules in `DESIGN.md` (plain British English, no hype words).

## Connecting the real services

Each service switches on when its environment variables are set; until then the stand-in is used. Full list in `.env.example`.

| Service | Variables | Without it |
|---|---|---|
| **Supabase** (database, sign-in, files), London region | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | In-memory store (lost on restart) and a dev sign-in link. **Production refuses to start without it.** |
| **Anthropic** (roadmap generation, `claude-haiku-5-5`) | `ANTHROPIC_API_KEY` | Labelled placeholder roadmap |
| **Resend** (roadmap email) | `RESEND_API_KEY`, `EMAIL_FROM` | Emails go to `/dev/emails` |
| Cookie and link signing | `EXHBT_COOKIE_SECRET` | Dev default; **required in production** |
| Public URL (used in email links) | `NEXT_PUBLIC_SITE_URL` | Taken from the request |

Supabase setup:
1. Create a project in **London (eu-west-2)** and run both files in `supabase/migrations/` in order.
2. Under Auth, enable email sign-in, set the Site URL, and add `https://<domain>/auth/callback` and `https://<domain>/auth/confirm` as redirect URLs.
3. Set Resend as Supabase's custom SMTP too (it sends the plain login emails from `/login`).
4. Verify your sending domain in Resend.

Then deploy. The intended route is Cloudflare building from GitHub on every push to `main`; **[LAUNCH.md](LAUNCH.md)** has the click-by-click steps. Manual alternative: `npm run deploy`, with secrets set via `npx wrangler secret put <NAME>`.

**Private preview vs public:** the site is private by default: `noindex` everywhere, `robots.txt` disallows all, and a preview bar shows. It only goes public when built with `EXHBT_PUBLIC=1` (`lib/site.ts`). In production a missing `ANTHROPIC_API_KEY` or `RESEND_API_KEY` fails loudly (logged); it never falls back to placeholder roadmaps or the dev outbox.

## Known limits and decisions

- **Hosting plan:** Cloudflare's free Workers plan allows about 10 ms of CPU per request, and server rendering can exceed that. Budget for **Workers Paid ($5/month)**. CV parsing already happens in the browser to keep server work light.
- **Email links expire** (Supabase default: 1 hour). After that, the email tells people to open the roadmap URL and log in with their email, which works.
- **Marketing consent** is an unticked opt-in at step 4, stored as `pending_marketing_opt_in` on the roadmap and copied to the profile on sign-in. Every email has an unsubscribe link (`/api/email/unsubscribe`, signed token, also one-click). Have the privacy policy reviewed before sending any marketing.
- **Fake emails are accepted** (the roadmap shows without verifying the address). That was a product decision; rate limits contain abuse.
- **Scanned-image PDFs** have no text to read; the builder asks people to paste instead. There's no OCR.
- **JavaScript is required** for the builder (steps and CV reading are client-side). Server-side file parsing was removed to keep the Worker small and fast.
- **Pricing buttons** don't take payment yet; checkout is Release 2.

## Tests

`e2e/` (Playwright, run by CI in `.github/workflows/ci.yml`):
- `phase1.spec.ts`:
  - role pre-fill, per-step validation, Back keeps answers
  - instant result through all five views
  - email in the outbox, with a working sign-in link
  - other-browser protection
  - email sent once
  - rate limit, unsubscribe
- `a11y.spec.ts`: axe WCAG 2.1 AA on every public page, every builder step and every result view.
- `responsive.spec.ts`: the home CTA is above the fold on desktop and phone; no sideways scrolling.

Tests run against the dev server with no services connected. They use the build folder `.next-e2e`, so they can run while `npm run dev` is up.

## What comes next

Release 2 (payments, pack editor, AI drafting, originality check, public pack page) is planned in `docs/PLAN.md`. The schema for it already exists in `supabase/migrations/20261105000000_init.sql`, and plan rules live in `lib/entitlements.ts`.
