"use client";

import type { ReactNode } from "react";
import type { HomeLinesSlot } from "@/components/portfolio/home-ctx";

/*
 * STUB (brief E, milestone 1). Brief F takes this file over: "Add a line", and each line's Move up,
 * Move down and Remove, drawn over the list and taking no room. Until then it draws nothing.
 *
 * The page puts it last in the lines' <dl>, which is `relative` while editing and rules off every child
 * after the first (`.pf-rows > * + *`): make it absolute and drop that border
 * (docs/briefs/portfolio-first/d-findings.md). It carries `data-path` (the list's own path), which is
 * where the list's own problem is shown and where "Show me" lands.
 */
export function LineTools(props: HomeLinesSlot): ReactNode {
  void props;
  return null;
}
