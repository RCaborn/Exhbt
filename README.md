# Exhbt

Free skills-gap roadmaps for graduates, then short, confirmed evidence packs of their project work that hiring managers can read in 30 seconds.

This repository holds **Release 1** (marketing pages, pricing, sign-up, roadmap builder and result, legal pages, analytics). The architecture for Releases 2–4 is in [docs/PLAN.md](docs/PLAN.md). The visual system is in [DESIGN.md](DESIGN.md) and product context in [PRODUCT.md](PRODUCT.md).

## Run it

```bash
npm install
npm run dev
```

With no environment variables set, the app runs in development mode: an in-memory store, a dev sign-in link in place of email, and a labelled placeholder roadmap. Copy `.env.example` to `.env.local` to use real services.

## Stack

| Layer | Service | Notes |
|---|---|---|
| App | Next.js 15 on Cloudflare Workers via OpenNext | `npm run preview`, `npm run deploy` |
| Database, auth, files | Supabase, London region | schema in `supabase/migrations/` |
| Email | Resend, set as Supabase's custom SMTP | configured in the Supabase dashboard |
| AI | Anthropic `claude-haiku-5-5`, structured output validated with Zod | `lib/ai/` |
| Analytics | first-party `events` table plus Cloudflare Web Analytics | no cookies |

## Setting up production

1. Create a Supabase project in **London (eu-west-2)**. Run `supabase/migrations/*.sql` (SQL editor or `supabase db push`).
2. In Supabase Auth: enable email (magic link), set the site URL and add `https://<your-domain>/auth/callback` as a redirect URL, and configure Resend as custom SMTP.
3. Set the secrets on the Worker: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY`. Put the `NEXT_PUBLIC_*` values in `wrangler.jsonc` `vars` (they are public).
4. `npm run deploy`, then add the custom domain in Cloudflare and turn on Web Analytics.
5. Add a Cloudflare rate-limiting rule on `POST /roadmap/new` (the free plan includes one rule).

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
