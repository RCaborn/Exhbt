"use server";

import { redirect } from "next/navigation";
import { RoadmapInputSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { callerIpHash, grantBrowserAccess } from "@/lib/access";
import { hashInput } from "@/lib/hash";
import { ENTITLEMENTS, freeRoadmapLimitMessage } from "@/lib/entitlements";

type Field = "targetRole" | "cv" | "situation" | "education";
export type FormState = { error?: string; fieldErrors?: Partial<Record<Field, string>>; step?: number } | undefined;

/**
 * Which builder step each field lives on: job, CV, then situation with education and skills.
 * The email is asked for later, at the project-ideas gate (docs/decisions/0004).
 */
const STEP_OF: Record<Field, number> = { targetRole: 1, cv: 2, situation: 3, education: 3 };
const LAST_STEP = 3;

/** Free plan refreshes: roadmaps per email in any 30 days (lib/entitlements.ts). */
const FREE_PER_30_DAYS = ENTITLEMENTS.free.roadmapsPer30Days;
/** Abuse guard, independent of plan. The end-to-end tests raise it: they build many roadmaps from one address. */
const PER_IP_PER_DAY = (process.env.NODE_ENV !== "production" && Number(process.env.EXHBT_PER_IP_PER_DAY)) || 10;

/**
 * The single submit for the roadmap builder. Creates the roadmap, remembers this
 * browser as allowed to view it, and sends the visitor straight to the result.
 * Generation and the roadmap email happen on the result page (/api/roadmap/[id]/generate).
 */
export async function startRoadmap(_prev: FormState, form: FormData): Promise<FormState> {
  // CV files are read in the browser (lib/cv-client.ts); only the extracted text arrives here.
  // Parsing files on the server was removed: it doubled the Worker size and its CPU use.
  const parsed = RoadmapInputSchema.safeParse({
    targetRole: form.get("targetRole") ?? "",
    situation: form.get("situation") ?? undefined,
    situationDetail: form.get("situationDetail") ?? "",
    education: form.get("education") ?? "",
    skills: form.get("skills") ?? "",
    cvText: form.get("cvText") ?? "",
  });
  const user = await getCurrentUser();

  if (!parsed.success) {
    const fieldErrors: NonNullable<FormState>["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      const key: Field = p === "targetRole" || p === "situation" ? p : p === "cvText" ? "cv" : "education";
      fieldErrors[key] ??= issue.message;
    }
    // Send the visitor back to the first step with a problem.
    const step = Math.min(...(Object.keys(fieldErrors) as Field[]).map((f) => STEP_OF[f]));
    return { fieldErrors, step };
  }

  const store = getStore();
  const ipHash = await callerIpHash();
  // Signed in: the email is known now, so the free limit applies here. Signed out: at the gate.
  if (user && (await store.countRecentRoadmaps(user.email, 24 * 30)) >= FREE_PER_30_DAYS) {
    return { error: freeRoadmapLimitMessage(), step: LAST_STEP };
  }
  if ((await store.countRecentByIpHash(ipHash, 24)) >= PER_IP_PER_DAY) {
    return { error: "Too many roadmaps from this connection today. Please try again tomorrow.", step: LAST_STEP };
  }

  const id = await store.createRoadmap({
    email: user?.email ?? null,
    input: parsed.data,
    inputHash: await hashInput(parsed.data),
    ipHash,
  });
  await grantBrowserAccess(id);
  if (user) await store.claimPendingRoadmaps(user.email, user.id);
  await store.logEvent("signup_started", user?.id ?? null, { source: "roadmap" });

  redirect(`/roadmap/${id}`);
}
