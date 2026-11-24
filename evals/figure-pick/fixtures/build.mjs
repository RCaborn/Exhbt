// Makes the reports the figure eval runs on (evals/figure-pick/README.md, decision 0025), and
// cases.json: for each report, the page its key figure is on, what kind it is, and the figure's
// true box on that page.
//
//   npm run eval:figures:fixtures
//
// Each report is a web page laid out as fixed-size sheets and printed to PDF by headless Chromium
// (Playwright's, already a dev dependency), so the PDFs are the kind a student exports from Word,
// Google Docs or PowerPoint: real fonts, text as text, charts as vector shapes, pasted charts as
// pictures. Because every sheet is one PDF page of a known size, the true box is measured from
// the page itself: the smallest box round everything the figure draws (its title, plot, axes and
// legend), in fractions of the page. A caption or source line under the figure is left outside
// the true box: a cut may hold it or not.
//
// The PDFs and cases.json are committed, so every run reads the same bytes. Chromium stamps the
// time into a PDF, so a rebuild changes the bytes but not the pages. Every person, place and
// result in them is made up.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { getDocumentProxy } from "unpdf";

const here = dirname(fileURLToPath(import.meta.url));
const A4 = { w: 794, h: 1123 };
const SLIDE = { w: 1280, h: 720 };

/* ---------------- Charts, drawn as SVG ---------------- */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BLUE = "#1f77b4";
const ORANGE = "#ff7f0e";
const GREEN = "#2ca02c";
const GREY = "#7f7f7f";

/** Bars, one group per category, with gridlines, a value on each bar, axis titles and a legend when there is more than one series. */
function barChart({ w = 520, h = 320, title, yTitle = "", xTitle = "", cats, series, max, step, font = "inherit", size = 12 }) {
  const m = { top: title ? 44 : 14, right: 14, bottom: xTitle ? 58 : 40, left: yTitle ? 62 : 44 };
  const legend = series.length > 1;
  if (legend) m.top += 22;
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;
  const y = (v) => m.top + ph - (v / max) * ph;
  const group = pw / cats.length;
  const bw = Math.min(46, (group * 0.72) / series.length);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${font}" font-size="${size}">`];
  if (title) out.push(`<text x="${w / 2}" y="18" text-anchor="middle" font-size="${size + 2}" font-weight="bold">${esc(title)}</text>`);
  if (legend) {
    let lx = m.left;
    series.forEach((s) => {
      out.push(`<rect x="${lx}" y="${m.top - 22}" width="12" height="12" fill="${s.colour}"/>`);
      out.push(`<text x="${lx + 17}" y="${m.top - 12}">${esc(s.name)}</text>`);
      lx += 30 + s.name.length * size * 0.56;
    });
  }
  for (let v = 0; v <= max + 1e-9; v += step) {
    out.push(`<line x1="${m.left}" y1="${y(v)}" x2="${m.left + pw}" y2="${y(v)}" stroke="#d9d9d9" stroke-width="1"/>`);
    out.push(`<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${Number(v.toFixed(2))}</text>`);
  }
  out.push(`<line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + ph}" stroke="#222" stroke-width="1.5"/>`);
  out.push(`<line x1="${m.left}" y1="${m.top + ph}" x2="${m.left + pw}" y2="${m.top + ph}" stroke="#222" stroke-width="1.5"/>`);
  cats.forEach((c, i) => {
    const gx = m.left + group * i + (group - bw * series.length) / 2;
    series.forEach((s, k) => {
      const v = s.values[i];
      out.push(`<rect x="${gx + bw * k}" y="${y(v)}" width="${bw - 3}" height="${m.top + ph - y(v)}" fill="${s.colour}"/>`);
      out.push(`<text x="${gx + bw * k + (bw - 3) / 2}" y="${y(v) - 5}" text-anchor="middle" font-size="${size - 1}">${v}</text>`);
    });
    out.push(`<text x="${m.left + group * i + group / 2}" y="${m.top + ph + 18}" text-anchor="middle">${esc(c)}</text>`);
  });
  if (xTitle) out.push(`<text x="${m.left + pw / 2}" y="${h - 10}" text-anchor="middle">${esc(xTitle)}</text>`);
  if (yTitle) out.push(`<text transform="translate(16 ${m.top + ph / 2}) rotate(-90)" text-anchor="middle">${esc(yTitle)}</text>`);
  out.push("</svg>");
  return out.join("");
}

/** Lines over an ordered axis, with markers, gridlines, axis titles and a legend. */
function lineChart({ w = 540, h = 320, title, yTitle = "", xTitle = "", xs, series, max, step, font = "inherit", size = 12 }) {
  const m = { top: (title ? 44 : 14) + 22, right: 18, bottom: xTitle ? 58 : 40, left: yTitle ? 64 : 46 };
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;
  const x = (i) => m.left + (pw * i) / (xs.length - 1);
  const y = (v) => m.top + ph - (v / max) * ph;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${font}" font-size="${size}">`];
  if (title) out.push(`<text x="${w / 2}" y="18" text-anchor="middle" font-size="${size + 2}" font-weight="bold">${esc(title)}</text>`);
  let lx = m.left;
  series.forEach((s) => {
    out.push(`<line x1="${lx}" y1="${m.top - 16}" x2="${lx + 22}" y2="${m.top - 16}" stroke="${s.colour}" stroke-width="2.5"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`);
    out.push(`<text x="${lx + 28}" y="${m.top - 12}">${esc(s.name)}</text>`);
    lx += 44 + s.name.length * size * 0.56;
  });
  for (let v = 0; v <= max + 1e-9; v += step) {
    out.push(`<line x1="${m.left}" y1="${y(v)}" x2="${m.left + pw}" y2="${y(v)}" stroke="#d9d9d9" stroke-width="1"/>`);
    out.push(`<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
  }
  out.push(`<line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + ph}" stroke="#222" stroke-width="1.5"/>`);
  out.push(`<line x1="${m.left}" y1="${m.top + ph}" x2="${m.left + pw}" y2="${m.top + ph}" stroke="#222" stroke-width="1.5"/>`);
  xs.forEach((label, i) => out.push(`<text x="${x(i)}" y="${m.top + ph + 18}" text-anchor="middle">${esc(label)}</text>`));
  series.forEach((s) => {
    out.push(`<polyline fill="none" stroke="${s.colour}" stroke-width="2.5"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""} points="${s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>`);
    s.values.forEach((v, i) => out.push(`<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.colour}"/>`));
  });
  if (xTitle) out.push(`<text x="${m.left + pw / 2}" y="${h - 10}" text-anchor="middle">${esc(xTitle)}</text>`);
  if (yTitle) out.push(`<text transform="translate(16 ${m.top + ph / 2}) rotate(-90)" text-anchor="middle">${esc(yTitle)}</text>`);
  out.push("</svg>");
  return out.join("");
}

/** Boxes joined by arrows, left to right: a method or a system. `rows` wraps them onto more than one row. */
function flowDiagram({ w = 560, boxW = 118, boxH = 54, gap = 28, steps, perRow = 4, font = "inherit", size = 12, fill = "#eef3f8", stroke = "#34495e" }) {
  const rows = Math.ceil(steps.length / perRow);
  const h = rows * boxH + (rows - 1) * 34 + 8;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${font}" font-size="${size}">`];
  steps.forEach((label, i) => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const x = 4 + c * (boxW + gap);
    const y = 4 + r * (boxH + 34);
    out.push(`<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
    const lines = label.split("\n");
    lines.forEach((line, k) => out.push(`<text x="${x + boxW / 2}" y="${y + boxH / 2 + 4 + (k - (lines.length - 1) / 2) * (size + 3)}" text-anchor="middle">${esc(line)}</text>`));
    if (i < steps.length - 1 && c < perRow - 1) {
      const ax = x + boxW;
      const ay = y + boxH / 2;
      out.push(`<line x1="${ax + 3}" y1="${ay}" x2="${ax + gap - 9}" y2="${ay}" stroke="${stroke}" stroke-width="1.5"/>`);
      out.push(`<polygon points="${ax + gap - 9},${ay - 5} ${ax + gap - 9},${ay + 5} ${ax + gap - 1},${ay}" fill="${stroke}"/>`);
    }
  });
  out.push("</svg>");
  return out.join("");
}

/** A campaign poster, to be pasted in as a picture. */
const poster = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594" viewBox="0 0 420 594" font-family="Liberation Sans, Arial, sans-serif">
    <rect width="420" height="594" fill="#16324f"/>
    <circle cx="330" cy="120" r="150" fill="#f2a541"/>
    <circle cx="70" cy="520" r="120" fill="#2a628f"/>
    <rect x="34" y="40" width="88" height="8" fill="#f2a541"/>
    <text x="34" y="250" font-size="54" font-weight="bold" fill="#ffffff">NOT JUST</text>
    <text x="34" y="310" font-size="54" font-weight="bold" fill="#ffffff">FOR</text>
    <text x="34" y="370" font-size="54" font-weight="bold" fill="#f2a541">LAWYERS.</text>
    <text x="34" y="420" font-size="19" fill="#ffffff">Mooting, debates and socials for every course.</text>
    <text x="34" y="500" font-size="22" font-weight="bold" fill="#ffffff">Freshers' Fair, stall 14</text>
    <text x="34" y="530" font-size="17" fill="#ffffff">Monday 21 September, the Great Hall</text>
    <text x="34" y="566" font-size="15" fill="#d6e2ee">Hallam Law Society</text>
  </svg>`;

/** A university crest and name: a logo on a cover page. */
const crest = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="96" viewBox="0 0 300 96" font-family="Caladea, Cambria, serif">
    <path d="M8 8 h64 v40 c0 22 -14 34 -32 40 c-18 -6 -32 -18 -32 -40 z" fill="#7a1f2b"/>
    <path d="M40 16 v64" stroke="#f0d9a8" stroke-width="3"/>
    <path d="M14 40 h52" stroke="#f0d9a8" stroke-width="3"/>
    <circle cx="26" cy="27" r="6" fill="#f0d9a8"/>
    <circle cx="54" cy="27" r="6" fill="#f0d9a8"/>
    <rect x="21" y="52" width="10" height="14" fill="#f0d9a8"/>
    <rect x="49" y="52" width="10" height="14" fill="#f0d9a8"/>
    <text x="92" y="44" font-size="26" font-weight="bold" fill="#7a1f2b">University of</text>
    <text x="92" y="76" font-size="26" font-weight="bold" fill="#7a1f2b">Northfield</text>
  </svg>`;

/* ---------------- Pages ---------------- */

const p = (...paras) => paras.map((t) => `<p>${t}</p>`).join("");
const h1 = (t) => `<h1>${esc(t)}</h1>`;
const h2 = (t) => `<h2>${esc(t)}</h2>`;
/** A figure as a report has it: the drawing, measured as the true box when `truth`, and a caption under it, left outside the box. */
const figure = (drawing, caption, { truth = false, align = "center" } = {}) =>
  `<figure style="text-align:${align}"><span class="drawing"${truth ? " data-truth" : ""}>${drawing}</span>${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
const footer = (text, n) => `<div class="foot"><span>${esc(text)}</span><span>${n}</span></div>`;

const REPORT_CSS = `
  .page { padding: 76px 82px 70px; font: 15px/1.55 Carlito, Calibri, "Liberation Sans", sans-serif; color: #1a1a1a; }
  h1 { font-size: 25px; margin: 0 0 6px; line-height: 1.25; }
  h2 { font-size: 18px; margin: 20px 0 6px; }
  p { margin: 0 0 11px; text-align: left; }
  .meta { color: #444; margin-bottom: 18px; }
  figure { margin: 16px 0 14px; }
  .drawing { display: inline-block; line-height: 0; }
  figcaption { font-size: 13px; color: #333; margin-top: 7px; line-height: 1.4; }
  table.results { border-collapse: collapse; font-size: 13.5px; line-height: 1.4; margin: 0 auto; }
  table.results caption { font-weight: bold; padding-bottom: 8px; font-size: 14px; }
  table.results th, table.results td { border: 1px solid #555; padding: 6px 13px; text-align: right; }
  table.results th:first-child, table.results td:first-child { text-align: left; }
  table.results thead th { background: #e8edf2; }
  .foot { position: absolute; left: 82px; right: 82px; bottom: 34px; display: flex; justify-content: space-between; font-size: 12px; color: #555; }
`;

/* ---------------- The reports ---------------- */

const reminders = {
  intro: [
    h1("Does a later text reminder cut missed GP appointments?"),
    `<p class="meta">Priya Nair · BSc Health Data Science, final-year project · Calder University · May 2026</p>`,
    h2("1. Introduction"),
    p(
      "Missed appointments cost general practice time that could go to other patients. Most practices in England send a text reminder the day before. Some patients say that a reminder a day ahead is easy to forget, and that one sent on the day itself would be more use.",
      "This project asked a narrow question: does moving the reminder from 24 hours before an appointment to 3 hours before reduce the share of appointments that are missed? Two practices in Leeds agreed to take part for six weeks in spring 2026.",
      "Earlier studies of reminder timing looked at hospital outpatient clinics, where appointments are booked months ahead. General practice is different: most appointments are booked within a week, and many on the same day. A patient who booked yesterday may not need reminding tomorrow, but may still forget by the afternoon.",
      "The rest of this report sets out how the trial was run, what the appointment records show, and what the two practices decided to do next.",
    ),
  ],
  method: [
    h2("2. Method"),
    p(
      "The practices shared an extract of 14,200 appointment records, with names and NHS numbers removed before it left the surgery. Each record held the time of the appointment, the age band of the patient, the practice, the time the reminder was sent and whether the patient attended.",
      "Each appointment was assigned to the 24-hour reminder or the 3-hour reminder at random by the booking system. Same-day appointments booked less than 3 hours ahead got no reminder and were left out of the analysis, which removed 1,930 records.",
      "I cleaned the extract in Python with pandas, then fitted a logistic regression of attendance on reminder time, with age band and practice as controls. The practice manager at each site checked a sample of 50 records against the booking system to confirm the extract was right.",
      "The main measure is the share of appointments missed, in percent, compared between the two reminder times. I report it for all patients and for patients under 30, the group both practices said missed the most appointments.",
    ),
  ],
  results: (chart) => [
    h2("3. Results"),
    p("Missed appointments were lower with the 3-hour reminder in both groups. Across all patients the share missed fell from 7.9% to 6.5%. For patients under 30 it fell from 11.2% to 8.4%. Figure 1 shows both comparisons."),
    figure(chart, "Figure 1. Share of appointments missed, by reminder time. Source: practice records, 12,270 appointments, March to April 2026.", { truth: true }),
    p(
      "The regression gives the same picture. With age band and practice held fixed, an appointment with the 3-hour reminder was less likely to be missed than one with the 24-hour reminder (odds ratio 0.81, 95% confidence interval 0.71 to 0.93).",
      "The difference between the two practices was small and not significant, so the result does not seem to depend on one site.",
    ),
  ],
  discussion: [
    h2("4. Discussion"),
    p(
      "A reminder sent 3 hours before an appointment was followed by fewer missed appointments than one sent the day before, and the gain was largest for patients under 30. The effect is modest, but it costs nothing to make: the booking system already sends the text, and only its timing changes.",
      "There are limits. Six weeks in spring say nothing about winter, when illness and weather change who attends. Two practices in one city are not the country. And appointments booked less than 3 hours ahead could not be included at all.",
      "Both practices have kept the 3-hour reminder. Next I would run the trial for a full year across more practices, and test whether sending both reminders does better than either one alone.",
    ),
  ],
};
const remindersChart = () =>
  barChart({
    title: "Missed appointments by reminder time",
    yTitle: "Appointments missed (%)",
    cats: ["All patients", "Patients under 30"],
    series: [
      { name: "24-hour reminder", colour: BLUE, values: [7.9, 11.2] },
      { name: "3-hour reminder", colour: ORANGE, values: [6.5, 8.4] },
    ],
    max: 12,
    step: 3,
  });

/** Every report: its sheets, their size, and where its key figure is (null when it has none). */
function reports({ bitmapChart, posterPng }) {
  const report = (pages, foot) => pages.map((body, i) => `<section class="page">${body.join("")}${foot ? footer(foot, i + 1) : ""}</section>`);
  return [
    {
      id: "01-bar-chart",
      what: "A four-page report with one bar chart of the results on page 3, drawn in vector shapes.",
      size: A4,
      css: REPORT_CSS,
      pages: report([reminders.intro, reminders.method, reminders.results(remindersChart()), reminders.discussion], "P. Nair · Reminder timing and missed appointments"),
      expect: { page: 3, kind: "graph" },
    },
    {
      id: "02-line-chart",
      what: "A three-page report with a line chart of two series over eight weeks on page 2.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("Did a shorter sign-up form keep new members using the society app?"),
            `<p class="meta">Tomasz Zielinski · BSc Computer Science, Year 2 group project · University of Kelham · March 2026</p>`,
            h2("Background"),
            p(
              "The Hiking Society's app lets members book places on trips. In autumn 2025 the committee found that many students who installed the app in Freshers' Week had stopped opening it a month later. Interviews with twelve members pointed at the sign-up form, which asked for fourteen fields before a student could see a single trip.",
              "Our group rebuilt the form so that it asks for a name and a university email address, and collects the rest when a member books a first trip. This report compares how many new members kept using the app under the old form and under the new one.",
              "We define a weekly active user as a member who opened the app at least once in a week. The society released the new form in January 2026, so the comparison is between the members who joined in the first week of the autumn term and those who joined in the first week of the spring term. The two groups were close in size: 212 and 198.",
            ),
          ],
          [
            h2("Results"),
            p("Figure 1 shows weekly active users for the eight weeks after each group joined. Both groups start near 200. Under the old form the number fell to 61 by week 8. Under the new form it fell more slowly, to 118."),
            figure(
              lineChart({
                title: "Weekly active users after joining",
                yTitle: "Weekly active users",
                xTitle: "Weeks since joining",
                xs: ["1", "2", "3", "4", "5", "6", "7", "8"],
                series: [
                  { name: "Old form (autumn)", colour: GREY, dash: "6 4", values: [204, 151, 122, 98, 84, 73, 66, 61] },
                  { name: "New form (spring)", colour: BLUE, values: [196, 171, 156, 143, 134, 127, 121, 118] },
                ],
                max: 250,
                step: 50,
              }),
              "Figure 1. Weekly active users in the eight weeks after joining, for members who joined under each form.",
              { truth: true },
            ),
            p(
              "By week 8, 60% of the spring group were still active, against 29% of the autumn group. The gap opens in the second week, which is when autumn members were first asked to finish the long form before booking.",
            ),
          ],
          [
            h2("What we would do next"),
            p(
              "The two groups joined in different terms, so the weather, the trips on offer and the time of year all differ. A fairer test would give half of one term's new members each form at random. The committee has agreed to do that in September.",
              "We would also look at bookings and not only at opening the app, since a member who opens the app and books nothing has not got much from it.",
              "The code for the new form is in the society's repository, with tests for each field and for the email check.",
            ),
          ],
        ],
        "Kelham Hiking Society app · sign-up form",
      ),
      expect: { page: 2, kind: "graph" },
    },
    {
      id: "03-results-table",
      what: "A three-page dissertation extract whose only figure is a table of regression results on page 3.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("Did the 2024 rise in the National Living Wage reduce the hours of young hospitality workers?"),
            `<p class="meta">Aisha Rahman · BSc Economics dissertation · Wessex University · April 2026</p>`,
            h2("1. Introduction"),
            p(
              "In April 2024 the National Living Wage rose by 9.8%, and for the first time it applied to workers aged 21 and 22. Hospitality employs more workers of that age than any other sector. Employers' groups warned that pubs and restaurants would cut hours in response.",
              "This dissertation tests that claim. It compares the weekly hours of hospitality workers aged 21 and 22, who were newly covered, with those of workers aged 23 to 25, who were covered already, before and after the change.",
              "The question matters for the Low Pay Commission, which must judge each year how far the wage floor can rise without costing jobs or hours. Most of the evidence it draws on comes from earlier, smaller rises.",
            ),
          ],
          [
            h2("2. Data and method"),
            p(
              "The data are from the Labour Force Survey, eight quarters from 2023 Q2 to 2025 Q1. The sample is 3,412 hospitality workers aged 21 to 25 who reported their usual weekly hours.",
              "I use a difference-in-differences design. The treated group is workers aged 21 and 22. The comparison group is workers aged 23 to 25. The estimate of interest is the change in usual weekly hours for the treated group after April 2024, less the change for the comparison group over the same period.",
              "The regression includes controls for sex, region, whether the worker is a full-time student, and quarter. Standard errors are clustered by region. The design rests on the two groups' hours moving in parallel before the change, which the four quarters of earlier data support.",
            ),
          ],
          [
            h2("3. Results"),
            p("Table 2 gives the estimates. The coefficient on the interaction term is the effect of the rise on the weekly hours of the newly covered workers."),
            `<figure style="text-align:center"><span class="drawing"><table class="results" data-truth>
              <caption>Table 2. Effect of the 2024 rise on usual weekly hours</caption>
              <thead><tr><th></th><th>Coefficient</th><th>Std. error</th><th>p-value</th></tr></thead>
              <tbody>
                <tr><td>Aged 21 to 22 × after April 2024</td><td>−0.42</td><td>0.51</td><td>0.41</td></tr>
                <tr><td>Aged 21 to 22</td><td>−1.87</td><td>0.38</td><td>&lt;0.001</td></tr>
                <tr><td>After April 2024</td><td>0.23</td><td>0.34</td><td>0.50</td></tr>
                <tr><td>Full-time student</td><td>−9.64</td><td>0.47</td><td>&lt;0.001</td></tr>
                <tr><td>Observations</td><td>3,412</td><td></td><td></td></tr>
                <tr><td>R²</td><td>0.31</td><td></td><td></td></tr>
              </tbody>
            </table></span><figcaption>Dependent variable: usual weekly hours. Controls for sex, region and quarter are included. Standard errors clustered by region.</figcaption></figure>`,
            p(
              "The estimated effect is a fall of 0.42 hours a week, with a standard error of 0.51. It is not statistically different from zero. The data give no sign that the rise reduced the hours of the workers it newly covered.",
              "The sample is small for a survey estimate, so a fall of up to about 1.4 hours cannot be ruled out. A fall as large as employers' groups predicted, of 3 hours or more, can be.",
            ),
          ],
        ],
        "A. Rahman · BSc Economics dissertation",
      ),
      expect: { page: 3, kind: "table" },
    },
    {
      id: "04-method-then-results",
      what: "A five-page lab report: a diagram of the method on page 2, the results chart on page 4. The results chart is the one to choose.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("How does infill density change the tensile strength of 3D-printed PLA?"),
            `<p class="meta">Callum Fraser · MEng Mechanical Engineering, Year 3 laboratory report · Strathmore University · February 2026</p>`,
            h2("1. Aim"),
            p(
              "Parts printed in PLA are rarely solid. The slicer fills the inside with a lattice, and the infill density sets how much of the inside is plastic. A denser part uses more material and takes longer to print. This report measures how much strength the extra material buys.",
              "The aim was to find the ultimate tensile strength of printed PLA specimens at 20%, 50% and 80% infill, and to see whether strength rises in proportion to the plastic used.",
              "Published figures for printed PLA vary widely, because strength depends on the printer, the filament, the layer height and the direction of the layers as well as on infill. Results from one printer are therefore a guide to that printer more than to the material.",
            ),
          ],
          [
            h2("2. Method"),
            p("Figure 1 shows the procedure. Fifteen dog-bone specimens were printed to ISO 527-2 type 1A, five at each infill density, on one printer from one reel of filament."),
            figure(flowDiagram({ steps: ["Print 15\nspecimens", "Condition\n48 hours", "Measure\ncross-section", "Tensile test\n5 mm/min", "Record peak\nload", "Calculate\nstrength"], perRow: 3, boxW: 150, gap: 40, w: 540 }), "Figure 1. Test procedure for each specimen.", {}),
            p(
              "Specimens were conditioned at 21 °C for 48 hours. The width and thickness of each gauge section were measured with a micrometer at three points, and the mean was used for the cross-sectional area.",
              "Each specimen was pulled to failure on a universal testing machine at 5 mm per minute. Ultimate tensile strength is the peak load divided by the original cross-sectional area. One specimen at 50% infill slipped in the grips and was printed and tested again.",
            ),
          ],
          [
            h2("3. Sources of error"),
            p(
              "The largest source of error is the cross-sectional area. The printed surface is ridged, so a micrometer reads the peaks of the ridges and overstates the area by an amount I estimate at 2%. This makes every strength slightly too low, by the same proportion.",
              "The load cell is calibrated to within 0.5% of reading. The spread between the five specimens at each density is larger than either of these, so the results are reported as a mean with the standard deviation of the five.",
              "All specimens were printed flat on the bed with the layers running along the length. Strength across the layers is known to be lower and was not measured here.",
            ),
          ],
          [
            h2("4. Results"),
            p("Mean ultimate tensile strength rose with infill density, from 28.4 MPa at 20% infill to 46.9 MPa at 80%. Figure 2 shows the mean of five specimens at each density."),
            figure(
              barChart({
                title: "Mean ultimate tensile strength by infill density",
                yTitle: "Tensile strength (MPa)",
                xTitle: "Infill density",
                cats: ["20%", "50%", "80%"],
                series: [{ name: "Mean of 5", colour: GREEN, values: [28.4, 37.1, 46.9] }],
                max: 50,
                step: 10,
                w: 480,
              }),
              "Figure 2. Mean ultimate tensile strength of five specimens at each infill density. Standard deviations: 1.6, 1.9 and 2.2 MPa.",
              { truth: true },
            ),
            p("Strength rose by 65% while the mass of the specimens rose by 118%. Strength per gram was therefore highest at 20% infill."),
          ],
          [
            h2("5. Conclusion"),
            p(
              "Raising infill from 20% to 80% made the specimens 65% stronger and more than twice as heavy. For a part that must simply not break, more infill helps. For a part where weight or print time matters, low infill gives the most strength for the plastic used.",
              "The shell of the part carries much of the load, which is why strength does not rise in proportion to infill. A useful next test would hold infill fixed and vary the number of shell layers.",
            ),
          ],
        ],
        "C. Fraser · PLA infill and tensile strength",
      ),
      expect: { page: 4, kind: "graph" },
    },
    {
      id: "05-three-charts",
      what: "A five-page report with three charts: the sample on page 2, the headline result on page 3 and a further check in an appendix on page 5. The headline result is the one to choose.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("Does a 10-minute walk before a test improve recall in first-year students?"),
            `<p class="meta">Megan Doyle · BSc Psychology final-year project · University of Ashby · March 2026</p>`,
            h2("1. Background"),
            p(
              "Exercise is known to lift mood and attention for a short time afterwards. Whether a short walk helps a student remember more in a test taken straight after it is less clear, and the studies that exist mostly used treadmills in laboratories.",
              "This project tested a walk a student could really take: ten minutes round the main quad, immediately before a word-list recall test.",
              "The hypothesis was that students who walk for 10 minutes before the test will recall more words than students who sit for the same time.",
            ),
            h2("2. Design"),
            p("The study used a between-groups design with two conditions, walking and sitting. Participants were assigned to a condition at random on arrival. The test was a list of 40 common nouns, shown for two minutes and recalled in writing after a one-minute delay."),
          ],
          [
            h2("3. Participants"),
            p("Forty-eight first-year undergraduates volunteered in response to posters in the halls of residence. All were aged 18 to 21. Figure 1 shows the course each was studying. No participant was a psychology student, to avoid anyone who had met the word-list task in a practical class."),
            figure(
              barChart({
                title: "Participants by subject area",
                yTitle: "Participants",
                cats: ["Sciences", "Humanities", "Business", "Engineering"],
                series: [{ name: "n", colour: GREY, values: [14, 13, 11, 10] }],
                max: 16,
                step: 4,
                w: 470,
                h: 270,
              }),
              "Figure 1. Subject area of the 48 participants.",
            ),
            p(
              "Twenty-four participants were assigned to each condition. The two groups did not differ in age or in the number of hours they reported sleeping the night before.",
              "Each participant gave written consent and could withdraw at any point. The project was approved by the School of Psychology ethics committee.",
            ),
          ],
          [
            h2("4. Results"),
            p("The walking group recalled more words than the sitting group. This is the main finding of the study, and Figure 2 shows it. The walking group recalled a mean of 21.4 words out of 40, and the sitting group a mean of 19.1."),
            figure(
              barChart({
                title: "Mean words recalled by group",
                yTitle: "Words recalled (out of 40)",
                cats: ["Walked for 10 minutes", "Sat for 10 minutes"],
                series: [{ name: "Mean", colour: BLUE, values: [21.4, 19.1] }],
                max: 25,
                step: 5,
                w: 470,
              }),
              "Figure 2. Mean number of words recalled out of 40, by condition (n = 24 in each group).",
              { truth: true },
            ),
            p("An independent-samples t-test found the difference to be significant, t(46) = 2.1, p = .04. The effect is small to medium, d = 0.61. The hypothesis was supported."),
          ],
          [
            h2("5. Discussion"),
            p(
              "A ten-minute walk before a recall test was followed by slightly better recall than ten minutes of sitting. The size of the effect, a little over two words in forty, is in line with the laboratory studies.",
              "The study has clear limits. The participants were volunteers at one university, and people who answer a poster about walking may like walking. The test came straight after the walk, so the result says nothing about recall a day later, which is what matters for an exam.",
              "A second study should test recall after a delay, and compare a walk outdoors with a walk indoors, to separate the exercise from the change of scene.",
            ),
          ],
          [
            h2("Appendix B. Further checks"),
            p("The sessions ran in the morning and in the afternoon. As an exploratory check, not planned in advance, Figure B1 splits mean recall by the time of the session. The numbers in each cell are small, and no test was run on them."),
            figure(
              barChart({
                title: "Mean words recalled by time of session",
                yTitle: "Words recalled (out of 40)",
                cats: ["Morning", "Afternoon"],
                series: [
                  { name: "Walked", colour: BLUE, values: [21.9, 20.8] },
                  { name: "Sat", colour: ORANGE, values: [19.6, 18.7] },
                ],
                max: 25,
                step: 5,
                w: 470,
                h: 280,
              }),
              "Figure B1. Mean recall by condition and time of session (exploratory).",
            ),
            p("Recall was a little higher in the morning in both groups. The gap between walking and sitting was about the same at both times."),
          ],
        ],
        "M. Doyle · Walking and recall",
      ),
      expect: { page: 3, kind: "graph" },
    },
    {
      id: "06-bitmap-chart",
      what: "A three-page report whose results chart on page 2 is a picture pasted in, not vector shapes.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("Freshers' Week campaign for the Film Society"),
            `<p class="meta">Daniel Okafor · BA Marketing, Year 2 campaign module · University of Marlow · November 2025</p>`,
            h2("The brief"),
            p(
              "The Film Society asked for a campaign to raise sign-ups at the Freshers' Fair. Last year 86 students joined in Freshers' Week, and the committee wanted at least 120.",
              "Our group of four planned a two-week campaign: posters in the five halls of residence, a daily Instagram story in the week before the fair, and a short quiz at the stall with free tickets to the first screening as the prize.",
              "We had a budget of £150, which went on printing and on the tickets. The society's own members ran the stall and the Instagram account.",
            ),
            h2("What we did"),
            p("We tested two poster designs with 20 students in the library and printed the one more of them could describe a minute later. Stories went out at 6pm each day, the time the society's past posts had done best."),
          ],
          [
            h2("What happened"),
            p("Sign-ups in Freshers' Week rose from 86 last year to 141 this year. The chart below, from the society's membership spreadsheet, shows sign-ups on each day of the week in both years."),
            figure(`<img src="${bitmapChart.src}" width="${bitmapChart.width}" height="${bitmapChart.height}" data-truth alt="">`, "Sign-ups on each day of Freshers' Week, last year and this year (society membership records).", {}),
            p(
              "The largest gain was on Wednesday, the day of the fair, when 58 students joined against 31 last year. Thursday and Friday were also higher, which we put down to the quiz winners bringing friends to the first screening.",
              "Of the 141 new members, 97 said at the stall that they had seen a poster or a story before the fair.",
            ),
          ],
          [
            h2("What we would change"),
            p(
              "The posters went up on the Friday before Freshers' Week, after many students had already moved in. A week earlier would have reached them as they arrived.",
              "We counted sign-ups, not attendance. A stronger measure would be how many of the new members came to a screening in the first month, and the society has agreed to share that figure in December.",
              "The quiz worked well at the stall but needed three people to run it. A version on a tablet would free two of them to talk to students.",
            ),
          ],
        ],
        "Film Society campaign · Group 6",
      ),
      expect: { page: 2, kind: "graph" },
      truthIsElement: true,
    },
    {
      id: "07-two-column",
      what: "A two-page paper set in two columns, with a small figure in the right-hand column of page 1.",
      size: A4,
      css: `${REPORT_CSS}
        .page { padding: 64px 58px 60px; font: 12.6px/1.45 Caladea, Cambria, "DejaVu Serif", serif; }
        h1 { font-size: 21px; text-align: center; margin: 0 0 6px; }
        .authors { text-align: center; margin: 0 0 12px; color: #333; }
        .abstract { margin: 0 34px 16px; font-size: 12px; }
        h2 { font-size: 13.5px; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
        p { margin: 0 0 8px; text-align: justify; }
        figure { margin: 10px 0 10px; }
        figcaption { font-size: 11.5px; text-align: left; }`,
      pages: report(
        [
          [
            h1("Reading on paper and on screen: a small test of response time and accuracy"),
            `<p class="authors">Hannah Whitfield and Joseph Adeyemi · School of Education, University of Brancaster · Undergraduate research project, 2026</p>`,
            `<p class="abstract"><b>Abstract.</b> Thirty-six undergraduates read short passages on paper, on a laptop and on a phone, and answered comprehension questions after each. Accuracy did not differ between the three. Response time did: questions were answered more slowly after reading on a phone. We suggest that the cost of small screens is one of time more than of understanding.</p>`,
            `<div class="cols"><div>
              ${h2("1. Introduction")}
              ${p(
                "Students now do much of their reading on screens, and a good deal of it on phones. Reviews of the research report a small advantage for paper in comprehension, but most of the studies compared paper with a desktop monitor, and few looked at phones at all.",
                "Small screens show fewer words at once, so a reader must scroll more and hold more of the passage in mind. If that has a cost, it may show in how long a reader takes to answer as well as in whether the answer is right.",
                "This study compares paper, laptop and phone within the same readers, and measures both accuracy and the time taken to answer.",
              )}
              ${h2("2. Method")}
              ${p(
                "Thirty-six undergraduates took part. Each read three passages of about 400 words, one in each medium, and answered six multiple-choice questions after each passage. The order of the media and the pairing of passage with medium were counterbalanced.",
                "Questions were answered on a tablet that recorded the time from the question appearing to the answer being chosen. The passages were matched for length and for reading ease.",
              )}
            </div><div>
              ${h2("3. Results")}
              ${p("Mean accuracy was 4.6 questions out of 6 on paper, 4.5 on a laptop and 4.4 on a phone. A repeated-measures ANOVA found no effect of medium on accuracy, F(2, 70) = 0.62, p = .54.")}
              ${figure(
                barChart({
                  yTitle: "Mean response time (s)",
                  cats: ["Paper", "Laptop", "Phone"],
                  series: [{ name: "Mean", colour: "#555555", values: [8.2, 8.6, 10.1] }],
                  max: 12,
                  step: 4,
                  w: 300,
                  h: 190,
                  size: 10.5,
                }),
                "Fig. 1. Mean time to answer a question after reading in each medium.",
                { truth: true },
              )}
              ${p(
                "Response time did differ, F(2, 70) = 7.9, p < .001. As Fig. 1 shows, questions were answered in a mean of 8.2 s after reading on paper, 8.6 s after a laptop and 10.1 s after a phone. Paired comparisons found the phone slower than both of the others, which did not differ from each other.",
                "The slower answers after reading on a phone were not more accurate, so the extra time does not look like extra care.",
              )}
            </div></div>`,
          ],
          [
            `<div class="cols"><div>
              ${h2("4. Discussion")}
              ${p(
                "Readers understood a short passage as well on a phone as on paper, but took about two seconds longer to answer each question about it. One reading is that the passage was held less firmly in mind after reading on a small screen, so that answers took longer to retrieve.",
                "The passages were short. A textbook chapter read on a phone might show a cost in accuracy that 400 words did not. The questions were also multiple choice, which gives the reader the answer to recognise; questions that ask a reader to recall would be a harder test.",
                "The participants were volunteers from one school of one university, and all were used to reading on phones. Older readers, or readers less used to small screens, might differ.",
              )}
            </div><div>
              ${h2("5. Conclusion")}
              ${p(
                "For short passages, the medium made no difference to how much students understood, and a small difference to how quickly they could show it. Advice to students to print their reading may matter less than advice to give phone reading more time.",
                "A follow-up should use longer texts, recall questions, and a measure of how often readers scroll back.",
              )}
              ${h2("Acknowledgements")}
              ${p("We thank the thirty-six students who gave up an hour, and Dr Ellen Marsh for supervising the project.")}
            </div></div>`,
          ],
        ],
        "",
      ),
      expect: { page: 1, kind: "graph" },
    },
    {
      id: "08-text-only",
      what: "A three-page history essay of plain text: no figure, and no page that draws anything but text.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("Why did the Chartist petition of 1848 fail?"),
            `<p class="meta">Eleanor Price · BA History, Year 2 essay · University of Dunmore · January 2026</p>`,
            p(
              "On 10 April 1848 the Chartists gathered on Kennington Common to carry a petition to Parliament. Its organisers claimed more than five million signatures. The government had sworn in tens of thousands of special constables and placed the Duke of Wellington in charge of the defence of London. By the evening the crowd had gone home in the rain, the petition had travelled to Westminster in three cabs, and the movement that had frightened the propertied classes for a decade was a subject for jokes.",
              "Historians have explained the failure in three ways. The first blames the leadership, and Feargus O'Connor above all, for losing its nerve. The second points to the strength of the state, which in 1848 was better prepared than it had been in 1839 or 1842. The third argues that the conditions that had fed Chartism were already passing, and that the petition failed because the movement behind it had begun to dissolve.",
              "This essay argues that the third explanation carries most weight, but that it cannot be separated from the second. The state did not only resist Chartism in 1848. Over the preceding years it had removed some of the grievances that gave Chartism its force.",
            ),
          ],
          [
            p(
              "The case against O'Connor is easy to make. He agreed to the government's demand that the procession should not cross the river, and he told the crowd to disperse. When the Commons clerks reported that the petition held fewer than two million genuine signatures, and that these included the names of the Queen and of Mr Punch, he had no answer. Contemporaries on the left of the movement never forgave him.",
              "Yet it is hard to see what else he could have done. The procession would have met armed troops at the bridges. The Chartists had no plan for an insurrection and no means to carry one out. O'Connor's caution on the day followed from the weakness of his position and was not its cause.",
              "The strength of the state is better supported. The railway and the electric telegraph allowed troops to be moved and orders to be sent faster than in earlier crises. The new police forces gave the authorities a means of control short of the army. The special constables, drawn largely from the middle classes and from respectable working men, showed that property stood together.",
            ),
          ],
          [
            p(
              "But the deeper change was economic and political. The repeal of the Corn Laws in 1846 took away the plainest symbol of a Parliament that legislated for landlords. The Ten Hours Act of 1847 suggested that an unreformed Commons could, after all, be moved on behalf of factory workers. Trade recovered from the depression of the early 1840s. A movement that had argued that nothing could improve without the vote found that some things had improved without it.",
              "Chartism did not vanish in 1848. Its ideas passed into trade unionism, into the co-operative movement and into popular Liberalism, and five of its six points became law within seventy years. As a mass movement able to alarm the state, however, it ended on Kennington Common.",
              "The petition failed, then, because the government was ready and the Chartists were not. But the government was ready partly because it had spent the years since 1842 giving ground on other questions, and the Chartists were not ready because that ground had been enough to thin their ranks. The failure of 1848 was prepared in 1846 and 1847.",
            ),
          ],
        ],
        "",
      ),
      expect: null,
    },
    {
      id: "09-cover-logo",
      what: "A cover page with a university crest and a ruled title, then two pages of text: no figure, though the cover draws shapes.",
      size: A4,
      css: `${REPORT_CSS}
        .cover { text-align: center; padding-top: 150px; }
        .cover h1 { font-size: 30px; margin: 44px 40px 14px; }
        .cover hr { border: 0; border-top: 3px solid #7a1f2b; width: 220px; margin: 26px auto; }
        .cover .who { font-size: 17px; line-height: 1.8; }`,
      pages: report(
        [
          [
            `<div class="cover">${crest()}<hr><h1>The effect of remote working on the commuting habits of Northfield residents</h1><hr>
              <p class="who">Oliver Bennett<br>BA Geography<br>Independent study module GEO3040<br>Supervisor: Dr Ruth Calloway<br>May 2026</p></div>`,
          ],
          [
            h2("1. Introduction"),
            p(
              "Before 2020, about one in twenty workers in Northfield worked mainly from home. The council's travel survey of 2025 suggests that the figure is now closer to one in five, with as many again working from home on some days of the week. This study asks what that has done to the journeys people make.",
              "The common assumption is that remote working reduces travel. A worker at home does not commute. But people who no longer commute may make other journeys instead: to shops, to a gym, to collect children. They may also move further from their workplace, so that the commutes they still make are longer.",
              "I interviewed twenty residents who had moved to working from home for at least three days a week, and asked them to describe a typical week of travel before and after the change.",
            ),
            h2("2. Approach"),
            p(
              "The interviews were semi-structured and lasted about forty minutes. Residents were recruited through two neighbourhood groups and the university's staff newsletter. The sample is not representative: it is older and better paid than the town as a whole.",
              "Each interview was recorded and transcribed, and the transcripts were coded for the kinds of journey described and the reasons given for them.",
            ),
          ],
          [
            h2("3. What residents said"),
            p(
              "Almost all of those interviewed travelled less in total. None, however, had simply removed the commute and changed nothing else. Most described new short journeys on the days they worked at home, usually on foot or by bicycle, and several said these were journeys they would once have made by car on the way home from work.",
              "Four residents had moved house since they began working from home, in each case further from their workplace. All four said the longer commute was acceptable because they made it only once or twice a week.",
              "Several spoke of the town centre differently. One said that she now thought of it as somewhere to go in the day, where before it had been somewhere she passed through.",
            ),
            h2("4. Conclusion"),
            p(
              "Remote working has not only removed journeys in Northfield. It has replaced long journeys by car with short journeys on foot, and for a few it has made a longer commute tolerable. Transport planning that counts only commutes will miss both changes.",
            ),
          ],
        ],
        "",
      ),
      expect: null,
    },
    {
      id: "10-slides",
      what: "Five landscape slides exported to PDF, with the results chart on slide 4. The chart is the figure, not the whole slide.",
      size: SLIDE,
      css: `
        .page { padding: 0; font: 26px/1.4 "Liberation Sans", Arial, sans-serif; color: #1b1b1b; background: #ffffff; }
        .bar { position: absolute; left: 0; top: 0; width: 100%; height: 22px; background: #0b5c7a; }
        .inner { position: absolute; left: 72px; right: 72px; top: 64px; bottom: 60px; }
        h1 { font-size: 58px; margin: 150px 0 20px; line-height: 1.15; color: #0b5c7a; }
        h2 { font-size: 40px; margin: 0 0 26px; color: #0b5c7a; }
        ul { margin: 0; padding-left: 34px; }
        li { margin-bottom: 16px; }
        .sub { font-size: 26px; color: #444; }
        .row { display: flex; gap: 40px; align-items: flex-start; }
        .drawing { display: inline-block; line-height: 0; }
        .note { font-size: 22px; flex: 1; }
        .slidefoot { position: absolute; left: 72px; right: 72px; bottom: 22px; font-size: 16px; color: #666; display: flex; justify-content: space-between; border-top: 2px solid #c9d6dc; padding-top: 8px; }`,
      pages: [
        ["<h1>Cutting the queue at the campus food bank</h1>", `<p class="sub">Service design project · Group 3 · BSc Business Management · University of Tavistock · December 2025</p>`],
        ["<h2>The problem</h2>", "<ul><li>The food bank opens two afternoons a week</li><li>Students queued for 34 minutes on average in October</li><li>Volunteers said most of the wait was at the sign-in desk</li><li>Some students left before reaching the front</li></ul>"],
        ["<h2>What we did</h2>", "<ul><li>Timed 120 visits over two weeks</li><li>Mapped each step from the door to the exit</li><li>Moved sign-in to a QR code on the door</li><li>Added a second packing table at the busiest hour</li></ul>"],
        [
          "<h2>Results: the wait fell by more than half</h2>",
          `<div class="row"><span class="drawing" data-truth>${barChart({
            title: "Average wait before and after the changes",
            yTitle: "Minutes",
            cats: ["Tuesday", "Thursday"],
            series: [
              { name: "October (before)", colour: "#9aa7ad", values: [36, 32] },
              { name: "November (after)", colour: "#0b5c7a", values: [15, 13] },
            ],
            max: 40,
            step: 10,
            w: 700,
            h: 440,
            size: 18,
            font: "Liberation Sans, Arial, sans-serif",
          })}</span><div class="note"><p>Average wait fell from 34 minutes to 14.</p><p>Nobody left the queue in the last two weeks of November.</p></div></div>`,
        ],
        ["<h2>Next steps</h2>", "<ul><li>Keep the QR sign-in and the second table</li><li>Time the queue again in February, when demand is highest</li><li>Ask students who used to leave whether they have come back</li></ul>"],
      ].map((body, i) => `<section class="page"><div class="bar"></div><div class="inner">${body.join("")}</div><div class="slidefoot"><span>Campus food bank · Group 3</span><span>${i + 1}</span></div></section>`),
      expect: { page: 4, kind: "graph" },
    },
    {
      id: "11-diagram-only",
      what: "A three-page software report whose only figure is a diagram of the system on page 2: a visual, but not a graph or a table.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("A booking system for the university climbing wall"),
            `<p class="meta">Yusuf Demir · BSc Software Engineering, Year 2 team project · University of Glenmoor · April 2026</p>`,
            h2("1. The problem"),
            p(
              "The climbing wall takes bookings by email. A member of staff reads each request, checks a spreadsheet for space, and replies. In term time the wall receives about ninety requests a week, and a reply can take a day. Climbers often turn up to find the session they asked for is full.",
              "Our team of five was asked to replace the email and the spreadsheet with a system that shows climbers which sessions have space and lets them book one themselves. Staff wanted to keep control of the timetable and to see who had booked.",
              "We agreed three requirements with the wall's manager: a climber can book a session in under a minute; a session can never be overbooked; and staff can cancel a session and tell everyone booked on it in one step.",
            ),
          ],
          [
            h2("2. Design"),
            p("Figure 1 shows the parts of the system and how they talk to each other. The climber's browser talks only to the web application, which is the one place that checks whether a session has space."),
            figure(flowDiagram({ steps: ["Climber's\nbrowser", "Web app\n(Django)", "Database\n(PostgreSQL)", "Email\nservice"], perRow: 4, boxW: 124, gap: 34, w: 610, fill: "#eaf5ee", stroke: "#2f6b45" }), "Figure 1. The parts of the booking system.", { truth: true }),
            p(
              "A booking is made inside a database transaction that locks the session's row, counts the places taken and inserts the booking only if there is space. Two climbers who press Book at the same moment are therefore handled one after the other, and the second is told the session is full.",
              "Emails are sent by a separate service through a queue. If the email service is down, bookings still work and the confirmations go out when it comes back.",
              "Staff sign in with their university accounts. Climbers use the same sign-in, so the system holds no passwords of its own.",
            ),
          ],
          [
            h2("3. Testing and what we learned"),
            p(
              "We wrote unit tests for the booking rules and an automated test that makes two bookings for the last place at once and checks that only one succeeds. The wall's staff tried the system for a week alongside the email process before the switch.",
              "The hardest part was not the code. The timetable changes most weeks, and the first design made staff re-enter every session. After watching the manager use it, we added a way to copy last week's timetable and change only what differs.",
              "The system has run since the start of the summer term. We did not measure reply times before and after, which we should have done, so we cannot yet say how much time it saves.",
            ),
          ],
        ],
        "Climbing wall booking system · Team 4",
      ),
      expect: { page: 2, kind: "other" },
    },
    // 12-scan is made from 01-bar-chart below: the same pages, as pictures.
    {
      id: "13-essay-styled",
      what: "A two-page essay with ruled headings, a shaded quotation and a boxed note, so its pages are sent, and no figure on them.",
      size: A4,
      css: `${REPORT_CSS}
        h1 { border-bottom: 3px solid #333; padding-bottom: 8px; }
        h2 { border-bottom: 1px solid #999; padding-bottom: 3px; }
        blockquote { margin: 14px 0; padding: 12px 18px; background: #f0f0f0; border-left: 5px solid #777; font-style: italic; }
        .note { border: 1.5px solid #555; padding: 10px 14px; margin: 14px 0; font-size: 14px; }
        .foot { border-top: 1px solid #999; padding-top: 6px; }`,
      pages: report(
        [
          [
            h1("Is a recommendation algorithm an editor?"),
            `<p class="meta">Grace Liddell · BA Media and Communication, Year 3 essay · University of Corran · February 2026</p>`,
            h2("The question"),
            p(
              "A newspaper editor chooses what readers see and answers for the choice. A recommendation algorithm on a video platform also chooses what viewers see, but nobody is named as having chosen. This essay asks whether the difference is one of kind or only of scale.",
              "The platforms' own account is that they do not edit. They host what users upload and rank it by what each viewer is likely to watch. On this account the algorithm is closer to a library catalogue than to a front page.",
            ),
            `<blockquote>We are not the arbiters of truth. We give people the tools to find what matters to them.</blockquote>`,
            p(
              "The statement above is typical of how platform executives have described their role. It treats ranking as a neutral service to the viewer's existing wishes. The difficulty is that the wishes are partly made by the ranking. A viewer cannot want what she has never been shown.",
            ),
            h2("Selection without a selector"),
            p(
              "An editor selects by judgement, and can give reasons. A ranking system selects by optimising a measure, usually watch time. The measure is chosen by people, and the choice has consequences as definite as any editorial line.",
            ),
          ],
          [
            p(
              "It may be objected that an editor decides for all readers at once, while an algorithm decides differently for each. But this makes the algorithm more of an editor, not less. It produces a front page for every viewer, and no viewer can see anyone else's.",
            ),
            `<div class="note"><b>A note on terms.</b> By "algorithm" this essay means the whole system that ranks content for a viewer, including the measures it is set to optimise and the people who set them.</div>`,
            h2("Responsibility"),
            p(
              "The strongest reason to call ranking a form of editing is that it places responsibility where the power is. If nobody edits, nobody answers for what is promoted. The language of neutral hosting has been useful to platforms for exactly that reason.",
              "The law in the United Kingdom has begun to move. The Online Safety Act places duties on platforms for the systems they run, and not only for single pieces of content. That is a recognition that the system is where the choices are made.",
            ),
            h2("Conclusion"),
            p(
              "A recommendation algorithm is not an editor in the sense of a person with a view. It is editorial in its effects: it selects, orders and promotes. The useful question is not whether to use the word, but who should answer for the selection. That is the people who choose what the system is asked to maximise.",
            ),
          ],
        ],
        "G. Liddell · MED3012",
      ),
      expect: null,
    },
    {
      id: "14-poster",
      what: "A three-page design project whose key visual is the finished poster on page 2, pasted in as a picture: a visual, but not a graph or a table.",
      size: A4,
      css: REPORT_CSS,
      pages: report(
        [
          [
            h1("A Freshers' Fair poster for the Law Society"),
            `<p class="meta">Imogen Carter · BA Graphic Design, Year 2 live brief · Hallam School of Art · October 2025</p>`,
            h2("The brief"),
            p(
              "The Law Society wanted a poster for the Freshers' Fair that would bring students from other courses to its stall. Most of its members study law, and the committee felt the society's name put everyone else off. They asked for one A3 poster, to be printed 40 times and put up in halls and in the students' union.",
              "The poster had to carry the society's name, the date and place of the fair and the stall number, and had to work from across a corridor.",
            ),
            h2("Research"),
            p(
              "I photographed the noticeboards in three halls of residence. Almost every poster used a white background and small type, and they merged into one another at any distance. I also asked fifteen first-year students who do not study law what they thought the society did. Twelve said they assumed it was only for law students.",
              "That gave the poster one job: to say, in a few large words, that the society is for everyone.",
            ),
          ],
          [
            h2("The final poster"),
            p("The final design uses a dark blue ground, so that it stands apart from the white posters round it, and a line of four words that answers the assumption directly."),
            figure(`<img src="${posterPng.src}" width="${posterPng.width}" height="${posterPng.height}" data-truth alt="">`, "The final A3 poster, as printed.", {}),
            p("The orange circle is taken from the society's existing logo, enlarged until it stops reading as a logo and becomes a shape."),
          ],
          [
            h2("Development and feedback"),
            p(
              "I drew twelve thumbnails and took three to the committee. They chose the direction with the large headline but asked for the date to be bigger, which I agreed with once I saw it printed at full size.",
              "The first proof printed darker than the screen, and the small text at the foot was hard to read. I lightened the blue slightly and raised the smallest type by two points.",
              "The society's president said that the stall was busier than in any year she could remember, and that several students mentioned the poster. The society did not count sign-ups by course, so I cannot say how many came from outside law. Next time I would agree a way to measure that before the poster goes up.",
            ),
          ],
        ],
        "I. Carter · Law Society poster",
      ),
      expect: { page: 2, kind: "other" },
      truthIsElement: true,
    },
  ];
}

/* ---------------- Printing and measuring ---------------- */

const htmlOf = (r) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><style>
  @page { size: ${r.size.w}px ${r.size.h}px; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: ${r.size.w}px; height: ${r.size.h}px; overflow: hidden; break-after: page; }
  .page:last-child { break-after: auto; }
  ${r.css}
</style></head><body>${r.pages.join("")}</body></html>`;

/** The true box of the element marked data-truth: the smallest box round everything it draws, in fractions of its page. */
const measure = (page, wholeElement) =>
  page.evaluate((whole) => {
    const el = document.querySelector("[data-truth]");
    if (!el) return null;
    const sheet = el.closest(".page");
    const sheets = [...document.querySelectorAll(".page")];
    const pr = sheet.getBoundingClientRect();
    const drawn = whole || el.matches("img, table") ? [el] : [...el.querySelectorAll("text, rect, line, polyline, polygon, circle, path")];
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const d of drawn) {
      const r = d.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      x1 = Math.min(x1, r.left);
      y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right);
      y2 = Math.max(y2, r.bottom);
    }
    const round = (n) => Math.round(n * 10000) / 10000;
    return { page: sheets.indexOf(sheet) + 1, box: { x: round((x1 - pr.left) / pr.width), y: round((y1 - pr.top) / pr.height), w: round((x2 - x1) / pr.width), h: round((y2 - y1) / pr.height) } };
  }, wholeElement);

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.emulateMedia({ media: "print" });

  /** A drawing as a PNG picture, to paste into a report: what a chart copied out of a spreadsheet is. */
  async function png(svg, css = "") {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.setContent(`<!doctype html><html><head><style>body{margin:0;background:#fff;font:13px Carlito,Calibri,sans-serif}${css}</style></head><body><span id="d" style="display:inline-block;line-height:0;padding:6px;background:#fff">${svg}</span></body></html>`);
    const el = page.locator("#d");
    const box = await el.boundingBox();
    const bytes = await el.screenshot({ type: "png" });
    return { src: `data:image/png;base64,${bytes.toString("base64")}`, width: Math.round(box.width), height: Math.round(box.height) };
  }

  const bitmapChart = await png(
    barChart({
      title: "Film Society sign-ups in Freshers' Week",
      yTitle: "New members",
      cats: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      series: [
        { name: "2024", colour: "#a5a5a5", values: [9, 12, 31, 19, 15] },
        { name: "2025", colour: "#4472c4", values: [14, 17, 58, 29, 23] },
      ],
      max: 60,
      step: 20,
      w: 500,
      h: 300,
      font: "Carlito, Calibri, sans-serif",
    }),
  );
  const posterPng = await png(poster());

  mkdirSync(here, { recursive: true });
  const cases = [];

  async function print(r) {
    await page.setViewportSize({ width: r.size.w, height: r.size.h });
    await page.setContent(htmlOf(r), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const truth = r.expect ? await measure(page, Boolean(r.truthIsElement)) : null;
    if (r.expect && (!truth || truth.page !== r.expect.page)) throw new Error(`${r.id}: the figure is on page ${truth?.page}, expected page ${r.expect.page}`);
    const pdf = await page.pdf({ width: `${r.size.w}px`, height: `${r.size.h}px`, printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    const pages = (await getDocumentProxy(new Uint8Array(pdf))).numPages;
    if (pages !== r.pages.length) throw new Error(`${r.id}: printed ${pages} pages from ${r.pages.length} sheets`);
    const file = `${r.id}.pdf`;
    writeFileSync(join(here, file), pdf);
    cases.push({ id: r.id, file, what: r.what, pages, expect: r.expect ? { page: r.expect.page, kind: r.expect.kind, box: truth.box } : null });
    console.log(`${file}: ${pages} pages, ${(pdf.length / 1024).toFixed(0)} KB${truth ? `, figure on page ${truth.page} at ${JSON.stringify(truth.box)}` : ", no figure"}`);
    return truth;
  }

  const all = reports({ bitmapChart, posterPng });
  for (const r of all) {
    const truth = await print(r);
    if (r.id !== "01-bar-chart") continue;
    // The scan: the same four pages, each photographed and put back as one picture filling its page.
    // Nothing is left of the text or the shapes, so every page is sent, as every page of a real scan is.
    const shots = [];
    for (const sheet of await page.locator(".page").all()) shots.push((await sheet.screenshot({ type: "jpeg", quality: 70 })).toString("base64"));
    const scan = {
      id: "12-scan",
      what: "The report of 01-bar-chart as a scan: every page is a picture, with no text behind it. The chart is on page 3.",
      size: A4,
      css: ".page img { display: block; width: 100%; height: 100%; }",
      pages: shots.map((b64) => `<section class="page"><img src="data:image/jpeg;base64,${b64}" alt=""></section>`),
      expect: null,
    };
    await page.setViewportSize({ width: A4.w, height: A4.h });
    await page.setContent(htmlOf(scan), { waitUntil: "load" });
    const pdf = await page.pdf({ width: `${A4.w}px`, height: `${A4.h}px`, printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    const pages = (await getDocumentProxy(new Uint8Array(pdf))).numPages;
    if (pages !== shots.length) throw new Error(`12-scan: printed ${pages} pages from ${shots.length} sheets`);
    writeFileSync(join(here, "12-scan.pdf"), pdf);
    // The same sheet, so the same box.
    cases.push({ id: scan.id, file: "12-scan.pdf", what: scan.what, pages, expect: { page: truth.page, kind: "graph", box: truth.box } });
    console.log(`12-scan.pdf: ${pages} pages, ${(pdf.length / 1024).toFixed(0)} KB, figure on page ${truth.page}`);
  }

  await browser.close();
  cases.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(join(here, "cases.json"), `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Wrote ${cases.length} reports and cases.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
