/**
 * Draws a PDF's pages in the browser, for picking a figure from an upload (decision 0017). It
 * uses unpdf, the reader lib/doc-readers.ts already loads for a PDF's text, so no new library;
 * it loads only when a PDF is added. Browser only: it draws on a canvas.
 *
 *   pdfPages   the first pages as small JPEGs, with how much each draws besides text
 *   pdfFigure  one page, or a box on it, at high resolution, as a picture to upload
 */
import type { FigureBox } from "@/lib/exhbt/blocks";
import { FIGURE, clampBox, withMargin, type PageMarks } from "./rules";

type Unpdf = typeof import("unpdf");
type Pdf = Awaited<ReturnType<Unpdf["getDocumentProxy"]>>;
type Page = Awaited<ReturnType<Pdf["getPage"]>>;
type Viewport = ReturnType<Page["getViewport"]>;

export type PageThumb = {
  /** From 1. */
  page: number;
  width: number;
  height: number;
  jpeg: Blob;
  /** An object URL for the JPEG, to show it. */
  url: string;
  marks: PageMarks;
};
export type PdfPages = { pageCount: number; pages: PageThumb[] };

/** Drawing operations that paint a shape, and ones that paint a picture (pdf.js names; a build may lack some). */
const SHAPE_OPS = ["constructPath", "fill", "eoFill", "stroke", "fillStroke", "eoFillStroke", "closeStroke", "closeFillStroke", "closeEOFillStroke", "shadingFill"];
const PICTURE_OPS = [
  "paintImageXObject",
  "paintInlineImageXObject",
  "paintImageMaskXObject",
  "paintImageXObjectRepeat",
  "paintImageMaskXObjectRepeat",
  "paintImageMaskXObjectGroup",
  "paintInlineImageXObjectGroup",
  "paintJpegXObject",
];

type Codes = { shapes: Set<number>; pictures: Set<number>; path?: number; endPath?: number };

async function open(bytes: Uint8Array): Promise<{ pdf: Pdf; codes: Codes }> {
  const { getDocumentProxy, getResolvedPDFJS } = await import("unpdf");
  // A copy: pdf.js may detach the buffer it's given, and the caller keeps the bytes.
  const pdf = await getDocumentProxy(bytes.slice());
  const ops = (await getResolvedPDFJS()).OPS as Record<string, number>;
  const set = (names: string[]) => new Set(names.map((n) => ops[n]).filter((v): v is number => typeof v === "number"));
  return { pdf, codes: { shapes: set(SHAPE_OPS), pictures: set(PICTURE_OPS), path: ops.constructPath, endPath: ops.endPath } };
}

/**
 * How many shapes and pictures a page paints. A path that paints nothing isn't a shape: Word,
 * browsers and LaTeX put clipping paths round ordinary text, and a page of plain text must still
 * count as plain text (decision 0025). This build of pdf.js gives each path with how it ends as
 * its first argument, so one that ends without a fill or a stroke ("endPath") is left out. A
 * build that lists the fill or stroke apart is counted by those, as before.
 */
async function marksOf(page: Page, codes: Codes): Promise<PageMarks> {
  const { fnArray, argsArray } = await page.getOperatorList();
  let shapes = 0;
  let pictures = 0;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]!;
    if (fn === codes.path && (argsArray[i] as unknown[] | null | undefined)?.[0] === codes.endPath && codes.endPath !== undefined) continue;
    if (codes.shapes.has(fn)) shapes++;
    else if (codes.pictures.has(fn)) pictures++;
  }
  return { shapes, pictures };
}

/** Paints a page (or the part the viewport's offset picks out) on a white canvas of the given size. */
async function draw(page: Page, viewport: Viewport, width: number, height: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<Page["render"]>[0]).promise;
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, quality));

/** Lets the canvas's memory go at once; browsers keep it until collection otherwise. */
const release = (canvas: HTMLCanvasElement) => {
  canvas.width = 0;
  canvas.height = 0;
};

/**
 * The first `maxPages` pages as JPEGs with a long edge of `edge` pixels, each with how many
 * shapes and pictures it draws. Throws if the PDF can't be opened (the caller carries on without).
 */
export async function pdfPages(bytes: Uint8Array, opts: { maxPages?: number; edge?: number } = {}): Promise<PdfPages> {
  const edge = opts.edge ?? FIGURE.thumbEdge;
  const { pdf, codes } = await open(bytes);
  try {
    const n = Math.min(pdf.numPages, opts.maxPages ?? FIGURE.maxPages);
    const pages: PageThumb[] = [];
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const marks = await marksOf(page, codes);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: edge / Math.max(base.width, base.height) });
      const canvas = await draw(page, viewport, viewport.width, viewport.height);
      const jpeg = await toBlob(canvas, "image/jpeg", FIGURE.thumbQuality);
      pages.push({ page: i, width: canvas.width, height: canvas.height, jpeg, url: URL.createObjectURL(jpeg), marks });
      release(canvas);
      page.cleanup();
    }
    return { pageCount: pdf.numPages, pages };
  } finally {
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}

/** Frees the object URLs of a set of thumbnails. */
export const releasePages = (p: PdfPages | null | undefined) => p?.pages.forEach((t) => URL.revokeObjectURL(t.url));

/**
 * One page, or the box on it with a small margin, drawn so its long edge is `edge` pixels, as a
 * PNG (sharp lines and text). A busy page that makes a big PNG comes back as a JPEG instead.
 */
export async function pdfFigure(bytes: Uint8Array, pageNo: number, box?: FigureBox | null, opts: { edge?: number; margin?: boolean } = {}): Promise<Blob> {
  const edge = opts.edge ?? FIGURE.outEdge;
  const { pdf } = await open(bytes);
  try {
    const page = await pdf.getPage(Math.min(Math.max(1, pageNo), pdf.numPages));
    const b = box ? (opts.margin === false ? clampBox(box) : withMargin(clampBox(box))) : { x: 0, y: 0, w: 1, h: 1 };
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(edge / Math.max(b.w * base.width, b.h * base.height), 10);
    const viewport = page.getViewport({ scale, offsetX: -b.x * base.width * scale, offsetY: -b.y * base.height * scale });
    const canvas = await draw(page, viewport, b.w * base.width * scale, b.h * base.height * scale);
    try {
      const png = await toBlob(canvas, "image/png");
      return png.size <= 3 * 1024 * 1024 ? png : await toBlob(canvas, "image/jpeg", 0.9);
    } finally {
      release(canvas);
      page.cleanup();
    }
  } finally {
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}

/** True for a file the PDF renderer can take: by its first bytes, then its name or type. */
export function isPdf(bytes: Uint8Array, name: string, type: string): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-") || (/\.pdf$/i.test(name) && type === "application/pdf");
}
