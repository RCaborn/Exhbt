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

/** Remaining regenerations across all three ideas. */
export function swapsLeft(ideas: ProjectIdea[], perIdeaLimit: number): number {
  return ideas.reduce((n, idea) => n + Math.max(0, perIdeaLimit - idea.swapsUsed), 0);
}

/** The plan is settled once they keep it, or every idea has used its regenerations. */
export function planDone(record: RoadmapRecord, ideas: ProjectIdea[], perIdeaLimit: number): boolean {
  return Boolean(record.planConfirmedAt) || (ideas.length > 0 && swapsLeft(ideas, perIdeaLimit) === 0);
}
