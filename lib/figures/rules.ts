import type { FigureBox } from "@/lib/exhbt/blocks";
import { DRAFT_TARGETS } from "@/lib/ai/draft-targets";
import { cutCaption } from "./caption";

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

/** Where the AI says a figure is: its edges in pixels of the image it was sent, counted from the image's top-left corner. */
export type PixelBox = { left: number; top: number; right: number; bottom: number };
export type PixelSize = { width: number; height: number };

/**
 * A thin figure's side, as fractions of the page's side: below `least` it is a slip, not a figure;
 * from there up to FIGURE.minSide it is widened to `widened`, a little over FIGURE.minSide.
 */
const THIN = { least: 0.01, widened: 0.06 } as const;

/**
 * The AI's box as fractions of the page, kept on the page (decision 0025). The one place pixels
 * become fractions, so the way the AI is asked for a box can change here and nowhere else. Edges
 * given the wrong way round are put right. An answer in fractions after all (every edge between 0
 * and 1) is read as fractions. A thin figure (a one-row diagram, a short table) is real, so a side
 * between 1% of the page and FIGURE.minSide is widened to FIGURE.minSide about its middle, where
 * clampBox would give up and take the whole page. Anything that makes no sense is the whole page.
 */
export function boxFromPixels(b: PixelBox | null | undefined, size: PixelSize): FigureBox {
  if (!b || !(size.width > 0) || !(size.height > 0)) return clampBox(null);
  const edges = [b.left, b.top, b.right, b.bottom];
  if (!edges.every((n) => Number.isFinite(n))) return clampBox(null);
  const fractions = edges.every((n) => n >= 0 && n <= 1);
  const sx = fractions ? 1 : size.width;
  const sy = fractions ? 1 : size.height;
  /** One side: its two edges on the page, widened to the least side when it is thin but not a sliver. */
  const side = (a: number, z: number): [number, number] => {
    const from = clamp01(Math.min(a, z));
    const to = clamp01(Math.max(a, z));
    if (to - from >= FIGURE.minSide || to - from < THIN.least) return [from, to];
    const start = Math.min(Math.max(0, (from + to) / 2 - THIN.widened / 2), 1 - THIN.widened);
    return [start, start + THIN.widened];
  };
  const [x1, x2] = side(b.left / sx, b.right / sx);
  const [y1, y2] = side(b.top / sy, b.bottom / sy);
  return clampBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
}

/** A box in fractions as pixels of an image: the other way round, for the stand-in and the tests. */
export const pixelsFromBox = (b: FigureBox, size: PixelSize): PixelBox => ({
  left: Math.round(b.x * size.width),
  top: Math.round(b.y * size.height),
  right: Math.round((b.x + b.w) * size.width),
  bottom: Math.round((b.y + b.h) * size.height),
});

/** A caption the AI wrote for a picked figure, cut to its target for an image's caption (draftTargets, decision 0030): a case study's unless a layout's is given. */
export function fitCaption(s: string, max: number = DRAFT_TARGETS.captionWords): string {
  return cutCaption(s, max);
}

/** Alt text tidied and capped. */
export const fitAlt = (s: string): string => s.replace(/\s+/g, " ").trim().slice(0, FIGURE.altChars);

/** "page 3" or "picture 2": where in the file a picked figure came from, for the editor's note. */
export function whereFrom(p: { page?: number; media?: string }, index?: number): string {
  if (p.page) return `page ${p.page}`;
  return index ? `picture ${index}` : "a picture in it";
}
