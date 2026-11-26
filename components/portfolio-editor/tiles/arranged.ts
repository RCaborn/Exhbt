"use client";

import { useMemo } from "react";
import { lookOf } from "../home-props";
import { usePortfolioData, usePortfolioState, usePortfolioUi } from "../runtime";
import { arrangedOf, type Arranged } from "./order";

/*
 * Which exhbts the page draws where, as PortfolioHome works it out (`featuredOf`, `workProjects`), read
 * from the slices that decide it and nothing else, so typing never draws a tile again. The ids are what
 * the boards sort, so they must be exactly what `Work` draws.
 */

export type { Arranged };

export function useArranged(): Arranged {
  const order = usePortfolioState((s) => s.arrangement.order);
  const hidden = usePortfolioState((s) => s.arrangement.hidden);
  const featured = usePortfolioState((s) => s.arrangement.featured);
  // Whether the band is on the page, not the sections' order: a section moved draws no tile again.
  const hasBand = usePortfolioState((s) => s.arrangement.sections.includes("featured"));
  const { projects, plan } = usePortfolioData().builder;
  return useMemo(() => arrangedOf({ order, hidden, featured, sections: hasBand ? ["featured"] : [] }, projects, plan.isPublic), [order, hidden, featured, hasBand, projects, plan.isPublic]);
}

/** How the look draws the work: "cards", or rows ("list", "index"). */
export function useWorkTreatment(): "cards" | "list" | "index" {
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const previewing = usePortfolioUi((u) => u.previewing);
  return lookOf(themeId, previewing).treatment.work;
}
