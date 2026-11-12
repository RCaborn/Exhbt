import "server-only";
import { PLAN_NAMES } from "./entitlements";
import { canCreateExhbt, getPlan, limitsFor } from "./plan";
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

export type DraftVerdict = ({ ok: true } | { ok: false; reason: string; status: number }) & DraftAllowance;

export async function draftVerdict(userId: string): Promise<DraftVerdict> {
  const store = getStore();
  const plan = await getPlan(userId);
  const e = limitsFor(plan);
  const [used, existing] = await Promise.all([
    store.countRecentEventsForUser("exhbt_drafted", userId, DRAFT_WINDOW_HOURS),
    store.listExhbts(userId),
  ]);
  const allowance: DraftAllowance = {
    perPeriod: e.draftsPer30Days,
    left: Math.max(0, e.draftsPer30Days - used),
    uploadMbPerFile: e.uploadMbPerFile,
    storageMbTotal: e.storageMbTotal,
  };
  if (!e.drafting) return { ok: false, status: 403, reason: `AI drafting isn't part of the ${PLAN_NAMES[plan]} plan.`, ...allowance };
  if (allowance.left === 0) {
    const n = e.draftsPer30Days;
    return {
      ok: false,
      status: 429,
      reason: `You've used your ${n} AI ${n === 1 ? "draft" : "drafts"} for the last 30 days. ${
        plan === "free" || plan === "premium" ? "Upgrade for more, or wait" : "Wait"
      } until one frees up.`,
      ...allowance,
    };
  }
  const room = canCreateExhbt(plan, existing);
  if (!room.ok) return { ok: false, status: 403, reason: room.reason, ...allowance };
  return { ok: true, ...allowance };
}
