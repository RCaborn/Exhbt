import "server-only";
import { getStore, type ProjectIdea, type RoadmapRecord } from "@/lib/store";

/**
 * The project-ideas gate (docs/decisions/0004): the radar shows without an email, and the
 * project ideas once we have one. A roadmap built while signed in, or made before the gate
 * existed, already has an email, so it's open.
 */
export function projectsUnlocked(record: RoadmapRecord): boolean {
  return Boolean(record.pendingEmail || record.userId);
}

/** A roadmap's plan ideas (up to three), seeded from its generated projects on first use. */
export async function ideasFor(record: RoadmapRecord): Promise<ProjectIdea[]> {
  const store = getStore();
  const ideas = await store.listProjectIdeas(record.id);
  if (ideas.length > 0 || !record.output?.projects.length) return ideas;
  await store.seedProjectIdeas(record.id, record.output.projects);
  return store.listProjectIdeas(record.id);
}

/** The plan is settled once they keep it or use their last swap: no more swaps after that. */
export function planDone(record: RoadmapRecord, swapsAllowed: number): boolean {
  return Boolean(record.planConfirmedAt) || record.projectSwapsUsed >= swapsAllowed;
}
