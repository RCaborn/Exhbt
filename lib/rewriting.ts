import "server-only";
import { PLAN_NAMES } from "./entitlements";
import { getPlan, limitsFor } from "./plan";
import { getStore } from "./store";

/**
 * Whether someone may rewrite another block of one exhbt. Figures come from lib/entitlements.ts
 * (blockRegenerations, per exhbt). Rewrites are counted as `exhbt_rewritten` events carrying the
 * exhbt id. Shared by the editor page (to show "n left") and the rewrite action (to enforce it).
 */
export type RewriteAllowance = { limit: number; used: number; left: number; reason: string | null };

export async function rewriteAllowance(userId: string, exhbtId: string): Promise<RewriteAllowance> {
  const plan = await getPlan(userId);
  const limit = limitsFor(plan).blockRegenerations;
  const used = await getStore().countEventsForExhbt("exhbt_rewritten", userId, exhbtId);
  const left = Math.max(0, limit - used);
  const reason =
    left > 0
      ? null
      : limit === 0
        ? `Rewriting isn't part of the ${PLAN_NAMES[plan]} plan.`
        : `You've used all ${limit} ${limit === 1 ? "rewrite" : "rewrites"} for this exhbt on the ${PLAN_NAMES[plan]} plan.`;
  return { limit, used, left, reason };
}
