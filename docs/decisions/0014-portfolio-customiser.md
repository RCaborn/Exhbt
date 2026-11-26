Status: accepted
Date: 13 Nov 2026
Amended by: 0031 (exhbts are arranged on the portfolio page itself, and the separate exhbts list goes when the switch is on)

# The portfolio customiser

Rory's ask: make dragging tiles on the portfolio clean, make it customisable but simple, and let people add a few tiles or take some away.

## What it is

One page, `/portfolio/customise`. It draws the person's own at-a-glance page at full size from the same pieces as `/p/<username>` (`PortfolioHeader`, `ExhbtTile`, the same grid and wide-tile rule), with a small bar of controls on each tile. People can:

- drag project and extra tiles into order (grip handle; mouse, touch and keyboard);
- hide an exhbt, or feature one (a wide tile, always first);
- pick the look from a strip (the plan's looks, as in decision 0012);
- switch the skills strip and the LinkedIn button on or off;
- add, edit and remove extra tiles.

Every change shows at once and saves itself a moment later. The last change can be undone. The server checks everything again (`saveCustomisationAction`).

## Extra tiles

About me, Education, Experience, a featured quote, and Links and contact. One of each, so a page can't fill with them. Limits are `TILE_LIMITS` in `lib/portfolio-layout.ts` (about 60 words, up to three lines of 14 words for Education and Experience, a quote of 30 words with a name and role). They are not part of any exhbt's word cap. Links must be https (GitHub must be on github.com, LinkedIn is the usual profile address). The email is shown as text, never a mailto, so it is harder to scrape. An empty tile is kept in the customiser but not shown to visitors.

**Which plans:** Premium and Max, and universities (`extraTiles` in `lib/entitlements.ts`). Free can arrange, hide and feature its exhbts in the customiser but has no public page to put tiles on, so the menu shows the upgrade prompt. After a downgrade the saved tiles are kept, hidden from the page, and come back with the plan, as looks do.

## Hidden exhbts

A hidden exhbt stays published. **Its own link keeps working**, but it leaves the at-a-glance page and anything that lists the portfolio, and its page asks search engines not to index it. It still counts toward the plan's limit and can still be picked for a job link. Hiding is not unpublishing: the person didn't take it down, they chose not to show it first. If every exhbt is hidden the glance address shows "not found" (each exhbt still opens). There is no sitemap or structured data on portfolio pages yet; when there is, it should list `listedOnPortfolio`, not `visibleOnPortfolio`.

## Where it is stored

Migration `20261120000000_portfolio_layout.sql`:

- `exhbts.hidden_on_portfolio` (boolean, default false);
- `profiles.featured_exhbt_id` (nullable, clears if that exhbt is deleted);
- `profiles.portfolio_layout` (jsonb): `{ v: 1, slots, tiles, header }`.

`slots` says where extra tiles sit among the projects ("p" is a project, a tile's name is that tile). The projects themselves keep their order in `exhbts.position`, so the up and down buttons on `/exhbts` and the customiser share one order, and there is one owner of it. `normaliseLayout` turns a missing or damaged value into today's page. The account export includes the layout and the flags (they are columns on rows already exported); deleting the account deletes them. Row-level security is unchanged.

## Dragging

`@dnd-kit/core` and `sortable`: mouse after a few pixels, touch after a short press on the grip (so the page still scrolls), keyboard with Space, arrows and Space. Announcements are plain English ("Picked up X. Position 1 of 4."). The lifted tile uses the existing shadow token. Tiles slide, they don't squash. All motion is off under `prefers-reduced-motion`. The featured tile is pinned and has no grip. Hidden exhbts wait in a list below the preview and return to the place they had.
