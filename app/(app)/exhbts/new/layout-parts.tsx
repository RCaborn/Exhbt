"use client";

import { MENU_LINES, SKETCHES } from "@/components/exhbt-editor/topbar/LayoutMenu";
import type { Format } from "@/lib/exhbt/formats";

/*
 * The editor's own picture and line for each layout (components/exhbt-editor/topbar/LayoutMenu.tsx),
 * so "Add an exhbt" shows a layout exactly as the editor's menu does and neither is written twice.
 * That file is client code, so a server page can't read its values: these two small client
 * components read them for it.
 */

/** A layout's sketch, as the editor's layout menu draws it. It takes its size and colour from `className`. */
export function LayoutSketch({ format, className }: { format: Format; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 56 40" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      {SKETCHES[format]}
    </svg>
  );
}

/** The one line on what a layout suits, as the editor's layout menu words it. */
export function LayoutLine({ format }: { format: Format }) {
  return MENU_LINES[format];
}
