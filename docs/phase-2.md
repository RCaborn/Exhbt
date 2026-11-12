Status: accepted
Date: 12 Nov 2026

The build plan for Phase 2. Figures here are a record of the decision; the code wins (`lib/entitlements.ts`). Decisions it relies on: 0006, 0007, 0008.

# Phase 2: portfolios, the exhbt editor, paid plans and per-job links

## Context
Phase 1 (the free roadmap) is live and working. Phase 2 is the product people pay for. A graduate uploads a project, the AI drafts a short exhbt (200 words at most) in a fixed block structure, the graduate edits it in a constrained editor, and publishes it to their own subdomain (`alex.exhbt.co.uk`). On Max they also get per-job pages (`alex.exhbt.co.uk/lloyds`), where the AI picks the 4 exhbts that best fit a pasted or linked job description.

Rory's decisions (12 Nov 2026):
- **Plans:**
  - **Free:** 1 exhbt, build and preview only, not public.
  - **Premium** (first paid tier): 4 exhbts on `alex.exhbt.co.uk`.
  - **Max:** 10 exhbts plus per-job links.
  - Universities get Max.
- **Per-job link address:** the user chooses `/lloyds` or `/lloyds-x7k2` (default: the suffix).
- **Editor:** halfway between plain cards and a full rich-text editor. Fixed block cards, each text field allowing only bold, italic and links.
- **Release:** everything ships together. Internally it's built in milestones behind a feature flag, merged as each one passes, and switched on together.

Already in the repo:
- `exhbts`, `curated_links` (capped at 4), `originality_checks` and `profiles.username` (format check) tables
- reserved usernames and the subdomain decision (`docs/decisions/0001`, `lib/hosts.ts`)
- the exhbt type and limits (`lib/exhbt.ts`: `EXHBT_LIMITS`, 200 words, 3–6 method steps, 6 skills)
- the rendering components `components/exhbt/{Exhbt,ExhbtTile,MethodFlow,BeforeAfterChart,PortfolioHeader,TrustBadge}.tsx`
- `EXHBTS_PER_JOB_LINK = 4`

Phase 2 builds on all of this rather than starting again.

**Waiting on:** Rory's layout picture. The block list below follows the current exhbt layout plus Grok's additions. If the picture differs, only the block schema and the renderer change.

---

## 1. Plans and entitlements (`lib/entitlements.ts`, the only copy of the figures)
- Rename the tiers (new `docs/decisions/0006-plan-names-premium-max.md`, superseding 0002's names):
  - Plan type becomes `"free" | "premium" | "max" | "institutional"`.
  - `PLAN_NAMES`: Free, Premium, Max, Universities.
  - Nobody pays yet (waitlist only), so one migration remaps the stored values in this order: `premium` → `max`, then `plus` → `premium`. That covers the `waitlist.interest` check and values, and the `subscriptions.plan` enum and data.
- Figures:

  | | Free | Premium | Max |
  |---|---|---|---|
  | `exhbts` | 1 | 4 | 10 |
  | `publicPortfolio` | **false** | true | true |
  | `jobLinks` | false | false | true |

  `drafting` and `originalityCheck` per section 6. Roadmap refreshes and swaps keep their current figures, moved to the new keys.
- New entitlement fields, placeholder figures for Rory to confirm, never repeated in prose:
  - `draftsPer30Days` (AI drafts)
  - `blockRegenerations` (per exhbt)
  - `uploadMbPerFile` and `storageMbTotal`
  - `jobLinksActive` (Max)
- `planFeatures()` and the pricing page are rewritten for Free, Premium and Max. Free's line becomes "Build and preview 1 exhbt".
- `lib/plan.ts` gets `getPlan(userId)`: an active or trialing subscription, otherwise an institution licence, otherwise free. Every limit is checked on the server with it, never only in the UI.
- **Downgrade:** nothing is deleted. Published exhbts over the new limit are unpublished, and the user chooses which ones stay live. Job pages go offline, and come back if the user upgrades again.

## 2. Payments (Stripe)
- Stripe Checkout for Premium and Max. The Stripe Billing Portal handles upgrade, downgrade and cancel.
- `app/api/stripe/webhook/route.ts`: verify signatures with `stripe.webhooks.constructEventAsync`, which works on the Workers runtime. It handles `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`, writing to `subscriptions` (the table exists).
- Secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets. Price IDs go in `wrangler.jsonc` vars (not secret) and are added to `/api/health`.
- `PRICES` in `lib/entitlements.ts` stays the only place prices live. **Rory sets the prices** (open question). Until then the pricing page keeps the waitlist.

## 3. Hosts and routing (decision 0001, now built)
- **DNS and Worker** (Rory, in Cloudflare):
  - proxied `*` record, and `app` record
  - Worker routes `*.exhbt.co.uk/*`, `app.exhbt.co.uk/*` and `www.exhbt.co.uk/*` in `wrangler.jsonc` `routes` with `zone_name`
  - Universal SSL covers `*.exhbt.co.uk` (one level). I'm about 90% sure; check that it's active.
- **`middleware.ts` routes by host:**
  - `www` / apex → marketing pages
  - `app.` → the tool (roadmap, account, editor, billing). `www.exhbt.co.uk/roadmap/*` and `/login` 301 to `app.` so old roadmap-email links keep working.
  - `<username>.` → rewrite to an internal `app/(portfolio)/[username]/...` route group. Reserved names (a list in `lib/hosts.ts`) and unknown usernames → a plain 404.
  - Dev and tests: `alex.localhost:3200` works in Chromium, so subdomains can be tested locally.
- **Cookies:** auth cookies are set on `app.exhbt.co.uk` only. Moving the tool from `www` to `app` signs everyone out once; acceptable this early.
- **Supabase URL settings:** add `https://app.exhbt.co.uk/**`.
- **`siteOrigin()`:** must return the app host for email links (`NEXT_PUBLIC_SITE_URL=https://app.exhbt.co.uk` in vars).

## 4. Usernames and profile
- `app./account/portfolio`:
  - claim a username, with a live availability check (format rule already in the DB, plus the reserved list)
  - display name, one-line headline (≤ 12 words), short bio (≤ 40 words), optional photo, LinkedIn (already on the profile)
  - "Hide my portfolio from search engines" toggle
- Username changes are allowed. The old name redirects for 30 days, then becomes available again (new `username_redirects` table).

## 5. Data model (new migrations; applied ones are never edited)
- **`exhbts`:** no rows exist yet, so the earlier fixed columns can be replaced.
  - add `blocks jsonb not null` (the source of truth, versioned with `schema_version int`), `headline jsonb` (the big number on tiles), `context text`, `position int` (portfolio order) and `confirmed_by_user_at`
  - drop `method`, `results` and `key_result` in favour of blocks; keep `title`, `status`, `public_slug`, `published_at`
  - a DB check caps published exhbts per user is NOT used: the limit is a plan rule, enforced in the server action
- **`exhbt_files`** (new): `id, exhbt_id, user_id, bucket, path, mime, bytes, kind ('evidence'|'figure'|'source'), visibility ('public'|'private'), caption, created_at`.
- **`curated_links` becomes per-job links** (rename to `job_links` with a view for compatibility, or keep the name; the code calls them job links):
  - add `company`, `role_title`, `slug_style ('clean'|'suffix')`, `intro (≤ 40 words)`, `ranking jsonb` (the AI's picks and one-line reasons), `status ('live'|'off')`, `view_count int`
  - `exhbt_ids` stays capped at `EXHBTS_PER_JOB_LINK`
  - unique `(user_id, collection_slug)` already exists
- **Storage buckets** (created in the migration):
  - `sources`: private; uploaded project material, deleted after 30 days or when the exhbt is deleted
  - `evidence`: private; files served through short-lived signed URLs from the portfolio page, so unpublishing takes effect immediately
- **RLS:** owner-only, as for the existing tables. Public portfolio pages read through the server with the service role, published rows only.
- **`Store` interface:** each new access method is added to the interface and to both the Supabase and in-memory implementations (AGENTS rule).

## 6. Upload → AI draft → editor → publish
**Upload** (`app./exhbts/new`):
- Drop files: PDF, docx, odt, txt, images, csv/xlsx, up to the plan's size caps. Optionally paste notes or a link (a GitHub repo, a published report).
- Files go straight from the browser to Supabase Storage with a signed upload URL, so the Worker never handles big uploads.
- Text is pulled out in the browser by generalising the CV readers (`lib/cv-client.ts` → `lib/doc-readers.ts`, keeping the CV wrapper). Scans and photos go through the consent-gated AI reader (`lib/ai/cv.ts` → `lib/ai/transcribe.ts`). The quality check (`lib/cv-quality.ts`) is reused.
- csv/xlsx: the first sheet is read in the browser into a small table, which can feed the key-result chart.

**AI draft** (`lib/ai/exhbt-draft.ts`, Haiku via `AI_MODEL`, structured output with a zod block schema):
- Prompt rule as everywhere: use only the user's material. Every number in the draft must carry a `sourceQuote` from the material.
- On the server, `lib/exhbt/verify.ts` checks each number in the draft appears in the extracted source text. Any that don't are flagged in the editor: "We couldn't find 18% in your files — check it."
- Uploaded images are offered as figure candidates. A chart is only proposed when the numbers came from the files.
- Cost: around 10–30k input tokens per draft, under $0.01 at Haiku's price (estimate). Each draft is logged in `ai_call_logs` with step `exhbt_draft`, which is already allowed.

**Blocks** (`lib/exhbt/blocks.ts`, zod; final shapes depend on the layout picture):
- **Fixed core, always present:**
  1. Outcome: 1 sentence
  2. **Process flowchart (Method):** always present, drawn as a flow diagram by `components/exhbt/MethodFlow.tsx`.
     - 3–6 nodes, each a short verb phrase ("Collected data", ≤ 5 words) with an optional detail (tool or scale, "14,200 records", ≤ 6 words). The last node is the result.
     - The AI drafts it from the user's material, with the same no-made-up-facts rule.
     - Edited on the diagram itself, wherever it appears in edit mode (the editor card and the portfolio edit mode below):
       - click a node to edit its words in place
       - "+" between nodes to insert one; × to remove one
       - drag, or ←/→ buttons, to reorder
     - The diagram redraws as you type.
     - Can't be removed; publishing needs at least 3 nodes.
     - Laid out left to right on wide screens, top to bottom on phones (as `MethodFlow` already does). Every node's text sits in the page for screen readers.
  3. Key result: a before/after chart (`BeforeAfterChart`, chart rules in AGENTS) **or** a figure (image and caption)
  4. Skills: up to 6 tags
  5. The work / evidence: a file or link, with a caption of 25 words at most
  6. Reflection: up to 2 sentences
- **Optional, at most 2 per exhbt:**
  - bullet list (≤ 4 items)
  - callout (≤ 25 words)
  - extra figure (image and caption)
  - second flowchart (3–5 nodes) for something other than the process, such as a system or data pipeline. It reuses the `MethodFlow` component and its editor card. No Mermaid: it's heavy and renders untrusted text.
- Title (≤ 80 characters), context line and headline number sit in the header, not in a block.
- Verification (`TrustBadge`: confirmed by the author, originality checked, date) is added by the system and can't be edited.
- **Ordering:** Outcome is always first and Reflection always last. Everything between can be reordered.
- **Overall limit:** 200 words across the editable text, from `EXHBT_LIMITS`, which grows to cover the new blocks.

**Editor** (`app./exhbts/[id]/edit`, the halfway approach):
- One card per block in a vertical list. Reorder with a drag handle and with up/down buttons (keyboard and screen-reader friendly).
- "+ Add" offers only the allowed optional blocks while there's room. The remove button is shown only on optional blocks.
- Text fields use a minimal Tiptap editor:
  - Document, Paragraph, Text, Bold, Italic, Link (https only, `rel="nofollow ugc"`), History; nothing else
  - bullets only inside the bullet block
  - stored as small Tiptap JSON per field and rendered by our own renderer, never as raw HTML
  - the editor code loads only on the editor page
- Live word count per card and overall. Saving is never blocked, so drafts can run over. Publishing is blocked until every limit passes. The same `validateForPublish()` runs on the server.
- Per block: "Rewrite this block" (counts towards `blockRegenerations`) and "Undo to AI version".
- Live preview beside the cards, using the real `Exhbt` component.

**Publish:**
- Checklist:
  - all limits pass
  - every flagged number is checked or removed
  - "This is my work, and the numbers are true" ticked (`confirmed_by_user_at`)
  - the plan allows another public exhbt
- Originality check on publish (`originalityCheck` entitlement, `originality_checks` table exists). **The provider is an open question.** Until one is chosen, publishing records the user's confirmation only and the badge doesn't claim a check.

## 7. Public portfolio (`alex.exhbt.co.uk`, Premium and Max)
- `/`: `PortfolioHeader` (name, headline, bio, LinkedIn), then up to the plan's count of `ExhbtTile`s in the user's order.
- `/<exhbt-slug>`: the full `Exhbt` component, with evidence one click away (signed URL; images inline, other files as downloads with `Content-Disposition: attachment`).
- Edge-cached; the cache is cleared on publish or edit. Open Graph image per exhbt (`next/og`). Indexed unless the user hides it, and a per-user sitemap when indexed.
- No sign-in cookies on portfolio hosts, a strict CSP, and all user text escaped by our renderer.
- Free users see the same page in a preview on `app.` with "Publish with Premium".

**Editing in the portfolio (edit mode)**
- `app.exhbt.co.uk/portfolio` shows the owner's portfolio exactly as employers see it, with an **Edit** switch.
- **In edit mode, everything on the page can be changed where it sits:**
  - the header (name, headline, bio)
  - tile order (drag)
  - inside an open exhbt, every block: text fields with the same minimal Tiptap editor, the flowcharts edited on the diagram (click a node, "+" between nodes), the chart's numbers in a small table, figures swapped or recaptioned, optional blocks added or removed, blocks reordered
- It's the same block editor as section 6, shown inside the real layout rather than as a list of cards. Both views save to the same `blocks` JSON, so there's one set of rules.
- Word counts and limit warnings show beside each block. Changes save as a draft.
- **"Publish changes"** runs the same publish checks and updates the live page. Live exhbts never show half-finished edits.
- **The public `alex.exhbt.co.uk` stays read-only:** no sign-in cookies, by decision 0001. When the owner is signed in on `app.`, a small client-side check (via `app.`, with credentials) shows them an "Edit" link that opens edit mode at the same exhbt.
- Per-job pages (section 8) get the same edit mode for their intro, order and picks.

## 8. Per-job links (Max)
- `app./job-links/new`: company, role title, and **paste the job description** (the main path) **or a link**.
- **Link fetch** (`lib/jobs/fetch-listing.ts`):
  - a server-side fetch with a 10-second timeout, HTML reduced to text, and a quality check
  - works for many company career sites, Greenhouse and Lever
  - LinkedIn, Indeed and JavaScript-only boards usually block or return nothing, so the user is asked to paste instead. I'm not certain which boards will work; this is best-effort by design.
- **Ranking** (`lib/ai/job-match.ts`, Haiku): the user's published exhbts against the job description. Returns the top `EXHBTS_PER_JOB_LINK` with a one-line reason each, drawn only from the exhbt and the description. It also suggests a ≤ 40-word intro, which the user can edit. AI step `link_ranking` is already allowed. The user can reorder or swap picks.
- **Address:** `alex.exhbt.co.uk/lloyds` or `/lloyds-x7k2`; the user chooses, suffix by default. The slug comes from the company name, and the user can edit it. Clean slugs must be unique per user.
- **Page:** "For Lloyds Banking Group · Graduate Data Analyst", the intro, and 4 tiles. Opening a tile keeps "← Back to Lloyds" context. Always `noindex`. A view count (no cookies, no tracking), shown to the owner. Can be turned off or deleted.
- Limit: `jobLinksActive` at a time (placeholder figure).

## 9. Privacy, legal, safety
- Privacy policy:
  - public portfolio data
  - stored project files and how long they're kept
  - AI drafting and job matching (Anthropic, as already listed)
  - Stripe, which is already listed
- Terms: users own their content, and are responsible for not publishing confidential employer data. The editor warns when an upload looks like it's marked "confidential" (a simple text check).
- Account export and delete (`exportUserData`, `deleteUserData`) cover blocks, files in Storage and job links.
- Abuse limits, using the `countRecentEvents` pattern: uploads, drafts and job-link fetches per user and per connection.

## 10. Keeping the live site safe while building
- **All Phase 2 work lives on a `phase-2` branch.** Each milestone is its own pull request into `phase-2`, with CI (docs, types, lint, build, e2e). `main`, and so www.exhbt.co.uk, is untouched until launch day, when `phase-2` is merged into `main` once.
- **Phase 1 fixes still go to `main` as normal.** `main` is merged into `phase-2` regularly so the final merge stays small.
- **Preview:** `phase-2` deploys to a separate Worker, `terna-preview`, on its own `workers.dev` address, never the real domain. Rory can click through accounts, uploads, the editor and payments (Stripe test mode). Portfolios there are previewed at `/_portfolio/alex` because `workers.dev` has no wildcard subdomains. Real `alex.exhbt.co.uk` routing is tested locally with `alex.localhost` in e2e.
- **The database is shared, so nothing touches production until launch:**
  - The branch, the preview and the tests use the in-memory store, or a Supabase branch database if Rory approves its hourly cost.
  - Production migrations are applied on launch day, just before the merge. Renaming the plan keys and changing the `exhbts` columns would break the live site if applied early.
  - Purely additive pieces (new tables, Storage buckets) may go earlier, only if needed for the preview.
- **DNS:** the wildcard and `app` records can be added early. They do nothing until the Worker routes in `wrangler.jsonc` ship with the merge.
- **The `EXHBT_PHASE2` flag stays as a second safety switch:** if something goes wrong after launch, turning it off hides the Phase 2 pages without a redeploy.

## Build order (milestone PRs into `phase-2`)
1. **Plans:** rename the tiers, add the new entitlements, `getPlan`, and update the pricing copy (behind the flag).
2. **Hosts:** middleware host routing, the move to `app.`, the portfolio route group, usernames, and a portfolio rendering seeded data.
3. **Data model:** migrations, Storage buckets, the Store methods, the block schema, the renderer and the validators.
4. **Draft pipeline:** upload, the shared document readers, the AI draft, number verification.
5. **Editor:** cards with minimal Tiptap, reorder, add/remove, live preview, publish checks, confirmation.
6. **Payments:** Stripe checkout, webhook, billing portal, downgrade handling.
7. **Per-job links:** creation, link fetch, ranking, the page, view counts.
8. **Hardening:** privacy and terms, export and delete, abuse limits, `/api/health` additions (Stripe, Storage), docs, a full e2e pass on `phase-2`.
9. **Launch day (Rory says go):** apply the production migrations, merge `phase-2` into `main` (deploys www, app and portfolio routes), switch Stripe to live keys, run the post-launch checks.

Docs:
- new decisions 0006 (plan names), 0007 (the exhbt block editor) and 0008 (per-job link address choice, amending 0001)
- updates to `docs/MAP.md`, `HANDOFF.md`, `LAUNCH.md`, `DESIGN.md` (new blocks)

## 11. Rory's setup (dashboards I can't reach)
- Cloudflare: the wildcard and `app` DNS records; confirm Universal SSL covers `*.exhbt.co.uk`.
- Stripe: account, Premium and Max products and prices, and webhook endpoint `https://app.exhbt.co.uk/api/stripe/webhook`.
- Supabase: add `https://app.exhbt.co.uk/**` to Redirect URLs.

## Open questions (decide before the milestones that need them)
1. Prices for Premium and Max, and whether there are monthly and/or annual options (milestone 6).
2. Does Free get the AI draft for its one exhbt? I'd say yes (1 draft): it shows the product working, at under $0.01.
3. The originality-check provider and its budget (milestone 5; until then, confirmation only).
4. The layout picture (milestone 3).
5. The placeholder figures: drafts per month, rewrites per exhbt, file and storage caps, active job links.

## Verification
- **Tests:**
  - `e2e/` gains specs for: claim username → upload (generated fixtures, as in `cv-files.spec.ts`) → AI draft (mock without a key) → edit, over-limit publish blocked → publish → view at `alex.localhost` → Free can't publish → Max creates a job link from a pasted description → page shows 4 tiles, noindex
  - pure tests for the block schema, `validateForPublish`, number verification, slug generation and ranking parsing
  - Stripe in test mode: `stripe trigger` events against the webhook, plus a signature-failure case
- `npm run check` (docs, theme, types, lint, build, e2e) passes at each milestone. `/api/health` reports Stripe and Storage.
- **Before launch day (on the `terna-preview` Worker):** a full run on a test account through each tier (Stripe test mode), a real phone check of `alex.exhbt.co.uk`, and an employer's-eye check that each exhbt reads in about 30 seconds.
