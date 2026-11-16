Status: accepted
Date: 16 Nov 2026

# Admin panel and anonymous page views

## Decision

The team gets a read-only panel at `/admin` to see how the product is used: accounts, roadmaps, project ideas, exhbts, AI cost, subscriptions, referrals, leads, uploads and page views. It changes nothing. It is not linked from anywhere.

## Who can see it

Only accounts whose `profiles.role` is `exhbt_admin` (set by hand in the database; at launch that is the two founders). Everyone else, signed in or not, gets the ordinary 404 page, so nothing says the panel exists. The check runs in four places: the layout, each page, every function in `lib/admin.ts` (`requireAdmin()`), and again inside each `Store` admin method, which takes the signed-in id and throws `forbidden` if that account is not an admin. The pages carry `noindex`; `robots.txt` does not list `/admin`, because that would point at it. `/admin` is not in the middleware's session-refresh list yet: add it there so a long session stays signed in on live.

## What it shows

- **Overview** (`/admin`), with 7 days, 30 days (the default), 90 days or all time. Days are UTC and a range includes today. Accounts (total, new per day, by plan, comp counted apart: a comp is a subscription whose id starts `comp_`); roadmaps (per day, people with 1, 2 and 3 or more, the top 10 by count with email, cached against fresh, failures); project ideas (written, swaps, saved, failed runs); exhbts (started, published, per person, AI drafts and rewrites); AI cost and tokens from `ai_call_logs`, per step and per day; subscriptions (active by plan, paying against comp, from our rows, no Stripe calls); referrals; the waitlist and university leads; job links, teammates, file uploads by bucket (count and bytes); the duplicate-file review queue (outcome and date only); page views (per day, top pages, top referring sites).
- **Accounts** (`/admin/accounts`): search by email or username, newest first, 25 a page. Each row links to a read-only account page with that person's counts and their latest 100 events (names and times, never the event details).

Totals marked all time (accounts, subscriptions, job links, teammates, files) ignore the range. Each part of the overview loads on its own; if a table is missing on a database that has not had the latest migrations, that part says so and the rest still shows.

## How it reads

`Store` has a `/* admin */` block with four methods: `isAdmin`, `adminRows`, `adminAccounts`, `adminAccount`. `adminRows(actor, table, since)` returns lean rows (only the columns the panel needs; no file contents, no event details beyond whether a roadmap was cached) and `lib/admin.ts` counts them. Supabase reads in pages of 1,000 rows (`lib/admin-supabase.ts`), up to 100,000 a table; beyond that the page says its figures are partial. That is plenty for launch. When it is not, add SQL functions for the daily counts in an additive migration; there is none today. The in-memory store does the same for tests and keeps `profiles.role` in a set, set from `/dev/admin`.

## Page views

Anonymous and cookieless. A small client component in the root layout (`components/site/PageViewBeacon.tsx`) sends the path and the referring site's name to `POST /api/pv` with `sendBeacon` after the page has loaded, so it never delays a page. The server stores an `events` row named `page_view` with `user_id` null and props `path`, `referrer` and `is_portfolio`, and nothing else: no IP, user agent, cookie or account.

- The path is the pathname only. Ids (UUIDs, numbers, short codes such as a referral code) become `:id`. A portfolio is stored as `/` or `/:page`, never under the person's name. `/admin`, `/api`, `/dev` and `/auth` are not counted.
- The referrer is the host only ("google.com"), and empty for our own sites. Only a visit's first page has one.
- Robots and link-preview fetchers (user agents containing bot, crawl, spider or preview, and a few named ones) are skipped, as is a visitor whose browser sends Do Not Track or Global Privacy Control.
- A person's portfolio host serves no API (middleware answers 404 there), so its pages post to the main site. The route reads the page's own `Origin` to tell it was a portfolio, accepts only our domains and localhost, and always answers 204, so a rejected view is not visible to the sender.
- A crude limit of 60 views a minute per connection (`EXHBT_PV_PER_MINUTE`), held in one process's memory as a counter keyed by the connection address; nothing is written down. The database write goes through `runInBackground` (`ctx.waitUntil` on Workers).

The privacy and cookie pages say this in one short paragraph each.

## Not done

- No editing from the panel. Changing a plan, role or account stays in the database.
- Page views are counted per load, not per person: there is no cookie to tell people apart, so "views" is not "visitors".
- Over about 100,000 page views in a range the top pages and charts are from the latest 100,000.
