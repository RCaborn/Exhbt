export type Plan = "free" | "premium" | "institutional";

type Entitlements = {
  /** Roadmaps a person can build per rolling 30 days ("refreshes"). null = no limit. */
  roadmapsPer30Days: number | null;
  /** How many exhbts can be published. 0 = none. */
  exhbts: number;
  /** Per-employer links (the best-fit exhbts for one job advert). */
  employerLinks: boolean;
};

/**
 * Single source of truth for what each plan includes (agreed 6 Nov 2026):
 * - Free: roadmaps with limited refreshes, no exhbts.
 * - Premium: hosted exhbts in a portfolio, plus custom links for different employers.
 * - Institutional: universities pay; their students get Premium.
 * Employers never pay and never need an account.
 */
export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: { roadmapsPer30Days: 3, exhbts: 0, employerLinks: false },
  premium: { roadmapsPer30Days: null, exhbts: 10, employerLinks: true },
  institutional: { roadmapsPer30Days: null, exhbts: 10, employerLinks: true },
};

/** Exhbts picked for a per-employer link. */
export const EXHBTS_PER_EMPLOYER_LINK = 4;

/** Premium has no public price yet: the early release collects a waitlist. */
export const PREMIUM_PRICE: string | null = null;
