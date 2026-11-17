-- The AI CV reader (lib/ai/cv.ts) is a new kind of AI call: a scanned PDF or photo of a CV
-- that the browser couldn't read, sent with the visitor's agreement.
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'originality', 'link_ranking', 'project_ideas', 'cv_read'));
