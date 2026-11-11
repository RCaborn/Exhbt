-- Generation lock (one Anthropic call per roadmap at a time) and shared rate-limit hits.
-- Per-idea swap counts for the launch "5 regenerations of each project suggestion" rule.

alter table roadmaps
  add column if not exists generation_started_at timestamptz;

alter table project_ideas
  add column if not exists swaps_used integer not null default 0 check (swaps_used >= 0);

-- Append-only hits so every Worker isolate shares the same counters.
create table if not exists rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_key_time_idx on rate_limit_hits (key, created_at);

alter table rate_limit_hits enable row level security;
-- No policies: service role only.
