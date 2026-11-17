// Makes the PDFs the auto-figure tests upload (e2e/auto-figure.spec.ts, decisions 0017 and 0025):
//
//   report-with-chart.pdf    four A4 pages: text, text, a bar chart drawn with vector shapes, text
//   report-text-only.pdf     three A4 pages of text and nothing else
//   report-with-diagram.pdf  four A4 pages: text, a method diagram drawn with vector shapes, text, text.
//                            The stand-in reads "diagram" in the name as a visual that isn't a graph.
//   scan-report.pdf          two A4 pages that are pictures with no text behind them, like a scan:
//                            a page of grey lines, and a page with a bar chart
//
// Run `node e2e/fixtures/make-figure-pdfs.mjs` to rebuild them. The PDFs are committed so the
// tests read the same bytes every time; this script is how they were made. No dependencies:
// the file is written by hand, with the cross-reference offsets worked out here.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const W = 595;
const H = 842;

const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** Lines of 11pt Helvetica from the top left, 15pt apart. */
const textBlock = (lines, top = 780, left = 60, size = 11) =>
  `BT /F1 ${size} Tf ${left} ${top} Td ${size + 4} TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;

const heading = (t, top) => `BT /F2 16 Tf 60 ${top} Td (${esc(t)}) Tj ET`;

const INTRO = [
  "Final-year project on GP appointment reminders.",
  "The question was whether sending the reminder 3 hours before an appointment",
  "cut missed appointments compared with sending it 24 hours before.",
  "Two practices in Leeds took part over six weeks in spring 2026.",
];
const METHOD = [
  "I cleaned 14,200 appointment records from the two practices in Python with pandas.",
  "Each appointment was assigned to the 24-hour or the 3-hour reminder at random.",
  "I fitted a logistic regression with age group and practice as controls.",
  "The practice manager checked the extract before it left the surgery.",
];
const RESULTS = [
  "Missed appointments fell from 7.9% to 6.5% across all patients.",
  "For patients under 30 they fell from 11.2% to 8.4%.",
  "Next time I would run the trial for a full term, to cover the winter months.",
];

/** A bar chart in vector shapes: axes, gridlines, four bars with their values and labels. */
function chartPage() {
  const x0 = 100;
  const y0 = 440;
  const top = 700;
  const max = 12;
  const scale = (top - y0) / max;
  const bars = [
    { label: "All, 24h", value: 7.9, fill: "0.310 0.914 0.706" },
    { label: "All, 3h", value: 6.5, fill: "0 0.459 0.365" },
    { label: "Under 30, 24h", value: 11.2, fill: "0.310 0.914 0.706" },
    { label: "Under 30, 3h", value: 8.4, fill: "0 0.459 0.365" },
  ];
  const ops = [heading("Figure 1. Missed appointments by reminder time (%)", 770)];
  // Gridlines and their tick labels.
  for (let v = 0; v <= max; v += 3) {
    const y = y0 + v * scale;
    ops.push(`0.85 0.85 0.85 RG 0.5 w ${x0} ${y.toFixed(1)} m 520 ${y.toFixed(1)} l S`);
    ops.push(`BT /F1 9 Tf ${x0 - 22} ${(y - 3).toFixed(1)} Td (${v}) Tj ET`);
  }
  // Axes.
  ops.push(`0 0 0 RG 1.2 w ${x0} ${y0} m 520 ${y0} l S ${x0} ${y0} m ${x0} ${top} l S`);
  bars.forEach((b, i) => {
    const x = x0 + 25 + i * 100;
    const h = b.value * scale;
    ops.push(`${b.fill} rg ${x} ${y0} 60 ${h.toFixed(1)} re f`);
    ops.push(`0 0 0 rg BT /F1 10 Tf ${x + 18} ${(y0 + h + 6).toFixed(1)} Td (${b.value}) Tj ET`);
    ops.push(`BT /F1 9 Tf ${x} ${y0 - 16} Td (${esc(b.label)}) Tj ET`);
  });
  ops.push(textBlock(["Source: practice records, 14,200 appointments, March to April 2026."], 400, 60, 9));
  ops.push(textBlock(["The 3-hour reminder lowered missed appointments in both groups,", "and most for patients under 30."], 360));
  return ops.join("\n");
}

/** A method diagram in vector shapes: four boxes joined by arrows, with a title and a line of text under it. */
function diagramPage() {
  const steps = ["Clean the records", "Assign reminders", "Fit the model", "Check with practice"];
  const ops = [heading("Figure 1. How the study was run", 770)];
  steps.forEach((label, i) => {
    const x = 60 + i * 122;
    ops.push(`0.93 0.98 0.96 rg 0 0.459 0.365 RG 1.2 w ${x} 640 104 60 re B`);
    ops.push(`0 0 0 rg BT /F1 9 Tf ${x + 8} 667 Td (${esc(label)}) Tj ET`);
    if (i < steps.length - 1) {
      const from = x + 104;
      ops.push(`0 0 0 RG 1.2 w ${from} 670 m ${from + 18} 670 l S`);
      ops.push(`0 0 0 rg ${from + 18} 674 m ${from + 18} 666 l ${from + 24} 670 l f`);
    }
  });
  ops.push(textBlock(["Each appointment went through these four steps in order."], 600));
  return ops.join("\n");
}

const pages = {
  withChart: [
    [heading("GP appointment reminders", 790), textBlock(INTRO, 760)].join("\n"),
    [heading("Method", 790), textBlock(METHOD, 760)].join("\n"),
    chartPage(),
    [heading("Results", 790), textBlock(RESULTS, 760)].join("\n"),
  ],
  withDiagram: [
    [heading("GP appointment reminders", 790), textBlock(INTRO, 760)].join("\n"),
    diagramPage(),
    [heading("Method", 790), textBlock(METHOD, 760)].join("\n"),
    [heading("Results", 790), textBlock(RESULTS, 760)].join("\n"),
  ],
  textOnly: [
    [heading("GP appointment reminders", 790), textBlock(INTRO, 760)].join("\n"),
    [heading("Method", 790), textBlock(METHOD, 760)].join("\n"),
    [heading("Results", 790), textBlock(RESULTS, 760)].join("\n"),
  ],
};

/** A PDF with one page per content stream, Helvetica and Helvetica-Bold, offsets computed. */
function pdf(streams) {
  const n = streams.length;
  // 1 catalog, 2 pages, 3 font, 4 bold font, then a page and its contents per page.
  const pageId = (i) => 5 + i * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${streams.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${n} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  streams.forEach((s, i) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${pageId(i) + 1} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`);
    objects.push(`<< /Length ${Buffer.byteLength(s, "latin1")} >>\nstream\n${s}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/* ---------------- A scan: pages that are pictures, with no text behind them ---------------- */

const SW = 300;
const SH = 424;

/** A white picture of a page, and a way to paint rectangles on it. */
function picture() {
  const px = Buffer.alloc(SW * SH * 3, 255);
  const rect = (x, y, w, h, [r, g, b]) => {
    for (let j = Math.max(0, y); j < Math.min(SH, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(SW, x + w); i++) px.set([r, g, b], (j * SW + i) * 3);
    }
  };
  return { px, rect };
}

/** Grey bars where the lines of a page of text would be. */
function scannedText() {
  const p = picture();
  p.rect(30, 30, 150, 8, [40, 40, 40]);
  for (let line = 0; line < 22; line++) p.rect(30, 56 + line * 14, 240 - ((line * 37) % 70), 5, [120, 120, 120]);
  return p.px;
}

/** A bar chart: two axes and four bars, with a few grey lines of "text" under it. */
function scannedChart() {
  const p = picture();
  p.rect(30, 28, 170, 8, [40, 40, 40]);
  p.rect(48, 60, 2, 150, [0, 0, 0]);
  p.rect(48, 208, 210, 2, [0, 0, 0]);
  [79, 65, 112, 84].forEach((h, i) => p.rect(66 + i * 48, 208 - h, 30, h, i % 2 ? [0, 117, 93] : [79, 233, 180]));
  for (let line = 0; line < 8; line++) p.rect(30, 250 + line * 14, 230 - ((line * 29) % 60), 5, [120, 120, 120]);
  return p.px;
}

/** A PDF whose every page is one picture filling the page: no fonts, no text. */
function scanPdf(pictures) {
  const n = pictures.length;
  // 1 catalog, 2 pages, then a page, its contents and its picture per page.
  const pageId = (i) => 3 + i * 3;
  const chunks = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [];
  let length = chunks[0].length;
  const add = (body) => {
    offsets.push(length);
    const obj = Buffer.concat([Buffer.from(`${offsets.length} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    chunks.push(obj);
    length += obj.length;
  };
  const text = (s) => Buffer.from(s, "latin1");
  add(text("<< /Type /Catalog /Pages 2 0 R >>"));
  add(text(`<< /Type /Pages /Kids [${pictures.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${n} >>`));
  pictures.forEach((px, i) => {
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im1 Do Q`;
    const data = deflateSync(px);
    add(text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${pageId(i) + 1} 0 R /Resources << /XObject << /Im1 ${pageId(i) + 2} 0 R >> >> >>`));
    add(text(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    add(
      Buffer.concat([
        text(`<< /Type /XObject /Subtype /Image /Width ${SW} /Height ${SH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`),
        data,
        text("\nendstream"),
      ]),
    );
  });
  const xref = length;
  let tail = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  tail += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  tail += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.concat([...chunks, text(tail)]);
}

writeFileSync(join(here, "report-with-chart.pdf"), pdf(pages.withChart));
writeFileSync(join(here, "report-text-only.pdf"), pdf(pages.textOnly));
writeFileSync(join(here, "report-with-diagram.pdf"), pdf(pages.withDiagram));
writeFileSync(join(here, "scan-report.pdf"), scanPdf([scannedText(), scannedChart()]));
console.log("Wrote report-with-chart.pdf, report-text-only.pdf, report-with-diagram.pdf and scan-report.pdf");
