import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { fromWorkOf } from "@/lib/exhbt/formats";

/**
 * Whether the "+" offers "Take a figure from my report" (decisions 0025 and 0026): the layout takes
 * something from the work (not an essay), there is a stored report to take it from, and no image on
 * the exhbt was picked from the work already. It does not look at room: F's "+" lists it whenever
 * this is true, dimmed with the image's own reason when the images are full, so the person learns it
 * is there.
 */
export function canTakeFigure(doc: ExhbtDoc, reportFiles: { fileId: string }[]): boolean {
  if (fromWorkOf(doc) === "none" || reportFiles.length === 0) return false;
  return !doc.sections.some((s) => s.kind === "image" && s.picked);
}
