import { ENTITLEMENTS, PLAN_NAMES, roadmapLimitMessage, type Plan } from "./entitlements";
import { planForTheme, themeAllowedOn, type PortfolioTheme } from "./portfolio-themes";
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
  const upgradeTo = nextPlan(plan);
  return {
    ok: false,
    reason: `Your plan holds ${max} ${max === 1 ? "exhbt" : "exhbts"}. ${
      upgradeTo ? `Delete one, or move to ${PLAN_NAMES[upgradeTo]} for ${ENTITLEMENTS[upgradeTo].exhbts}.` : "Delete one to start another."
    }`,
    upgradeTo,
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
  const upgradeTo = nextPlan(plan);
  return {
    ok: false,
    reason: `You have ${live} live, the most your plan shows. Unpublish one first${upgradeTo ? `, or move to ${PLAN_NAMES[upgradeTo]}` : ""}.`,
    upgradeTo,
  };
}

/** The plan one step up, for an upgrade offer, or undefined at the top (Max, universities). */
export function nextPlan(plan: Plan): Plan | undefined {
  return plan === "free" ? "premium" : plan === "premium" ? "max" : undefined;
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

/** Can they start another roadmap? `recent` is how many they made in the last 30 days. */
export function canStartRoadmap(plan: Plan, recent: number): Verdict {
  if (recent < ENTITLEMENTS[plan].roadmapsPer30Days) return { ok: true };
  return { ok: false, reason: roadmapLimitMessage(plan), upgradeTo: nextPlan(plan) };
}

/** Saved ideas (a list kept across roadmaps) come with the paid plans. */
export function canSaveIdeas(plan: Plan): Verdict {
  if (ENTITLEMENTS[plan].savedIdeas) return { ok: true };
  return { ok: false, reason: `Saving ideas to a list you keep comes with ${PLAN_NAMES.premium}.`, upgradeTo: "premium" };
}

/** Can they use this portfolio look? The cheapest plan that has it is the upgrade offer. */
export function canUseTheme(plan: Plan, theme: PortfolioTheme): Verdict {
  if (themeAllowedOn(plan, theme)) return { ok: true };
  const upgradeTo = planForTheme(theme);
  return { ok: false, reason: `The ${theme.name} look comes with ${PLAN_NAMES[upgradeTo]}.`, upgradeTo };
}
