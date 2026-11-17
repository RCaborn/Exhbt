import { LIMITS, type FigureBox } from "@/lib/exhbt/blocks";

/**
 * The fixed numbers and pure helpers for picking a figure from an upload (decision 0017), shared
 * by the browser (lib/figures/pdf.ts, the draft page, the editor) and the server
 * (/api/exhbts/figure, /api/exhbts/[id]/figure). No browser or server APIs here.
 */
export const FIGURE = {
  /** Pages of a PDF drawn as thumbnails: enough for a report's results, and a cap on the AI's cost. */
  maxPages: 30,
  /** Thumbnails sent to the AI: the long edge in pixels, and JPEG quality. About 550 tokens a page. */
  thumbEdge: 768,
  thumbQuality: 0.72,
  /** The most page images one pick may send, and the largest one the server takes. */
  maxImages: 30,
  maxImageBytes: 1_500_000,
  /** All the page images of one pick together: 30 thumbnails of a busy report fit in well under this. */
  maxTotalBytes: 6_000_000,
  /**
   * A page is worth sending when it draws something besides text: at least this many shapes, or
   * any picture. A page of plain text has none and is never sent (and can't be a figure).
   */
  minShapes: 4,
  /** The figure as uploaded: the crop's long edge in pixels. Sharp on a retina screen, small enough to load fast. */
  outEdge: 1600,
  /** Room left round the figure when it's cut out, as a fraction of the page. */
  margin: 0.02,
  /** The smallest crop, as a fraction of the page's side, so a slip of the mouse can't make a sliver. */
  minSide: 0.05,
  /** Alt text kept, in characters. */
  altChars: 400,
} as const;

/** A page from a document: drawn small, with how much it draws besides text. */
export type PageMarks = { shapes: number; pictures: number };

/** Whether a page draws enough besides text to hold a chart, diagram or table. */
export const mayHoldFigure = (m: PageMarks): boolean => m.pictures > 0 || m.shapes >= FIGURE.minShapes;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** A box kept on the page and at least FIGURE.minSide on each side; the whole page when it makes no sense. */
export function clampBox(b: Partial<FigureBox> | null | undefined): FigureBox {
  if (!b) return { x: 0, y: 0, w: 1, h: 1 };
  const x = clamp01(b.x ?? 0);
  const y = clamp01(b.y ?? 0);
  let w = clamp01(b.w ?? 1);
  let h = clamp01(b.h ?? 1);
  w = Math.min(w, 1 - x);
  h = Math.min(h, 1 - y);
  if (w < FIGURE.minSide || h < FIGURE.minSide) return { x: 0, y: 0, w: 1, h: 1 };
  return { x, y, w, h };
}

/** The box with a small margin round it, still on the page. */
export function withMargin(b: FigureBox, m: number = FIGURE.margin): FigureBox {
  const x = Math.max(0, b.x - m);
  const y = Math.max(0, b.y - m);
  return { x, y, w: Math.min(1, b.x + b.w + m) - x, h: Math.min(1, b.y + b.h + m) - y };
}

/** A caption cut to the word limit for image captions, so a picked figure never blocks publishing on length. */
export function fitCaption(s: string, max: number = LIMITS.images.captionWords): string {
  const w = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return w.slice(0, max).join(" ");
}

/** Alt text tidied and capped. */
export const fitAlt = (s: string): string => s.replace(/\s+/g, " ").trim().slice(0, FIGURE.altChars);

/** "page 3" or "picture 2": where in the file a picked figure came from, for the editor's note. */
export function whereFrom(p: { page?: number; media?: string }, index?: number): string {
  if (p.page) return `page ${p.page}`;
  return index ? `picture ${index}` : "a picture in it";
}
