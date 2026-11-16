import { normaliseDoc, SCHEMA_VERSION, text, type Chart, type ExhbtDoc, type ExhbtDocV1 } from "./blocks";

/**
 * Fictional exhbts, for development, previews and tests (app/dev/portfolio). Same fictional
 * person as the demo portfolio. Never shown as real work.
 */

/**
 * The GP exhbt, stored the way exhbts were before sections (decision 0015): findings and graphs
 * at the top of the doc, and a graph with no `kind` (from before graph kinds, decision 0011).
 * Kept like that on purpose: app/dev/portfolio stores it as is, in both copies, so the seeded
 * portfolio and the tests go through the path old exhbts take.
 */
export const legacyGpDoc: ExhbtDocV1 = {
  schemaVersion: 1,
  title: "Cutting missed GP appointments by changing when reminders are sent",
  context: "BSc Data Science, final-year project",
  headline: { value: "−18%", label: "missed appointments" },
  skills: ["Python", "pandas", "Logistic regression", "Data cleaning"],
  gap: [
    { t: "Two GP practices lost about 8% of appointments to no-shows. " },
    { t: "Did the timing", b: true },
    { t: " of the reminder text matter more than whether one was sent?" },
  ],
  flow: [
    { step: "Collected appointment records", detail: "14,200 rows" },
    { step: "Cleaned and matched reminders" },
    { step: "Modelled no-shows by timing", detail: "logistic regression" },
    { step: "Piloted 3-hour reminders", detail: "6 weeks" },
  ],
  findings: [
    text("3-hour reminders cut missed appointments from 7.9% to 6.5%."),
    text("Under-30s gained most: 11.2% down to 8.4%."),
    text("Same-day bookings were unaffected, so the change is free to keep."),
  ],
  charts: [
    {
      title: "Missed appointments (%)",
      beforeLabel: "24-hour reminder",
      afterLabel: "3-hour reminder",
      lowerIsBetter: true,
      unit: "%",
      rows: [
        { label: "All patients", before: 7.9, after: 6.5 },
        { label: "Under 30", before: 11.2, after: 8.4 },
      ],
    } as unknown as Chart,
  ],
  images: [],
  evidence: { kind: "link", href: "https://example.com/gp-reminders-report.pdf", label: "Final report (PDF)" },
};

/** The library exhbt, in the current layout. */
export const libraryDoc: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  title: "Forecasting weekly footfall for a city-centre library",
  context: "Data module coursework, Year 2",
  headline: { value: "±6%", label: "forecast error" },
  skills: ["SQL", "Time series", "Excel"],
  gap: text("Staff rotas were set by habit. Could last year's footfall predict next month well enough to plan shifts?"),
  flow: [
    { step: "Pulled gate counts", detail: "3 years" },
    { step: "Added term dates and weather" },
    { step: "Fitted a seasonal model" },
    { step: "Tested on held-out months" },
  ],
  sections: [{ id: "findings", kind: "findings", items: [text("Weekly forecasts landed within 6% of the real count."), text("Term dates explained more than weather did.")] }],
};

/** The samples as they're stored by app/dev/portfolio: the GP one in the old layout. */
export const sampleSeeds: unknown[] = [legacyGpDoc, libraryDoc];

/** The samples as the app reads them (normaliseDoc): what the pages and tests compare against. */
export const sampleDocs: ExhbtDoc[] = sampleSeeds.map(normaliseDoc);
