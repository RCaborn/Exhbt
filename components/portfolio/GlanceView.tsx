import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { PortfolioHeader, type HeaderOwner } from "@/components/exhbt/PortfolioHeader";
import { ExtraTile } from "@/components/portfolio/ExtraTiles";
import { TeamLine } from "@/components/portfolio/TeamByline";
import { safeHref } from "@/lib/exhbt/blocks";
import { tileFromDoc } from "@/lib/exhbt/headline";
import type { PortfolioItem } from "@/lib/portfolio";
import { isTileKind, wideIndexes, type PortfolioLayout } from "@/lib/portfolio-layout";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { PortfolioProfile } from "@/lib/store";

/**
 * The at-a-glance page of a real portfolio, built from the same brand pieces as /demo: the ink
 * band (as a framed panel, since the page container belongs to the subdomain work), then a tile
 * per exhbt with its catalogue number, seal, result and method strip, and any extra tiles the
 * person added (decision 0014).
 *
 * The customiser (app/(app)/portfolio/customise) draws its preview from the same pieces: the
 * header props (`headerOwner`), the grid (`GLANCE_GRID`, `wideIndexes`) and the tile components.
 * Grid: two columns from md. The featured exhbt is always a wide tile at the top. With an odd
 * count and none featured the first tile spans both, so no tile sits alone beside a gap.
 */

/** The grid the tiles sit in. */
export const GLANCE_GRID = "mt-6 grid gap-4 sm:mt-8 md:grid-cols-2 md:gap-5";
/** A tile that spans both columns. */
export const WIDE = "md:col-span-2";

/** The header's owner block: LinkedIn only when the person has it switched on. */
export function headerOwner(
  profile: Pick<PortfolioProfile, "username" | "headline" | "bio" | "linkedin"> & { username: string },
  displayName: string,
  photoUrl: string | null,
  layout: Pick<PortfolioLayout, "header">,
): HeaderOwner {
  return {
    username: profile.username,
    name: displayName,
    headline: profile.headline,
    bio: profile.bio,
    linkedin: layout.header.linkedin ? safeHref(profile.linkedin ?? undefined) : null,
    photoUrl,
  };
}

export function GlanceView({
  profile,
  displayName,
  photoUrl,
  items,
  order,
  featuredId,
  layout,
  base,
  theme,
}: {
  profile: PortfolioProfile & { username: string };
  displayName: string;
  photoUrl: string | null;
  /** The projects shown, in page order. */
  items: PortfolioItem[];
  /** The page top to bottom: a project's id, or an extra tile's name. */
  order: string[];
  featuredId: string | null;
  layout: PortfolioLayout;
  base: string;
  theme?: PortfolioTheme;
}) {
  const tiles = items.map((it) => ({ it, tile: tileFromDoc(it.doc) }));
  const byId = new Map(tiles.map((t) => [t.it.id, t]));
  const wide = wideIndexes(order.length, Boolean(featuredId));
  let projects = 0;
  return (
    <>
      <PortfolioHeader
        framed
        theme={theme}
        owner={headerOwner(profile, displayName, photoUrl, layout)}
        exhbts={tiles.map((t) => t.tile)}
        showSkills={layout.header.skills}
      />

      <h2 className="sr-only">Projects</h2>
      <ul className={GLANCE_GRID}>
        {order.map((key, i) => {
          const isWide = wide.has(i);
          if (isTileKind(key)) {
            return (
              <li key={key} className={isWide ? WIDE : undefined}>
                <ExtraTile kind={key} tiles={layout.tiles} />
              </li>
            );
          }
          const t = byId.get(key);
          if (!t) return null;
          projects += 1;
          return (
            <li key={key} className={isWide ? WIDE : undefined}>
              <ExhbtTile
                exhbt={t.tile}
                href={`${base}/${t.it.slug}`}
                position={projects}
                maxSkills={isWide ? 6 : 4}
                team={<TeamLine team={t.it.team} />}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
