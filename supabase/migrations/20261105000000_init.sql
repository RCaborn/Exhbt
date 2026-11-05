-- Exhbt initial schema: all eight entities from the dev brief, plus events and leads.
-- RLS is on for every table. The server writes with the service role and checks
-- ownership in code; the policies below stop the public anon key reading anything
-- it should not, which matters once R2 adds browser-side reads.

create extension if not exists pgcrypto;

create type plan_tier as enum ('free', 'basic', 'custom', 'institutional');
create type pack_status as enum ('draft', 'flagged', 'published', 'read_only');
create type user_role as enum ('user', 'institution_admin', 'exhbt_admin');

create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email_domain text unique,
  seat_limit int not null default 0,
  licence_start date,
  licence_end date,
  price_gbp numeric(10,2),
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role user_role not null default 'user',
  plan plan_tier not null default 'free',
  institution_id uuid references institutions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan plan_tier not null,
  status text not null,
  provider_customer_id text,
  provider_subscription_id text unique,
  renews_at timestamptz,
  created_at timestamptz not null default now()
);

-- One roadmap per user is the brief's rule; history is kept, latest wins.
create table roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  pending_email text,                 -- set before the magic link is clicked
  input_json jsonb not null,          -- CV text, skills, target role, ambitions
  input_hash text not null,           -- cache key for identical inputs
  output_json jsonb,
  created_at timestamptz not null default now()
);
create index roadmaps_user_idx on roadmaps(user_id);
create index roadmaps_hash_idx on roadmaps(input_hash) where output_json is not null;
create index roadmaps_pending_idx on roadmaps(pending_email) where user_id is null;

create table packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  outcome text not null default '',
  method text not null default '',
  results text[] not null default '{}' check (cardinality(results) <= 3),
  reflection text not null default '',
  evidence_url text,
  evidence_file_path text,
  status pack_status not null default 'draft',
  confirmed_at timestamptz,
  public_slug text unique,            -- 22-char random, generated on publish
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index packs_user_idx on packs(user_id);

create table originality_checks (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs(id) on delete cascade,
  result text not null check (result in ('pass', 'flag', 'error')),
  score numeric,
  report_url text,
  checked_at timestamptz not null default now()
);

create table curated_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  job_listing_text text,
  job_listing_url text,
  pack_ids uuid[] not null default '{}' check (cardinality(pack_ids) <= 4),
  public_slug text unique not null,
  created_at timestamptz not null default now()
);

create table ai_call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  step text not null check (step in ('roadmap', 'pack_draft', 'originality', 'link_ranking')),
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  cost_usd numeric(10,6) not null,
  created_at timestamptz not null default now()
);

-- First-party, cookieless product analytics.
create table events (
  id bigint generated always as identity primary key,
  name text not null,
  user_id uuid references profiles(id) on delete set null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_name_time_idx on events(name, created_at);

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  institution text not null,
  message text,
  created_at timestamptz not null default now()
);

-- Create a profile row when Supabase Auth creates a user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security
alter table institutions enable row level security;
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table roadmaps enable row level security;
alter table packs enable row level security;
alter table originality_checks enable row level security;
alter table curated_links enable row level security;
alter table ai_call_logs enable row level security;
alter table events enable row level security;
alter table leads enable row level security;

create policy "own profile" on profiles for select using (id = auth.uid());
create policy "own subscriptions" on subscriptions for select using (user_id = auth.uid());
create policy "own roadmaps" on roadmaps for select using (user_id = auth.uid());
create policy "own packs" on packs for select using (user_id = auth.uid());
create policy "published packs are public" on packs for select using (status in ('published', 'read_only'));
create policy "own originality checks" on originality_checks for select
  using (exists (select 1 from packs p where p.id = pack_id and p.user_id = auth.uid()));
create policy "own curated links" on curated_links for select using (user_id = auth.uid());
-- institutions, ai_call_logs, events, leads: no policies, so service role only.
