/**
 * The draft page's side of picking a figure from an upload (decisions 0017 and 0025). While the AI
 * drafts the exhbt, this sends the images a figure could be on to /api/exhbts/figure-pick, cuts
 * the chosen one out at full size and uploads it as a picture. Once the draft is saved,
 * placeFigure puts it on the exhbt. The draft carries on whatever happens here; the outcome
 * (a figure, none found, or it couldn't look) is said once when the editor opens.
 *
 * A candidate is any image a figure could be cut from: a page of a PDF (pdfCandidates), a picture
 * inside a Word or PowerPoint file (officeCandidates), or a picture uploaded with the work
 * (pictureCandidates). Nothing after those knows which it is: each is a function that returns
 * Candidates and nothing else.
 */
import { removeFile, uploadForExhbt } from "@/components/editor/media";
import type { FigureBox, FigureKind } from "@/lib/exhbt/blocks";
import type { OfficeRead } from "@/lib/figures/office";
import type { PdfPages } from "@/lib/figures/pdf";
import { FIGURE, clampBox, mayHoldFigure, withMargin } from "@/lib/figures/rules";

/** A PDF read on the person's device, with its pages drawn. `fileId` once it is uploaded. */
export type FigureSource = { name: string; file: File; fileId?: string; pages: PdfPages };

/** A Word or PowerPoint file read on the device, with the pictures inside it worth offering (lib/figures/office.ts). */
export type OfficeSource = { name: string; file: File; fileId?: string; read: OfficeRead };

/** A PNG or JPEG the person uploaded with the work and agreed to send, already stored as `fileId`. */
export type PictureSource = { name: string; file: File; fileId: string; bytes: Uint8Array; type: "image/png" | "image/jpeg"; width: number; height: number };

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
  /** A picture the person uploaded themselves, already stored: it goes on as it is, with no cut, no upload and no "may share" tick. */
  own?: { fileId: string };
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
  /** Where it was picked from. Absent for a picture the person uploaded themselves. */
  picked?: { from: string; sourceFileId?: string; page?: number; media?: string; box?: FigureBox };
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
 * The pictures inside a Word or PowerPoint file, one candidate each: its small copy goes to the AI, and the cut
 * is taken from the picture itself at full size. Labelled "File 2, slide 3" or "File 1, picture 2".
 */
export async function officeCandidates(source: OfficeSource, fileNo: number): Promise<Candidate[]> {
  const { pictureThumb, pictureCut } = await import("@/lib/figures/pictures");
  const { pictures } = source.read;
  const onSlide = new Map<number, number>();
  for (const p of pictures) if (p.slide) onSlide.set(p.slide, (onSlide.get(p.slide) ?? 0) + 1);
  const seen = new Map<number, number>();
  const out: Candidate[] = [];
  for (const [i, pic] of pictures.entries()) {
    let where = `picture ${i + 1}`;
    if (pic.slide) {
      const nth = (seen.get(pic.slide) ?? 0) + 1;
      seen.set(pic.slide, nth);
      where = `slide ${pic.slide}${(onSlide.get(pic.slide) ?? 0) > 1 ? `, picture ${nth}` : ""}`;
    }
    let thumb: { jpeg: Blob };
    try {
      thumb = await pictureThumb(pic.bytes, pic.type, pic.width, pic.height);
    } catch {
      // A picture the browser can't decode is left out; the others still go.
      continue;
    }
    out.push({
      label: `File ${fileNo}, ${where}`,
      image: thumb.jpeg,
      from: source.name,
      ...(source.fileId ? { sourceFileId: source.fileId } : {}),
      media: pic.path,
      async cut(box: FigureBox) {
        // The whole picture when the box is nearly all of it; otherwise the box, with a small margin. The editor can't crop it again, so no box is kept.
        const kept = withMargin(clampBox(box));
        const whole = kept.w * kept.h > 0.9;
        const blob = await pictureCut(pic.bytes, pic.type, pic.width, pic.height, whole ? null : kept);
        const name = `${stem(source.name)}-${where.replace(/[^\w]+/g, "-")}.${blob.type === "image/png" ? "png" : "jpg"}`;
        return { file: new File([blob], name, { type: blob.type }) };
      },
    });
  }
  return out;
}

/** The person's own uploaded pictures that they agreed to send: one candidate each, labelled "File 3, picture". They go on as they are. */
export async function pictureCandidates(sources: PictureSource[], firstNo: number): Promise<Candidate[]> {
  const { pictureThumb } = await import("@/lib/figures/pictures");
  const out: Candidate[] = [];
  for (const [i, s] of sources.entries()) {
    let thumb: { jpeg: Blob };
    try {
      thumb = await pictureThumb(s.bytes, s.type, s.width, s.height);
    } catch {
      continue;
    }
    out.push({
      label: `File ${firstNo + i}, picture`,
      image: thumb.jpeg,
      from: s.name,
      sourceFileId: s.fileId,
      own: { fileId: s.fileId },
      async cut() {
        return { file: s.file };
      },
    });
  }
  return out;
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

    // A picture the person uploaded is already stored: it goes on as it is, described by what the AI read on it.
    if (candidate.own) return { status: "ready", figure: { fileId: candidate.own.fileId, kind: "other", alt: pick.alt, caption: pick.caption } };

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

/**
 * Puts an uploaded figure on the exhbt just drafted, and, for a gallery, the person's other uploaded pictures after it (`more`, in
 * the order uploaded). False if it can't. A figure cut out of the person's file is then deleted; a picture they uploaded themselves
 * (no `picked`) never is: it is theirs.
 */
export async function placeFigure(exhbtId: string, f: ReadyFigure, more: string[] = []): Promise<boolean> {
  try {
    const res = await fetch(`/api/exhbts/${exhbtId}/figure`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, ...(more.length ? { more } : {}) }),
    });
    if (res.ok) return true;
  } catch {
    // Carried on without it, below.
  }
  if (f.picked) void removeFile(f.fileId);
  return false;
}

/** Reads a Word or PowerPoint file's pictures on the device. Null when it can't be read within the caps (the draft goes ahead without). */
export async function readOffice(file: File): Promise<{ kind: "docx" | "pptx"; read: OfficeRead } | null> {
  try {
    const { detectKind } = await import("@/lib/doc-readers");
    const { readOfficePictures } = await import("@/lib/figures/office");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectKind(bytes, file.name, file.type);
    if (kind !== "docx" && kind !== "pptx") return null;
    const read = await readOfficePictures(bytes, kind);
    return read ? { kind, read } : null;
  } catch {
    return null;
  }
}

/** A PNG or JPEG the person uploaded, read for sending: its bytes, type from the bytes and size within the caps. Null for anything else. */
export async function readPicture(file: File): Promise<Pick<PictureSource, "bytes" | "type" | "width" | "height"> | null> {
  try {
    const { OFFICE, sniffImage } = await import("@/lib/figures/office");
    const { imageSize } = await import("@/lib/figures/image-size");
    if (file.size === 0 || file.size > OFFICE.maxPictureBytes * 2) return null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    const size = type ? imageSize(bytes) : null;
    if (!type || !size || size.width * size.height > OFFICE.maxPixels) return null;
    return { bytes, type, ...size };
  } catch {
    return null;
  }
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
