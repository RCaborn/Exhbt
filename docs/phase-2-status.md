Status: current
Date: 13 Nov 2026

# Phase 2: where it stands, and what Rory sets up

Everything below is on the `phase-2` branch. The live site (`main`) is unchanged. Nothing reaches it until launch day (LAUNCH.md, "Phase 2 launch day").

## Built and tested
177 end-to-end tests pass in one full run, and the production build succeeds. All of it runs against the in-memory database and a stand-in AI.

| Area | What a person can do |
|---|---|
| Plans | Free, Premium and Max (figures only in `lib/entitlements.ts`). Upgrade prompts appear where they're needed: publishing on Free, a full plan, drafts used up. |
| Pricing | Free / £9 / £15 a month. The pricing page and home page show this once Phase 2 is switched on; the waitlist shows until then. The originality check and per-job links are marked "coming soon". |
| Payments | Stripe Checkout, the billing portal, a billing page, and the webhook (signed, repeat-safe, ignores out-of-order events). |
| Upload and AI draft | Upload PDF, Word, text, CSV, spreadsheets, photos or scans. Haiku drafts an exhbt from the files and flags any number it can't find in them. The progress screen shows each step. |
| Editor | One card per section, the flowchart edited on the diagram itself, live word count against 200 (every word on the page counts), images and the work as a file, and autosave that can't lose work. Also: "Rewrite this block", "Back to the AI version", publish checks with links to the card at fault, and an "it's live" panel. |
| Portfolio | An at-a-glance page and a page per project in the agreed layout, with photo, link previews (LinkedIn, Slack, email), "Save as PDF" and the brand design. |
| Usernames and profile | Claim an address; a renamed address redirects for 30 days. Name, headline, bio, LinkedIn, photo, and hiding from search engines. |
| Roadmaps | "My roadmaps" for switching careers. A new roadmap for a different job reuses your details. Saved ideas (Premium and Max) keep ideas from any roadmap in one list. "Build this as an exhbt" works from any idea. |
| Per-job links (Max) | Paste a job description or link one. The AI picks the 4 best exhbts with reasons and an intro; the person reorders, swaps, chooses `/lloyds` or `/lloyds-x7k2`, and can switch a link off. **The public page isn't connected yet** (see "For the subdomain work"). |
| Privacy and safety | Privacy and terms describe only what's built. Deletes remove stored files. Account export covers everything. `/api/health` reports Phase 2 settings and Storage. |
| AI eval kit | 8 realistic sample projects, a rubric, and a runner (`npm run eval:drafts`, plus the GitHub workflow "Exhbt draft eval"). |

## Not yet proven against real services
Nothing above has run with real Stripe, real Supabase Storage, or the real Haiku for drafts, rewrites and job matching. Every test uses stand-ins. The first real run should be on a preview (setup item 3) before launch.

## Setup list for Rory
1. **Anthropic key for the eval.** In GitHub: RCaborn/Exhbt, then Settings, then Secrets and variables, then Actions, then New repository secret. Name it `ANTHROPIC_API_KEY` and use the same Default-workspace key as in Cloudflare.
   - GitHub only lets you run a manual workflow once its file is on `main`, so the eval workflow (`.github/workflows/eval-drafts.yml`) needs to land on `main` first.
   - It's safe to merge that one file on its own, because it doesn't change the site. Say the word and it will be done as a small pull request.
2. **Stripe, test mode first** (LAUNCH.md has the detail):
   - Create two products, Premium £9/month and Max £15/month (GBP).
   - Put both price ids in `wrangler.jsonc` vars, as `STRIPE_PRICE_PREMIUM` and `STRIPE_PRICE_MAX`.
   - Add the secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the Worker.
   - Create a webhook to `https://<app host>/api/stripe/webhook` with `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`.
   - Turn on the Customer portal.
   - Optional: a promotion code for a new-joiner discount.
3. **A preview to click through.** Create a second free Supabase project (for example `exhbt-preview`) and say so. The preview Worker is built (see "Preview site" below); it needs its secrets adding and the migrations applied to that project, then Stripe test keys. That's where the real-service run happens.
4. **Launch day** (LAUNCH.md has the full order):
   - apply migrations `20261113` → `20261117` to the live Supabase, in date order
   - merge `phase-2` into `main`
   - set `EXHBT_PHASE2=1` on the Worker
   - switch Stripe to live keys
   - check `/api/health`
5. **Anthropic credit:** turn on auto-reload with a low cap, and replace any API key that expires.
6. **Decisions still open:**
   - **Headline number:** when a project has no headline number, one is worked out from its own graph (for example "−18%"). OK?
   - **One word:** "projects" or "exhbts" on the public pages?
   - **Billing period:** monthly only, or annual too? Monthly is assumed.
   - **Placeholder figures** in `lib/entitlements.ts`: drafts per month, rewrites per exhbt, upload and storage caps, active job links.
   - **Originality check:** choosing a provider (it's "coming soon" until then).

## Preview site
`exhbt-preview` is a separate Worker that runs the `phase-2` branch with Phase 2 on, at `https://exhbt-preview.<your-workers-subdomain>.workers.dev`. It deploys on every push to `phase-2` (`.github/workflows/deploy-preview.yml`) and uses the preview Supabase project. It needs these Worker secrets added in the Cloudflare dashboard: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EXHBT_COOKIE_SECRET` (a new random value), and the Stripe test keys later. The preview Supabase project's Site URL and redirect URL must be the preview address. LAUNCH.md, "Preview site", has the steps.

## For the subdomain work (Rory's friend)
Nothing in `middleware.ts`, `lib/hosts.ts`, `app/(portfolio)/layout.tsx` or Worker routes was changed by this work. Left for that work:
- **Connect the per-job link pages.** In `app/(portfolio)/p/[username]/[slug]/page.tsx`, check for a job link first:
  ```tsx
  import { cache } from "react";
  import { JobLinkView } from "@/components/portfolio/JobLinkView";
  import { loadJobLink } from "@/lib/job-links";
  const jobLinkFor = cache(loadJobLink); // counts the view once
  // generateMetadata: if (job) return { title: { absolute: `For ${job.link.company} · ${job.displayName}` }, robots: { index: false, follow: false } };
  // page: const job = await jobLinkFor(username, slug); if (job) return <JobLinkView data={job} />;
  ```
  Then, on the project page, `?for=<slug>` should show "← Back to <company>" when that link is live.
- **Middleware:** keep rewriting `/preview.png` and `/<slug>/preview.png` on portfolio hosts; the link previews use them.
- **Portfolio layout:**
  - a full-width brand band (the glance page uses a framed panel until then)
  - hide the private-preview bar on portfolio hosts
  - tidy the print override in `globals.css`
- **Owner preview:** an owner preview and edit-mode route (`app.<domain>/portfolio`), including a preview for Free users.
- **Per-user sitemaps, edge caching, and clearing the cache on publish** (`docs/phase-2.md` section 7).

## Known limits
- **The home page renders on every request** so the Phase 2 switch works at runtime (slightly slower than static).
- **30-day automatic deletion** of source material isn't built; the privacy policy says so.
- **Audit items left** (`docs/audits/phase2-visual-audit.md`): headline and "View" in the exhbt list, empty drafts counting against the plan, a public contact route beyond LinkedIn, and some small type and layout polish.
