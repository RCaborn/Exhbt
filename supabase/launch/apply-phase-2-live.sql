-- LIVE PROJECT ONLY (ref jbrcseklzigdcrgqbclx). Run once, on launch day, BEFORE phase-2 is merged into main.
-- Applies, in date order and all or nothing, the Phase 2 migrations this database doesn't have yet.
-- How: Supabase dashboard > this project > SQL Editor > New query > paste this whole file > Run.
-- Generated from supabase/migrations/ on 15 Nov 2026. The files there stay the source of truth.
begin;

-- ===== 20261113000000_plan_names =====
-- Plan names: Free, Premium (was Plus), Max (was Pro, stored as 'premium').
-- docs/decisions/0006-plan-names-premium-max.md. Apply on Phase 2 launch day, just before
-- the merge: the Phase 1 code still writes the old values.
-- Order matters: move 'premium' to 'max' first, then rename 'plus' to 'premium'.

alter type plan_tier rename value 'premium' to 'max';
alter type plan_tier rename value 'plus' to 'premium';

alter table waitlist drop constraint if exists waitlist_interest_check;
update waitlist set interest = 'max' where interest = 'premium';
update waitlist set interest = 'premium' where interest = 'plus';
alter table waitlist add constraint waitlist_interest_check
  check (interest in ('premium', 'max', 'university'));
insert into supabase_migrations.schema_migrations (version, name) values ('20261113000000', '20261113000000_plan_names') on conflict do nothing;

-- ===== 20261114000000_phase2_schema =====
-- Phase 2: portfolios, exhbts as blocks, files, per-job links. docs/phase-2.md sections 4-8.
-- Apply on Phase 2 launch day with 20261113000000_plan_names.sql, before the merge.
-- exhbts had no rows when this was written (Phase 1 never created any), so its first-draft
-- columns are replaced rather than migrated.

-- Profiles: the portfolio header.
alter table profiles
  add column headline text check (char_length(headline) <= 120),
  add column bio text check (char_length(bio) <= 400),
  add column photo_file_id uuid,
  add column hide_from_search boolean not null default false;

-- A changed username redirects for 30 days, then the old name is free again.
create table username_redirects (
  old_username text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null
);
alter table username_redirects enable row level security; -- service role only

-- Claims or changes a username atomically: refuses names in use or still redirecting to someone else.
create function public.claim_username(p_user uuid, p_username text) returns void
language plpgsql security definer set search_path = public as $$
declare old text;
begin
  if exists (select 1 from profiles where username = p_username and id <> p_user) then
    raise exception 'taken';
  end if;
  if exists (select 1 from username_redirects where old_username = p_username and user_id <> p_user and expires_at > now()) then
    raise exception 'taken';
  end if;
  select username into old from profiles where id = p_user for update;
  delete from username_redirects where old_username = p_username;
  update profiles set username = p_username where id = p_user;
  if old is not null and old <> p_username then
    insert into username_redirects (old_username, user_id, expires_at)
    values (old, p_user, now() + interval '30 days')
    on conflict (old_username) do update set user_id = excluded.user_id, expires_at = excluded.expires_at;
  end if;
end $$;
revoke all on function public.claim_username(uuid, text) from public, anon, authenticated;

-- Exhbts: the block document (lib/exhbt/blocks.ts) is the source of truth. `blocks` is the
-- working copy; `published_blocks` is what employers see, replaced only on publish.
alter table exhbts
  drop column if exists outcome,
  drop column if exists key_result,
  drop column if exists method,
  drop column if exists results,
  drop column if exists skills,
  drop column if exists reflection,
  drop column if exists evidence_url,
  drop column if exists evidence_file_path,
  drop column if exists methodology,
  add column blocks jsonb not null default '{}'::jsonb,
  add column published_blocks jsonb,
  add column position integer not null default 0;
-- Slugs are unique per person (alex.exhbt.co.uk/<slug>), not across everyone.
alter table exhbts drop constraint if exists exhbts_public_slug_key;
create unique index exhbts_user_slug_idx on exhbts(user_id, public_slug) where public_slug is not null;
create index exhbts_user_position_idx on exhbts(user_id, position);

-- Files: project material for drafting (private, short-lived), evidence and images shown on exhbts.
create table exhbt_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  exhbt_id uuid references exhbts(id) on delete cascade,
  bucket text not null check (bucket in ('sources', 'evidence')),
  path text not null,
  mime text not null,
  bytes integer not null check (bytes > 0),
  kind text not null check (kind in ('source', 'evidence', 'image', 'photo')),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index exhbt_files_user_idx on exhbt_files(user_id);
alter table exhbt_files enable row level security;
create policy "own files" on exhbt_files for select using (user_id = auth.uid());

-- Per-job links (Max): what the job is, how the address reads, and the AI's picks.
alter table curated_links
  add column company text check (char_length(company) <= 120),
  add column role_title text check (char_length(role_title) <= 120),
  add column slug_style text not null default 'suffix' check (slug_style in ('clean', 'suffix')),
  add column intro text check (char_length(intro) <= 400),
  add column ranking jsonb,
  add column status text not null default 'live' check (status in ('live', 'off')),
  add column view_count integer not null default 0;

-- Storage: both buckets private. Portfolio pages hand out short-lived signed URLs, so
-- unpublishing or deleting takes effect straight away.
insert into storage.buckets (id, name, public) values ('sources', 'sources', false), ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- New AI steps: drafting an exhbt and rewriting one block.
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'exhbt_rewrite', 'originality', 'link_ranking', 'project_ideas', 'cv_read'));
insert into supabase_migrations.schema_migrations (version, name) values ('20261114000000', '20261114000000_phase2_schema') on conflict do nothing;

-- ===== 20261115000000_billing_and_files =====
-- Billing polish and file transcription logging (docs/phase-2.md sections 2 and 6).
-- Not applied anywhere yet: production migrations go on at launch (section 10).

-- Stripe can deliver events out of order. The webhook stores each event's created time here and
-- ignores an event older than the one already applied (lib/store.ts, upsertSubscription).
alter table subscriptions add column last_event_at timestamptz;

-- Reading a scanned or photographed project file is its own AI step, so its cost is counted
-- apart from drafting (lib/ai/transcribe.ts).
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'exhbt_rewrite', 'originality', 'link_ranking', 'project_ideas', 'cv_read', 'file_transcribe'));
insert into supabase_migrations.schema_migrations (version, name) values ('20261115000000', '20261115000000_billing_and_files') on conflict do nothing;

-- ===== 20261116000000_job_links =====
-- Per-job links (docs/phase-2.md section 8, decision 0008).
--
-- A link's address is collection_slug, unique per person (curated_links_user_slug_idx, 20261106120000).
-- public_slug was unique across everyone, so two people could never both have /lloyds; the app no
-- longer writes it, and it is no longer required.
alter table curated_links alter column public_slug drop not null;
alter table curated_links drop constraint if exists curated_links_public_slug_key;

-- Counts a view of a live link in one statement, so two visitors at once both count.
-- Only the service role calls it (lib/store.ts); it records nothing about the visitor.
create or replace function increment_job_link_views(link_id uuid) returns void
language sql security definer set search_path = public as $$
  update curated_links set view_count = view_count + 1 where id = link_id and status = 'live';
$$;
revoke execute on function increment_job_link_views(uuid) from public, anon, authenticated;
insert into supabase_migrations.schema_migrations (version, name) values ('20261116000000', '20261116000000_job_links') on conflict do nothing;

-- ===== 20261117000000_saved_ideas =====
-- Saved ideas: project ideas a person keeps in a list across roadmaps (docs/decisions/0010).
--
-- Each row is a copy of the idea (its words, the job it came from), so it survives a swap in the
-- roadmap and the roadmap being deleted (roadmap_id then becomes null). Like project_ideas, it is
-- readable only by its owner; the app writes through the service role and enforces the per-person
-- cap (SAVED_IDEAS_CAP in lib/store.ts).
create table saved_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  roadmap_id uuid references roadmaps(id) on delete set null,
  target_role text not null check (char_length(target_role) <= 300),
  title text not null check (char_length(title) <= 200),
  brief text not null check (char_length(brief) <= 1000),
  closes_gaps text[] not null default '{}',
  deliverable text not null check (char_length(deliverable) <= 300),
  weeks integer not null check (weeks between 1 and 12),
  created_at timestamptz not null default now(),
  unique (user_id, roadmap_id, title)
);
create index saved_ideas_user_idx on saved_ideas(user_id, created_at desc);
alter table saved_ideas enable row level security;
create policy "own saved ideas" on saved_ideas for select using (user_id = auth.uid());
insert into supabase_migrations.schema_migrations (version, name) values ('20261117000000', '20261117000000_saved_ideas') on conflict do nothing;

-- ===== 20261118000000_portfolio_theme =====
-- Portfolio looks: the theme a person chose for their portfolio header (docs/decisions/0012).
--
-- Stores the id only (lib/portfolio-themes.ts has the colours, font and photo shape). Null means the
-- default look. The column keeps a choice the person's plan no longer allows; the app shows the
-- default until they upgrade again, and never deletes it. Validity and plan are checked in code
-- (an id that stops existing falls back to the default), so there is no enum here. Row-level
-- security is unchanged: profiles are read and written through the existing policies and the
-- service role.
alter table profiles
  add column portfolio_theme text check (char_length(portfolio_theme) <= 40);
insert into supabase_migrations.schema_migrations (version, name) values ('20261118000000', '20261118000000_portfolio_theme') on conflict do nothing;

-- ===== 20261119000000_teammates =====
-- Teammates on an exhbt, and private matching of identical files (docs/decisions/0013).
-- Not applied anywhere yet: production migrations go on at launch (docs/phase-2.md section 10).
--
-- Like the other Phase 2 tables, rows are written by the app through the service role. Selects
-- are limited to the exhbt's owner (and a member's own membership row). duplicate_matches has no
-- policy at all: it is for the app and an admin only, so an uploader can never read who else
-- holds the same file.

-- A teammate's own exhbt made from a team project points at the original. Deleting the original
-- leaves theirs standing: the link clears, and the project files they were given are their own
-- copies (lib/team.ts, makeOwnExhbt).
alter table exhbts add column team_of uuid references exhbts(id) on delete set null;
create index exhbts_team_of_idx on exhbts(team_of) where team_of is not null;

-- SHA-256 of each uploaded file's bytes, as 64 hex characters, worked out on the server once the
-- upload has landed (app/api/files/[id]/complete). Null for files from before this, and for the
-- app's own helper files.
alter table exhbt_files add column sha256 text check (sha256 ~ '^[0-9a-f]{64}$');
create index exhbt_files_sha256_idx on exhbt_files(sha256) where sha256 is not null;

-- Accepted teammates. A byline on the exhbt, not part of its content: they count no words.
-- The per-exhbt cap is TEAMMATES_PER_EXHBT in lib/team-rules.ts, checked in code.
create table exhbt_members (
  exhbt_id uuid not null references exhbts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default '' check (char_length(role) <= 40),
  added_at timestamptz not null default now(),
  primary key (exhbt_id, user_id)
);
create index exhbt_members_user_idx on exhbt_members(user_id);
alter table exhbt_members enable row level security;
create policy "members of own exhbts" on exhbt_members for select
  using (exists (select 1 from exhbts e where e.id = exhbt_id and e.user_id = auth.uid()));
create policy "own memberships" on exhbt_members for select using (user_id = auth.uid());

-- Invites by email. The link carries a signed token; only its SHA-256 is stored, so a leaked
-- table can't be turned into working links. Resending replaces the hash and the expiry.
-- Addresses are stored lower-case, so lookups are exact matches.
create table exhbt_invites (
  id uuid primary key,
  exhbt_id uuid not null references exhbts(id) on delete cascade,
  email text not null check (char_length(email) <= 320 and email = lower(email)),
  role text not null default '' check (char_length(role) <= 40),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz
);
create index exhbt_invites_exhbt_idx on exhbt_invites(exhbt_id);
create index exhbt_invites_email_idx on exhbt_invites(email);
-- One open invite per address per exhbt; inviting the same address again resends it.
create unique index exhbt_invites_open_idx on exhbt_invites(exhbt_id, email)
  where accepted_at is null and cancelled_at is null;
alter table exhbt_invites enable row level security;
create policy "invites on own exhbts" on exhbt_invites for select
  using (exists (select 1 from exhbts e where e.id = exhbt_id and e.user_id = auth.uid()));

-- Each time an upload's fingerprint matches a file on another account's exhbt. Never shown
-- publicly; kept for an admin to review. outcome: shown (prompt shown, no answer yet), asked
-- (the uploader asked to join), approved / declined (the owner's answer), mine (the uploader
-- said "No, it's mine"), repeat (the same uploader matched the same exhbt again after an answer).
create table duplicate_matches (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploader_id uuid not null references profiles(id) on delete cascade,
  uploader_file_id uuid references exhbt_files(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete cascade,
  owner_file_id uuid references exhbt_files(id) on delete set null,
  owner_exhbt_id uuid references exhbts(id) on delete set null,
  outcome text not null default 'shown'
    check (outcome in ('shown', 'asked', 'approved', 'declined', 'mine', 'repeat')),
  -- What the uploader said they did on the project, when they asked to join.
  role text check (char_length(role) <= 40),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  decided_at timestamptz
);
create index duplicate_matches_owner_idx on duplicate_matches(owner_id, outcome);
create index duplicate_matches_pair_idx on duplicate_matches(uploader_id, owner_exhbt_id, created_at desc);
alter table duplicate_matches enable row level security; -- service role only
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000000', '20261119000000_teammates') on conflict do nothing;

-- ===== 20261120000000_portfolio_layout =====
-- The portfolio customiser: how a person arranges their at-a-glance page (docs/decisions/0014).
-- Not applied anywhere yet: production migrations go on at launch (docs/phase-2.md section 10).
--
-- Three additions, all with safe defaults, so every existing portfolio looks exactly as before:
--
--   exhbts.hidden_on_portfolio  true when the owner has left the exhbt off the at-a-glance page. The
--                               exhbt stays published and its own link keeps working; it leaves the
--                               glance page and anything that lists the portfolio.
--   profiles.featured_exhbt_id  the exhbt shown first as a wide tile, or null. Clears itself if that
--                               exhbt is deleted.
--   profiles.portfolio_layout   jsonb, the rest of the arrangement. Shape (lib/portfolio-layout.ts):
--                                 { "v": 1,
--                                   "slots": ["p", "about", "p", "p", "quote"],  -- "p" = a project, in exhbts.position order
--                                   "tiles": { "about": { "text": "..." }, "education": { "lines": [...] }, ... },
--                                   "header": { "skills": true, "linkedin": true } }
--                               '{}' means the default arrangement. The app validates and normalises it
--                               on every read and write, so the column only caps the size here.
--
-- Row-level security is unchanged: profiles and exhbts are read and written through the existing
-- policies and the service role. The layout is part of the profile row, so the account export
-- already includes it and deleting the account deletes it.
alter table exhbts
  add column hidden_on_portfolio boolean not null default false;

alter table profiles
  add column featured_exhbt_id uuid references exhbts(id) on delete set null,
  add column portfolio_layout jsonb not null default '{}'::jsonb
    check (pg_column_size(portfolio_layout) <= 16384);
insert into supabase_migrations.schema_migrations (version, name) values ('20261120000000', '20261120000000_portfolio_layout') on conflict do nothing;

commit;
