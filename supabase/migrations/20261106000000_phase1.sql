-- Phase 1: instant roadmaps, roadmap email, marketing consent, per-IP rate limit.

alter table roadmaps
  add column email_sent_at timestamptz,
  add column creator_ip_hash text,
  add column pending_marketing_opt_in boolean not null default false;

create index roadmaps_ip_time_idx on roadmaps(creator_ip_hash, created_at);
create index roadmaps_email_time_idx on roadmaps(pending_email, created_at);

alter table profiles
  add column marketing_opt_in boolean not null default false,
  add column marketing_opt_in_at timestamptz;
