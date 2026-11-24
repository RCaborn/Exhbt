/**
 * The draft page's side of picking a figure from an upload (decisions 0017 and 0025). While the AI
 * drafts the exhbt, this sends the images a figure could be on to /api/exhbts/figure-pick, cuts
 * the chosen one out at full size and uploads it as a picture. Once the draft is saved,
 * placeFigure puts it on the exhbt. The draft carries on whatever happens here; the outcome
 * (a figure, none found, or it couldn't look) is said once when the editor opens.
 *
 * A candidate is any image a figure could be cut from. Today each one is a page of a PDF
 * (pdfCandidates). Nothing after that knows it is a page: a picture inside a Word or PowerPoint
 * file, or a picture uploaded with the work, only needs its own function that returns Candidates.
 */
import { removeFile, uploadForExhbt } from "@/components/editor/media";
import type { FigureBox, FigureKind } from "@/lib/exhbt/blocks";
import type { PdfPages } from "@/lib/figures/pdf";
import { FIGURE, clampBox, mayHoldFigure, withMargin } from "@/lib/figures/rules";

/** A PDF read on the person's device, with its pages drawn. `fileId` once it is uploaded. */
export type FigureSource = { name: string; file: File; fileId?: string; pages: PdfPages };

/** One image a figure could be cut from, whatever it came from. */
export type Candidate = {
  /** What the AI is told it is: "report.pdf, page 3". */
  label: string;
  /** The small image sent to the AI: a JPEG or PNG of at most FIGURE.maxImageBytes. */
  image: Blob;
  /** The uploaded file it is from, and that file's stored id once it has one, for the editor's note. */
  from: string;
  sourceFileId?: string;
  /** Where in the file: a PDF's page (from 1), or a picture's path inside a Word or PowerPoint file. */
  page?: number;
  media?: string;
  /**
   * The picture to upload for a box the AI gave on `image` (in fractions of it), at full size.
   * `box` is the box that was cut, when the editor can crop it again from the stored file.
   */
  cut: (box: FigureBox) => Promise<{ file: File; box?: FigureBox }>;
};

/** A figure cut out and uploaded, ready to go on the exhbt. */
export type ReadyFigure = {
  fileId: string;
  kind: FigureKind;
  alt: string;
  caption: string;
  picked: { from: string; sourceFileId?: string; page?: number; media?: string; box?: FigureBox };
};

/** What came of looking for a figure: one ready to place, none in the files, or it couldn't look. */
export type FigureOutcome = { status: "ready"; figure: ReadyFigure } | { status: "none" } | { status: "failed" };

/** The pick as /api/exhbts/figure-pick answers it. */
export type PickAnswer = { image: number; kind: FigureKind; box: FigureBox; alt: string; caption: string };
export type AskResult =
  | { status: "picked"; http: number; pick: PickAnswer; candidate: Candidate; debug?: unknown }
  | { status: "none"; http: number; debug?: unknown }
  | { status: "failed"; http: number | null; error: string };

const stem = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 60) || "report";

/** A PDF's pages that draw shapes or pictures, in page order: each one a candidate. A page of plain text is never one. */
export function pdfCandidates(source: FigureSource): Candidate[] {
  return source.pages.pages
    .filter((t) => mayHoldFigure(t.marks))
    .map((thumb) => ({
      label: `${source.name}, page ${thumb.page}`,
      image: thumb.jpeg,
      from: source.name,
      ...(source.fileId ? { sourceFileId: source.fileId } : {}),
      page: thumb.page,
      async cut(box: FigureBox) {
        // Cut out with a small margin round it; the box kept is the one cut, so the editor's cropper starts there.
        const kept = withMargin(clampBox(box));
        const { pdfFigure } = await import("@/lib/figures/pdf");
        const blob = await pdfFigure(new Uint8Array(await source.file.arrayBuffer()), thumb.page, kept, { margin: false });
        const name = `${stem(source.name)}-page-${thumb.page}.${blob.type === "image/png" ? "png" : "jpg"}`;
        return { file: new File([blob], name, { type: blob.type }), box: kept };
      },
    }));
}

/**
 * The candidates one pick may send, in the order given: at most FIGURE.maxImages, each within
 * FIGURE.maxImageBytes, and FIGURE.maxTotalBytes together (the route refuses more).
 */
export function withinCaps(all: Candidate[]): Candidate[] {
  const out: Candidate[] = [];
  let bytes = 0;
  for (const c of all.filter((c) => c.image.size > 0 && c.image.size <= FIGURE.maxImageBytes)) {
    if (out.length === FIGURE.maxImages || bytes + c.image.size > FIGURE.maxTotalBytes) break;
    out.push(c);
    bytes += c.image.size;
  }
  return out;
}

/** The pages worth sending from a set of PDFs, in file and page order, within the caps. */
export const candidatesOf = (sources: FigureSource[]): Candidate[] => withinCaps(sources.flatMap(pdfCandidates));

/**
 * Asks /api/exhbts/figure-pick which candidate holds the figure. An answer of no figure and a
 * request that failed are told apart, with the HTTP status, so "none found" is never said for
 * a pick that didn't run.
 */
export async function askForPick(candidates: Candidate[], signal?: AbortSignal): Promise<AskResult> {
  const body = new FormData();
  for (const [i, c] of candidates.entries()) {
    body.append("label", c.label);
    body.append("image", c.image, `image-${i + 1}.${c.image.type === "image/png" ? "png" : "jpg"}`);
  }
  let res: Response;
  try {
    res = await fetch("/api/exhbts/figure-pick", { method: "POST", body, signal });
  } catch (e) {
    return { status: "failed", http: null, error: (e as Error)?.message ?? "The request didn't finish." };
  }
  const data = (await res.json().catch(() => null)) as { pick?: PickAnswer | null; error?: string; debug?: unknown } | null;
  if (!res.ok || !data) return { status: "failed", http: res.status, error: data?.error ?? `HTTP ${res.status}` };
  if (!data.pick) return { status: "none", http: res.status, debug: data.debug };
  const candidate = candidates[data.pick.image - 1];
  if (!candidate) return { status: "failed", http: res.status, error: "The answer named an image that wasn't sent." };
  return { status: "picked", http: res.status, pick: data.pick, candidate, debug: data.debug };
}

/** Picks, cuts out and uploads the figure. */
export async function prepareFigure(candidates: Candidate[], signal: AbortSignal): Promise<FigureOutcome> {
  if (!candidates.length) return { status: "none" };
  let fileId: string | null = null;
  try {
    const asked = await askForPick(candidates, signal);
    if (asked.status === "failed") return { status: "failed" };
    if (asked.status === "none") return { status: "none" };
    const { pick, candidate } = asked;

    const { file, box } = await candidate.cut(pick.box);
    if (signal.aborted) return { status: "failed" };
    fileId = await uploadForExhbt(file, "image");
    if (signal.aborted) {
      void removeFile(fileId);
      return { status: "failed" };
    }
    return {
      status: "ready",
      figure: {
        fileId,
        kind: pick.kind,
        alt: pick.alt,
        caption: pick.caption,
        picked: {
          from: candidate.from,
          ...(candidate.sourceFileId ? { sourceFileId: candidate.sourceFileId } : {}),
          ...(candidate.page ? { page: candidate.page } : {}),
          ...(candidate.media ? { media: candidate.media } : {}),
          ...(box ? { box } : {}),
        },
      },
    };
  } catch {
    if (fileId) void removeFile(fileId);
    return { status: "failed" };
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
