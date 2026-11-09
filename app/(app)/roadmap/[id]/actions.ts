"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getStore } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { ENTITLEMENTS, freeRoadmapLimitMessage } from "@/lib/entitlements";
import { normaliseLinkedin } from "@/lib/cv-contact";
import { emailRoadmapOnce } from "@/lib/roadmap-service";
import { ideasFor, planDone, projectsUnlocked } from "@/lib/roadmap/ideas";
import { generateSwap } from "@/lib/ai/projects";

type GateField = "name" | "email" | "linkedin";
export type GateState = { error?: string; fieldErrors?: Partial<Record<GateField, string>> } | undefined;
export type SwapState = { error?: string; done?: number } | undefined;

async function viewable(roadmapId: string) {
  const user = await getCurrentUser();
  const record = await getStore().getRoadmap(roadmapId);
  if (!record || !(await canView(record, user))) return { user, record: null };
  return { user, record };
}

/**
 * The project-ideas gate: name, email and (optionally) LinkedIn, prefilled from the CV where
 * possible. Records them, sends the roadmap email, and opens the ideas.
 */
export async function unlockProjects(roadmapId: string, _prev: GateState, form: FormData): Promise<GateState> {
  const { user, record } = await viewable(roadmapId);
  if (!record) return { error: "We couldn't find that roadmap. Try opening it again." };
  if (projectsUnlocked(record)) redirect(`/roadmap/${roadmapId}?view=projects`);

  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = z.email().safeParse((user?.email ?? String(form.get("email") ?? "")).trim().toLowerCase());
  const linkedinText = String(form.get("linkedin") ?? "").trim();
  const linkedin = linkedinText ? normaliseLinkedin(linkedinText) : null;

  const fieldErrors: Partial<Record<GateField, string>> = {};
  if (name.length < 2 || name.length > 100) fieldErrors.name = "Enter your name.";
  if (!email.success) fieldErrors.email = "Enter a valid email address.";
  if (linkedinText && !linkedin) fieldErrors.linkedin = "Use your LinkedIn profile address, like linkedin.com/in/your-name.";
  if (!email.success || Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const store = getStore();
  // The free monthly limit, checked here now that the email is known (it isn't at the builder).
  if ((await store.countRecentRoadmaps(email.data, 24 * 30)) >= ENTITLEMENTS.free.roadmapsPer30Days) {
    return { error: freeRoadmapLimitMessage() };
  }

  await store.unlockRoadmap(roadmapId, {
    email: email.data,
    name,
    linkedin,
    marketingOptIn: form.get("marketingOptIn") === "yes",
  });
  if (user) await store.claimPendingRoadmaps(user.email, user.id);
  const unlocked = await store.getRoadmap(roadmapId);
  if (unlocked?.output) await emailRoadmapOnce(unlocked, unlocked.output, user?.id ?? null);
  await store.logEvent("projects_unlocked", user?.id ?? null, { prefilled: form.get("prefilled") === "yes" });

  redirect(`/roadmap/${roadmapId}?view=projects`);
}

/**
 * Swap one idea in the plan for a new one, steered by the "Make some tweaks" note if there is
 * one. The swap buttons submit the idea's id; the note comes from the same form.
 */
export async function swapIdea(roadmapId: string, _prev: SwapState, form: FormData): Promise<SwapState> {
  const note = String(form.get("note") ?? "").trim().replace(/\s+/g, " ");
  if (note.length > 300) return { error: "Keep the note under 300 characters." };

  const { user, record } = await viewable(roadmapId);
  if (!record?.output || !projectsUnlocked(record)) return { error: "We couldn't find that roadmap. Try opening it again." };
  const limit = ENTITLEMENTS.free.projectSwapsPerRoadmap;
  if (planDone(record, limit)) return { error: "Your plan is set. No more swaps." };

  const ideas = await ideasFor(record);
  const replacing = ideas.find((i) => i.id === String(form.get("ideaId") ?? ""));
  if (!replacing) return { error: "We couldn't find that idea. Refresh the page and try again." };

  const store = getStore();
  let result;
  try {
    result = await generateSwap({
      input: record.input,
      roadmap: record.output,
      replacing,
      keeping: ideas.filter((i) => i.id !== replacing.id),
      note,
      round: record.projectSwapsUsed + 1,
    });
  } catch (e) {
    console.error("project swap failed", (e as Error).message);
    return { error: "We couldn't swap that idea just now. Try again." };
  }
  await store.logAICall({
    userId: user?.id ?? null,
    step: "project_ideas",
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  });
  if (!(await store.swapProjectIdea(roadmapId, replacing.id, result.project, limit))) {
    return { error: "Your plan is set. No more swaps." };
  }
  await store.logEvent("project_swapped", user?.id ?? null, { round: record.projectSwapsUsed + 1, withNote: note.length > 0 });
  revalidatePath(`/roadmap/${roadmapId}`);
  return { done: Date.now() };
}

/** Keep the plan as it is: no more swaps. */
export async function keepPlan(roadmapId: string): Promise<void> {
  const { user, record } = await viewable(roadmapId);
  if (!record || !projectsUnlocked(record)) return;
  await getStore().confirmPlan(roadmapId);
  await getStore().logEvent("plan_kept", user?.id ?? null, { swapsUsed: record.projectSwapsUsed });
  revalidatePath(`/roadmap/${roadmapId}`);
}
