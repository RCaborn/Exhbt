-- The plan: three project ideas, each swappable, behind a details gate (docs/decisions/0004).

-- The gate asks for a name, an email and (optionally) a LinkedIn profile before the project ideas.
-- Like pending_email, these sit on the roadmap until sign-in copies them to the profile.
alter table roadmaps
  add column pending_name text check (char_length(pending_name) <= 100),
  add column pending_linkedin text check (char_length(pending_linkedin) <= 200),
  add column projects_unlocked_at timestamptz,
  add column project_swaps_used integer not null default 0 check (project_swaps_used >= 0),
  add column plan_confirmed_at timestamptz;

alter table profiles add column linkedin_url text check (char_length(linkedin_url) <= 200);

-- The ideas on a roadmap's Projects page, one row per slot in the plan (positions 0-2). Kept apart
-- from roadmaps.output_json, which is shared between roadmaps with the same inputs (the output
-- cache): a swap belongs to one person only.
create table project_ideas (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps(id) on delete cascade,
  position integer not null check (position between 0 and 2),
  title text not null check (char_length(title) <= 200),
  brief text not null check (char_length(brief) <= 1000),
  closes_gaps text[] not null default '{}',
  deliverable text not null check (char_length(deliverable) <= 300),
  weeks integer not null check (weeks between 1 and 12),
  source text not null check (source in ('roadmap', 'swap')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (roadmap_id, position)
);

alter table project_ideas enable row level security;
create policy "own project ideas" on project_ideas for select using (
  exists (select 1 from roadmaps r where r.id = project_ideas.roadmap_id and r.user_id = auth.uid())
);

-- Swapping an idea is a new kind of AI call.
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'originality', 'link_ranking', 'project_ideas'));
