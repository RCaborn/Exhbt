-- LIVE PROJECT ONLY (ref jbrcseklzigdcrgqbclx). Run BEFORE merging the auto-figure release into main.
-- Adds 20261124 (figure_pick), all or nothing, recorded in history.
-- Apply 20261121000000_portfolio_personal first: its check list doesn't have 'figure_pick', so
-- running it after this one would take 'figure_pick' out again.
-- How: Supabase dashboard > this project > SQL Editor > New query > paste this whole file > Run.
begin;

-- ===== 20261124000000_figure_pick =====
-- Picking the figure from an upload (docs/decisions/0017-auto-figure.md). The AI call that picks it
-- logs its cost as 'figure_pick', apart from the draft. The check is replaced with the full list
-- (20261121's, with 'portfolio_intro') plus 'figure_pick'; every existing value stays.
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'exhbt_rewrite', 'originality', 'link_ranking', 'project_ideas', 'cv_read', 'file_transcribe', 'portfolio_intro', 'figure_pick'));
insert into supabase_migrations.schema_migrations (version, name) values ('20261124000000', '20261124000000_figure_pick') on conflict do nothing;

commit;
