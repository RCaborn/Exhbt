import { SCHEMA_VERSION, text, type ExhbtDoc } from "./exhbt/blocks";
import { homeProject, type HomeProject } from "./portfolio-home";
import type { SectionKey, Tiles } from "./portfolio-layout";

/**
 * An exhbt is one piece of a graduate's portfolio: a short, fixed-format account of a
 * real project, with the work attached and a visual of the key result. `ExhbtData` and
 * `exampleExhbt` are the Phase 1 card (components/exhbt/Exhbt.tsx, the employer guide); the
 * demo portfolio below is in the Phase 2 page layout (components/portfolio/ProjectView.tsx).
 */

export type KeyResult = {
  /** What is measured, with unit, e.g. "Missed appointments (%)". */
  title: string;
  beforeLabel: string;
  afterLabel: string;
  /** True when a fall is the good outcome (e.g. error rates, waiting times). */
  lowerIsBetter: boolean;
  /** 1-3 rows, each a before/after pair. */
  rows: { label: string; before: number; after: number }[];
  /** Suffix for values, e.g. "%" or " days". */
  unit?: string;
};

export type ExhbtData = {
  /** URL segment within the owner's portfolio. */
  slug: string;
  author: string;
  context: string;
  title: string;
  outcome: string;
  /** The one number that sums the project up, shown big on portfolio tiles. */
  headline: { value: string; label: string };
  /** Optional: shown as a before/after chart when the project has numbers. */
  keyResult?: KeyResult;
  /**
   * The methodology as a flow diagram: 3-6 steps, each a short verb phrase with the
   * tool or scale as detail. The last step is the result.
   */
  methodology: { step: string; detail?: string }[];
  /** Up to 6 skills shown, as tags. */
  skills: string[];
  evidence: { label: string; href: string; kind: "file" | "link" };
  reflection: string;
  checkedOn: string;
};

/** Fixed limits. The editor (Release 2) enforces these; the type documents them. */
export const EXHBT_LIMITS = {
  titleChars: 80,
  outcomeSentences: 1,
  methodologySteps: { min: 3, max: 6 },
  skills: 6,
  chartRows: 3,
  reflectionSentences: 2,
  totalWords: 200,
} as const;

export function exhbtWordCount(e: ExhbtData): number {
  const text = [e.title, e.outcome, ...e.methodology.flatMap((m) => [m.step, m.detail ?? ""]), e.reflection].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Used on the home page and the guide until real exhbts exist. Fictional author. */
export const exampleExhbt: ExhbtData = {
  slug: "gp-reminders",
  author: "Amara Okafor",
  context: "BSc Data Science, final-year project",
  title: "Cutting missed GP appointments by changing when reminders are sent",
  outcome:
    "Sending reminder texts 3 hours before an appointment instead of 24 hours cut missed appointments by 18% across two GP practices.",
  headline: { value: "−18%", label: "missed appointments" },
  keyResult: {
    title: "Missed appointments (%)",
    beforeLabel: "24-hour reminder",
    afterLabel: "3-hour reminder",
    lowerIsBetter: true,
    unit: "%",
    rows: [
      { label: "All patients", before: 7.9, after: 6.5 },
      { label: "Under 30", before: 11.2, after: 8.4 },
    ],
  },
  methodology: [
    { step: "Collected data", detail: "14,200 records" },
    { step: "Cleaned in Python", detail: "pandas" },
    { step: "Ran a trial", detail: "6 weeks, 2 practices" },
    { step: "Regressed", detail: "logistic, statsmodels" },
    { step: "Graphed", detail: "matplotlib" },
    { step: "Result", detail: "−18% missed" },
  ],
  skills: ["Python", "pandas", "statsmodels", "Logistic regression", "Trial design", "Working with clinicians"],
  evidence: { label: "Dissertation, 42 pages (PDF)", href: "#", kind: "file" },
  reflection:
    "Getting access to the data took longer than the analysis, so next time I would agree data-sharing terms before writing the proposal. I also learned to report effect sizes, not only p-values.",
  checkedOn: "12 March 2026",
};

/** The owner of a portfolio. The public host is portfolioHost() in lib/hosts.ts. */
export type PortfolioOwner = {
  username: string;
  name: string;
  headline: string;
  course: string;
  lookingFor: string;
};

/** The owner of the demo portfolio (home page, /demo, the guide). Fictional. */
export const demoOwner: PortfolioOwner = {
  username: "amara",
  name: "Amara Okafor",
  headline: "Data analyst, health and public services",
  course: "BSc Data Science, University of Example, 2026",
  lookingFor: "Junior data analyst roles in the NHS or local government",
};

/**
 * Amara's portfolio, for the home page, /demo and the guide. Fictional person, address and projects,
 * always labelled as made up where they show. Every exhbt is in the page layout Rory drew (decision
 * 0022): the title is the question, the context line has its gap in bold (drawn highlighted), and
 * each has what it is, where and when, and a one-sentence summary. They keep to the product's own
 * limits (validateForPublish in lib/exhbt/blocks.ts; checked in e2e/home.spec.ts), so the demo can't
 * drift from what a real exhbt can be.
 */
export type DemoExhbt = {
  /** Its path under /demo. */
  slug: string;
  /** When the (fictional) checks ran, as the page prints it. */
  checkedOn: string;
  doc: ExhbtDoc;
};

const bold = (t: string) => ({ t, b: true });

export const demoExhbts: DemoExhbt[] = [
  {
    slug: "gp-reminders",
    checkedOn: "12 March 2026",
    doc: {
      schemaVersion: SCHEMA_VERSION,
      title: "Does the timing of a reminder text cut missed GP appointments?",
      context: "BSc Data Science, final-year project",
      whereWhen: "Two GP practices, autumn 2025",
      summary: "Sending the reminder 3 hours before instead of 24 cut missed appointments by 18%.",
      skills: ["Python", "pandas", "Logistic regression", "Trial design", "Data cleaning"],
      gap: [{ t: "Two GP practices lost about 8% of appointments to no-shows. " }, bold("Nobody had tested whether the timing of the reminder mattered.")],
      flow: [
        { step: "Collected appointment records", detail: "14,200 rows" },
        { step: "Cleaned and matched reminders", detail: "pandas" },
        { step: "Modelled no-shows by timing", detail: "logistic regression" },
        { step: "Piloted 3-hour reminders", detail: "6 weeks, 2 practices" },
        { step: "Missed appointments down 18%" },
      ],
      sections: [
        {
          id: "findings",
          kind: "findings",
          items: [
            text("3-hour reminders cut missed appointments from 7.9% to 6.5%."),
            text("Under-30s gained most: 11.2% down to 8.4%."),
            text("Same-day bookings were unaffected, so the change costs nothing to keep."),
          ],
        },
        {
          id: "graph-1",
          kind: "graph",
          chart: {
            kind: "beforeAfter",
            title: "Missed appointments (%)",
            beforeLabel: "24-hour reminder",
            afterLabel: "3-hour reminder",
            lowerIsBetter: true,
            unit: "%",
            rows: [
              { label: "All patients", before: 7.9, after: 6.5 },
              { label: "Under 30", before: 11.2, after: 8.4 },
            ],
          },
        },
        { id: "reflection-1", kind: "reflection", text: text("Agree data-sharing terms before writing the proposal: getting the data took longer than the analysis.") },
      ],
      evidence: { kind: "file", fileId: "demo-gp-reminders", label: "Dissertation.pdf" },
    },
  },
  {
    slug: "ae-forecast",
    checkedOn: "2 April 2026",
    doc: {
      schemaVersion: SCHEMA_VERSION,
      title: "Can open NHS data forecast A&E waiting times a week ahead?",
      context: "Personal project, open NHS data",
      whereWhen: "Self-directed, January 2026",
      summary: "A seasonal model forecast four-hour A&E performance to within 2.1 percentage points on held-out months.",
      skills: ["Python", "Time series", "SARIMA", "Back-testing", "Open data"],
      gap: [{ t: "Trusts plan staffing a week at a time. " }, bold("Could published data alone say how the next week would go?")],
      flow: [
        { step: "Pulled open data", detail: "NHS England, 6 years" },
        { step: "Cleaned in Python", detail: "pandas" },
        { step: "Modelled seasonality", detail: "SARIMA, statsmodels" },
        { step: "Back-tested on held-out months", detail: "12 months" },
        { step: "Forecast within 2.1 points" },
      ],
      sections: [
        {
          id: "findings",
          kind: "findings",
          items: [
            text("The seasonal model's error was under half that of last year's figure."),
            text("Bank holidays broke the first model, so I added them as features."),
            text("Winter weeks were the hardest to call."),
          ],
        },
        {
          id: "graph-1",
          kind: "graph",
          chart: {
            kind: "bar",
            title: "Average forecast error (percentage points)",
            lowerIsBetter: true,
            highlight: 2,
            rows: [
              { label: "Same week last year", value: 5.8 },
              { label: "Four-week average", value: 3.9 },
              { label: "Seasonal model", value: 2.1 },
            ],
          },
        },
        { id: "reflection-1", kind: "reflection", text: text("Test a simpler baseline first, to show the model earns its complexity.") },
      ],
      evidence: { kind: "file", fileId: "demo-ae-forecast", label: "forecast-notebook.ipynb" },
    },
  },
  {
    slug: "bed-dashboard",
    checkedOn: "20 June 2025",
    doc: {
      schemaVersion: SCHEMA_VERSION,
      title: "Would ward nurses use a live bed dashboard instead of the whiteboard?",
      context: "Placement project, acute medical ward",
      whereWhen: "NHS placement, spring 2025",
      summary: "All six charge nurses in the trial kept using the dashboard after it ended.",
      skills: ["SQL", "Power BI", "User interviews", "Dashboard design"],
      gap: [{ t: "Charge nurses tracked beds on a hand-filled whiteboard. " }, bold("Would they trust a live dashboard enough to replace it?")],
      flow: [
        { step: "Interviewed charge nurses", detail: "6 interviews" },
        { step: "Wrote SQL on the bed system" },
        { step: "Built the dashboard", detail: "Power BI" },
        { step: "Tested it on shift", detail: "3 weeks" },
        { step: "6 of 6 nurses kept it" },
      ],
      sections: [
        {
          id: "findings",
          kind: "findings",
          items: [
            text("The first version showed too much, and nobody opened it twice."),
            text("Cutting it to the three numbers checked at handover made it stick."),
            text("All six charge nurses still used it a month after the trial."),
          ],
        },
        { id: "reflection-1", kind: "reflection", text: text("Ask what people check first before designing anything.") },
      ],
      evidence: { kind: "file", fileId: "demo-bed-dashboard", label: "Placement report.pdf" },
    },
  },
  {
    slug: "study-habits",
    checkedOn: "8 May 2025",
    doc: {
      schemaVersion: SCHEMA_VERSION,
      title: "Do students who space out their revision get better grades?",
      context: "Second-year module, survey research",
      whereWhen: "University of Example, spring 2025",
      summary: "Students who spaced out their revision reported averages 0.4 grade points higher, after allowing for year and subject.",
      skills: ["R", "Survey design", "Regression", "Report writing"],
      gap: [{ t: "Revision advice is everywhere and rarely checked. " }, bold("Does spaced practice show up in students' grades?")],
      flow: [
        { step: "Designed the survey", detail: "18 questions" },
        { step: "Collected responses", detail: "412 students" },
        { step: "Ran a regression in R", detail: "allowing for year and subject" },
        { step: "Spaced revision: +0.4 grade points" },
      ],
      sections: [
        {
          id: "graph-1",
          kind: "graph",
          chart: {
            kind: "bar",
            title: "Reported average grade points, by how students revise",
            highlight: 2,
            rows: [
              { label: "Mostly cramming", value: 2.9 },
              { label: "A mix", value: 3.1 },
              { label: "Mostly spaced out", value: 3.3 },
            ],
          },
        },
        {
          id: "findings",
          kind: "findings",
          items: [
            text("Spaced revision went with averages 0.4 grade points higher."),
            text("The gap held after allowing for year of study and subject."),
            text("Grades were self-reported, which limits what this can show."),
          ],
        },
        { id: "reflection-1", kind: "reflection", text: text("Ask permission to use real module marks instead of self-reported grades.") },
      ],
      evidence: { kind: "file", fileId: "demo-study-habits", label: "Module report.pdf" },
    },
  },
];

/** Amara's home page (PortfolioHome): who she is, in her words, and what's on it. */
export const demoPortfolio: {
  person: { username: string; name: string; headline: string; bio: string; location: string; lookingFor: string; photoUrl: null };
  tiles: Tiles;
  sections: SectionKey[];
} = {
  person: {
    username: demoOwner.username,
    name: demoOwner.name,
    headline: demoOwner.headline,
    bio: "I'm a data science graduate who likes messy public data and the people who rely on it. My final-year project changed when two GP practices send their reminder texts.",
    location: "Leeds",
    lookingFor: demoOwner.lookingFor,
    photoUrl: null,
  },
  tiles: {
    about: {
      text: "I learn most from the people the numbers are about: receptionists, charge nurses, students. I like a clear question, a small test and a chart someone can read in ten seconds.",
    },
    education: { lines: ["BSc Data Science, University of Example 2026", "A levels: Maths, Biology, Economics 2022"], tools: "Python, SQL, R, Power BI, Excel" },
  },
  sections: ["featured", "work", "about"],
};

/** Each demo exhbt as the portfolio home shows it (title, summary, key figure), linking to its /demo page. */
export const demoHomeProjects = (): HomeProject[] => demoExhbts.map((e) => homeProject(e.slug, e.doc, `/demo/${e.slug}`));

/**
 * Catalogue number for the exhbt at `position` (1-based) in a portfolio, like a
 * museum accession number: EX·01, EX·02… Derived from order, never stored.
 */
export function catalogueNo(position: number): string {
  return `EX·${String(position).padStart(2, "0")}`;
}
