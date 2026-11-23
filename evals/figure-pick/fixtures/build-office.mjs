// Makes the Word, PowerPoint and picture reports the figure eval runs on besides the PDFs
// (evals/figure-pick/README.md, decision 0025), and cases-office.json: for each, which picture the
// key figure is, what kind it is, and its true box inside that picture.
//
//   npm run eval:figures:fixtures:office
//
// Pictures are drawn as SVG and screenshotted by headless Chromium (Playwright's, a dev
// dependency), so the true box of the chart inside its picture is measured, not guessed. The
// Word and PowerPoint files are zips made here with JSZip: real part names and relationships
// (word/document.xml, word/media/, ppt/slides/, ppt/media/), so they are read by the same code
// that reads a student's file. The files and cases-office.json are committed, so every run reads
// the same bytes. Every person, place and result is made up. PDFs are left alone: build.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import JSZip from "jszip";

const here = dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------------- Pictures, drawn as SVG on a white canvas ---------------- */

/** A bar chart with a title, gridlines, axis titles, values and a legend, inside a white picture of `w` by `h`. The chart is `data-truth`. */
function chartPicture({ w, h, pad, title, yTitle, cats, series, max, step }) {
  const cw = w - 2 * pad;
  const ch = h - 2 * pad;
  const m = { top: 66, right: 18, bottom: 54, left: 70 };
  const pw = cw - m.left - m.right;
  const ph = ch - m.top - m.bottom;
  const y = (v) => m.top + ph - (v / max) * ph;
  const group = pw / cats.length;
  const bw = Math.min(52, (group * 0.74) / series.length);
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Carlito, Calibri, Arial, sans-serif" font-size="15"><rect width="${w}" height="${h}" fill="#fff"/>`];
  o.push(`<g transform="translate(${pad} ${pad})"><rect data-truth x="0" y="0" width="${cw}" height="${ch}" fill="none"/>`);
  o.push(`<text x="${cw / 2}" y="24" text-anchor="middle" font-size="18" font-weight="bold">${esc(title)}</text>`);
  let lx = m.left;
  for (const s of series) {
    o.push(`<rect x="${lx}" y="38" width="13" height="13" fill="${s.colour}"/><text x="${lx + 19}" y="50">${esc(s.name)}</text>`);
    lx += 46 + s.name.length * 8.4;
  }
  for (let v = 0; v <= max + 1e-9; v += step) {
    o.push(`<line x1="${m.left}" y1="${y(v)}" x2="${m.left + pw}" y2="${y(v)}" stroke="#d9d9d9"/><text x="${m.left - 8}" y="${y(v) + 5}" text-anchor="end">${v}</text>`);
  }
  o.push(`<line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + ph}" stroke="#222" stroke-width="1.5"/><line x1="${m.left}" y1="${m.top + ph}" x2="${m.left + pw}" y2="${m.top + ph}" stroke="#222" stroke-width="1.5"/>`);
  cats.forEach((c, i) => {
    const gx = m.left + group * i + (group - bw * series.length) / 2;
    series.forEach((s, k) => {
      const v = s.values[i];
      o.push(`<rect x="${gx + bw * k}" y="${y(v)}" width="${bw - 3}" height="${m.top + ph - y(v)}" fill="${s.colour}"/><text x="${gx + bw * k + (bw - 3) / 2}" y="${y(v) - 6}" text-anchor="middle" font-size="13">${v}</text>`);
    });
    o.push(`<text x="${m.left + group * i + group / 2}" y="${m.top + ph + 22}" text-anchor="middle">${esc(c)}</text>`);
  });
  o.push(`<text transform="translate(18 ${m.top + ph / 2}) rotate(-90)" text-anchor="middle">${esc(yTitle)}</text></g></svg>`);
  return o.join("");
}

/** A university crest: a circle, a shield and a name. A logo, not a figure. */
const crest = (name) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" font-family="Georgia, serif"><rect width="320" height="320" fill="#fff"/><circle cx="160" cy="130" r="96" fill="#1b365d"/><path d="M160 60 L225 85 L225 140 Q225 185 160 205 Q95 185 95 140 L95 85 Z" fill="#c9a227" stroke="#fff" stroke-width="4"/><text x="160" y="140" text-anchor="middle" font-size="46" fill="#1b365d" font-weight="bold">N</text><text x="160" y="268" text-anchor="middle" font-size="26" fill="#1b365d" font-weight="bold">${esc(name)}</text><text x="160" y="296" text-anchor="middle" font-size="15" fill="#555">Est. 1874</text></svg>`;

/** A photo of a desk, as a plain gradient scene (no real photo is needed: it is not a chart, not a logo, and not text). */
const photo = (w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9db4c0"/><stop offset="1" stop-color="#5c6b73"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect x="${w * 0.08}" y="${h * 0.62}" width="${w * 0.84}" height="${h * 0.3}" rx="8" fill="#a67c52"/><rect x="${w * 0.3}" y="${h * 0.3}" width="${w * 0.36}" height="${h * 0.26}" rx="6" fill="#222"/><rect x="${w * 0.32}" y="${h * 0.32}" width="${w * 0.32}" height="${h * 0.22}" fill="#6fa8dc"/><circle cx="${w * 0.78}" cy="${h * 0.7}" r="${h * 0.05}" fill="#e8e8e8"/><rect x="${w * 0.14}" y="${h * 0.66}" width="${w * 0.12}" height="${h * 0.07}" fill="#f2f2f2"/></svg>`;

/** A rough wireframe sketch: grey boxes and lines on lined paper. */
const sketch = (w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Comic Sans MS, cursive, sans-serif"><rect width="${w}" height="${h}" fill="#fdfcf5"/>${Array.from({ length: Math.floor(h / 32) }, (_, i) => `<line x1="0" y1="${32 * (i + 1)}" x2="${w}" y2="${32 * (i + 1)}" stroke="#cfd8e6"/>`).join("")}<rect x="${w * 0.1}" y="${h * 0.12}" width="${w * 0.8}" height="${h * 0.12}" fill="none" stroke="#555" stroke-width="3"/><rect x="${w * 0.1}" y="${h * 0.32}" width="${w * 0.35}" height="${h * 0.5}" fill="none" stroke="#555" stroke-width="3"/><rect x="${w * 0.55}" y="${h * 0.32}" width="${w * 0.35}" height="${h * 0.22}" fill="none" stroke="#555" stroke-width="3"/><line x1="${w * 0.55}" y1="${h * 0.65}" x2="${w * 0.9}" y2="${h * 0.65}" stroke="#555" stroke-width="3"/><line x1="${w * 0.55}" y1="${h * 0.72}" x2="${w * 0.8}" y2="${h * 0.72}" stroke="#555" stroke-width="3"/><text x="${w * 0.12}" y="${h * 0.2}" font-size="22" fill="#555">header?</text></svg>`;

/** The finished piece: a designed poster for a campaign. The whole picture is the work. */
const poster = (w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Georgia, serif"><rect width="${w}" height="${h}" fill="#0f3d3e"/><circle cx="${w * 0.5}" cy="${h * 0.36}" r="${w * 0.28}" fill="#e9c46a"/><rect x="${w * 0.06}" y="${h * 0.62}" width="${w * 0.88}" height="${h * 0.1}" fill="#f4f1de"/><text x="${w * 0.5}" y="${h * 0.69}" text-anchor="middle" font-size="${w * 0.07}" font-weight="bold" fill="#0f3d3e">RIVERSIDE SWIM NIGHT</text><text x="${w * 0.5}" y="${h * 0.8}" text-anchor="middle" font-size="${w * 0.04}" fill="#f4f1de">Friday 14 March, 7pm, Riverside Pool</text><text x="${w * 0.5}" y="${h * 0.88}" text-anchor="middle" font-size="${w * 0.032}" fill="#e9c46a">Free for first-years. Bring a towel.</text></svg>`;

/* ---------------- Word and PowerPoint files ---------------- */

const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const relsXml = (items) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join("")}</Relationships>`;
const rel = (id, target, type = REL_IMAGE) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
const wPara = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const wPic = (rid, name) => `<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><!-- ${name} -->`;
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

async function docx(files, bodyXml, relItems, extra = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", relsXml([rel("rId1", "word/document.xml", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument")]));
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", relsXml(relItems));
  for (const [name, data] of Object.entries({ ...files, ...extra })) zip.file(name, data);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function pptx(slides, files, extra = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`);
  zip.file("_rels/.rels", relsXml([rel("rId1", "ppt/presentation.xml", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument")]));
  zip.file("ppt/presentation.xml", `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
  slides.forEach((s, i) => {
    const n = i + 1;
    zip.file(`ppt/slides/slide${n}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${s.text.map((t) => `<p:sp><p:txBody><a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p></p:txBody></p:sp>`).join("")}${s.images.map((m) => `<p:pic><p:blipFill><a:blip r:embed="${m.rid}"/></p:blipFill></p:pic>`).join("")}</p:spTree></p:cSld></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, relsXml(s.images.map((m) => rel(m.rid, `../media/${m.file}`))));
  });
  for (const [name, data] of Object.entries({ ...files, ...extra })) zip.file(name, data);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/* ---------------- Build ---------------- */

async function main() {
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  /** A picture: the SVG screenshotted as a PNG, with the true box of the `data-truth` element in fractions of the picture. */
  async function png(svg, w, h) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const truth = await page.evaluate(() => {
      const el = document.querySelector("[data-truth]");
      const root = document.querySelector("svg").getBoundingClientRect();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: (r.left - root.left) / root.width, y: (r.top - root.top) / root.height, w: r.width / root.width, h: r.height / root.height };
    });
    const bytes = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: w, height: h } });
    return { bytes, truth };
  }
  const r4 = (b) => b && { x: +b.x.toFixed(4), y: +b.y.toFixed(4), w: +b.w.toFixed(4), h: +b.h.toFixed(4) };
  const write = (name, data) => {
    writeFileSync(join(here, name), data);
    console.log(`${name}: ${(data.length / 1024).toFixed(0)} KB`);
  };
  mkdirSync(here, { recursive: true });
  const cases = [];

  // 15. A Word report: the results chart pasted in as a picture (image2), a crest on the title page (image3, in the body) and the same crest's small
  // copy in the header (image1, which only the header points at). The chart is the figure; the crest is a logo.
  const chart = await png(
    chartPicture({ w: 900, h: 560, pad: 36, title: "Missed appointments by reminder time", yTitle: "Missed appointments (%)", cats: ["All patients", "Under 30", "30 and over"], series: [{ name: "24 hours before", colour: "#a5a5a5", values: [7.9, 11.2, 5.1] }, { name: "3 hours before", colour: "#4472c4", values: [6.5, 8.4, 4.6] }], max: 12, step: 4 }),
    900,
    560,
  );
  const crestBig = await png(crest("NORTHFIELD UNIVERSITY"), 320, 320);
  const crestSmall = await png(crest("NORTHFIELD"), 320, 320);
  write(
    "15-word-chart-picture.docx",
    await docx(
      { "word/media/image1.png": crestSmall.bytes, "word/media/image2.png": chart.bytes, "word/media/image3.png": crestBig.bytes },
      wPara("BSc Health Data Science: final-year project") + wPic("rId5", "crest") + wPara("Do later reminders cut missed appointments?") + wPara("Method. We compared reminders sent 24 hours and 3 hours before an appointment across two practices.") + wPic("rId4", "chart") + wPara("Figure 1. Missed appointments, by reminder time. Source: practice records."),
      [rel("rId4", "media/image2.png"), rel("rId5", "media/image3.png")],
      { "word/_rels/header1.xml.rels": relsXml([rel("rId1", "media/image1.png")]), "word/header1.xml": `<w:hdr ${NS}>${wPara("Northfield University")}</w:hdr>` },
    ),
  );
  cases.push({
    id: "15-word-chart-picture",
    files: ["15-word-chart-picture.docx"],
    what: "A Word report with the results chart pasted in as a picture (image2) and a university crest on its title page (image3). A smaller copy of the crest is only in the header, so it is not offered.",
    expect: { picture: "word/media/image2.png", kind: "graph", box: r4(chart.truth) },
  });

  // 16. A PowerPoint: a chart picture on slide 2, a photo on slide 3, a logo on every slide (not offered), a crest on the master (not offered).
  const slideChart = await png(
    chartPicture({ w: 780, h: 470, pad: 24, title: "Sign-ups in Freshers' Week", yTitle: "New members", cats: ["Mon", "Tue", "Wed", "Thu", "Fri"], series: [{ name: "2024", colour: "#a5a5a5", values: [9, 12, 31, 19, 15] }, { name: "2025", colour: "#4472c4", values: [14, 17, 58, 29, 23] }], max: 60, step: 20 }),
    780,
    470,
  );
  const slidePhoto = await png(photo(1200, 800), 1200, 800);
  const logo = await png(crest("FILM SOC"), 320, 320);
  write(
    "16-pptx-chart-and-photo.pptx",
    await pptx(
      [
        { text: ["Film Society: Freshers' Week"], images: [{ rid: "rId1", file: "logo.png" }] },
        { text: ["Sign-ups more than doubled on Wednesday"], images: [{ rid: "rId1", file: "image7.png" }, { rid: "rId2", file: "logo.png" }] },
        { text: ["Our stall"], images: [{ rid: "rId1", file: "image2.png" }, { rid: "rId2", file: "logo.png" }] },
      ],
      { "ppt/media/logo.png": logo.bytes, "ppt/media/image7.png": slideChart.bytes, "ppt/media/image2.png": slidePhoto.bytes, "ppt/media/crest.png": crestBig.bytes },
      { "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml([rel("rId1", "../media/crest.png")]), "ppt/slideMasters/slideMaster1.xml": "<p:sldMaster xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\"/>" },
    ),
  );
  cases.push({
    id: "16-pptx-chart-and-photo",
    files: ["16-pptx-chart-and-photo.pptx"],
    what: "A PowerPoint with a chart picture on slide 2 and a photo of the stall on slide 3. The society's logo is on every slide and a crest is on the master, so neither is offered.",
    expect: { picture: "ppt/media/image7.png", kind: "graph", box: r4(slideChart.truth) },
  });

  // 17. Three pictures uploaded with the work: a rough sketch, a photo of the desk it was made at, and the finished poster. The finished piece leads.
  const finished = await png(poster(900, 1200), 900, 1200);
  const rough = await png(sketch(1000, 700), 1000, 700);
  const desk = await png(photo(1200, 800), 1200, 800);
  write("17-uploaded-pictures-poster.png", finished.bytes);
  write("17-uploaded-pictures-sketch.png", rough.bytes);
  write("17-uploaded-pictures-desk.png", desk.bytes);
  cases.push({
    id: "17-uploaded-pictures",
    files: ["17-uploaded-pictures-sketch.png", "17-uploaded-pictures-desk.png", "17-uploaded-pictures-poster.png"],
    what: "Three pictures uploaded with a design project: a rough wireframe sketch, a photo of the desk, and the finished poster. The finished poster should lead.",
    expect: { picture: "17-uploaded-pictures-poster.png", kind: "other", box: { x: 0, y: 0, w: 1, h: 1 } },
  });

  // 18. A Word report whose chart is drawn in Word itself: no picture to lift. Nothing is sent, and the editor says to save it as a PDF.
  write(
    "18-word-native-chart.docx",
    await docx(
      {},
      wPara("Do later reminders cut missed appointments?") + wPara("Figure 1 is the chart below, drawn in Word.") + wPara("Missed appointments fell from 7.9% to 6.5%."),
      [rel("rId9", "charts/chart1.xml", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart")],
      { "word/charts/chart1.xml": `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:barChart/></c:plotArea></c:chart></c:chartSpace>` },
    ),
  );
  cases.push({
    id: "18-word-native-chart",
    files: ["18-word-native-chart.docx"],
    what: "A Word report whose only chart is drawn in Word itself, so there is no picture to take. Nothing should be sent, and the file should be reported as holding a chart that can't be lifted.",
    expect: null,
    nativeChart: true,
  });

  await browser.close();
  writeFileSync(join(here, "cases-office.json"), `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Wrote ${cases.length} cases and cases-office.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
