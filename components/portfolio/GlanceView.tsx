import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { ExtraTile } from "@/components/portfolio/ExtraTiles";
import { PortfolioMasthead, type PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { TeamLine } from "@/components/portfolio/TeamByline";
import { safeHref } from "@/lib/exhbt/blocks";
import { tileFromDoc } from "@/lib/exhbt/headline";
import type { PortfolioItem } from "@/lib/portfolio";
import { isTileKind, wideIndexes, type PortfolioLayout } from "@/lib/portfolio-layout";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { PortfolioProfile } from "@/lib/store";

/**
 * The at-a-glance page of a real portfolio (decisions 0014 and 0016): the masthead (cover, photo,
 * name, where they are and what they're after, their intro and how to reach them), then a tile per
 * exhbt with its catalogue number, seal, result and method strip, and any extra tiles.
 *
 * The builder (app/(app)/portfolio) draws its live preview from the same pieces: `PortfolioMasthead`,
 * the grid (`GLANCE_GRID`, `wideIndexes`) and the tile components. Grid: two columns from md. The
 * featured exhbt is always a wide tile at the top. With an odd count and none featured the first
 * tile spans both, so no tile sits alone beside a gap.
 */

/** The grid the tiles sit in. */
export const GLANCE_GRID = "mt-6 grid gap-4 sm:mt-8 md:grid-cols-2 md:gap-5";
/** A tile that spans both columns. */
export const WIDE = "md:col-span-2";

/** The person as the masthead shows them. LinkedIn only while they have it switched on. */
export function personFrom(
  profile: Pick<PortfolioProfile, "username" | "headline" | "bio" | "linkedin" | "location" | "lookingFor" | "github" | "website" | "contactEmail">,
  displayName: string,
  media: { photoUrl: string | null; coverUrl: string | null },
  layout: Pick<PortfolioLayout, "header">,
): PortfolioPerson {
  return {
    username: profile.username,
    name: displayName,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    lookingFor: profile.lookingFor,
    photoUrl: media.photoUrl,
    coverUrl: media.coverUrl,
    links: {
      linkedin: layout.header.linkedin ? safeHref(profile.linkedin ?? undefined) : null,
      github: safeHref(profile.github ?? undefined),
      website: safeHref(profile.website ?? undefined),
      email: profile.contactEmail,
    },
  };
}

/** Every skill the exhbts prove, in page order, once each. */
export const skillsOf = (tiles: { skills: string[] }[]) => [...new Set(tiles.flatMap((t) => t.skills))];

export function GlanceView({
  person,
  items,
  order,
  featuredId,
  layout,
  base,
  theme,
  note,
  empty,
}: {
  person: PortfolioPerson;
  /** The projects shown, in page order. */
  items: PortfolioItem[];
  /** The page top to bottom: a project's id, or an extra tile's name. */
  order: string[];
  featuredId: string | null;
  layout: PortfolioLayout;
  base: string;
  theme?: PortfolioTheme;
  /** A line at the top, for the owner's preview of an unpublished page. */
  note?: React.ReactNode;
  /** What to show where the tiles go when there are none (the owner's preview). */
  empty?: React.ReactNode;
}) {
  const tiles = items.map((it) => ({ it, tile: tileFromDoc(it.doc) }));
  const byId = new Map(tiles.map((t) => [t.it.id, t]));
  const wide = wideIndexes(order.length, Boolean(featuredId));
  let projects = 0;
  return (
    <>
      <PortfolioMasthead
        person={person}
        theme={theme}
        skills={skillsOf(tiles.map((t) => t.tile))}
        projectCount={tiles.length}
        showSkills={layout.header.skills}
        note={note}
      />

      <h2 className="sr-only">Projects</h2>
      {order.length === 0 && empty ? (
        empty
      ) : (
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
      )}
    </>
  );
}

/** The space the first exhbt will take, on a page with none yet. */
export function EmptyProjects({ children }: { children?: React.ReactNode }) {
  return (
    <div data-empty-projects className="mt-6 grid min-h-48 place-items-center rounded-[16px] border border-dashed border-field bg-surface p-8 text-center sm:mt-8">
      <div className="max-w-[28rem]">
        <p className="font-semibold">Your exhbts go here</p>
        <p className="mt-1 text-graphite">Each one is a short, checked write-up of a project, with its result up front.</p>
        {children}
      </div>
    </div>
  );
}
