"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { RoadmapInputSchema } from "@/lib/ai/schemas";
import { getStore } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import type { Plan } from "@/lib/entitlements";
import { createRoadmapFor } from "@/lib/roadmap-create";

type Field = "targetRole" | "cv" | "situation" | "education";
export type FormState = { error?: string; fieldErrors?: Partial<Record<Field, string>>; step?: number } | undefined;

/**
 * Which builder step each field lives on: job, CV, then situation with education and skills.
 * The email is asked for later, at the project-ideas gate (docs/decisions/0004).
 */
const STEP_OF: Record<Field, number> = { targetRole: 1, cv: 2, situation: 3, education: 3 };
const LAST_STEP = 3;

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

  try {
    const made = await createRoadmapFor(parsed.data, user);
    if (!made.ok) return { error: made.error, step: LAST_STEP };
    redirect(`/roadmap/${made.id}`);
  } catch (e) {
    unstable_rethrow(e); // redirect() / notFound()
    console.error("startRoadmap failed", e);
    return { error: "That didn't work. Please try again in a moment.", step: LAST_STEP };
  }
}

export type NewJobState = { error?: string; limit?: { upgradeTo?: Plan }; fieldError?: string } | undefined;

/**
 * "New roadmap for a different job" on My roadmaps: only the job is asked for. Everything else
 * (situation, education, skills, CV) is copied from the person's newest roadmap, and the same
 * checks as the builder apply (the plan's roadmaps per 30 days, the per-connection guard).
 */
export async function startRoadmapForJob(_prev: NewJobState, form: FormData): Promise<NewJobState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/roadmap");
  const targetRole = String(form.get("targetRole") ?? "").trim();
  if (targetRole.length < 2) return { fieldError: "Describe the job you want." };
  if (targetRole.length > 300) return { fieldError: "Keep the job to a short description." };

  try {
    const latest = await getStore().latestRoadmapFor(user.id);
    if (!latest) redirect("/roadmap/new");
    const parsed = RoadmapInputSchema.safeParse({ ...latest.input, targetRole });
    if (!parsed.success) redirect(`/roadmap/new?from=${latest.id}&role=${encodeURIComponent(targetRole.slice(0, 120))}`);
    const made = await createRoadmapFor(parsed.data, user);
    if (!made.ok) return { error: made.error, limit: made.limit };
    redirect(`/roadmap/${made.id}`);
  } catch (e) {
    unstable_rethrow(e);
    console.error("startRoadmapForJob failed", e);
    return { error: "That didn't work. Please try again in a moment." };
  }
}
