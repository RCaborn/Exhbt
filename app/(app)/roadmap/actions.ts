"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { RoadmapInputSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { callerIpHash, grantBrowserAccess } from "@/lib/access";
import { hashInput } from "@/lib/hash";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";

type Field = "targetRole" | "cv" | "situation" | "education" | "email";
export type FormState = { error?: string; fieldErrors?: Partial<Record<Field, string>>; step?: number } | undefined;

/** Which builder step each field lives on (docs/decisions/0003: job, CV, situation with education and skills, email). */
const STEP_OF: Record<Field, number> = { targetRole: 1, cv: 2, situation: 3, education: 3, email: 4 };

/** Free plan refreshes: roadmaps per email in any 30 days (lib/entitlements.ts). */
const FREE_PER_30_DAYS = ENTITLEMENTS.free.roadmapsPer30Days;
/** Abuse guard, independent of plan. */
const PER_IP_PER_DAY = 10;

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
  const email = z.email().safeParse(user?.email ?? String(form.get("email") ?? "").trim().toLowerCase());

  if (!parsed.success || !email.success) {
    const fieldErrors: NonNullable<FormState>["fieldErrors"] = {};
    for (const issue of parsed.error?.issues ?? []) {
      const p = issue.path[0];
      const key: Field | null =
        p === "targetRole" || p === "situation" ? p : p === "cvText" ? "cv" : p === "email" ? null : "education";
      if (key) fieldErrors[key] ??= issue.message;
    }
    if (!email.success) fieldErrors.email = "Enter a valid email address.";
    // Send the visitor back to the first step with a problem.
    const step = Math.min(...(Object.keys(fieldErrors) as Field[]).map((f) => STEP_OF[f]));
    return { fieldErrors, step };
  }

  const store = getStore();
  const ipHash = await callerIpHash();
  if ((await store.countRecentRoadmaps(email.data, 24 * 30)) >= FREE_PER_30_DAYS) {
    return {
      error: `You've used this month's ${FREE_PER_30_DAYS} free ${FREE_PER_30_DAYS === 1 ? "roadmap" : "roadmaps"}. ${PLAN_NAMES.plus} and ${PLAN_NAMES.premium} include more: join the waitlist on the pricing page.`,
      step: 4,
    };
  }
  if ((await store.countRecentByIpHash(ipHash, 24)) >= PER_IP_PER_DAY) {
    return { error: "Too many roadmaps from this connection today. Please try again tomorrow.", step: 4 };
  }

  const id = await store.createRoadmap({
    email: email.data,
    input: parsed.data,
    inputHash: await hashInput(parsed.data),
    ipHash,
    marketingOptIn: form.get("marketingOptIn") === "yes",
  });
  await grantBrowserAccess(id);
  if (user) await store.claimPendingRoadmaps(user.email, user.id);
  await store.logEvent("signup_started", user?.id ?? null, { source: "roadmap" });

  redirect(`/roadmap/${id}`);
}
