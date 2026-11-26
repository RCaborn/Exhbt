"use client";

import { useMemo } from "react";
import { lookOf, shownProjects } from "../home-props";
import { usePortfolioData, usePortfolioState, usePortfolioUi } from "../runtime";
import { fullOrder } from "../sections/arrange";

/*
 * Which exhbts the page draws where, as PortfolioHome works it out (`featuredOf`, `workProjects`), read
 * from the slices that decide it and nothing else, so typing never draws a tile again. The ids are what
 * the boards sort, so they must be exactly what `Work` draws.
 */

export type Arranged = {
  /** Every exhbt the page arranges, in the order drawn, hidden ones left out. */
  shown: string[];
  /** The band's exhbt, when the band is on the page and there is one. */
  band: string | null;
  /** The ones More of my work lists, in order (without the band's). */
  work: string[];
  /** Every arranged exhbt the page knows, hidden ones too, in the order drawn. */
  known: string[];
  /** The hidden ones the page knows, in their order. */
  hidden: string[];
  title(id: string): string;
  /** Whether it is live: on Free none is, as Free cannot publish. */
  live(id: string): boolean;
};

export function useArranged(): Arranged {
  const order = usePortfolioState((s) => s.arrangement.order);
  const hidden = usePortfolioState((s) => s.arrangement.hidden);
  const featured = usePortfolioState((s) => s.arrangement.featured);
  const hasBand = usePortfolioState((s) => s.arrangement.sections.includes("featured"));
  const { projects, plan } = usePortfolioData().builder;
  return useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    const shown = shownProjects(order, hidden, projects).map((p) => p.id);
    const first = shown.find((id) => id === featured) ?? shown[0] ?? null;
    const band = hasBand ? first : null;
    const known = fullOrder(order, projects.map((p) => p.id));
    return {
      shown,
      band,
      work: band ? shown.filter((id) => id !== band) : shown,
      known,
      hidden: known.filter((id) => hidden.includes(id)),
      title: (id) => byId.get(id)?.title.trim() || "Untitled exhbt",
      live: (id) => plan.isPublic && Boolean(byId.get(id)?.live),
    };
  }, [order, hidden, featured, hasBand, projects, plan.isPublic]);
}

/** How the look draws the work: "cards", or rows ("list", "index"). */
export function useWorkTreatment(): "cards" | "list" | "index" {
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const previewing = usePortfolioUi((u) => u.previewing);
  return lookOf(themeId, previewing).treatment.work;
}
