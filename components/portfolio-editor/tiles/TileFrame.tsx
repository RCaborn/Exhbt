"use client";

import type { ReactNode } from "react";
import type { HomeTileSlot } from "@/components/portfolio/home-ctx";

/*
 * STUB (brief E, milestone 1). Brief F takes this file over: the exhbt as a button that opens it, and
 * the owner's controls over its corner (the star, Hide, a grip, More), in the look's own variables; on
 * a phone, `ItemMore` (I's). Until then it draws the band, card or row as the page gave it.
 *
 * The page puts it inside the card's <li>, and the card is `h-full`: a frame with a box of its own must
 * pass the height through (docs/briefs/portfolio-first/d-findings.md).
 */
export function TileFrame({ children }: HomeTileSlot & { children: ReactNode }): ReactNode {
  return children;
}
