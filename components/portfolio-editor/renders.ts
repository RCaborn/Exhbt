"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    /**
     * Development only. How many times each unit of the portfolio's editing page has rendered: "page", "hero",
     * "section:<key>" and "tile:<id>". For the smoothness checks (e2e/portfolio-smooth.spec.ts).
     */
    __portfolioRenders?: Record<string, number>;
  }
}

/**
 * Counts a unit's renders on window.__portfolioRenders[unit], in development only (the exhbt editor's
 * counter, components/exhbt-editor/store.ts, with the portfolio's units). Counted after each commit, so
 * React's second render of a component in development is not counted twice; and once per render, since
 * in development React runs a part's effects again, with no render, when it mounts or moves the part.
 */
export function useRenderCount(unit: string): void {
  const render = {};
  const counted = useRef<object | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (counted.current === render) return;
    counted.current = render;
    const counts = (window.__portfolioRenders ??= {});
    counts[unit] = (counts[unit] ?? 0) + 1;
  });
}
