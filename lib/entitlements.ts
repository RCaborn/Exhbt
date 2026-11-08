import { portfolioHost } from "@/lib/hosts";

/**
 * What each plan includes. This file is the only copy of the figures.
 * Public names are PLAN_NAMES. The key `premium` is the stored value (database,
 * waitlist interest, pricing anchor); the name on the site is Pro.
 * Why these figures: docs/decisions/0002-plan-tiers.md.
 */

export type Plan = "free" | "plus" | "premium" | "institutional";

type Entitlements = {
  /** Roadmaps a person can build per rolling 30 days. */
  roadmapsPer30Days: number;
  /** How many exhbts can be hosted. */
  exhbts: number;
  /** A personal portfolio link: {username}.exhbt.co.uk */
  personalLink: boolean;
  /** Custom links per job: upload the description, we pick the best-fit exhbts. */
  jobLinks: boolean;
  /** Help drafting an exhbt from what the person supplied. */
  drafting: boolean;
  /** A paid originality check when an exhbt is published. */
  originalityCheck: boolean;
};

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: { roadmapsPer30Days: 1, exhbts: 1, personalLink: true, jobLinks: false, drafting: false, originalityCheck: false },
  plus: { roadmapsPer30Days: 8, exhbts: 4, personalLink: true, jobLinks: false, drafting: true, originalityCheck: false },
  premium: { roadmapsPer30Days: 30, exhbts: 10, personalLink: true, jobLinks: true, drafting: true, originalityCheck: true },
  institutional: { roadmapsPer30Days: 30, exhbts: 10, personalLink: true, jobLinks: true, drafting: true, originalityCheck: true },
};

/** Display names. The site reads these. The stored key for Pro stays `premium`. */
export const PLAN_NAMES: Record<Plan, string> = {
  free: "Free",
  plus: "Plus",
  premium: "Pro",
  institutional: "Universities",
};

/** Exhbts picked for a job-specific link. */
export const EXHBTS_PER_JOB_LINK = 4;

/** Paid tiers have no public price yet: the early release collects a waitlist. */
export const PRICES: Partial<Record<Plan, string>> = { free: "£0" };

function refreshes(n: number): string {
  return n === 1 ? "1 roadmap refresh a month" : `${n} roadmap refreshes a month`;
}

function exhbtCount(n: number, hosted: boolean): string {
  const noun = n === 1 ? "exhbt" : "exhbts";
  const prefix = hosted ? "Up to " : "";
  return `${prefix}${n} ${noun}${hosted ? " hosted" : ""}`;
}

/** What each tier includes, as short checklist lines (pricing page and home summary). */
export function planFeatures(plan: "free" | "plus" | "premium"): string[] {
  const e = ENTITLEMENTS[plan];
  const link = portfolioHost("you");
  switch (plan) {
    case "free": {
      const lines = ["Skills roadmap for the job you want", refreshes(e.roadmapsPer30Days)];
      if (e.personalLink) lines.push(`${exhbtCount(e.exhbts, false)} on ${link}`);
      lines.push("Emailed to you to keep");
      return lines;
    }
    case "plus":
      return [
        e.personalLink ? `${exhbtCount(e.exhbts, false)} hosted on ${link}` : `${exhbtCount(e.exhbts, false)} hosted`,
        ...(e.drafting ? ["Drafting help for each exhbt"] : []),
        refreshes(e.roadmapsPer30Days),
      ];
    case "premium":
      return [
        e.personalLink ? `${exhbtCount(e.exhbts, true)} on ${link}` : exhbtCount(e.exhbts, true),
        ...(e.jobLinks ? [`A custom link for every job: we pick your ${EXHBTS_PER_JOB_LINK} best fits`] : []),
        ...(e.drafting ? ["Drafting help for each exhbt"] : []),
        ...(e.originalityCheck ? ["An originality check when you publish"] : []),
        refreshes(e.roadmapsPer30Days),
      ];
  }
}
