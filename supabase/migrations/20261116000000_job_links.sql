-- Per-job links (docs/phase-2.md section 8, decision 0008).
--
-- A link's address is collection_slug, unique per person (curated_links_user_slug_idx, 20261106120000).
-- public_slug was unique across everyone, so two people could never both have /lloyds; the app no
-- longer writes it, and it is no longer required.
alter table curated_links alter column public_slug drop not null;
alter table curated_links drop constraint if exists curated_links_public_slug_key;

-- Counts a view of a live link in one statement, so two visitors at once both count.
-- Only the service role calls it (lib/store.ts); it records nothing about the visitor.
create or replace function increment_job_link_views(link_id uuid) returns void
language sql security definer set search_path = public as $$
  update curated_links set view_count = view_count + 1 where id = link_id and status = 'live';
$$;
revoke execute on function increment_job_link_views(uuid) from public, anon, authenticated;
