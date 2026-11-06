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
  /** Up to 3 short bullets. */
  method: string[];
  /** Up to 3 short bullets, numbers first. */
  results: string[];
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
  methodBullets: 3,
  resultBullets: 3,
  skills: 6,
  chartRows: 3,
  reflectionSentences: 2,
  totalWords: 200,
} as const;

export function exhbtWordCount(e: ExhbtData): number {
  const text = [e.title, e.outcome, ...e.method, ...e.results, e.reflection].join(" ");
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
  method: [
    "Analysed 14,200 anonymised appointment records from two GP practices",
    "Ran a six-week trial of reminder timing with both practice managers",
    "Modelled the effect in Python with a logistic regression controlling for age",
  ],
  results: [
    "Missed appointments down 18% (7.9% to 6.5%, p = 0.003)",
    "Largest drop for patients under 30: 11.2% to 8.4%",
    "Both practices kept the 3-hour timing after the trial",
  ],
  skills: ["Python", "pandas", "statsmodels", "Logistic regression", "Trial design", "Working with clinicians"],
  evidence: { label: "Dissertation, 42 pages (PDF)", href: "#", kind: "file" },
  reflection:
    "Getting access to the data took longer than the analysis, so next time I would agree data-sharing terms before writing the proposal. I also learned to report effect sizes, not only p-values.",
  checkedOn: "12 March 2026",
};
