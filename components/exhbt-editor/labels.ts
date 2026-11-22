import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import { sectionLabel } from "@/lib/exhbt/sections";

/** "Graph 1", "Findings", "Flowchart": a page item's name in the layout's words (sectionLabel), as the toolbar, the "+" and the words read out use it. */
export function labelOf(d: ExhbtDoc, id: string): string {
  const i = d.sections.findIndex((s) => s.id === id);
  return i >= 0 ? sectionLabel(d.sections, i, formatOf(d)) : id === "flow" ? "Flowchart" : "Section";
}

/** Each page item's name, in page order: worked out once for each version of the doc, which every "+" on the page reads its name from. */
const names = new WeakMap<ExhbtDoc, string[]>();
const namesOf = (d: ExhbtDoc): string[] => {
  let list = names.get(d);
  if (!list) names.set(d, (list = pageItems(d).map((it) => labelOf(d, it.id))));
  return list;
};

/** The name of the page item at page place `at`, or null past the end. */
export function labelAt(d: ExhbtDoc, at: number): string | null {
  return namesOf(d)[at] ?? null;
}
