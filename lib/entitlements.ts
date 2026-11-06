export type Plan = "free" | "plus" | "premium" | "institutional";

type Entitlements = {
  /** Roadmaps a person can build per rolling 30 days ("refreshes"). null = no limit. */
  roadmapsPer30Days: number | null;
  /** How many exhbts can be hosted. 0 = none. */
  exhbts: number;
  /** A personal portfolio link: exhbt.co.uk/<username>. */
  personalLink: boolean;
  /** Custom links per job: upload the job description, we pick the best-fit exhbts. */
  jobLinks: boolean;
};

/**
 * Single source of truth for what each plan includes (Rory, 6 Nov 2026):
 * - Free: skills roadmap, 3 refreshes a month, no exhbts.
 * - Plus: 4 exhbts, a personal link to send employers, unlimited refreshes.
 * - Premium: up to 10 exhbts, a custom link for each job, unlimited refreshes.
 * - Institutional: universities pay; their students get Premium.
 * Employers never pay and never need an account.
 */
export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: { roadmapsPer30Days: 3, exhbts: 0, personalLink: false, jobLinks: false },
  plus: { roadmapsPer30Days: null, exhbts: 4, personalLink: true, jobLinks: false },
  premium: { roadmapsPer30Days: null, exhbts: 10, personalLink: true, jobLinks: true },
  institutional: { roadmapsPer30Days: null, exhbts: 10, personalLink: true, jobLinks: true },
};

/** Display names. Rename a tier here (e.g. "Premium" to "Max") and the site follows. */
export const PLAN_NAMES: Record<Plan, string> = {
  free: "Free",
  plus: "Plus",
  premium: "Premium",
  institutional: "Universities",
};

/** Exhbts picked for a job-specific link. */
export const EXHBTS_PER_JOB_LINK = 4;

/** Paid tiers have no public price yet: the early release collects a waitlist. */
export const PRICES: Partial<Record<Plan, string>> = { free: "£0" };

/** What each tier includes, as short checklist lines (pricing page and home summary). */
export function planFeatures(plan: "free" | "plus" | "premium"): string[] {
  const e = ENTITLEMENTS[plan];
  const refreshes = e.roadmapsPer30Days === null ? "Unlimited roadmap refreshes" : `${e.roadmapsPer30Days} roadmap refreshes a month`;
  switch (plan) {
    case "free":
      return ["Skills roadmap for the job you want", refreshes, "Emailed to you to keep"];
    case "plus":
      return [`${e.exhbts} exhbts hosted`, "Your own link: exhbt.co.uk/you", "AI drafting and originality checks", refreshes];
    case "premium":
      return [
        `Up to ${e.exhbts} exhbts hosted`,
        `A custom link for every job: we pick your ${EXHBTS_PER_JOB_LINK} best fits`,
        "Everything in Plus",
        refreshes,
      ];
  }
}
