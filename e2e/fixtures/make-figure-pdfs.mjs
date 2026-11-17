// Makes the PDFs the auto-figure tests upload (e2e/auto-figure.spec.ts, decision 0017):
//
//   report-with-chart.pdf  four A4 pages: text, text, a bar chart drawn with vector shapes, text
//   report-text-only.pdf   three A4 pages of text and nothing else
//
// Run `node e2e/fixtures/make-figure-pdfs.mjs` to rebuild them. The PDFs are committed so the
// tests read the same bytes every time; this script is how they were made. No dependencies:
// the file is written by hand, with the cross-reference offsets worked out here.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const pages = {
  withChart: [
    [heading("GP appointment reminders", 790), textBlock(INTRO, 760)].join("\n"),
    [heading("Method", 790), textBlock(METHOD, 760)].join("\n"),
    chartPage(),
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

writeFileSync(join(here, "report-with-chart.pdf"), pdf(pages.withChart));
writeFileSync(join(here, "report-text-only.pdf"), pdf(pages.textOnly));
console.log("Wrote report-with-chart.pdf and report-text-only.pdf");
