"use client";

import { useSyncExternalStore } from "react";
import { useNarrow } from "@/components/exhbt-editor/topbar/Popover";
import { usePortfolioData, usePortfolioState } from "../runtime";
import { useLive } from "../ui/SaveStatus";

export { useNarrow };

const COARSE = "(pointer: coarse)";
const subscribeCoarse = (fn: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** A finger is the pointer: every control of the bar is then 44px (Astryx's md), not 36px. */
export function useCoarse(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

/** The size the bar's controls take: Astryx's sm under a mouse, md (44px) under a finger. */
export function useBarSize(): "sm" | "md" {
  return useCoarse() ? "md" : "sm";
}

/**
 * Where the page stands for visitors (decision 0031, "A returning person"), as the chip says it:
 * "live" (visitors can see it), "offline" (a public plan with no address yet, or nothing listed on it),
 * "preview" (the plan has no public page).
 */
export type Standing = "live" | "offline" | "preview";

export function useStanding(): Standing {
  const data = usePortfolioData();
  const live = useLive();
  if (!data.visitor.publicPlan) return "preview";
  return live ? "live" : "offline";
}

/** How many of the person's published exhbts are listed on the page now (not hidden). */
export function useListedLive(): number {
  const data = usePortfolioData();
  const hidden = usePortfolioState((s) => s.arrangement.hidden);
  return data.visitor.published.filter((p) => !hidden.includes(p.id)).length;
}
