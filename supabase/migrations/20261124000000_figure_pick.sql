-- Picking the figure from an upload (docs/decisions/0017-auto-figure.md). Not applied anywhere yet:
-- production migrations go on at launch (docs/phase-2.md section 10).
--
-- When an exhbt is drafted from a PDF, small images of the pages that draw a chart, diagram or
-- table go to the AI, which picks the figure that best shows the result. That call logs its cost
-- like every other step, as 'figure_pick', so it is costed apart from the draft. The check is
-- replaced with the full list from 20261121000000_portfolio_personal.sql plus 'figure_pick'; every
-- existing value stays. The constraint's name is the one Postgres gave the column check in
-- 20261105000000_init.sql, which every later migration has dropped and added under the same name.
--
-- Nothing else changes: the picked figure is an image section in the exhbt's jsonb doc, with a
-- note of the file and page it came from and the person's tick that they may share it.
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'exhbt_rewrite', 'originality', 'link_ranking', 'project_ideas', 'cv_read', 'file_transcribe', 'portfolio_intro', 'figure_pick'));
