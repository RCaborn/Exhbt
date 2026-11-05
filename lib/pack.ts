export type PackData = {
  author: string;
  context: string;
  title: string;
  outcome: string;
  method: string;
  results: [string, string?, string?];
  evidence: { label: string; href: string; kind: "file" | "link" };
  reflection: string;
  checkedOn: string;
};

/** Fixed limits from the brief. The editor (R2) enforces these; the type only documents them. */
export const PACK_LIMITS = {
  titleChars: 80,
  outcomeSentences: 1,
  methodSentences: 2,
  resultLines: 3,
  reflectionSentences: 2,
  totalWords: 200,
} as const;

export function packWordCount(p: PackData): number {
  const text = [p.title, p.outcome, p.method, ...p.results.filter(Boolean), p.reflection].join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Used on the home page and the guide until real packs exist (R2). Fictional author. */
export const examplePack: PackData = {
  author: "Amara Okafor",
  context: "BSc Data Science, final-year project",
  title: "Cutting missed GP appointments by changing when reminders are sent",
  outcome:
    "Sending reminder texts 3 hours before an appointment instead of 24 hours cut missed appointments by 18% across two GP practices.",
  method:
    "I analysed 14,200 anonymised appointment records, then ran a six-week trial of reminder timing with both practice managers. I used Python (pandas, statsmodels) and a logistic regression controlling for age and appointment type.",
  results: [
    "Missed-appointment rate fell from 7.9% to 6.5% (p = 0.003).",
    "Largest change for patients under 30: 11.2% to 8.4%.",
    "Both practices kept the 3-hour timing after the trial.",
  ],
  evidence: { label: "Dissertation, 42 pages (PDF)", href: "#", kind: "file" },
  reflection:
    "Getting access to the data took longer than the analysis, so next time I would agree data-sharing terms before writing the proposal. I also learned to report effect sizes, not only p-values.",
  checkedOn: "12 March 2026",
};
