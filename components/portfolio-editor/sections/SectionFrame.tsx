"use client";

import type { ReactNode } from "react";
import type { HomeSectionSlot } from "@/components/portfolio/home-ctx";
import type { SectionKey } from "@/lib/portfolio-layout";

/*
 * STUB (brief E, milestone 1). Brief F takes this file over: the section's outline and its corner
 * toolbar (grip, Move up, Move down, Remove), drawn over the section and out of its flow, in the look's
 * own variables; on a phone, the grip and `ItemMore` (I's). Until then it draws the section as the page
 * gave it and nothing else.
 *
 * The adapter draws one of these round each section (adapter.tsx). It is inside a boundary that is not
 * drawn again while its section's own words and its place are the same, so a frame that must follow
 * something else (the arrangement, a drag) reads it itself with `usePortfolioState`.
 */

/**
 * A section's place, as `HomeSectionSlot` gives it, with the section's key as `sectionKey`: `key` is
 * React's own word and never reaches a component, so a frame could not read it.
 */
export type SectionFrameProps = Omit<HomeSectionSlot, "key"> & { sectionKey: SectionKey; children: ReactNode };

export function SectionFrame({ children }: SectionFrameProps): ReactNode {
  return children;
}
