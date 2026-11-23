import "server-only";
import { failureProps, type AIFeature } from "@/lib/ai/failure";
import { getStore, type EventName } from "@/lib/store";

/**
 * Failed AI calls, recorded and limited (decision 0025). Every caller of an AI feature logs a
 * failure event when the call fails: the feature, the reason, the HTTP status and the tokens spent,
 * never text from the person's files or the model's answer. The admin panel counts them.
 *
 * A failure never uses up a person's allowance (drafts, rewrites and the rest count only on
 * success). So that a call that keeps failing can't be retried without limit at our cost, one
 * person (or, signed out, one roadmap) gets at most FAILURES_PER_DAY failed calls of a feature in
 * 24 hours; after that the feature says so and makes no call until the oldest failure is a day old.
 * The key goes in the event's props as `ipHash`, the field countRecentEvents reads (as the intro's
 * own daily limit does).
 */

/** The event each feature's failure is logged as. Roadmaps, ideas and CV reads keep their old names. */
export const FAILURE_EVENT: Record<AIFeature, EventName> = {
  exhbt_draft: "exhbt_draft_failed",
  exhbt_rewrite: "exhbt_rewrite_failed",
  figure_pick: "figure_pick_failed",
  job_match: "job_match_failed",
  portfolio_intro: "intro_failed",
  project_ideas: "ideas_failed",
  project_swap: "swap_failed",
  roadmap: "roadmap_failed",
  file_read: "file_read_failed",
};

export const FAILURES_PER_DAY = 5;

export const TOO_MANY_FAILURES = "This isn't working for you at the moment, and we've been told. Nothing was used up. Try again tomorrow.";

type Who = { userId: string | null; key?: string };

/** Logs the failure (console and a failure event). `event` overrides the feature's usual name (CV reads). */
export async function recordAIFailure(feature: AIFeature, who: Who, e: unknown, extra: Record<string, unknown> = {}, event?: EventName): Promise<void> {
  const props = failureProps(e, feature);
  // The console line carries the same fields: an AIFailure's message has no text from the person or the model.
  console.error(`${feature} failed`, JSON.stringify(props));
  const key = who.key ?? who.userId;
  await getStore()
    .logEvent(event ?? FAILURE_EVENT[feature], who.userId, { ...props, ...extra, ...(key ? { ipHash: key } : {}) })
    .catch((err) => console.error("failure event not logged", (err as Error).message));
}

/** True when this person (or key) has had FAILURES_PER_DAY failures of this feature in the last 24 hours. */
export async function tooManyFailures(feature: AIFeature, who: Who, event?: EventName): Promise<boolean> {
  const key = who.key ?? who.userId;
  if (!key) return false;
  return (await getStore().countRecentEvents(event ?? FAILURE_EVENT[feature], key, 24)) >= FAILURES_PER_DAY;
}
