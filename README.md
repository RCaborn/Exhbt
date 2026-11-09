# Exhbt

Free skills-gap roadmaps for UK students and graduates, then a portfolio of **exhbts** (short, checked write-ups of their projects, with a chart of the key result) that hiring managers can read in 30 seconds. **exhbt.co.uk**

The current shape of the product is `docs/MAP.md`.

Team workflow: [CONTRIBUTING.md](CONTRIBUTING.md). AI tools: [AGENTS.md](AGENTS.md).

**Phase 1 is complete:** marketing site, the click-through roadmap builder, instant roadmap results, and the roadmap email. **Start with [HANDOFF.md](HANDOFF.md)**: it covers how everything fits together, where to change things, and how to connect the real services. To put it live, follow **[LAUNCH.md](LAUNCH.md)**.

The site is a **private preview** (hidden from search engines, with a preview bar) unless it is built with `EXHBT_PUBLIC=1`.

Also see: [DESIGN.md](DESIGN.md) (visual system and rules), [PRODUCT.md](PRODUCT.md) (product context), [docs/PLAN.md](docs/PLAN.md) (architecture for Releases 2–4).

## Run it

```bash
npm install
npm run dev
```

With no environment variables set, everything works locally: an in-memory store, a dev sign-in link in place of email, emails shown at `/dev/emails`, and a labelled placeholder roadmap. Copy `.env.example` to `.env.local` to use real services.

## Checks

```bash
npm run check
```

That runs typecheck, lint, the production build and the Playwright end-to-end tests. CI runs the same on every push.

## Stack

| Layer | Service | Notes |
|---|---|---|
| App | Next.js 15 on Cloudflare Workers via OpenNext | `npm run preview`, `npm run deploy`; budget for Workers Paid ($5/month) |
| Database, auth, files | Supabase, London region | schema in `supabase/migrations/` |
| Email | Resend (HTTP API for app emails; also Supabase's SMTP) | `lib/email/` |
| AI | Anthropic `claude-haiku-5-5`, structured output validated with Zod | `lib/ai/` |
| Analytics | first-party `events` table plus Cloudflare Web Analytics | no cookies |
