-- Tiers revised 6 Nov 2026 (later the same day as the team meeting):
-- Free (roadmap, 3 refreshes/month) · Plus (4 exhbts, personal link) ·
-- Premium (10 exhbts, a custom link per job) · Institutional (students get Premium).
alter type plan_tier add value if not exists 'plus' before 'premium';

alter table waitlist drop constraint if exists waitlist_interest_check;
alter table waitlist add constraint waitlist_interest_check
  check (interest in ('plus', 'premium', 'university'));

-- Exhbts show their methodology as a flow diagram: [{ "step": "...", "detail": "..." }].
-- The older method/results text arrays stay for compatibility and are no longer shown.
alter table exhbts add column methodology jsonb not null default '[]'::jsonb;
