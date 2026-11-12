import { ENTITLEMENTS, PLAN_NAMES, type Plan } from "./entitlements";
import type { ExhbtRecord } from "./store";

/**
 * What a plan allows, as pure rules (no database), so pages, server actions and tests share them.
 * Figures come from lib/entitlements.ts. lib/plan.ts finds the plan; these decide.
 */

export const limitsFor = (plan: Plan) => ENTITLEMENTS[plan];

export type Verdict = { ok: true } | { ok: false; reason: string; upgradeTo?: Plan };

/** Can they start another exhbt? Free has one; paid plans have their count (drafts and live together). */
export function canCreateExhbt(plan: Plan, existing: ExhbtRecord[]): Verdict {
  const max = ENTITLEMENTS[plan].exhbts;
  if (existing.length < max) return { ok: true };
  return {
    ok: false,
    reason: `Your plan holds ${max} ${max === 1 ? "exhbt" : "exhbts"}. Delete one, or upgrade for more.`,
    upgradeTo: plan === "free" ? "premium" : plan === "premium" ? "max" : undefined,
  };
}

/** Can this exhbt go live? Free can't publish; paid plans up to their count of live exhbts. */
export function canPublish(plan: Plan, existing: ExhbtRecord[], exhbtId: string): Verdict {
  const e = ENTITLEMENTS[plan];
  if (!e.publicPortfolio) {
    return { ok: false, reason: `Publishing to your own link comes with ${PLAN_NAMES.premium}.`, upgradeTo: "premium" };
  }
  const live = existing.filter((x) => x.status === "published" && x.id !== exhbtId).length;
  if (live < e.exhbts) return { ok: true };
  return {
    ok: false,
    reason: `You have ${live} live, the most your plan shows. Unpublish one first, or upgrade.`,
    upgradeTo: plan === "premium" ? "max" : undefined,
  };
}

/** Per-job links are a Max feature. */
export function canMakeJobLinks(plan: Plan, activeLinks: number): Verdict {
  const e = ENTITLEMENTS[plan];
  if (!e.jobLinks) return { ok: false, reason: `Links for each job come with ${PLAN_NAMES.max}.`, upgradeTo: "max" };
  if (activeLinks >= e.jobLinksActive) return { ok: false, reason: "Turn off an old job link to make a new one." };
  return { ok: true };
}

/**
 * Which live exhbts a portfolio shows. After a downgrade, nothing is deleted: only the first
 * N (in the person's order) stay visible until they choose (docs/phase-2.md section 1).
 */
export function visibleOnPortfolio(plan: Plan, exhbts: ExhbtRecord[]): ExhbtRecord[] {
  const e = ENTITLEMENTS[plan];
  if (!e.publicPortfolio) return [];
  return exhbts
    .filter((x) => x.status === "published" && x.published && x.slug)
    .sort((a, b) => a.position - b.position)
    .slice(0, e.exhbts);
}
