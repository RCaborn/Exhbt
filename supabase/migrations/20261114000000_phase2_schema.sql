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
