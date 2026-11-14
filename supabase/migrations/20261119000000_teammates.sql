-- Teammates on an exhbt, and private matching of identical files (docs/decisions/0013).
-- Not applied anywhere yet: production migrations go on at launch (docs/phase-2.md section 10).
--
-- Like the other Phase 2 tables, rows are written by the app through the service role. Selects
-- are limited to the exhbt's owner (and a member's own membership row). duplicate_matches has no
-- policy at all: it is for the app and an admin only, so an uploader can never read who else
-- holds the same file.

-- A teammate's own exhbt made from a team project points at the original. Deleting the original
-- leaves theirs standing: the link clears, and the project files they were given are their own
-- copies (lib/team.ts, makeOwnExhbt).
alter table exhbts add column team_of uuid references exhbts(id) on delete set null;
create index exhbts_team_of_idx on exhbts(team_of) where team_of is not null;

-- SHA-256 of each uploaded file's bytes, as 64 hex characters, worked out on the server once the
-- upload has landed (app/api/files/[id]/complete). Null for files from before this, and for the
-- app's own helper files.
alter table exhbt_files add column sha256 text check (sha256 ~ '^[0-9a-f]{64}$');
create index exhbt_files_sha256_idx on exhbt_files(sha256) where sha256 is not null;

-- Accepted teammates. A byline on the exhbt, not part of its content: they count no words.
-- The per-exhbt cap is TEAMMATES_PER_EXHBT in lib/team-rules.ts, checked in code.
create table exhbt_members (
  exhbt_id uuid not null references exhbts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default '' check (char_length(role) <= 40),
  added_at timestamptz not null default now(),
  primary key (exhbt_id, user_id)
);
create index exhbt_members_user_idx on exhbt_members(user_id);
alter table exhbt_members enable row level security;
create policy "members of own exhbts" on exhbt_members for select
  using (exists (select 1 from exhbts e where e.id = exhbt_id and e.user_id = auth.uid()));
create policy "own memberships" on exhbt_members for select using (user_id = auth.uid());

-- Invites by email. The link carries a signed token; only its SHA-256 is stored, so a leaked
-- table can't be turned into working links. Resending replaces the hash and the expiry.
create table exhbt_invites (
  id uuid primary key,
  exhbt_id uuid not null references exhbts(id) on delete cascade,
  email text not null check (char_length(email) <= 320),
  role text not null default '' check (char_length(role) <= 40),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz
);
create index exhbt_invites_exhbt_idx on exhbt_invites(exhbt_id);
create index exhbt_invites_email_idx on exhbt_invites(lower(email));
-- One open invite per address per exhbt; inviting the same address again resends it.
create unique index exhbt_invites_open_idx on exhbt_invites(exhbt_id, lower(email))
  where accepted_at is null and cancelled_at is null;
alter table exhbt_invites enable row level security;
create policy "invites on own exhbts" on exhbt_invites for select
  using (exists (select 1 from exhbts e where e.id = exhbt_id and e.user_id = auth.uid()));

-- Each time an upload's fingerprint matches a file on another account's exhbt. Never shown
-- publicly; kept for an admin to review. outcome: shown (prompt shown, no answer yet), asked
-- (the uploader asked to join), approved / declined (the owner's answer), mine (the uploader
-- said "No, it's mine"), repeat (the same uploader matched the same exhbt again after an answer).
create table duplicate_matches (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploader_id uuid not null references profiles(id) on delete cascade,
  uploader_file_id uuid references exhbt_files(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete cascade,
  owner_file_id uuid references exhbt_files(id) on delete set null,
  owner_exhbt_id uuid references exhbts(id) on delete set null,
  outcome text not null default 'shown'
    check (outcome in ('shown', 'asked', 'approved', 'declined', 'mine', 'repeat')),
  -- What the uploader said they did on the project, when they asked to join.
  role text check (char_length(role) <= 40),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  decided_at timestamptz
);
create index duplicate_matches_owner_idx on duplicate_matches(owner_id, outcome);
create index duplicate_matches_pair_idx on duplicate_matches(uploader_id, owner_exhbt_id, created_at desc);
alter table duplicate_matches enable row level security; -- service role only
