-- LIVE PROJECT ONLY (ref jbrcseklzigdcrgqbclx). Run BEFORE merging the 16 Nov release into main.
-- Adds 20261122 (project ideas status) and 20261123 (referrals), all or nothing, recorded in history.
begin;

-- ===== 20261122000000_ideas_status =====
-- Project ideas are made in the background after the roadmap (docs/decisions/0019). These three
-- columns say whether that is under way, failed, or has been tried too often, so two requests
-- never pay for two AI calls and the page can show the right state.
--
--   ideas_started_at  when the ideas were last started. Null: never.
--   ideas_failed_at   when the last try failed. It only counts if it is not before ideas_started_at.
--   ideas_attempts    how many times they've been started; the app stops retrying at a fixed number.
--
-- Safe defaults: every existing roadmap reads as "never started", and one that already has ideas
-- (or old projects in its output) never starts anything.
alter table roadmaps
  add column ideas_started_at timestamptz,
  add column ideas_failed_at timestamptz,
  add column ideas_attempts integer not null default 0 check (ideas_attempts >= 0);
insert into supabase_migrations.schema_migrations (version, name) values ('20261122000000', '20261122000000_ideas_status') on conflict do nothing;

-- ===== 20261123000000_referrals =====
-- Referrals (docs/decisions/0020-referrals.md). Built but off: nothing reads these until
-- REFERRALS_LIVE in lib/referrals.ts is true. Not applied anywhere yet: production migrations go
-- on at launch (docs/phase-2.md section 10).

-- A short code per account, made the first time it is asked for (lib/store.ts, getReferralCode).
alter table profiles
  add column referral_code text unique check (referral_code ~ '^[a-z0-9]{6,12}$');

-- One row per referred account, ever (referred_id is unique). The status moves one way:
-- pending (signed up through a link), earned (their first payment went through), credited
-- (the referrer's account credit was made in Stripe; credit_ref is Stripe's balance transaction id).
-- If the referred person deletes their account the row stays with referred_id cleared, so the
-- referrer keeps what they earned; a row still pending is deleted instead (lib/store.ts).
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid unique references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'earned', 'credited')),
  created_at timestamptz not null default now(),
  earned_at timestamptz,
  credited_at timestamptz,
  credit_ref text,
  check (referred_id is null or referrer_id <> referred_id)
);
create index referrals_referrer_idx on referrals(referrer_id, status);

-- Owner-select only: a referrer can read their own rows. The app writes through the service role.
alter table referrals enable row level security;
create policy "own referrals" on referrals for select using (referrer_id = auth.uid());
insert into supabase_migrations.schema_migrations (version, name) values ('20261123000000', '20261123000000_referrals') on conflict do nothing;

commit;
