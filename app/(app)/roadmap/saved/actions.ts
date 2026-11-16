"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { canSaveIdeas, getPlan } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

/**
 * Saved ideas (docs/decisions/0010): a paid plan keeps copies of project ideas in one list
 * across roadmaps. Every rule is checked here; the pages only show it.
 */

/**
 * The star on an idea in a roadmap's Projects view: saves a copy, or takes it off the list if
 * this idea is already there. Reads the idea from the store, never from the page.
 */
export async function toggleSavedIdea(roadmapId: string, ideaId: string): Promise<void> {
  if (!isPhase2Enabled()) notFound();
  const back = `/roadmap/${roadmapId}?view=projects`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  // Refused: the Projects page shows the locked star and the upgrade offer.
  if (!canSaveIdeas(await getPlan(user.id)).ok) redirect(back);

  const store = getStore();
  const record = await store.getRoadmap(roadmapId);
  if (!record || !(await canView(record, user))) notFound();
  const idea = (await store.listProjectIdeas(roadmapId)).find((i) => i.id === ideaId);
  if (!idea) redirect(back);

  const already = (await store.listSavedIdeas(user.id)).find((s) => s.roadmapId === roadmapId && s.title === idea.title);
  if (already) {
    await store.removeSavedIdea(already.id, user.id);
  } else {
    const result = await store.saveIdea(user.id, { roadmapId, targetRole: record.input.targetRole, idea });
    if (result === "full") redirect("/roadmap/saved?full=1");
  }
  revalidatePath(`/roadmap/${roadmapId}`);
  revalidatePath("/roadmap/saved");
}

/** "Remove" on the saved list. */
export async function removeSavedIdea(savedId: string): Promise<void> {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/roadmap/saved");
  await getStore().removeSavedIdea(savedId, user.id);
  revalidatePath("/roadmap/saved");
}
