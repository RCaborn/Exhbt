"use client";

import { forwardRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { useDragging } from "./drag";
import type { Spot } from "./place";

/*
 * A part's corner toolbar (decision 0026, "On each section"): Astryx's Toolbar, one Tab stop with the
 * arrow keys along it, on the app's surface with its border and shadow, drawn over the page and out of
 * its flow. 36px buttons with a mouse; 44px on any touch screen, where it always shows. With a mouse it
 * shows while the pointer is over its part or the focus is in it (css/arrange.css). While a drag is
 * under way the arrow keys are the drag's, so they do not walk the toolbar.
 */

const COARSE = "(pointer: coarse)";
const subscribe = (fn: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** A touch screen: its toolbars always show, at 44px. */
export function useCoarse(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export const ToolRow = forwardRef<HTMLDivElement, { label: string; spot: Spot | null; kind: "section" | "tile" | "line"; children: ReactNode }>(function ToolRow({ label, spot, kind, children }, ref) {
  const coarse = useCoarse();
  const dragging = useDragging();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (dragging.current && ARROWS.has(e.key)) e.preventDefault();
  };
  return (
    <div
      ref={ref}
      className="pe-tools"
      data-pe-tools={kind}
      data-where={spot?.where}
      style={spot ? { left: `${spot.x}px`, top: `${spot.y}px` } : { right: 0, top: 0 }}
      // Not yet measured: drawn, so it can be measured, but not seen.
      data-placed={spot ? "true" : undefined}
    >
      <Toolbar label={label} size={coarse ? "md" : "sm"} gap={0.5} variant="section" onKeyDown={onKeyDown} startContent={children} />
    </div>
  );
});
