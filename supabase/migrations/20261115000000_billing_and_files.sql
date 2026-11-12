-- Billing polish and file transcription logging (docs/phase-2.md sections 2 and 6).
-- Not applied anywhere yet: production migrations go on at launch (section 10).

-- Stripe can deliver events out of order. The webhook stores each event's created time here and
-- ignores an event older than the one already applied (lib/store.ts, upsertSubscription).
alter table subscriptions add column last_event_at timestamptz;

-- Reading a scanned or photographed project file is its own AI step, so its cost is counted
-- apart from drafting (lib/ai/transcribe.ts).
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'exhbt_rewrite', 'originality', 'link_ranking', 'project_ideas', 'cv_read', 'file_transcribe'));
