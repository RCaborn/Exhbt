import "server-only";
import { getStore, type ProjectIdea, type RoadmapRecord } from "@/lib/store";
import { generateIdeas } from "@/lib/ai/projects";
import { runInBackground } from "@/lib/background";

/**
 * The project-ideas gate (docs/decisions/0004): the radar shows without an email, and the
 * project ideas once we have one. A roadmap built while signed in, or made before the gate
 * existed, already has an email, so it's open.
 */
export function projectsUnlocked(record: RoadmapRecord): boolean {
  return Boolean(record.pendingEmail || record.userId);
}

/** How long a started run is believed before it counts as lost (a Worker that was cut off). */
export const IDEAS_STALE_MS = 75_000;
/** Starts per roadmap, first try included. The retry button stops here. */
export const IDEAS_MAX_ATTEMPTS = 5;

/**
 * Where a roadmap's ideas stand (docs/decisions/0019). "ready": there are ideas to show.
 * "pending": a try is running. "failed": the last try failed or was lost. "limit": too many tries.
 * "idle": never started (a roadmap made before this existed, or the first request hasn't landed).
 */
export type IdeasStatus = "ready" | "pending" | "failed" | "limit" | "idle";

/** A roadmap's plan ideas (up to three), seeded from projects stored in its output on first use. */
export async function ideasFor(record: RoadmapRecord): Promise<ProjectIdea[]> {
  const store = getStore();
  const ideas = await store.listProjectIdeas(record.id);
  if (ideas.length > 0 || !record.output?.projects.length) return ideas;
  // Roadmaps written before the ideas became their own step carry them in the output.
  await store.seedProjectIdeas(record.id, record.output.projects);
  return store.listProjectIdeas(record.id);
}

/** Works the status out from what's stored. Pure reading: starts nothing. */
export async function ideasState(record: RoadmapRecord): Promise<{ status: IdeasStatus; ideas: ProjectIdea[] }> {
  const ideas = await ideasFor(record);
  if (ideas.length > 0) return { status: "ready", ideas };
  const started = record.ideasStartedAt ? Date.parse(record.ideasStartedAt) : null;
  if (started === null) return { status: "idle", ideas };
  const stopped = record.ideasAttempts >= IDEAS_MAX_ATTEMPTS ? "limit" : "failed";
  const failed = record.ideasFailedAt !== null && Date.parse(record.ideasFailedAt) >= started;
  // Started and not failed is running, unless it has been silent for too long.
  if (failed || Date.now() - started >= IDEAS_STALE_MS) return { status: stopped, ideas };
  return { status: "pending", ideas };
}

/**
 * Starts making a roadmap's ideas in the background, once. Safe to call from anywhere, any number
 * of times: the claim in the store lets one caller through, so a race never makes two calls.
 * `retry` is the person pressing "Try again"; without it a failed run is left alone. Returns the
 * status straight away; the work carries on after the response (`runInBackground`).
 */
export async function startIdeas(roadmapId: string, opts: { retry?: boolean } = {}): Promise<IdeasStatus> {
  const store = getStore();
  const record = await store.getRoadmap(roadmapId);
  if (!record?.output) return "idle";
  if ((await ideasFor(record)).length > 0) return "ready";

  const attempt = record.ideasAttempts + 1; // read before the claim: the in-memory store shares the record
  const claim = await store.claimIdeasRun(roadmapId, {
    staleMs: IDEAS_STALE_MS,
    maxAttempts: IDEAS_MAX_ATTEMPTS,
    retry: Boolean(opts.retry),
  });
  if (claim === "running") return "pending";
  if (claim === "failed") return "failed";
  if (claim === "limit") return "limit";

  runInBackground(makeIdeas(record, attempt));
  return "pending";
}

async function makeIdeas(record: RoadmapRecord, attempt: number): Promise<void> {
  const store = getStore();
  try {
    const result = await generateIdeas({ input: record.input, roadmap: record.output!, attempt });
    await store.logAICall({
      userId: record.userId,
      step: "project_ideas",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    });
    // Idempotent: the unique (roadmap_id, position) row means a late duplicate changes nothing.
    await store.seedProjectIdeas(record.id, result.projects);
    await store.logEvent("ideas_completed", record.userId, { attempt });
  } catch (e) {
    console.error("project ideas failed", (e as Error).message);
    await store.failIdeasRun(record.id);
    await store.logEvent("ideas_failed", record.userId, { attempt, message: (e as Error).message.slice(0, 200) });
  }
}

/** The plan is settled once they keep it or use their last swap: no more swaps after that. */
export function planDone(record: RoadmapRecord, swapsAllowed: number): boolean {
  return Boolean(record.planConfirmedAt) || record.projectSwapsUsed >= swapsAllowed;
}
