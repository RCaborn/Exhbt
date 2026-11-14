-- Portfolio looks: the theme a person chose for their portfolio header (docs/decisions/0012).
--
-- Stores the id only (lib/portfolio-themes.ts has the colours, font and photo shape). Null means the
-- default look. The column keeps a choice the person's plan no longer allows; the app shows the
-- default until they upgrade again, and never deletes it. Validity and plan are checked in code
-- (an id that stops existing falls back to the default), so there is no enum here. Row-level
-- security is unchanged: profiles are read and written through the existing policies and the
-- service role.
alter table profiles
  add column portfolio_theme text check (char_length(portfolio_theme) <= 40);
