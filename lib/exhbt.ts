/**
 * An exhbt is one piece of a graduate's portfolio: a short, fixed-format account of a
 * real project, with the work attached and a visual of the key result. Every exhbt
 * renders through components/exhbt/Exhbt.tsx so employers learn the layout once.
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

/** The owner of a portfolio (exhbt.co.uk/<username>). */
export type PortfolioOwner = {
  username: string;
  name: string;
  headline: string;
  course: string;
  lookingFor: string;
};

/** A complete demo portfolio for the home page and /demo. Fictional person and projects. */
export const demoOwner: PortfolioOwner = {
  username: "amara",
  name: "Amara Okafor",
  headline: "Data analyst, health and public services",
  course: "BSc Data Science, University of Example, 2026",
  lookingFor: "Junior data analyst roles in the NHS or local government",
};

export const demoExhbts: ExhbtData[] = [
  exampleExhbt,
  {
    slug: "ae-forecast",
    author: "Amara Okafor",
    context: "Personal project, open NHS data",
    title: "Forecasting A&E waiting times a week ahead",
    outcome: "A weekly forecast of four-hour A&E performance for one trust, accurate to within 2.1 percentage points on held-out months.",
    headline: { value: "±2.1 pts", label: "forecast error" },
    methodology: [
      { step: "Pulled open data", detail: "NHS England, 6 years" },
      { step: "Cleaned in Python", detail: "pandas" },
      { step: "Modelled seasonality", detail: "statsmodels SARIMA" },
      { step: "Back-tested", detail: "12 held-out months" },
      { step: "Result", detail: "±2.1 pts error" },
    ],
    skills: ["Python", "Time series", "SARIMA", "Back-testing", "Open data"],
    evidence: { label: "GitHub repository with notebook", href: "#", kind: "link" },
    reflection: "Bank holidays broke the first model, so I added them as features. Next I would test a simpler baseline first to show the model earns its complexity.",
    checkedOn: "2 April 2026",
  },
  {
    slug: "bed-dashboard",
    author: "Amara Okafor",
    context: "Placement project, acute medical ward",
    title: "A bed occupancy dashboard nurses actually used",
    outcome: "Replaced a hand-filled whiteboard with a live Power BI dashboard; all six charge nurses in the trial kept using it after the trial ended.",
    headline: { value: "6 / 6", label: "nurses kept using it" },
    methodology: [
      { step: "Interviewed staff", detail: "6 charge nurses" },
      { step: "Wrote SQL queries", detail: "ward bed system" },
      { step: "Built dashboard", detail: "Power BI" },
      { step: "Tested on shift", detail: "3 weeks" },
      { step: "Result", detail: "6 of 6 adopted" },
    ],
    skills: ["SQL", "Power BI", "User interviews", "Dashboard design"],
    evidence: { label: "Placement report and screenshots (PDF)", href: "#", kind: "file" },
    reflection: "The first version showed too much. Cutting it to the three numbers nurses check at handover is what made it stick.",
    checkedOn: "20 June 2025",
  },
  {
    slug: "study-habits",
    author: "Amara Okafor",
    context: "Second-year module, survey research",
    title: "How students actually revise: a survey of 412 undergraduates",
    outcome: "Students who used spaced practice reported 0.4 grade points higher averages, after controlling for year and subject.",
    headline: { value: "412", label: "survey responses" },
    methodology: [
      { step: "Designed survey", detail: "18 questions" },
      { step: "Collected responses", detail: "412 students" },
      { step: "Analysed in R", detail: "linear regression" },
      { step: "Result", detail: "+0.4 grade points" },
    ],
    skills: ["R", "Survey design", "Regression", "Report writing"],
    evidence: { label: "Module report (PDF)", href: "#", kind: "file" },
    reflection: "Self-reported grades limit what this can show. With more time I would ask for permission to use actual module marks.",
    checkedOn: "8 May 2025",
  },
];

/**
 * Catalogue number for the exhbt at `position` (1-based) in a portfolio, like a
 * museum accession number: EX·01, EX·02… Derived from order, never stored.
 */
export function catalogueNo(position: number): string {
  return `EX·${String(position).padStart(2, "0")}`;
}
