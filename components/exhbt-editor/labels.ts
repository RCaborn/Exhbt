import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import { sectionLabel } from "@/lib/exhbt/sections";

/** "Graph 1", "Findings", "Flowchart": a page item's name in the layout's words (sectionLabel), as the toolbar, the "+" and the words read out use it. */
export function labelOf(d: ExhbtDoc, id: string): string {
  const i = d.sections.findIndex((s) => s.id === id);
  return i >= 0 ? sectionLabel(d.sections, i, formatOf(d)) : id === "flow" ? "Flowchart" : "Section";
}

/** The name of the page item at page place `at`, or null past the end. */
export function labelAt(d: ExhbtDoc, at: number): string | null {
  const it = pageItems(d)[at];
  return it ? labelOf(d, it.id) : null;
}
