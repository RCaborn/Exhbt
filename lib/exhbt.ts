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
  author: string;
  context: string;
  title: string;
  outcome: string;
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
  author: "Amara Okafor",
  context: "BSc Data Science, final-year project",
  title: "Cutting missed GP appointments by changing when reminders are sent",
  outcome:
    "Sending reminder texts 3 hours before an appointment instead of 24 hours cut missed appointments by 18% across two GP practices.",
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
