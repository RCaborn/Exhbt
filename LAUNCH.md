# Launch checklist: private preview

This puts Exhbt live on a private Cloudflare address (`https://terna.<your-account>.workers.dev`), with the real database, AI and email. It stays **hidden from search engines** and shows a "Private preview" bar until you choose to go public (see the end).

About 30–45 minutes. You'll paste keys into each service's dashboard; **never paste keys into chat or commit them to GitHub.**

Dashboards change their wording from time to time. If a label below doesn't match exactly, look for the closest equivalent.

---

## 1. Anthropic (writes the roadmaps) · ~5 min

1. Go to **console.anthropic.com** and sign up.
2. **Billing:** add $5–10 of credit. A roadmap costs roughly $0.001, so this lasts a long time.
3. Optional: **Limits:** set a monthly spend limit (e.g. $10).
4. **API keys > Create key**, name it `exhbt`. Copy it somewhere safe for step 4. → this is `ANTHROPIC_API_KEY`

## 2. Supabase (database and sign-in) · ~10 min

1. Go to **supabase.com**, sign up, and create a **New project**:
   - Name: `exhbt`
   - **Region: London (eu-west-2)**. This matters for UK data rules.
   - Save the database password in your password manager. You won't need it for this checklist.
2. When the project is ready, open **SQL Editor > New query**:
   - Open `supabase/migrations/20261105000000_init.sql` in this repo on GitHub, copy all of it, paste it, and press **Run**. It should say "Success".
   - Do the same with each remaining file in that folder, **in date order**: `20261106000000_phase1.sql`, then `20261106120000_meeting_updates.sql`, then `20261106150000_tiers_and_methodology.sql`.
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
   - **To email anyone**, verify **exhbt.co.uk**: in Resend use **Domains > Add domain** and add the DNS records it shows you at your domain registrar or in Cloudflare DNS. Then use `EMAIL_FROM` = `Exhbt <hello@exhbt.co.uk>`.
   - **Google Workspace is fine alongside this.** Resend sends from a subdomain it gives you (e.g. `send.exhbt.co.uk`), so your Workspace inboxes and MX records are untouched. Make sure `hello@` and `privacy@exhbt.co.uk` exist in Workspace (or as aliases), because the site tells people to email them.
3. Optional, recommended once you have a domain: in Supabase, under **Authentication > Emails > SMTP settings**, enable custom SMTP with Resend's SMTP details. Without this, Supabase's built-in email only sends the `/login` emails to members of your Supabase team, so friends couldn't log in from another device. Roadmap emails don't depend on this.

## 4. Cloudflare (hosting) · ~10 min

1. **Upgrade to Workers Paid ($5/month)** under Workers & Pages > Plans. The free plan's per-request processing limit is likely too tight for this app. Pages can fail with error **1102** on it.
2. **Workers & Pages > Create > Import a repository.** Connect GitHub and choose **`RCaborn/Exhbt`** (it was called `RCaborn/Terna` before the rename).
3. Settings on that screen:
   - Project name: **`terna`** (must match `"name"` in `wrangler.jsonc`)
   - Production branch: **`main`**
   - Build command: `npx opennextjs-cloudflare build` (**not** the default `npm run build`, which fails at the deploy step with "Could not find compiled Open Next config")
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - If an existing Worker fails with that error, fix the two commands under the Worker's **Settings > Build**, then retry the latest build under **Deployments**.
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
     | `ANTHROPIC_API_KEY` | from step 1 |
     | `RESEND_API_KEY` | from step 3 |
     | `EMAIL_FROM` | from step 3 |
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

**If something's wrong:** in Cloudflare open the Worker's **Logs**. A missing key shows a clear message such as `ANTHROPIC_API_KEY is not set.`

---

## Going public later

Do these first:
- have a solicitor review the privacy policy and terms (they're drafts)
- connect your own domain (Worker > Settings > Domains & Routes)
- verify it in Resend

Then add a **build variable** `EXHBT_PUBLIC` = `1` and redeploy. That removes the preview bar and lets search engines index the public pages. Without it, the site always stays hidden.
