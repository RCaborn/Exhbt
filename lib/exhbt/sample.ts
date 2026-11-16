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

/**
 * An exhbt in the page layout Rory drew (16 Nov 2026, decision 0022): the title is the question,
 * the context line marks its gap in bold (drawn highlighted), and it has what it is, where and
 * when, and a summary. Its words follow the layout PDF; the graph's figures are made up for
 * development. Not in sampleSeeds: app/dev/portfolio adds it with `with=open-banking`.
 */
export const openBankingDoc: ExhbtDoc = {
  schemaVersion: SCHEMA_VERSION,
  title: "Will banks and fintechs cooperate under open banking?",
  context: "MSc Finance dissertation",
  whereWhen: "University of St Andrews, August 2026",
  summary: "It depends on two opposing forces, complementarity and substitution.",
  skills: ["Evolutionary game theory", "Replicator dynamics", "Risk dominance", "Comparative statics", "Python", "SymPy"],
  gap: [
    { t: "Open banking makes banks share customer data. " },
    { t: "Nobody knows whether banks and fintechs will then cooperate or compete.", b: true },
  ],
  flow: [
    { step: "Define bank and fintech strategies" },
    { step: "Set payoff matrix with openness parameter" },
    { step: "Derive replicator equations and rest points" },
    { step: "Classify stability of each equilibrium" },
    { step: "Select outcome via risk dominance" },
  ],
  sections: [
    {
      id: "findings",
      kind: "findings",
      items: [
        text("Openness acts through fintech disruption payoffs, not bank payoffs."),
        text("Two opposing forces, complementarity and substitution, decide whether the market moves to cooperation or competition."),
        text("Access fees can shift outcomes, depending on segment and market structure."),
      ],
    },
    {
      id: "graph-1",
      kind: "graph",
      chart: {
        kind: "bar",
        title: "Simulated markets ending in cooperation (%)",
        unit: "%",
        highlight: 0,
        rows: [
          { label: "No access fee", value: 64 },
          { label: "Low access fee", value: 52 },
          { label: "High access fee", value: 31 },
        ],
      },
    },
    { id: "reflection-1", kind: "reflection", text: text("Test the model against real partnership data from UK banks since 2018.") },
  ],
  evidence: { kind: "link", href: "https://example.com/open-banking-dissertation.pdf", label: "Dissertation.pdf" },
};

/** The samples as they're stored by app/dev/portfolio: the GP one in the old layout. */
export const sampleSeeds: unknown[] = [legacyGpDoc, libraryDoc];

/** The samples as the app reads them (normaliseDoc): what the pages and tests compare against. */
export const sampleDocs: ExhbtDoc[] = sampleSeeds.map(normaliseDoc);
