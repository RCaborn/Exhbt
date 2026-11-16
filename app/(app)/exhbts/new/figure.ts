/**
 * The draft page's side of picking a figure from an upload (decision 0017). While the AI drafts
 * the exhbt, this sends the pages of the person's PDFs that draw something besides text to
 * /api/exhbts/figure-pick, draws the chosen page again at high resolution, cuts out the figure
 * and uploads it as a picture. Once the draft is saved, placeFigure puts it on the exhbt. Any
 * failure, or no figure, gives null: the draft carries on without one, and nothing shows.
 */
import { removeFile, uploadForExhbt } from "@/components/editor/media";
import type { FigureBox } from "@/lib/exhbt/blocks";
import type { PageThumb, PdfPages } from "@/lib/figures/pdf";
import { FIGURE, mayHoldFigure } from "@/lib/figures/rules";

/** A PDF read on the person's device, with its pages drawn. `fileId` once it is uploaded. */
export type FigureSource = { name: string; file: File; fileId?: string; pages: PdfPages };

/** A figure cut out and uploaded, ready to go on the exhbt. */
export type ReadyFigure = {
  fileId: string;
  alt: string;
  caption: string;
  picked: { from: string; sourceFileId?: string; page: number; box: FigureBox };
};

type Candidate = { source: FigureSource; thumb: PageThumb };

/** The pages worth sending: those that draw shapes or pictures, in file and page order, at most FIGURE.maxImages. */
export function candidatesOf(sources: FigureSource[]): Candidate[] {
  return sources.flatMap((source) => source.pages.pages.filter((t) => mayHoldFigure(t.marks)).map((thumb) => ({ source, thumb }))).slice(0, FIGURE.maxImages);
}

const stem = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 60) || "report";

/** Picks, cuts out and uploads the figure. Null when there's none, or anything fails. */
export async function prepareFigure(sources: FigureSource[], signal: AbortSignal): Promise<ReadyFigure | null> {
  const candidates = candidatesOf(sources);
  if (!candidates.length) return null;
  let fileId: string | null = null;
  try {
    const body = new FormData();
    for (const c of candidates) {
      body.append("label", `${c.source.name}, page ${c.thumb.page}`);
      body.append("image", c.thumb.jpeg, `page-${c.thumb.page}.jpg`);
    }
    const res = await fetch("/api/exhbts/figure-pick", { method: "POST", body, signal });
    if (!res.ok) return null;
    const { pick } = (await res.json()) as { pick?: { image: number; box: FigureBox; alt: string; caption: string } | null };
    const chosen = pick ? candidates[pick.image - 1] : undefined;
    if (!pick || !chosen) return null;

    const { pdfFigure } = await import("@/lib/figures/pdf");
    const blob = await pdfFigure(new Uint8Array(await chosen.source.file.arrayBuffer()), chosen.thumb.page, pick.box);
    if (signal.aborted) return null;
    const file = new File([blob], `${stem(chosen.source.name)}-page-${chosen.thumb.page}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type });
    fileId = await uploadForExhbt(file, "image");
    if (signal.aborted) {
      void removeFile(fileId);
      return null;
    }
    return {
      fileId,
      alt: pick.alt,
      caption: pick.caption,
      picked: { from: chosen.source.name, ...(chosen.source.fileId ? { sourceFileId: chosen.source.fileId } : {}), page: chosen.thumb.page, box: pick.box },
    };
  } catch {
    if (fileId) void removeFile(fileId);
    return null;
  }
}

/** Puts an uploaded figure on the exhbt just drafted. False (and the picture deleted) if it can't. */
export async function placeFigure(exhbtId: string, f: ReadyFigure): Promise<boolean> {
  try {
    const res = await fetch(`/api/exhbts/${exhbtId}/figure`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    if (res.ok) return true;
  } catch {
    // Carried on without it, below.
  }
  void removeFile(f.fileId);
  return false;
}

/** Draws a PDF's pages for the pick; null when it can't be read (the draft carries on without a figure). */
export async function drawPages(file: File): Promise<PdfPages | null> {
  try {
    const { pdfPages } = await import("@/lib/figures/pdf");
    return await pdfPages(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return null;
  }
}
