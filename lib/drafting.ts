import "server-only";
import { PLAN_NAMES, type Plan } from "./entitlements";
import { canCreateExhbt, getPlan, limitsFor, nextPlan } from "./plan";
import { getStore } from "./store";

/**
 * Whether someone may ask for another AI draft, shared by /exhbts/new (to show it) and
 * /api/exhbts/draft (to enforce it). Figures come from lib/entitlements.ts.
 */

/** The rolling window for draftsPer30Days. */
export const DRAFT_WINDOW_HOURS = 30 * 24;

export type DraftAllowance = {
  /** AI drafts in the window, and how many are left. */
  perPeriod: number;
  left: number;
  /** Size caps, in MB, for the upload hints. */
  uploadMbPerFile: number;
  storageMbTotal: number;
};

/** `upgradeTo`: the plan that would lift the limit, for the upgrade offer; none on the top plan. */
export type DraftVerdict = ({ ok: true } | { ok: false; reason: string; status: number; upgradeTo?: Plan }) & DraftAllowance;

/**
 * `counted`: the id of a draft just saved and logged, for the re-check after saving
 * (app/api/exhbts/draft). It is left out of both counts, so the question is still "was there
 * room for it?" and not "is there room for one more?".
 */
export async function draftVerdict(userId: string, counted?: string): Promise<DraftVerdict> {
  const store = getStore();
  const plan = await getPlan(userId);
  const e = limitsFor(plan);
  const [used, all] = await Promise.all([
    store.countRecentEventsForUser("exhbt_drafted", userId, DRAFT_WINDOW_HOURS),
    store.listExhbts(userId),
  ]);
  const existing = counted ? all.filter((x) => x.id !== counted) : all;
  const usedBefore = counted ? Math.max(0, used - 1) : used;
  const allowance: DraftAllowance = {
    perPeriod: e.draftsPer30Days,
    left: Math.max(0, e.draftsPer30Days - usedBefore),
    uploadMbPerFile: e.uploadMbPerFile,
    storageMbTotal: e.storageMbTotal,
  };
  if (!e.drafting) return { ok: false, status: 403, reason: `AI drafting isn't part of the ${PLAN_NAMES[plan]} plan.`, ...allowance };
  if (allowance.left === 0) {
    const n = e.draftsPer30Days;
    const upgradeTo = nextPlan(plan);
    return {
      ok: false,
      status: 429,
      reason: `You've used your ${n} AI ${n === 1 ? "draft" : "drafts"} for the last 30 days. ${
        upgradeTo ? `${PLAN_NAMES[upgradeTo]} includes ${limitsFor(upgradeTo).draftsPer30Days}, or wait` : "Wait"
      } until one frees up.`,
      upgradeTo,
      ...allowance,
    };
  }
  const room = canCreateExhbt(plan, existing);
  if (!room.ok) return { ok: false, status: 403, reason: room.reason, upgradeTo: room.upgradeTo, ...allowance };
  return { ok: true, ...allowance };
}
