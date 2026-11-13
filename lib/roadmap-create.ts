import "server-only";
import type { RoadmapInput } from "./ai/schemas";
import { callerIpHash, grantBrowserAccess } from "./access";
import type { Plan } from "./entitlements";
import { hashInput } from "./hash";
import { canStartRoadmap, getPlan } from "./plan";
import { getStore } from "./store";

/** Abuse guard, independent of plan. The end-to-end tests raise it: they build many roadmaps from one address. */
const PER_IP_PER_DAY = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_PER_IP_PER_DAY)) || 10;

export type CreateRoadmapResult =
  | { ok: true; id: string }
  | { ok: false; error: string; /** Set when the plan's roadmap allowance is used up. */ limit?: { upgradeTo?: Plan } };

/**
 * Makes a roadmap from checked input, for the builder (`startRoadmap`) and for "new roadmap for
 * a different job" (`startRoadmapForJob`): the plan's roadmaps per 30 days (signed in; signed out
 * it is checked at the project-ideas gate, where the email is known), the per-connection guard,
 * the record, browser access and claiming earlier roadmaps. The caller redirects.
 */
export async function createRoadmapFor(
  input: RoadmapInput,
  user: { id: string; email: string } | null,
): Promise<CreateRoadmapResult> {
  const store = getStore();
  const ipHash = await callerIpHash();
  if (user) {
    const verdict = canStartRoadmap(await getPlan(user.id), await store.countRecentRoadmaps(user.email, 24 * 30));
    if (!verdict.ok) return { ok: false, error: verdict.reason, limit: { upgradeTo: verdict.upgradeTo } };
  }
  if ((await store.countRecentByIpHash(ipHash, 24)) >= PER_IP_PER_DAY) {
    return { ok: false, error: "Too many roadmaps from this connection today. Please try again tomorrow." };
  }

  const id = await store.createRoadmap({
    email: user?.email ?? null,
    input,
    inputHash: await hashInput(input),
    ipHash,
  });
  await grantBrowserAccess(id);
  if (user) await store.claimPendingRoadmaps(user.email, user.id);
  await store.logEvent("signup_started", user?.id ?? null, { source: "roadmap" });
  return { ok: true, id };
}
