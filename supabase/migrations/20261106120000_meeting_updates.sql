-- Changes agreed in the 6 Nov 2026 team meeting.

-- Plans (defined in the init migration): Free (roadmaps, limited refreshes, no exhbts),
-- Premium (hosted exhbts and per-employer links), Institutional (students get Premium).

-- Waitlist for Premium and for universities, the early-release goal.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  interest text not null check (interest in ('premium', 'university')),
  source text not null default 'site',
  created_at timestamptz not null default now(),
  unique (email, interest)
);
alter table waitlist enable row level security; -- service role only

-- Public portfolio URLs: exhbt.co.uk/<username> and exhbt.co.uk/<username>/<collection>.
alter table profiles
  add column username text unique check (username ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$');
-- Per-employer collections live at /<username>/<slug>; slugs carry a short random suffix
-- (e.g. northfield-health-k3x9) so they can't be guessed from the employer's name.
alter table curated_links add column collection_slug text;
create unique index curated_links_user_slug_idx on curated_links(user_id, collection_slug);

-- array_to_string is only STABLE, and a stored generated column needs an IMMUTABLE expression,
-- so this file failed on every Postgres ("generation expression is not immutable") until
-- 10 Nov 2026, when this wrapper was added. For text[] the result never changes, so IMMUTABLE
-- is safe. Fixing the file in place was right: it could never have been applied anywhere.
create function immutable_array_to_string(text[], text) returns text
  language sql immutable parallel safe
  as $$ select array_to_string($1, $2) $$;

-- UK job profiles with required skills (~3,000 roles), loaded by scripts/import-jobs.ts.
create table job_profiles (
  id text primary key,                 -- stable id from the source dataset
  title text not null,
  alt_titles text[] not null default '{}',
  skills text[] not null default '{}',
  summary text,
  source text not null,
  search tsvector generated always as (
    to_tsvector('english', title || ' ' || immutable_array_to_string(alt_titles, ' '))
  ) stored
);
create index job_profiles_search_idx on job_profiles using gin(search);
alter table job_profiles enable row level security;
create policy "job profiles are public" on job_profiles for select using (true);
