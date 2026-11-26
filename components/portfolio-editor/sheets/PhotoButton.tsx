"use client";

import type { ReactNode } from "react";

/*
 * STUB (brief E, milestone 1). Brief G takes this file over: a button over the photo or the initials
 * ("Add a photo", "Change your photo") that opens the photo sheet (`open("photo")`, with `Sheet` from
 * ../ui/Sheet.tsx). Until then it draws the face as the page gave it.
 *
 * `children` is the face as the page draws it. In Classic, Mono and Ledger the face is a grid item with
 * `order-*` classes: a box wrapped round it moves it at phone width, so the button is drawn over the
 * face, not round it (docs/briefs/portfolio-first/d-findings.md).
 */
export function PhotoButton({ children }: { children: ReactNode }): ReactNode {
  return children;
}
