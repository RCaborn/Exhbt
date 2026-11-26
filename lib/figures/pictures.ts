/**
 * Pictures on the person's device as candidates for the key figure (decision 0025): the small copy
 * sent to the AI, and the cut-out at full size. Browser only: it draws on a canvas. The bytes were
 * checked first (lib/figures/office.ts: PNG or JPEG from the bytes, pixels capped), so nothing here
 * decodes a picture that is not one.
 */
import type { FigureBox } from "@/lib/exhbt/blocks";
import { FIGURE, clampBox } from "./rules";

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, quality));

const release = (canvas: HTMLCanvasElement) => {
  canvas.width = 0;
  canvas.height = 0;
};

/** A canvas of `w` by `h` holding the part of the picture in `box`, on white (a transparent PNG would turn black as a JPEG). */
async function paint(bytes: Uint8Array, type: string, box: FigureBox, w: number, h: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, box.x * bitmap.width, box.y * bitmap.height, box.w * bitmap.width, box.h * bitmap.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

const WHOLE: FigureBox = { x: 0, y: 0, w: 1, h: 1 };

/** The small JPEG sent to the AI: the long edge FIGURE.thumbEdge at most, never enlarged. Its size is the size the AI is told. */
export async function pictureThumb(bytes: Uint8Array, type: string, width: number, height: number): Promise<{ jpeg: Blob; width: number; height: number }> {
  const scale = Math.min(1, FIGURE.thumbEdge / Math.max(width, height));
  const canvas = await paint(bytes, type, WHOLE, width * scale, height * scale);
  const out = { jpeg: await toBlob(canvas, "image/jpeg", FIGURE.thumbQuality), width: canvas.width, height: canvas.height };
  release(canvas);
  return out;
}

/** The part of the picture in `box` (fractions of it), at full size up to FIGURE.outEdge on the long edge: a PNG, or a JPEG when the PNG is over 3 MB. */
export async function pictureCut(bytes: Uint8Array, type: string, width: number, height: number, box: FigureBox | null): Promise<Blob> {
  const b = clampBox(box);
  const w = b.w * width;
  const h = b.h * height;
  const scale = Math.min(1, FIGURE.outEdge / Math.max(w, h));
  const canvas = await paint(bytes, type, b, w * scale, h * scale);
  try {
    const png = await toBlob(canvas, "image/png");
    return png.size <= 3 * 1024 * 1024 ? png : await toBlob(canvas, "image/jpeg", 0.9);
  } finally {
    release(canvas);
  }
}
