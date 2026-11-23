import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { mediaPath, OFFICE, readOfficePictures, sniffImage, zipEntryCount } from "../lib/figures/office";

// Pictures inside Word and PowerPoint files (decision 0025, "Pictures from Word and PowerPoint"), read
// as hostile zips. Pure: the files are made here with JSZip, with no browser and no AI.

/** A PNG that claims `w` by `h` pixels and is `bytes` long. Only the header is real: the reader never decodes it. */
function fakePng(w: number, h: number, bytes = 6_000, fill = 7): Uint8Array {
  const out = new Uint8Array(Math.max(bytes, 33));
  out.fill(fill);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(out.buffer);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return out;
}
/** A JPEG that claims `w` by `h`: the start, one frame header, then filler. */
function fakeJpeg(w: number, h: number, bytes = 6_000): Uint8Array {
  const out = new Uint8Array(Math.max(bytes, 32));
  out.fill(9);
  out.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00]);
  return out;
}
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><script>alert(1)</script></svg>');
const gif = (() => {
  const b = new Uint8Array(6_000);
  b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  return b;
})();

type Files = Record<string, Uint8Array | string>;
async function zipOf(files: Files): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
const rels = (targets: string[]) =>
  `<?xml version="1.0"?><Relationships>${targets.map((t, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${t}"/>`).join("")}</Relationships>`;

test.describe("A Word file", () => {
  test("offers the results chart pasted in as a picture, and leaves out the logo in its header and a tiny icon", async () => {
    const file = await zipOf({
      "[Content_Types].xml": "<Types/>",
      "word/document.xml": "<w:document/>",
      "word/_rels/document.xml.rels": rels(["media/image2.png", "media/image3.png", "media/image10.jpeg"]),
      "word/_rels/header1.xml.rels": rels(["media/image1.png"]),
      "word/media/image1.png": fakePng(320, 320),
      "word/media/image2.png": fakePng(900, 560),
      "word/media/image3.png": fakePng(32, 32, 4_000),
      "word/media/image10.jpeg": fakeJpeg(1000, 700, 9_000),
    });
    const read = (await readOfficePictures(file, "docx"))!;
    expect(read.pictures.map((p) => [p.path, p.type, p.width, p.height])).toEqual([
      ["word/media/image2.png", "image/png", 900, 560],
      ["word/media/image10.jpeg", "image/jpeg", 1000, 700],
    ]);
    expect(read.nativeChart).toBe(false);
  });

  test("a chart drawn in Word itself is noticed, not lifted", async () => {
    const file = await zipOf({ "word/document.xml": "<w:document/>", "word/charts/chart1.xml": "<c:chartSpace/>", "word/_rels/document.xml.rels": rels([]) });
    expect(await readOfficePictures(file, "docx")).toEqual({ pictures: [], nativeChart: true, skipped: 0 });
  });

  test("with no relationships file to go by, every picture that passes is considered", async () => {
    const file = await zipOf({ "word/document.xml": "<w:document/>", "word/media/image1.png": fakePng(800, 500) });
    expect((await readOfficePictures(file, "docx"))!.pictures).toHaveLength(1);
  });

  test("the same picture under two names is offered once", async () => {
    const file = await zipOf({
      "word/_rels/document.xml.rels": rels(["media/a.png", "media/b.png"]),
      "word/media/a.png": fakePng(800, 500),
      "word/media/b.png": fakePng(800, 500),
    });
    expect((await readOfficePictures(file, "docx"))!.pictures).toHaveLength(1);
  });
});

test.describe("A PowerPoint file", () => {
  test("offers a chart picture on one slide and a photo on another, in slide order, and not a logo on the master or on every slide", async () => {
    const file = await zipOf({
      "ppt/slides/slide1.xml": "<p:sld/>",
      "ppt/slides/slide2.xml": "<p:sld/>",
      "ppt/slides/slide3.xml": "<p:sld/>",
      "ppt/slides/slide4.xml": "<p:sld/>",
      "ppt/slides/_rels/slide1.xml.rels": rels(["../media/logo.png"]),
      "ppt/slides/_rels/slide2.xml.rels": rels(["../media/image7.png", "../media/logo.png"]),
      "ppt/slides/_rels/slide3.xml.rels": rels(["../media/image2.jpeg", "../media/logo.png"]),
      "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels(["../media/crest.png"]),
      "ppt/media/logo.png": fakePng(400, 400),
      "ppt/media/image7.png": fakePng(1280, 720),
      "ppt/media/image2.jpeg": fakeJpeg(1600, 1067, 20_000),
      "ppt/media/crest.png": fakePng(500, 500),
    });
    const read = (await readOfficePictures(file, "pptx"))!;
    expect(read.pictures.map((p) => [p.path, p.slide])).toEqual([
      ["ppt/media/image7.png", 2],
      ["ppt/media/image2.jpeg", 3],
    ]);
  });

  test("a chart drawn in PowerPoint itself is noticed", async () => {
    const file = await zipOf({ "ppt/slides/slide1.xml": "<p:sld/>", "ppt/charts/chart3.xml": "<c:chartSpace/>" });
    expect((await readOfficePictures(file, "pptx"))!.nativeChart).toBe(true);
  });
});

test.describe("A hostile zip", () => {
  test("takes a picture only from a plain file name directly under word/media/ or ppt/media/", () => {
    expect(mediaPath("word/media/image1.png", "docx")).toBe("word/media/image1.png");
    expect(mediaPath("ppt/media/image1.png", "pptx")).toBe("ppt/media/image1.png");
    // The wrong folder for the kind of file, a nested folder, a parent folder, a backslash, no name, odd characters.
    for (const name of ["ppt/media/image1.png", "word/media/sub/image1.png", "word/media/../image1.png", "word/media/..%2Fimage1.png", "word/media/a..b.png", "word/media/a\\b.png", "word/media/", "word/media/.hidden.png", "word/media/image1.png\u0000.svg", "word/mediaX/image1.png", "../word/media/image1.png", "/word/media/image1.png"]) {
      expect(mediaPath(name, "docx"), name).toBeNull();
    }
    expect(mediaPath("word/media/image1.png", "pptx")).toBeNull();
  });

  test("names that climb out or nest are skipped, and the rest of the file is still read", async () => {
    const file = await zipOf({
      "word/_rels/document.xml.rels": rels(["media/good.png", "../../evil.png", "media/sub/nested.png"]),
      "word/media/good.png": fakePng(800, 500),
      "word/media/../../evil.png": fakePng(800, 500, 7_000, 8),
      "word/media/sub/nested.png": fakePng(800, 500, 7_000, 5),
      "word/media/a..b.png": fakePng(800, 500, 7_000, 4),
    });
    expect((await readOfficePictures(file, "docx"))!.pictures.map((p) => p.path)).toEqual(["word/media/good.png"]);
  });

  test("the type comes from the bytes: SVG, GIF and anything else are skipped whatever the name says", async () => {
    const file = await zipOf({
      "word/_rels/document.xml.rels": rels(["media/a.png", "media/b.png", "media/c.emf", "media/d.png", "media/e.png"]),
      "word/media/a.png": svg,
      "word/media/b.png": gif,
      "word/media/c.emf": new Uint8Array(8_000).fill(1),
      // A JPEG named .png is a JPEG; a PNG named .jpg would be a PNG.
      "word/media/d.png": fakeJpeg(900, 600),
      "word/media/e.png": new TextEncoder().encode("<html>".repeat(2_000)),
    });
    const read = (await readOfficePictures(file, "docx"))!;
    expect(read.pictures.map((p) => [p.path, p.type])).toEqual([["word/media/d.png", "image/jpeg"]]);
    expect(read.skipped).toBe(4);
    expect(sniffImage(svg)).toBeNull();
    expect(sniffImage(gif)).toBeNull();
  });

  test("a picture past the pixel cap is skipped before anything decodes it", async () => {
    const file = await zipOf({
      "word/_rels/document.xml.rels": rels(["media/huge.png", "media/ok.png"]),
      "word/media/huge.png": fakePng(19_000, 19_000),
      "word/media/ok.png": fakePng(800, 500, 7_000, 3),
    });
    const read = (await readOfficePictures(file, "docx"))!;
    expect(19_000 * 19_000).toBeGreaterThan(OFFICE.maxPixels);
    expect(read.pictures.map((p) => p.path)).toEqual(["word/media/ok.png"]);
    expect(read.skipped).toBe(1);
  });

  test("a zip bomb: a picture that inflates past the cap is skipped, and nothing close to its size is held", async () => {
    // 60 MB of one byte compresses to about 60 KB. It starts like a PNG, so only its size gives it away.
    const bomb = fakePng(800, 500, 60_000_000, 0);
    const file = await zipOf({
      "word/_rels/document.xml.rels": rels(["media/bomb.png", "media/ok.png"]),
      "word/media/bomb.png": bomb,
      "word/media/ok.png": fakePng(800, 500, 7_000, 3),
    });
    expect(file.length).toBeLessThan(200_000);
    const t = Date.now();
    const read = (await readOfficePictures(file, "docx"))!;
    expect(Date.now() - t).toBeLessThan(10_000);
    expect(read.pictures.map((p) => p.path)).toEqual(["word/media/ok.png"]);
    expect(read.skipped).toBe(1);
  });

  test("the pictures together are capped too", async () => {
    const files: Files = {};
    const targets: string[] = [];
    // 8 pictures of just under the per-picture cap is over the total cap.
    for (let i = 0; i < 8; i++) {
      files[`word/media/p${i}.png`] = fakePng(900, 600, OFFICE.maxPictureBytes - 10, i + 1);
      targets.push(`media/p${i}.png`);
    }
    files["word/_rels/document.xml.rels"] = rels(targets);
    const read = (await readOfficePictures(await zipOf(files), "docx"))!;
    expect(read.pictures.length).toBeLessThan(8);
    expect(read.pictures.reduce((n, p) => n + p.bytes.length, 0)).toBeLessThanOrEqual(OFFICE.maxTotalBytes);
  });

  test("a zip with too many entries is not read at all, and a file that is not a zip is not either", async () => {
    const files: Files = { "word/media/image1.png": fakePng(800, 500) };
    for (let i = 0; i <= OFFICE.maxEntries; i++) files[`customXml/item${i}.xml`] = "x";
    const big = await zipOf(files);
    expect(zipEntryCount(big)).toBeGreaterThan(OFFICE.maxEntries);
    expect(await readOfficePictures(big, "docx")).toBeNull();
    expect(await readOfficePictures(new TextEncoder().encode("PK this is not a zip file at all"), "docx")).toBeNull();
    expect(zipEntryCount(new Uint8Array(100))).toBeNull();
  });

  test("a picture whose size is cut short by the cap isn't trusted from a low declared size", async () => {
    // The entry is stored with its real (large) size in the zip; the stream count is the limit, not the header alone.
    const file = await zipOf({ "word/media/big.png": fakePng(800, 500, OFFICE.maxPictureBytes + 1, 2), "word/media/ok.png": fakePng(800, 500, 7_000, 3) });
    expect((await readOfficePictures(file, "docx"))!.pictures.map((p) => p.path)).toEqual(["word/media/ok.png"]);
  });
});
