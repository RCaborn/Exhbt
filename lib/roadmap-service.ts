import "server-only";
import { recordAIFailure } from "@/lib/ai-failures";
import { generateRoadmap } from "./ai/roadmap";
import { findJobProfile } from "./jobs";
import { getStore, type RoadmapRecord } from "./store";
import { siteOrigin, signInLinkFor } from "./auth";
import { sign } from "./access";
import { sendEmail } from "./email/send";
import { roadmapReadyEmail } from "./email/templates/roadmap-ready";
import type { Project, Roadmap } from "./ai/schemas";
import { startIdeas } from "./roadmap/ideas";

export class GenerationError extends Error {}

/**
 * Makes sure a roadmap has output (cache first, then the model) and, if its email is known,
 * that the email has gone out once. Safe to call repeatedly: a second call does no AI work
 * and sends nothing.
 */
export async function ensureRoadmap(record: RoadmapRecord, userId: string | null): Promise<Roadmap> {
  const store = getStore();
  let roadmap = record.output;

  if (!roadmap) {
    roadmap = await store.findCachedOutput(record.inputHash);
    const fromCache = roadmap !== null;
    if (!roadmap) {
      try {
        const job = await findJobProfile(record.input.targetRole);
        const result = await generateRoadmap(record.input, job);
        roadmap = result.roadmap;
        await store.logAICall({
          userId,
          step: "roadmap",
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
        });
      } catch (e) {
        await recordAIFailure("roadmap", { userId }, e, { roadmapId: record.id });
        throw new GenerationError((e as Error).message);
      }
    }
    if (!(await store.saveRoadmapOutput(record.id, roadmap))) {
      // Another generation of this roadmap (a reload, a second tab) saved first. Its result stands,
      // and that call sends the email and starts the ideas: this one only hands back what was saved.
      const stored = (await store.getRoadmap(record.id))?.output;
      if (stored) return stored;
    }
    await store.logEvent("roadmap_completed", userId, { cached: fromCache });
  }
  // Start the project ideas now, in the background, so they're ready by the time the person
  // has been through the gate (docs/decisions/0019). Idempotent; a failure here is not fatal,
  // because the Projects page starts them again if they never began.
  await startIdeas(record.id).catch((e) => console.error("starting project ideas failed", (e as Error).message));

  await emailRoadmapOnce(record, roadmap, userId);
  return roadmap;
}

/**
 * Sends the roadmap email the first time it's possible: when the roadmap has output and an
 * email. That's straight after generation for someone signed in, and at the project-ideas
 * gate for everyone else (docs/decisions/0004). Safe to call repeatedly.
 */
export async function emailRoadmapOnce(record: RoadmapRecord, roadmap: Roadmap, userId: string | null) {
  const store = getStore();
  if (!record.pendingEmail || !(await store.markEmailSent(record.id))) return;
  try {
    await sendRoadmapEmail(record, roadmap, (await store.listProjectIdeas(record.id)).slice(0, 2));
    await store.logEvent("roadmap_emailed", userId);
  } catch (e) {
    // The roadmap is already on screen; a failed email must not break that.
    console.error("roadmap email failed", (e as Error).message);
  }
}

async function sendRoadmapEmail(record: RoadmapRecord, roadmap: Roadmap, projects: Project[]) {
  const to = record.pendingEmail!;
  const origin = await siteOrigin();
  const path = `/roadmap/${record.id}`;
  const unsubscribeUrl = `${origin}/api/email/unsubscribe?token=${encodeURIComponent(await sign(`unsub:${to}`))}`;
  const content = roadmapReadyEmail({
    roadmap,
    projects,
    signInUrl: await signInLinkFor(to, path),
    viewUrl: `${origin}${path}`,
    unsubscribeUrl,
    privacyUrl: `${origin}/legal/privacy`,
    logoUrl: `${origin}/brand/exhbt-mark.png`,
  });
  await sendEmail({ to, ...content, unsubscribeUrl });
}
