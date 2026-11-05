"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { RoadmapInputSchema } from "@/lib/ai/schemas";
import { extractCvText } from "@/lib/cv";
import { getStore } from "@/lib/store";
import { getCurrentUser, sendMagicLink } from "@/lib/auth";
import { hashInput } from "@/lib/hash";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const MAX_ROADMAPS_PER_DAY = 3;
const Email = z.email("Enter a valid email address.");

export async function startRoadmap(_prev: FormState, form: FormData): Promise<FormState> {
  let cvText = String(form.get("cvText") ?? "");
  const file = form.get("cvFile");
  if (file instanceof File && file.size > 0) {
    try {
      cvText = await extractCvText(file);
    } catch (e) {
      return { fieldErrors: { cv: (e as Error).message } };
    }
  }

  const parsed = RoadmapInputSchema.safeParse({
    cvText,
    skills: form.get("skills") ?? "",
    targetRole: form.get("targetRole") ?? "",
    ambitions: form.get("ambitions") ?? "",
  });

  const user = await getCurrentUser();
  const emailRaw = user?.email ?? String(form.get("email") ?? "").trim().toLowerCase();
  const email = Email.safeParse(emailRaw);

  if (!parsed.success || !email.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) {
      const key = issue.path[0] === "cvText" ? "cv" : String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    if (!email.success) fieldErrors.email = "Enter a valid email address.";
    return { fieldErrors };
  }

  const store = getStore();
  if ((await store.countRecentRoadmaps(email.data, 24)) >= MAX_ROADMAPS_PER_DAY) {
    return { error: "You have made three roadmaps today. Try again tomorrow." };
  }

  const id = await store.createPendingRoadmap(email.data, parsed.data, await hashInput(parsed.data));

  if (user) {
    await store.claimPendingRoadmaps(user.email, user.id);
    redirect(`/roadmap/${id}`);
  }

  await store.logEvent("signup_started", null, { source: "roadmap" });
  let devLink: string | undefined;
  try {
    ({ devLink } = await sendMagicLink(email.data, `/roadmap/${id}`));
  } catch {
    return { error: "We could not send the email just now. Please try again in a minute." };
  }
  const q = new URLSearchParams({ email: email.data });
  if (devLink) q.set("dev", devLink);
  redirect(`/check-email?${q}`);
}
