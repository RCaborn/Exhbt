import type { ExhbtDoc } from "@/lib/exhbt/blocks";

/** Whether the "+" offers "Take a figure from my report" (decision 0026). J's: G's stub says no. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canTakeFigure(doc: ExhbtDoc, reportFiles: { fileId: string }[]): boolean {
  return false;
}
