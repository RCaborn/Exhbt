-- The portfolio customiser: how a person arranges their at-a-glance page (docs/decisions/0014).
-- Not applied anywhere yet: production migrations go on at launch (docs/phase-2.md section 10).
--
-- Three additions, all with safe defaults, so every existing portfolio looks exactly as before:
--
--   exhbts.hidden_on_portfolio  true when the owner has left the exhbt off the at-a-glance page. The
--                               exhbt stays published and its own link keeps working; it leaves the
--                               glance page and anything that lists the portfolio.
--   profiles.featured_exhbt_id  the exhbt shown first as a wide tile, or null. Clears itself if that
--                               exhbt is deleted.
--   profiles.portfolio_layout   jsonb, the rest of the arrangement. Shape (lib/portfolio-layout.ts):
--                                 { "v": 1,
--                                   "slots": ["p", "about", "p", "p", "quote"],  -- "p" = a project, in exhbts.position order
--                                   "tiles": { "about": { "text": "..." }, "education": { "lines": [...] }, ... },
--                                   "header": { "skills": true, "linkedin": true } }
--                               '{}' means the default arrangement. The app validates and normalises it
--                               on every read and write, so the column only caps the size here.
--
-- Row-level security is unchanged: profiles and exhbts are read and written through the existing
-- policies and the service role. The layout is part of the profile row, so the account export
-- already includes it and deleting the account deletes it.
alter table exhbts
  add column hidden_on_portfolio boolean not null default false;

alter table profiles
  add column featured_exhbt_id uuid references exhbts(id) on delete set null,
  add column portfolio_layout jsonb not null default '{}'::jsonb
    check (pg_column_size(portfolio_layout) <= 16384);
