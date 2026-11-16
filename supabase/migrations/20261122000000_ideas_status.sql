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
