import { portfolioHost } from "@/lib/hosts";
import { isPhase2Enabled } from "@/lib/site";

/**
 * What each plan includes. This file is the only copy of the figures.
 * Free, Premium (the first paid tier) and Max; universities get Max.
 * Why these figures: docs/decisions/0006-plan-names-premium-max.md (and 0002 before it).
 */

export type Plan = "free" | "premium" | "max" | "institutional";

type Entitlements = {
  /** Roadmaps a person can build per rolling 30 days. */
  roadmapsPer30Days: number;
  /** How many exhbts a person can have. On Free they can be built and previewed, not published. */
  exhbts: number;
  /** A public portfolio at {username}.exhbt.co.uk. */
  publicPortfolio: boolean;
  /** Custom links per job: paste or link the description, we pick the best-fit exhbts. */
  jobLinks: boolean;
  /** Per-job links live at once. Placeholder (12 Nov 2026), to be confirmed. */
  jobLinksActive: number;
  /** The AI drafts an exhbt from what the person uploaded. */
  drafting: boolean;
  /** AI drafts per rolling 30 days. Placeholder (12 Nov 2026), to be confirmed. */
  draftsPer30Days: number;
  /** "Rewrite this block" turns per exhbt. Placeholder (12 Nov 2026), to be confirmed. */
  blockRegenerations: number;
  /** Largest file that can be uploaded, in MB. Placeholder (12 Nov 2026), to be confirmed. */
  uploadMbPerFile: number;
  /** All stored files together, in MB. Placeholder (12 Nov 2026), to be confirmed. */
  storageMbTotal: number;
  /**
   * An originality check when an exhbt is published. Part of Premium and Max; not built yet (Rory, 12 Nov 2026:
   * "will be there, just not sorting it now"). Until ORIGINALITY_CHECK_LIVE, it's sold as coming soon
   * and no exhbt shows the tick.
   */
  originalityCheck: boolean;
  /**
   * Swaps (regenerating one idea) in a roadmap's plan of three. Placeholder figures
   * (Rory, 9 Nov 2026: "will change later"); see docs/decisions/0004.
   */
  projectSwapsPerRoadmap: number;
  /**
   * A saved list of project ideas, kept across roadmaps and careers (decision 0010). Free people
   * see every idea in their roadmap; keeping them in a list is a paid feature.
   */
  savedIdeas: boolean;
  /**
   * How many of the portfolio looks in lib/portfolio-themes.ts the person can use: that many from
   * the start of the list, or "all". Free has the default only (decision 0012).
   */
  portfolioThemes: number | "all";
};

const MAX: Entitlements = {
  roadmapsPer30Days: 30,
  exhbts: 10,
  publicPortfolio: true,
  jobLinks: true,
  jobLinksActive: 20,
  drafting: true,
  draftsPer30Days: 20,
  blockRegenerations: 10,
  uploadMbPerFile: 20,
  storageMbTotal: 500,
  originalityCheck: true,
  projectSwapsPerRoadmap: 25,
  savedIdeas: true,
  portfolioThemes: "all",
};

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: {
    roadmapsPer30Days: 1,
    exhbts: 1,
    publicPortfolio: false,
    jobLinks: false,
    jobLinksActive: 0,
    drafting: true,
    draftsPer30Days: 1,
    blockRegenerations: 3,
    uploadMbPerFile: 10,
    storageMbTotal: 25,
    originalityCheck: false,
    projectSwapsPerRoadmap: 3,
    savedIdeas: false,
    portfolioThemes: 1,
  },
  premium: {
    roadmapsPer30Days: 8,
    exhbts: 4,
    publicPortfolio: true,
    jobLinks: false,
    jobLinksActive: 0,
    drafting: true,
    draftsPer30Days: 8,
    blockRegenerations: 10,
    uploadMbPerFile: 20,
    storageMbTotal: 200,
    originalityCheck: true,
    projectSwapsPerRoadmap: 10,
    savedIdeas: true,
    portfolioThemes: 6,
  },
  max: MAX,
  institutional: MAX,
};

/** Display names. The site reads these. */
export const PLAN_NAMES: Record<Plan, string> = {
  free: "Free",
  premium: "Premium",
  max: "Max",
  institutional: "Universities",
};

/** Flip to true once the originality check runs on publish. Until then, copy says "coming soon". */
export const ORIGINALITY_CHECK_LIVE = false;

/**
 * Flip to true once per-job links are built (docs/phase-2.md section 8). Until then, while Phase 2
 * sells Max for real, the Max line says "coming soon". With Phase 2 off the whole tier is a
 * waitlist marked "Coming soon", so the line stays as it was.
 */
export const JOB_LINKS_LIVE = false;

/** Exhbts picked for a job-specific link. */
export const EXHBTS_PER_JOB_LINK = 4;

/** Shown when a free account has used its roadmaps for the month (builder or project-ideas gate). */
export function freeRoadmapLimitMessage(): string {
  const n = ENTITLEMENTS.free.roadmapsPer30Days;
  return `You've used this month's ${n} free ${n === 1 ? "roadmap" : "roadmaps"}. ${PLAN_NAMES.premium} and ${PLAN_NAMES.max} include more: ${
    isPhase2Enabled() ? "compare plans on the pricing page" : "join the waitlist on the pricing page"
  }.`;
}

/** Shown when a paid plan has used its roadmaps for the month. Free has its own wording, above. */
export function roadmapLimitMessage(plan: Plan): string {
  if (plan === "free") return freeRoadmapLimitMessage();
  const n = ENTITLEMENTS[plan].roadmapsPer30Days;
  return `You've used this month's ${n} ${n === 1 ? "roadmap" : "roadmaps"}. A new one opens up as the oldest turns 30 days old.`;
}

/**
 * Prices (Rory, 12 Nov 2026: £9 and £15). A launch or new-joiner discount would be a Stripe
 * promotion code on top of these, not a different figure here. Billed per BILLING_PERIOD.
 */
export const PRICES: Partial<Record<Plan, string>> = { free: "£0", premium: "£9", max: "£15" };
/** Assumed monthly until Rory confirms. */
export const BILLING_PERIOD = "month";

function refreshes(n: number): string {
  return n === 1 ? "1 roadmap refresh a month" : `${n} roadmap refreshes a month`;
}

function exhbtCount(n: number, hosted: boolean): string {
  const noun = n === 1 ? "exhbt" : "exhbts";
  const prefix = hosted ? "Up to " : "";
  return `${prefix}${n} ${noun}${hosted ? " hosted" : ""}`;
}

function looksLine(n: number | "all"): string {
  return n === "all" ? "Every portfolio look: colours, fonts and photo shape" : `${n} portfolio looks to choose from`;
}

const SAVED_IDEAS_LINE = "A saved list of project ideas from every roadmap";

function jobLinksLine(): string {
  const line = `A custom link for every job: we pick your ${EXHBTS_PER_JOB_LINK} best fits`;
  return JOB_LINKS_LIVE || !isPhase2Enabled() ? line : `${line} (coming soon)`;
}

/** What each tier includes, as short checklist lines (pricing page and home summary). */
export function planFeatures(plan: "free" | "premium" | "max"): string[] {
  const e = ENTITLEMENTS[plan];
  const link = portfolioHost("you");
  switch (plan) {
    case "free":
      return [
        "Skills roadmap for the job you want",
        refreshes(e.roadmapsPer30Days),
        `Build and preview ${exhbtCount(e.exhbts, false)}`,
        "Emailed to you to keep",
      ];
    case "premium":
      return [
        `${exhbtCount(e.exhbts, true)} on ${link}`,
        ...(e.drafting ? ["Drafted for you from your files, then yours to edit"] : []),
        ...(e.originalityCheck
          ? [ORIGINALITY_CHECK_LIVE ? "An originality check when you publish" : "An originality check when you publish (coming soon)"]
          : []),
        refreshes(e.roadmapsPer30Days),
        ...(e.savedIdeas ? [SAVED_IDEAS_LINE] : []),
        looksLine(e.portfolioThemes),
      ];
    case "max":
      return [
        `${exhbtCount(e.exhbts, true)} on ${link}`,
        ...(e.jobLinks ? [jobLinksLine()] : []),
        ...(e.drafting ? ["Drafted for you from your files, then yours to edit"] : []),
        ...(e.originalityCheck
          ? [ORIGINALITY_CHECK_LIVE ? "An originality check when you publish" : "An originality check when you publish (coming soon)"]
          : []),
        refreshes(e.roadmapsPer30Days),
        ...(e.savedIdeas ? [SAVED_IDEAS_LINE] : []),
        looksLine(e.portfolioThemes),
      ];
  }
}
