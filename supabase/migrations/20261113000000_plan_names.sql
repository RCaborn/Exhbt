-- Plan names: Free, Premium (was Plus), Max (was Pro, stored as 'premium').
-- docs/decisions/0006-plan-names-premium-max.md. Apply on Phase 2 launch day, just before
-- the merge: the Phase 1 code still writes the old values.
-- Order matters: move 'premium' to 'max' first, then rename 'plus' to 'premium'.

alter type plan_tier rename value 'premium' to 'max';
alter type plan_tier rename value 'plus' to 'premium';

alter table waitlist drop constraint if exists waitlist_interest_check;
update waitlist set interest = 'max' where interest = 'premium';
update waitlist set interest = 'premium' where interest = 'plus';
alter table waitlist add constraint waitlist_interest_check
  check (interest in ('premium', 'max', 'university'));
