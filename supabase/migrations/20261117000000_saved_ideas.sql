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
