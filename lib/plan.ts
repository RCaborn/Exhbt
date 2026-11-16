import "server-only";
import type { Plan } from "./entitlements";
import { getStore } from "./store";

/**
 * The plan a person is on, and what it lets them do. Every limit is checked here, on the
 * server, never only in the page. Figures come from lib/entitlements.ts.
 */

/**
 * The plan that applies to this person now (theirs, never the viewer's). In development the
 * in-memory store's plan can be set from /dev/portfolio, so plans can be tried without Stripe.
 */
export async function getPlan(userId: string): Promise<Plan> {
  return getStore().planFor(userId);
}

export * from "./plan-rules";
