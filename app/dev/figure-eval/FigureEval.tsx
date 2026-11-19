"use client";

import { useEffect, useState } from "react";
import { askForPick, candidatesOf, drawPages, type PickAnswer } from "@/app/(app)/exhbts/new/figure";
import type { FigureBox } from "@/lib/exhbt/blocks";

/**
 * The figure eval's hands in the browser (evals/figure-pick/README.md). It puts three functions on
 * `window.figureEval`, each working from a PDF's bytes in base64, and each calling the code the
 * draft page calls (app/(app)/exhbts/new/figure.ts, lib/figures/pdf.ts):
 *
 *   pages draws the pages and says which would be sent, without asking anything.
 *   pick  draws the pages, chooses the ones to send, asks /api/exhbts/figure-pick once, and cuts
 *         the answer out as the draft page would before uploading it. A request that failed, an
 *         answer of no figure, and a PDF with no page worth sending are told apart.
 *   draw  a page, or a box on it, as a PNG, with boxes outlined on it if asked: for looking at
 *         what was expected and what was cut.
 *
 * Nothing is uploaded, placed or saved.
 */

export type EvalPage = { page: number; width: number; height: number; shapes: number; pictures: number; bytes: number; sent: boolean };
export type EvalPick = {
  pageCount: number;
  pages: EvalPage[];
  /** The images sent, in order: the pick's "image 1" is the first. */
  sent: { image: number; label: string; page: number }[];
  /** "skipped": no page was worth sending, so nothing was asked (the draft page then says none was found). */
  status: "picked" | "none" | "failed" | "skipped";
  http: number | null;
  error?: string;
  /** The answer after the server's checks, with the page it names. */
  pick?: PickAnswer;
  page?: number;
  /** The box the draft page cuts: the pick's box with the app's margin, kept on the page. */
  cut?: FigureBox;
  /** The picture the draft page would upload, as a data URL. */
  crop?: string;
  /** Outside production the route also says which model answered, its token counts and its answer before the checks. */
  debug?: unknown;
  ms: number;
};
export type Outline = { box: FigureBox; token: "jade" | "error" };

declare global {
  interface Window {
    figureEval?: {
      pages: (pdfBase64: string, name: string) => Promise<{ pageCount: number; pages: EvalPage[] } | null>;
      pick: (pdfBase64: string, name: string) => Promise<EvalPick>;
      draw: (pdfBase64: string, name: string, page: number, box: FigureBox | null, outlines?: Outline[]) => Promise<string>;
    };
  }
}

const toFile = (b64: string, name: string) => new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], name, { type: "application/pdf" });
const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the picture"));
    reader.readAsDataURL(blob);
  });

/** The PDF's pages as the draft page draws them, and the ones it would send. Null when they can't be drawn. */
async function drawn(file: File, name: string) {
  const read = await drawPages(file);
  if (!read) return null;
  const candidates = candidatesOf([{ name, file, pages: read }]);
  const sentPages = new Set(candidates.map((c) => c.page));
  const pages: EvalPage[] = read.pages.map((p) => ({ page: p.page, width: p.width, height: p.height, shapes: p.marks.shapes, pictures: p.marks.pictures, bytes: p.jpeg.size, sent: sentPages.has(p.page) }));
  return { candidates, pageCount: read.pageCount, pages, sent: candidates.map((c, i) => ({ image: i + 1, label: c.label, page: c.page ?? 0 })) };
}

async function pages(pdfBase64: string, name: string): Promise<{ pageCount: number; pages: EvalPage[] } | null> {
  const d = await drawn(toFile(pdfBase64, name), name);
  return d ? { pageCount: d.pageCount, pages: d.pages } : null;
}

async function pick(pdfBase64: string, name: string): Promise<EvalPick> {
  const t0 = performance.now();
  const d = await drawn(toFile(pdfBase64, name), name);
  if (!d) return { pageCount: 0, pages: [], sent: [], status: "failed", http: null, error: "The PDF's pages couldn't be drawn.", ms: Math.round(performance.now() - t0) };
  const { candidates } = d;
  const base = { pageCount: d.pageCount, pages: d.pages, sent: d.sent };
  const done = () => Math.round(performance.now() - t0);
  if (!candidates.length) return { ...base, status: "skipped", http: null, ms: done() };

  const asked = await askForPick(candidates);
  if (asked.status === "failed") return { ...base, status: "failed", http: asked.http, error: asked.error, ms: done() };
  if (asked.status === "none") return { ...base, status: "none", http: asked.http, debug: asked.debug, ms: done() };
  const ms = done();
  // The cut the draft page makes before it uploads: the same function, the same margin.
  const cut = await asked.candidate.cut(asked.pick.box);
  return { ...base, status: "picked", http: asked.http, pick: asked.pick, page: asked.candidate.page, cut: cut.box, crop: await dataUrl(cut.file), debug: asked.debug, ms };
}

async function draw(pdfBase64: string, name: string, page: number, box: FigureBox | null, outlines: Outline[] = []): Promise<string> {
  const { pdfFigure } = await import("@/lib/figures/pdf");
  const bytes = new Uint8Array(await toFile(pdfBase64, name).arrayBuffer());
  const blob = await pdfFigure(bytes, page, box, { margin: false, edge: 1200 });
  if (!outlines.length || box) return dataUrl(blob);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(bitmap, 0, 0);
  ctx.lineWidth = 4;
  for (const o of outlines) {
    ctx.strokeStyle = tokenColour(o.token);
    ctx.strokeRect(o.box.x * canvas.width, o.box.y * canvas.height, o.box.w * canvas.width, o.box.h * canvas.height);
  }
  return canvas.toDataURL("image/png");
}

/** The outline colours are the brand's own, read from its text classes: jade for what was expected, the error red for what was cut. */
function tokenColour(token: Outline["token"]): string {
  const probe = document.createElement("span");
  probe.className = token === "jade" ? "text-jade" : "text-error";
  document.body.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

export function FigureEval() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.figureEval = { pages, pick, draw };
    setReady(true);
    return () => {
      delete window.figureEval;
    };
  }, []);
  return (
    <p data-ready={ready ? "true" : undefined} className="mt-6 rounded-[var(--radius)] bg-surface px-5 py-4 text-sm text-graphite">
      {ready ? "Ready. The eval calls window.figureEval from here." : "Loading…"}
    </p>
  );
}
