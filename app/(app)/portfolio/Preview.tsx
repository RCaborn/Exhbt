"use client";

import { useEffect, useRef, useState } from "react";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { ExtraTile } from "@/components/portfolio/ExtraTiles";
import { EmptyProjects, GLANCE_GRID, WIDE } from "@/components/portfolio/GlanceView";
import { PortfolioMasthead, type PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { checkTiles } from "@/lib/portfolio-customise";
import { isTileKind, shownKeys, tileHasContent, wideIndexes, type TileKind, type Tiles } from "@/lib/portfolio-layout";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import type { BuilderProject, BuilderState } from "./steps";

/** The width the page is drawn at before it is scaled into the preview column on a wide screen. */
const PAGE_WIDTH = 1040;

/**
 * The live preview: the whole portfolio page as visitors will see it, drawn from the same pieces as
 * /p/<username> (`PortfolioMasthead`, the glance grid, `ExhbtTile`, `ExtraTile`). On a wide screen
 * the page is drawn at desktop width and scaled down to fit the column, so it shows the real
 * two-column layout; on a phone it is drawn at the phone's width, as a visitor on a phone sees it.
 * It is a picture of the page: nothing in it takes focus or opens a link.
 */
export function Preview({
  state,
  person,
  theme,
  projects,
}: {
  state: BuilderState;
  person: PortfolioPerson;
  theme: PortfolioTheme;
  projects: BuilderProject[];
}) {
  const a = state.arrangement;
  const byId = new Map(projects.map((p) => [p.id, p]));
  const shown = shownKeys(a.order, new Set(a.hidden), a.featured).filter((k) => (isTileKind(k) ? tileHasContent(k, a.tiles) : byId.has(k)));
  const featured = a.featured && shown[0] === a.featured ? a.featured : null;
  const wide = wideIndexes(shown.length, Boolean(featured));
  let n = 0;

  return (
    <Scaled>
      <div inert data-testid="preview" className="bg-mist p-4 sm:p-8">
        <PortfolioMasthead person={person} theme={theme} />
        {shown.length === 0 ? (
          <EmptyProjects />
        ) : (
          <ul className={GLANCE_GRID}>
            {shown.map((key, i) => {
              const isWide = wide.has(i);
              if (isTileKind(key)) {
                return (
                  <li key={key} data-key={key} className={isWide ? WIDE : undefined}>
                    <ExtraTile kind={key} tiles={tidy(a.tiles, key)} />
                  </li>
                );
              }
              n += 1;
              return (
                <li key={key} data-key={key} className={isWide ? WIDE : undefined}>
                  <ExhbtTile exhbt={byId.get(key)!.tile} href="#" position={n} maxSkills={isWide ? 6 : 4} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Scaled>
  );
}

/** The tile as the page will show it: each kind's words tidied by the same rules as saving, or as typed if they don't pass yet. */
function tidy(tiles: Tiles, kind: TileKind): Tiles {
  const { clean } = checkTiles(tiles, [kind]);
  return clean[kind] ? clean : tiles;
}

/** Draws its child at PAGE_WIDTH and scales it to the column from 1024px of window width up. */
function Scaled({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      if (!wide.matches) return setFit(null);
      const scale = Math.min(1, o.clientWidth / PAGE_WIDTH);
      setFit({ scale, height: i.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    wide.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, []);

  return (
    <div ref={outer} className="overflow-hidden" style={fit ? { height: fit.height } : undefined}>
      <div
        ref={inner}
        style={fit ? { width: PAGE_WIDTH, transform: `scale(${fit.scale})`, transformOrigin: "top left" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
