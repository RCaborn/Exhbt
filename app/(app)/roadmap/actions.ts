"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { RoadmapInputSchema } from "@/lib/ai/schemas";
import { extractCvText } from "@/lib/cv";
import { getStore } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { callerIpHash, grantBrowserAccess } from "@/lib/access";
import { hashInput } from "@/lib/hash";

export type FormState =
  | { error?: string; fieldErrors?: Partial<Record<"cv" | "targetRole" | "email", string>>; step?: number }
  | undefined;

const PER_EMAIL_PER_DAY = 3;
const PER_IP_PER_DAY = 10;

/**
 * The single submit for the roadmap builder. Creates the roadmap, remembers this
 * browser as allowed to view it, and sends the visitor straight to the result.
 * Generation and the roadmap email happen on the result page (/api/roadmap/[id]/generate).
 */
export async function startRoadmap(_prev: FormState, form: FormData): Promise<FormState> {
  // The wizard extracts CV text in the browser. A file only arrives here without JavaScript.
  let cvText = String(form.get("cvText") ?? "");
  const file = form.get("cvFile");
  if (!cvText && file instanceof File && file.size > 0) {
    try {
      cvText = await extractCvText(file);
    } catch (e) {
      return { fieldErrors: { cv: (e as Error).message }, step: 2 };
    }
  }

  const parsed = RoadmapInputSchema.safeParse({
    cvText,
    skills: form.get("skills") ?? "",
    targetRole: form.get("targetRole") ?? "",
    ambitions: form.get("ambitions") ?? "",
  });
  const user = await getCurrentUser();
  const email = z.email().safeParse(user?.email ?? String(form.get("email") ?? "").trim().toLowerCase());

  if (!parsed.success || !email.success) {
    const fieldErrors: NonNullable<FormState>["fieldErrors"] = {};
    for (const issue of parsed.error?.issues ?? []) {
      const key = issue.path[0] === "cvText" ? "cv" : issue.path[0] === "targetRole" ? "targetRole" : null;
      if (key) fieldErrors[key] ??= issue.message;
    }
    if (!email.success) fieldErrors.email = "Enter a valid email address.";
    // Send the visitor back to the first step with a problem.
    const step = fieldErrors.targetRole ? 1 : fieldErrors.cv ? 2 : 4;
    return { fieldErrors, step };
  }

  const store = getStore();
  const ipHash = await callerIpHash();
  if (
    (await store.countRecentRoadmaps(email.data, 24)) >= PER_EMAIL_PER_DAY ||
    (await store.countRecentByIpHash(ipHash, 24)) >= PER_IP_PER_DAY
  ) {
    return {
      error: "You've made the most roadmaps we allow in a day. Please come back tomorrow.",
      step: 4,
    };
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
