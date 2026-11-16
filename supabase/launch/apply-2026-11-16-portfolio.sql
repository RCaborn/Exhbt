-- LIVE PROJECT ONLY (ref jbrcseklzigdcrgqbclx). Run BEFORE merging the portfolio home and exhbt page release into main.
-- Adds 20261121 (portfolio builder: location, looking for, links, contact email, longer bio, portfolio_intro AI step).
-- All or nothing, recorded in history. Constraint names checked on live 16 Nov 2026.
begin;

-- ===== 20261121000000_portfolio_personal =====
-- The guided portfolio builder: the parts that make a portfolio feel like the person's own
-- (docs/decisions/0016). Not applied anywhere yet: production migrations go on at launch
-- (docs/phase-2.md section 10).
--
-- All additive, nullable, with no default to back-fill, so every existing portfolio looks as before:
--
--   profiles.location        where they are, in their words ("Leeds", "London or remote").
--   profiles.looking_for     one line on what they want next ("Graduate data roles from September").
--   profiles.github_url      an https github.com address, checked by the app.
--   profiles.website_url     an https address, checked by the app.
--   profiles.contact_email   an email to show as text on the page (never a mailto). It can differ
--                            from the sign-in address, which is never shown.
--
-- The bio becomes the intro that leads the page, so it gets room for about 60 words: its length
-- check is replaced with a longer one. Every stored bio already passes it.
--
-- Row-level security is unchanged: these are columns on the profile row, read and written through
-- the existing policies and the service role. The account export selects the whole row, so it
-- includes them; deleting the account deletes them.
alter table profiles
  add column location text check (char_length(location) <= 80),
  add column looking_for text check (char_length(looking_for) <= 160),
  add column github_url text check (char_length(github_url) <= 200),
  add column website_url text check (char_length(website_url) <= 200),
  add column contact_email text check (char_length(contact_email) <= 120);

alter table profiles drop constraint if exists profiles_bio_check;
alter table profiles add constraint profiles_bio_check check (char_length(bio) <= 700);

-- "Suggest an intro" logs its AI call like every other step. The check is replaced with the same
-- list the live database has (checked 16 Nov 2026) plus 'portfolio_intro'; every existing value stays.
alter table ai_call_logs drop constraint if exists ai_call_logs_step_check;
alter table ai_call_logs add constraint ai_call_logs_step_check
  check (step in ('roadmap', 'exhbt_draft', 'exhbt_rewrite', 'originality', 'link_ranking', 'project_ideas', 'cv_read', 'file_transcribe', 'portfolio_intro'));
insert into supabase_migrations.schema_migrations (version, name) values ('20261121000000', '20261121000000_portfolio_personal') on conflict do nothing;

commit;
