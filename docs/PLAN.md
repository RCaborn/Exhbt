# Exhbt — site plan (architecture for R1–R4, build R1)

## Context
Exhbt gives graduates a free skills-gap roadmap, then turns their project work into fixed-template "evidence packs" (~200 words) that a hiring manager can read in 30 seconds. The repo (`/home/user/Terna`) is empty apart from the design tooling installed earlier. The goal is to plan the architecture for all four releases in the dev brief, then build **Release 1** (marketing pages, pricing, sign-up, roadmap builder and result, legal pages, analytics). Constraints: fixed costs as close to £0 as possible for the first few hundred users, UK GDPR, WCAG 2.1 AA, and a look that does not read as AI-generated.

---

## 1. Design direction (resolving the skill conflicts)

**Concept: "the exhibit label."** Exhbt = exhibit. The pack is the product and the brand: a museum wall label or archive catalogue card. It's sober, editorial and precise, and every pack looks the same so readers learn it once. This is the opposite of the usual SaaS look of purple gradients, icon cards and glowing dashboards.

| Conflict | Skills say | Decision (most professional, least AI-generic) |
|---|---|---|
| Hero visual | taste: software gets a shader effect, pulsing diagrams, card loops, "moments" | **None of these.** Hero = a real evidence pack rendered as live HTML (taste's own "show the product's real UI" rule). Shader grounds and pulsing diagrams are now the most recognisable AI-landing-page look. |
| Fonts | ui-ux-pro-max recommends Inter widely; impeccable flags Inter/Geist/Fraunces/Plus Jakarta/Space Grotesk as overused | **No Inter.** Display: *Newsreader* (serif, label/editorial voice). UI/body: *Schibsted Grotesk*. Numbers/word counts only: *IBM Plex Mono*. Self-host via `@fontsource/*` npm packages (fonts.google.com is blocked here, and self-hosting avoids sending visitor data to Google, which matters for GDPR). *My taste call; I'm not 90% sure these aren't on someone's overused list.* |
| Photography | taste: "more real photographs", people and customers | **No stock graduates.** Visuals are the artifacts themselves: roadmap excerpt, pack, trust badge, curated link. |
| Icons | taste: full-colour known-product icons | One stroke-icon library (Lucide), used sparingly. No emoji or Unicode icons. |
| Motion | taste: card lift, photo zoom, looping cards | Keep only button press, underline draw and focus states. No loops, no scroll-jacking. Respect `prefers-reduced-motion`. |
| Layout | taste: one section per screen | Marketing home only. App pages use impeccable's **Operate** mode: dense, quiet, keyboard-first. |
| awesome-design-md | copy a brand's DESIGN.md | Reference only. Copying Stripe/Linear's system *is* generic. We write our own `DESIGN.md`. |

**Tokens (light mode, chosen from the use scene: hiring managers reading on a laptop or phone in daylight)**
- Paper `#F1F2F0` (cool stone; cream was dropped after impeccable's detector flagged it as a recognised AI default), surface `#FFFFFF`, ink `#16161A`, secondary ink `#4F534D` (≥4.5:1 on paper), rule lines `#D8DBD6`.
- One accent, **verification green** `#1E4D3B`, reserved for the trust badge, confirmed states and the primary CTA. Error oxblood `#8A2A1F`. No purple, cyan or gradients.
- Radius 4px max, hairline 1px rules, soft offset shadows only on raised items. No glass, no gradient text.

**Banned throughout (from impeccable's craft floor plus anti-slop writing):** eyebrow/kicker labels, 01/02/03 section numbers, icon+heading+text card grids, hero-metric stats blocks, coloured left-border callouts, monospace as decoration, emoji icons, banned-words copy ("unlock", "empower", "seamless", "elevate"…), em-dash stacking. Copy is British English, concrete and short.

**Home page (Persuade mode)**
1. Hero: plain headline (e.g. "Show employers what you actually did."), one supporting line, "Get your free roadmap" CTA, secondary "See an example pack". On the right sits a real pack at true size.
2. How it works: the three real artifacts in sequence (roadmap excerpt → pack draft with live word count → published pack with trust badge). No cards with icons.
3. "Read in 30 seconds": an annotated pack showing what each field tells an employer (links to *How to read a pack*).
4. Pricing summary (Free / £9 / £15) + universities line.
5. Footer: legal, contact.

---

## 2. Architecture (all releases), cheapest-possible stack

| Layer | Choice | Free-tier fit (first ~200 users) |
|---|---|---|
| App | **Next.js (App Router, TypeScript)** deployed to **Cloudflare Workers** via `@opennextjs/cloudflare` | Free: 100k requests/day, commercial use allowed. Vercel Hobby is non-commercial, so it's out. |
| DB, auth, files | **Supabase Free, London region** (Postgres + RLS, magic-link auth, Storage) | 500 MB DB / 1 GB storage / 50k MAU. Caveats: pauses after 7 days idle; limited backups. **Upgrade to Pro (~£20/mo) when R2 takes payments.** |
| Email | **Resend free** as Supabase custom SMTP | 3k/month, 100/day. Supabase's built-in SMTP is too rate-limited for production. |
| Payments (R2) | **Stripe Checkout + Customer Portal + webhooks** | No fixed fee; proration and cancellation handled by Stripe. |
| AI | Anthropic API, **Haiku-class model**, structured JSON output validated with Zod; cache by input hash | Pay per call only. *I haven't priced it against your £0.02–0.10/roadmap target; I'll verify before R1 ships.* |
| Analytics | **First-party `events` table** (no cookies) + Cloudflare Web Analytics for page views | £0, no cookie banner needed for analytics. |
| Originality check (R2) | Vendor TBD (e.g. Copyleaks) | **Risk:** per-check pricing may exceed £0.20–0.90/user/year. Price it before R2. |
| Malware scan (R2) | Scan on upload via a vendor or worker | Cost TBD in R2. |
| Domain | ~£10/yr | The only certain fixed cost in R1. |

**Repo layout**
```
app/(marketing)/  page.tsx, pricing/, universities/, how-to-read-a-pack/, legal/{privacy,terms,cookies}/
app/(auth)/       login/, auth/callback/
app/(free)/       roadmap/new/, roadmap/[id]/
app/(paid)/       dashboard/, packs/[id]/edit/, links/new/, account/        (R2–R3)
app/(admin)/      institution/, admin/                                     (R4)
app/p/[slug]/     public pack            app/l/[slug]/  public curated link  (R2–R3)
app/api/          roadmap/, stripe/webhook/ (R2), events/
components/pack/  Pack.tsx: one fixed template used by home, public page and editor preview
lib/ai/           client.ts, schemas.ts (Zod), prompts/roadmap.ts, cost-log.ts
lib/supabase/     server.ts, client.ts, middleware.ts
lib/entitlements.ts   plan → features (single source of truth)
supabase/migrations/  all 8 entities from the brief + events + RLS policies
DESIGN.md, PRODUCT.md   (impeccable init)
```

**Data model:** all 8 entities from the brief go in now (cheap to add early, painful to migrate later), with RLS on every table. Public slugs are 22-char random (unguessable). `Pack.status` adds `draft | flagged | published | read_only` (for lapse). `entitlements.ts` maps `free | basic | custom | institutional` so R2–R4 only add rows, never rewrites.

**AI rule (all steps):** prompt says use only facts in the input and leave fields empty rather than guess. Output is validated against the schema before saving, and every call writes `AICallLog` (tokens, cost).

---

## 3. Release 1 build steps
1. Scaffold Next.js + TypeScript + Tailwind (tokens from DESIGN.md as CSS variables), OpenNext Cloudflare config, `@fontsource` fonts.
2. `impeccable init` → write `PRODUCT.md` and `DESIGN.md` from section 1.
3. Supabase project (London), first migration (all entities + events + RLS), magic-link auth with Resend SMTP.
4. Shared `Pack` component with a hard-coded example pack (the home page needs it in R1, though the brief schedules packs for R2).
5. Marketing pages: Home, Pricing, For universities (contact form → `leads` table + email), How to read a pack, Legal (privacy, terms, cookies).
6. Roadmap builder: CV upload (PDF/DOCX parsed server-side, 5 MB cap, rate-limited) or paste; skills, target role, ambitions; email gate → magic link.
7. Roadmap generation endpoint: AI → Zod-validated JSON, cached by input hash, cost logged. Result page shows gaps, suggested projects and an upgrade prompt (pricing link; checkout arrives in R2).
8. Events: sign-up, roadmap completed, upgrade clicked. Data export and delete endpoints (GDPR).
9. Copy pass with the anti-ai-slop-writing skill.

**Later releases (outline):** R2 adds Stripe, dashboard, pack editor (live word count, hard 200-word block), AI drafting, confirmation, originality check, public pack page and lapse handling. R3 adds curated-link ranking, builder and public link. R4 adds institutions, seat invites (CSV/domain), admin panels and flag review.

---

## 4. Problems in the brief to resolve
- **"How to read a pack" is scheduled for R4**, but the R2 public pack page links to it and the home page needs it. **Move it to R1** (it's static).
- **Institutional students' tier is stated twice:** the roles section says they get Custom, but it's also listed as an open founder decision. I'll assume Custom.
- **Lapse behaviour** stays an assumption (read-only); the schema supports either answer.
- **The originality-check budget** may not fit the per-user cost target; check before R2.
- **Free tiers stop being enough once you take money.** Supabase Pro (~£240/yr) should start at R2. That still fits £300–500.

---

## 5. Verification (R1)
- `npm run build` and `npm run lint`/`tsc` clean. Run locally with `wrangler dev`.
- Playwright: roadmap flow end to end (paste CV → email → magic link via Supabase local inbox → result rendered), at 1440 / 768 / 390.
- impeccable hook/detector clean on every UI file. Then `/impeccable audit` and `/impeccable critique` on Home, Pricing and Roadmap result.
- axe-core accessibility scan on all public pages (WCAG 2.1 AA). Keyboard-only pass on the roadmap builder.
- Lighthouse mobile ≥90 performance on Home.
- AI: schema rejects malformed output; repeated identical input hits the cache (no second `AICallLog` row); a sparse CV yields empty fields rather than invented ones.
- RLS: an anonymous client can't read another user's roadmap.
