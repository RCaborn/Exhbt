# Launch checklist: private preview

This puts Exhbt live on a private Cloudflare address (`https://terna.<your-account>.workers.dev`), with the real database, AI and email. It stays **hidden from search engines** and shows a "Private preview" bar until you choose to go public (see the end).

About 30–45 minutes. You'll paste keys into each service's dashboard; **never paste keys into chat or commit them to GitHub.**

Dashboards change their wording from time to time. If a label below doesn't match exactly, look for the closest equivalent.

---

## 1. Anthropic (writes the roadmaps) · ~5 min

1. Go to **console.anthropic.com** and sign up.
2. **Billing:** add $5–10 of credit. A roadmap costs roughly $0.001, so this lasts a long time.
3. Optional: **Limits:** set a monthly spend limit (e.g. $10).
4. **API keys > Create key**, name it anything you like (e.g. `exhbt`). Copy it somewhere safe for step 4. → this is `ANTHROPIC_API_KEYS`

## 2. Supabase (database and sign-in) · ~10 min

1. Go to **supabase.com**, sign up, and create a **New project**:
   - Name: `exhbt`
   - **Region: London (eu-west-2)**. This matters for UK data rules.
   - Save the database password in your password manager. You won't need it for this checklist.
2. When the project is ready, open **SQL Editor > New query**:
   - Open `supabase/migrations/20261105000000_init.sql` in this repo on GitHub, copy all of it, paste it, and press **Run**. It should say "Success".
   - Do the same with each remaining file in that folder, **in date order**: `20261106000000_phase1.sql`, then `20261106120000_meeting_updates.sql`, then `20261106150000_tiers_and_methodology.sql`, then `20261110000000_project_ideas.sql`, then `20261112000000_cv_read.sql`.
   - If a file fails with `relation "roadmaps" does not exist`, an earlier file hasn't been run in this project: start again from `20261105000000_init.sql`. A failed file changes nothing, so it's safe to run again once fixed.
   - Optional, when you have it: load the UK jobs dataset (see `HANDOFF.md`). Until then a small sample is used.
3. **Project Settings > API (or API Keys)**. Copy three values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to be public)
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**keep secret**; it can read everything)

You'll come back to Supabase in step 5 once you know the site's address.

## 3. Resend (sends the roadmap emails) · ~5 min, plus domain setup

1. Go to **resend.com**, sign up, then **API Keys > Create**, with "Sending access". → `RESEND_API_KEY`
2. **Who can receive email:**
   - **Without your own domain**, Resend only delivers to the address you signed up with. Use `EMAIL_FROM` = `Exhbt <onboarding@resend.dev>`. Friends can still use the site and see their roadmap on screen; only their email copy won't arrive.
   - **To email anyone**, verify **exhbt.co.uk**: in Resend use **Domains > Add domain** and add the DNS records it shows you at your domain registrar or in Cloudflare DNS. The sender, `EMAIL_FROM` = `Exhbt <hello@exhbt.co.uk>`, is already set in `wrangler.jsonc`, so don't add it in Cloudflare.
   - **Google Workspace is fine alongside this.** Resend sends from a subdomain it gives you (e.g. `send.exhbt.co.uk`), so your Workspace inboxes and MX records are untouched. Make sure `hello@` and `privacy@exhbt.co.uk` exist in Workspace (or as aliases), because the site tells people to email them.
3. Sign-in emails from `/login` go through Resend too, sent by the app, so Supabase's own SMTP settings aren't needed. Their links work on any device.

## 4. Cloudflare (hosting) · ~10 min

1. **Upgrade to Workers Paid ($5/month)** under Workers & Pages > Plans. The free plan's per-request processing limit is likely too tight for this app. Pages can fail with error **1102** on it.
2. **Workers & Pages > Create > Import a repository.** Connect GitHub and choose **`RCaborn/Exhbt`** (it was called `RCaborn/Terna` before the rename).
3. Settings on that screen:
   - Project name: **`terna`** (must match `"name"` in `wrangler.jsonc`)
   - Production branch: **`main`**
   - Build command: `npx opennextjs-cloudflare build` (**not** plain `npm run build` — OpenNext calls that itself for the Next step; pointing both at OpenNext recurses until the job is killed)
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - If an existing Worker fails with "Could not find compiled Open Next config", fix the Build command under **Settings > Build**, then retry under **Deployments**.
   - Backup path: GitHub Actions workflow **Deploy** on `main` (runs `npm run deploy`). Repo secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. The Supabase URL is set in `wrangler.jsonc` and the keys are read at runtime from the Worker's secrets, and `keep_vars` stops a deploy from wiping variables set in the dashboard. Open `/api/health` after any deploy: it lists any setting that's missing.
4. Click **Deploy**. The first deploy will build but won't work yet (no keys). That's expected.
5. In the new Worker, open **Settings**:
   - **Build > Variables and secrets** (used while building). Add:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Variables and Secrets** (used while running). Add each of these as type **Secret**:

     | Name | Value |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | same as above |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as above |
     | `SUPABASE_SERVICE_ROLE_KEY` | from step 2 |
     | `ANTHROPIC_API_KEYS` | from step 1 |
     | `RESEND_API_KEY` | from step 3 |
     | `EXHBT_COOKIE_SECRET` | a long random string, see below |

     For `EXHBT_COOKIE_SECRET`, on a Mac open Terminal and run `openssl rand -base64 32`, then paste the output. Or generate a 40+ character random password in your password manager.
6. **Deployments > latest > Retry deployment** (or push any commit), so it rebuilds with the build variables.
7. Note the address shown, e.g. `https://terna.yourname.workers.dev`.
8. Optional: add `NEXT_PUBLIC_SITE_URL` = that address as both a build variable and a secret. This makes links in emails use it exactly.

## 5. Back to Supabase · ~2 min

**Authentication > URL Configuration**:
- Site URL: your `workers.dev` address
- Redirect URLs: add both
  - `https://terna.yourname.workers.dev/auth/callback`
  - `https://terna.yourname.workers.dev/auth/confirm`

## 6. Try it

1. Open your address in a private window. You should see the **"Private preview" bar**.
2. Build a roadmap with **your own email**. You should get:
   - a real roadmap (not "Development preview: placeholder content")
   - an email titled "Your roadmap to …"
3. Open the email on your phone and press **See your full roadmap**. It should sign you in and open the same roadmap.
4. In Supabase **Table Editor > roadmaps**, your roadmap row should be there.

Then tell Claude the address. It can run a fuller automated check against the live site.

**If something's wrong:** in Cloudflare open the Worker's **Logs**. A missing key shows a clear message such as `ANTHROPIC_API_KEYS is not set.`

---

## Stripe (payments, Phase 2) · ~20 min

Payments stay off until Phase 2 is switched on. Do all of this in Stripe's **test mode** first (the toggle at the top of the dashboard), try it, then repeat in live mode with the live keys and ids.

1. Go to **stripe.com** and create an account for the business. Set the account's currency to **GBP**.
2. **Product catalogue > Add product**, twice:
   - **Premium**: one recurring price, **monthly**, in GBP.
   - **Max**: one recurring price, **monthly**, in GBP.
   The amounts must match `PRICES` in `lib/entitlements.ts` (that is what the site shows; Stripe is what actually charges).
3. Open each price and copy its id (starts `price_`). In `wrangler.jsonc` under `vars`, replace the placeholders:
   - `STRIPE_PRICE_PREMIUM` = the Premium price id
   - `STRIPE_PRICE_MAX` = the Max price id
   Commit that change on a branch. These ids aren't secret.
4. **Developers > API keys**: copy the **Secret key** (starts `sk_test_` in test mode).
5. **Developers > Webhooks > Add endpoint**:
   - URL: `https://app.exhbt.co.uk/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - After saving, reveal the **Signing secret** (starts `whsec_`).
6. Add both as Worker secrets, either in Cloudflare (Worker > **Settings > Variables and Secrets**, type **Secret**) or from a terminal:
   ```
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
   Never put either in `wrangler.jsonc` or in chat.
7. **Settings > Billing > Customer portal**: turn it on, and allow customers to update payment methods, see invoices, cancel, and **switch plans** between Premium and Max (add both products). The "Manage billing" and "Switch to" buttons on `/account/billing` open this page.
8. Optional, for a new-joiner discount later: **Product catalogue > Coupons**, then add a **promotion code**. Checkout already shows a box for codes.
9. Open `/api/health`. Under `phase2`, every setting should be `true` and `stripe.ok` should be `true`. (This section doesn't change the overall `ok` until payments are meant to be live.)
10. Try it in test mode: sign in, open `/account/billing`, choose Premium and pay with card `4242 4242 4242 4242`, any future date and any CVC. Back on the billing page the plan should read Premium within a minute. **Manage billing** should open Stripe's page, where you can cancel; the plan should go back to Free when the subscription ends.

---

## Phase 2 launch day

Do this only when Rory says go, and in this order. Until step 6 the live site is still running `main`, so the Supabase steps must come first and the merge must follow straight after them: the migrations rename the plan keys and change the `exhbts` columns, and Phase 1 code on `main` won't read them.

Before the day: the Stripe section above done and tried in test mode, a full click-through on the `terna-preview` Worker, and the privacy policy and terms read through (they describe Phase 2).

1. **Back up.** In Supabase, **Database > Backups**, check last night's backup is there (or take one if your plan allows).
2. **Apply the migrations**, in Supabase **SQL Editor > New query**, one file at a time, **in date order**:
   - `supabase/migrations/20261113000000_plan_names.sql`
   - `supabase/migrations/20261114000000_phase2_schema.sql`
   - `supabase/migrations/20261115000000_billing_and_files.sql`
   - `supabase/migrations/20261116000000_job_links.sql`
   - If the `phase-2` branch has any file in that folder after these, run it too, by the date at the start of its name. Run only files that aren't already applied; never edit one that is.
3. **Check Storage.** Under **Storage**, there should be two buckets, `sources` and `evidence`, both **private** (the `phase2_schema` migration creates them). If one is missing, run the `insert into storage.buckets` lines from `20261114000000_phase2_schema.sql` again; they're safe to repeat. Never make either bucket public.
4. **Stripe live mode.** Switch the Stripe dashboard to live mode and repeat steps 2–7 of the Stripe section with live products and prices:
   - replace `STRIPE_PRICE_PREMIUM` and `STRIPE_PRICE_MAX` in `wrangler.jsonc` with the **live** price ids, on the `phase-2` branch
   - set the Worker secrets `STRIPE_SECRET_KEY` (starts `sk_live_`) and `STRIPE_WEBHOOK_SECRET` (from the live webhook endpoint)
5. **Turn Phase 2 on.** In Cloudflare, Worker > **Settings > Variables and Secrets**, add `EXHBT_PHASE2` = `1` as a plain variable. It's read at runtime; with it missing, Phase 2 pages stay hidden after the merge.
6. **Merge.** Open a pull request from `phase-2` into `main`, wait for CI to pass, and merge it. Cloudflare deploys `main` on its own; watch **Deployments** until it's live.
7. **Check it's working.**
   - Open `/api/health`. `ok` should be `true`, and under `phase2`: every setting `true`, `stripe.ok` `true` and `storage.ok` `true`. If a check is false, its `detail` says why.
   - On your own account, in **live mode**: sign up with a fresh email, upload a project and draft an exhbt, edit it and publish it, then pay for Premium with a real card. Check the plan reads Premium on `/account/billing` and the exhbt shows on your portfolio.
   - Refund that payment in Stripe (**Payments >** the payment **> Refund**) and cancel the subscription from **Manage billing**.
   - Delete the test account from `/account` if you don't want to keep it.

**If something goes wrong after the merge:** remove `EXHBT_PHASE2` (or set it to `0`) in Cloudflare. Phase 2 pages go back to 404 straight away, without a redeploy, while you look into it.

### Portfolio subdomains and DNS

Owned by the subdomain work, which is being built separately (decision 0001). That work will fill in this section: DNS records, Worker routes and the checks for portfolio addresses.

---

## Going public later

Do these first:
- have a solicitor review the privacy policy and terms (they're drafts)
- connect your own domain (Worker > Settings > Domains & Routes)
- verify it in Resend

Then add a **build variable** `EXHBT_PUBLIC` = `1` and redeploy. That removes the preview bar and lets search engines index the public pages. Without it, the site always stays hidden.
