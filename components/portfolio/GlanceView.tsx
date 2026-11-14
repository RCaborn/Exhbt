import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { PortfolioHeader } from "@/components/exhbt/PortfolioHeader";
import { safeHref } from "@/lib/exhbt/blocks";
import { tileFromDoc } from "@/lib/exhbt/headline";
import type { PortfolioItem } from "@/lib/portfolio";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { PortfolioProfile } from "@/lib/store";

/**
 * The at-a-glance page of a real portfolio, built from the same brand pieces as /demo: the ink
 * band (as a framed panel, since the page container belongs to the subdomain work), then a tile
 * per exhbt with its catalogue number, seal, result and method strip.
 *
 * Grid: two columns from md. With an odd count the first tile spans both, so no tile sits
 * alone beside a gap; a single exhbt is one wide tile.
 */
export function GlanceView({
  profile,
  displayName,
  photoUrl,
  items,
  base,
  theme,
}: {
  profile: PortfolioProfile & { username: string };
  displayName: string;
  photoUrl: string | null;
  items: PortfolioItem[];
  base: string;
  theme?: PortfolioTheme;
}) {
  const tiles = items.map((it) => ({ it, tile: tileFromDoc(it.doc) }));
  const odd = tiles.length % 2 === 1;
  return (
    <>
      <PortfolioHeader
        framed
        theme={theme}
        owner={{
          username: profile.username,
          name: displayName,
          headline: profile.headline,
          bio: profile.bio,
          linkedin: safeHref(profile.linkedin ?? undefined),
          photoUrl,
        }}
        exhbts={tiles.map((t) => t.tile)}
      />

      <h2 className="sr-only">Projects</h2>
      <ul className="mt-6 grid gap-4 sm:mt-8 md:grid-cols-2 md:gap-5">
        {tiles.map(({ it, tile }, i) => (
          <li key={it.id} className={odd && i === 0 ? "md:col-span-2" : undefined}>
            <ExhbtTile exhbt={tile} href={`${base}/${it.slug}`} position={i + 1} maxSkills={odd && i === 0 ? 6 : 4} />
          </li>
        ))}
      </ul>
    </>
  );
}
