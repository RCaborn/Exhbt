import JSZip from "jszip";
import { imageSize } from "./image-size";

/**
 * The pictures inside a Word (.docx) or PowerPoint (.pptx) file, offered as candidates for the key
 * figure (decision 0025, "Pictures from Word and PowerPoint"). Pure and without browser APIs: the
 * draft page reads the file on the person's device and the tests read made-up files here.
 *
 * A .docx or .pptx is a zip the person chose, so it is read as hostile. Every limit is in OFFICE:
 *  - the number of entries is read from the zip's end record before anything is opened, and a file
 *    over the cap is not read at all;
 *  - a picture is taken only from a plain file name directly under word/media/ or ppt/media/ (no
 *    "..", no slash, no nested folder), whatever the file's other entries are called;
 *  - each entry is inflated through a counter that stops at the cap, so a header that understates
 *    its size is no help to a zip bomb, and the total across the file is capped too;
 *  - the type is decided from the bytes and only PNG and JPEG are taken (no SVG, EMF, WMF, GIF,
 *    WebP or anything else), never from the name;
 *  - the pixels are capped using the image header's size (image-size.ts), so a small file that
 *    decodes to a huge picture is skipped before anything decodes it;
 *  - logos and tiny pictures, banners and rules, and pictures repeated on every slide or put in a
 *    header or footer, are left out.
 * Whatever breaks a cap is skipped (counted in `skipped`); the draft goes ahead without it.
 *
 * A chart drawn in Word or PowerPoint itself is not a picture and can't be lifted. Its parts
 * (word/charts/ or ppt/charts/) are noticed, so the editor can say so (`nativeChart`).
 */
export const OFFICE = {
  /** Entries in the zip, as its end record says. Real documents have tens or a few hundred. */
  maxEntries: 2_000,
  /** One picture, uncompressed, in bytes. */
  maxPictureBytes: 8_000_000,
  /** Every picture taken from one file, together. */
  maxTotalBytes: 40_000_000,
  /** One picture's pixels (width times height): 36 million is 6000 by 6000. */
  maxPixels: 36_000_000,
  /** A relationships file, or a slide's XML, in bytes. */
  maxRelsBytes: 1_000_000,
  maxXmlBytes: 2_000_000,
  /** Pictures taken from one file. */
  maxPictures: 30,
  /** Smaller than this and it is a logo or an icon: the short side in pixels, the area in pixels, the file in bytes. */
  minSide: 100,
  minPixels: 60_000,
  minBytes: 3_000,
  /** A banner or a rule: the long side over the short side. */
  maxAspect: 6,
  /** A picture on more slides than this is a logo or a background, not the work. */
  maxSlides: 2,
} as const;

export type OfficeKind = "docx" | "pptx";
export type OfficePicture = {
  /** Its path in the file: "word/media/image2.png". */
  path: string;
  bytes: Uint8Array;
  type: "image/png" | "image/jpeg";
  width: number;
  height: number;
  /** The slide it is on, from 1, in a PowerPoint file. */
  slide?: number;
};
export type OfficeRead = {
  pictures: OfficePicture[];
  /** The file has a chart drawn in Word or PowerPoint, which can't be lifted as a picture. */
  nativeChart: boolean;
  /** Pictures left out because they broke a cap or were not a PNG or JPEG. Logos and tiny ones are not counted. */
  skipped: number;
};

/** "image/png" or "image/jpeg" from the first bytes, or null. */
export function sniffImage(b: Uint8Array): OfficePicture["type"] | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/** The number of entries the zip's end record claims, or null if it has no end record, or is zip64 (too many to be a document). */
export function zipEntryCount(b: Uint8Array): number | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // The end record is 22 bytes plus a comment of up to 65535 bytes, at the very end.
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65_535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      const total = v.getUint16(i + 10, true);
      return total === 0xffff ? null : total;
    }
  }
  return null;
}

/** A plain file name directly under word/media/ or ppt/media/: no "..", no slash or backslash, no nested folder. */
export function mediaPath(name: string, kind: OfficeKind): string | null {
  const dir = kind === "docx" ? "word/media/" : "ppt/media/";
  if (!name.startsWith(dir)) return null;
  const base = name.slice(dir.length);
  if (!base || base.length > 100 || base.includes("..") || !/^[A-Za-z0-9_][A-Za-z0-9_. -]*$/.test(base)) return null;
  return name;
}

/** The bytes of one zip entry, or null once they pass `cap` (the inflating stops there) or can't be read. */
export async function readCapped(entry: JSZip.JSZipObject, cap: number): Promise<Uint8Array | null> {
  // The size the header declares: a quick no. It can lie low, so the count below is the real limit.
  const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof declared === "number" && declared > cap) return null;
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let n = 0;
    let over = false;
    const stream = (entry as unknown as { internalStream: (t: "uint8array") => { on: (e: string, f: (...a: never[]) => void) => unknown; pause: () => void; resume: () => void } }).internalStream("uint8array");
    stream.on("data", ((chunk: Uint8Array) => {
      if (over) return;
      n += chunk.length;
      if (n > cap) {
        over = true;
        stream.pause();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    }) as (...a: never[]) => void);
    stream.on("error", (() => resolve(null)) as (...a: never[]) => void);
    stream.on("end", (() => {
      if (over) return;
      const out = new Uint8Array(n);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      resolve(out);
    }) as (...a: never[]) => void);
    stream.resume();
  });
}

const textOf = (b: Uint8Array | null) => (b ? new TextDecoder("utf-8").decode(b) : "");
/** The media file names a relationships file points at ("../media/image1.png" gives "image1.png"), in order, each once. */
const mediaTargets = (rels: string): string[] => {
  const out: string[] = [];
  for (const m of rels.matchAll(/Target="([^"]+)"/g)) {
    const t = m[1]!;
    if (!/(^|\/)media\/[^/]+$/.test(t)) continue;
    const base = t.slice(t.lastIndexOf("/") + 1);
    if (!out.includes(base)) out.push(base);
  }
  return out;
};

/**
 * The pictures worth offering from a Word or PowerPoint file, or null when the file can't be read as
 * a zip within the caps (too many entries, not a zip). Never throws.
 */
export async function readOfficePictures(bytes: Uint8Array, kind: OfficeKind): Promise<OfficeRead | null> {
  try {
    const count = zipEntryCount(bytes);
    if (count === null || count > OFFICE.maxEntries) return null;
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    if (names.length > OFFICE.maxEntries) return null;
    const dir = kind === "docx" ? "word" : "ppt";
    const nativeChart = names.some((n) => new RegExp(`^${dir}/charts/[^/]+\\.xml$`).test(n));
    const media = names.filter((n) => !zip.files[n]!.dir && mediaPath(n, kind));

    // Which pictures the work itself uses, and on which slide: a picture only the masters, layouts, headers or footers point at is
    // decoration. With no relationships file to go by, every picture is considered.
    const slideOf = new Map<string, number[]>();
    let inBody: Set<string> | null = null;
    const relsFiles = kind === "docx" ? names.filter((n) => n === "word/_rels/document.xml.rels") : names.filter((n) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(n));
    if (relsFiles.length) {
      inBody = new Set();
      for (const rf of relsFiles) {
        const entry = zip.file(rf);
        if (!entry) continue;
        const slide = kind === "pptx" ? Number(/slide(\d+)\.xml\.rels$/.exec(rf)![1]) : undefined;
        for (const base of mediaTargets(textOf(await readCapped(entry, OFFICE.maxRelsBytes)))) {
          inBody.add(`${dir}/media/${base}`);
          if (slide !== undefined) slideOf.set(`${dir}/media/${base}`, [...(slideOf.get(`${dir}/media/${base}`) ?? []), slide]);
        }
      }
    }

    const pictures: OfficePicture[] = [];
    const seen = new Set<string>();
    let total = 0;
    let skipped = 0;
    // In order: slides by number, then files by name with their numbers read as numbers (image2 before image10).
    const ordered = media.sort((a, b) => (slideOf.get(a)?.[0] ?? 0) - (slideOf.get(b)?.[0] ?? 0) || a.localeCompare(b, "en", { numeric: true }));
    for (const name of ordered) {
      if (pictures.length >= OFFICE.maxPictures) break;
      if (inBody && !inBody.has(name)) continue;
      const slides = slideOf.get(name) ?? [];
      // On many slides: a logo or a background.
      if (slides.length > OFFICE.maxSlides) continue;
      const data = await readCapped(zip.file(name)!, OFFICE.maxPictureBytes);
      if (!data) {
        skipped++;
        continue;
      }
      total += data.length;
      if (total > OFFICE.maxTotalBytes) {
        skipped++;
        break;
      }
      const type = sniffImage(data);
      const size = type ? imageSize(data) : null;
      if (!type || !size || size.width * size.height > OFFICE.maxPixels) {
        skipped++;
        continue;
      }
      const { width, height } = size;
      const tiny = Math.min(width, height) < OFFICE.minSide || width * height < OFFICE.minPixels || data.length < OFFICE.minBytes;
      const banner = Math.max(width, height) / Math.min(width, height) > OFFICE.maxAspect;
      if (tiny || banner) continue;
      // The same picture under two names (a logo copied into each place it is used).
      const key = `${width}x${height}:${data.length}:${data[data.length >> 1]}:${data[data.length >> 2]}:${data[data.length - 1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pictures.push({ path: name, bytes: data, type, width, height, ...(slides.length ? { slide: slides[0] } : {}) });
    }
    return { pictures, nativeChart, skipped };
  } catch {
    return null;
  }
}
