Status: accepted (built, switched off)
Date: 16 Nov 2026

# Referrals: £5 credit when someone you refer first pays

## Decision

The founders (16 Nov 2026): when a person someone referred makes their first payment, the referrer gets £5 of Stripe account credit, automatically. The figure is `REFERRAL_CREDIT_PENCE` in `lib/entitlements.ts`.

It is built and off. `REFERRALS_LIVE` in `lib/referrals.ts` is `false`, and every entry point asks `referralsLive()`: the link, the sign-in hook, the webhook step and the account box. Nothing can run until Stripe is live and the two launch checks below are done. Tests turn it on with `EXHBT_REFERRALS_TEST=1`, which is ignored in production and also swaps the Stripe credit for a recorded stand-in (`/dev/referrals`).

## How it works

1. Each account has a short code (8 characters, no look-alikes), made the first time it is asked for: `profiles.referral_code`, unique.
2. The link is `https://www.exhbt.co.uk/r/<code>` (`app/r/[code]/route.ts`). A known code sets the cookie `exhbt_ref` (httpOnly, SameSite Lax, 30 days, Secure in production, domain `.exhbt.co.uk` so www and app both see it) and goes to `/start`. The value is the code and the time, signed with `EXHBT_COOKIE_SECRET`. An unknown code, or referrals off, goes to the home page and sets nothing.
3. When someone signs in through a link (`/auth/callback`, `/auth/confirm`, `/auth/dev`), `recordReferralFromCookie` records a pending referral if the cookie is valid, the code is not their own, they have no subscription, and the account was **created after the link was followed**. That last test is what stops an existing user who clicks a link from being "referred": these routes run on every sign-in, not only the first. `referred_id` is unique, so one referrer per account, ever.
4. In the Stripe webhook, on `checkout.session.completed` for a subscription, after the plan is saved: if the referred person's checkout was real money (`payment_status` paid and a non-zero total, so a 100% code is not a payment), the referral moves pending to earned. That is the only way in, so only a first payment counts. An earned referral is credited if the referrer has a Stripe customer: a customer balance transaction of -500 GBP with a description and the referral id in its metadata, sent with the idempotency key `exhbt-referral-<referral id>`. The row then moves earned to credited with Stripe's transaction id. Both moves are conditional updates, so a webhook retry or two parallel deliveries change each row once and Stripe returns the same transaction. A Stripe failure returns 500 and Stripe retries.
5. If the referrer is not a customer yet, the referral stays earned. It is credited when the referrer's own subscription checkout completes (the same webhook step looks for earned referrals where they are the referrer). A free referrer's credit therefore only reduces their first invoice, and with yearly billing that is a year after the credit was earned if they were never a customer before. The copy says "credit towards your next payment", never cash.
6. The account page shows "Refer a friend" (link, copy button, count credited) only while referrals are live.

## Data

`supabase/migrations/20261123000000_referrals.sql`: `profiles.referral_code`; `referrals` (referrer, referred, status, timestamps, Stripe transaction id) with row-level security on and an owner-select policy. The app writes through the service role. If the referred person deletes their account, a pending referral goes with them; an earned or credited one stays with `referred_id` cleared, so the referrer keeps what they earned. If the referrer deletes theirs, their referrals go. The export gives each person their own side only: referrals they made (status and dates, never who) and whether a referral is on their account (status, never by whom). The `Store` has a `/* referrals */` block in the interface and both implementations.

## Before the flag goes on

- **Stripe is live** and the yearly prices exist (`LAUNCH.md`). No new webhook event is needed: the credit rides on `checkout.session.completed`, already in the endpoint's list.
- **The cookie position.** `/legal/cookies` says every cookie is strictly necessary and there is no banner. `exhbt_ref` is set by following a link and exists to pay a third party, which is hard to call strictly necessary under PECR. Decide between a consent step on the link and a different design (for example carrying the code in the URL through the gate) before the flag goes on, then update the cookie and privacy pages. Today those pages say referrals are not open and describe what will happen.
- Someone who opens the sign-in email in another browser from the one that followed the link loses the cookie, so no referral is recorded. Known limit; the fix would be to store the code on the roadmap at the email gate.

## Guards

No self-referral (checked at the link, in the hook, and by a database check). One referral per referred account (unique). Only a first real payment earns. Idempotent credit (conditional update plus Stripe's key). Abuse beyond that (many throwaway accounts paying £9) costs the referrer's friend real money each time, so it is not a free credit farm; no further limit is built.
