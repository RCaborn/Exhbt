/**
 * How an AI call failed, as the app records it (decision 0029). Pure, so pages and tests can use
 * it. Thrown by structuredCall (./call.ts) and transcribe (./transcribe.ts); each caller logs it as
 * a failure event (failureProps) and the admin panel counts them.
 */

/** Every AI feature, as named in failure events and the admin panel. */
export type AIFeature =
  | "exhbt_draft"
  | "exhbt_rewrite"
  | "figure_pick"
  | "job_match"
  | "portfolio_intro"
  | "project_ideas"
  | "project_swap"
  | "roadmap"
  | "file_read";

/**
 * cut_off: the answer stopped at max_tokens. refused: the model declined. wrong_shape: the answer
 * wasn't the JSON asked for, even after repair. empty: no answer text at all. Those four were
 * answered, and paid for.
 *
 * service: the service never answered. The request itself failed (no connection, a timeout, or the
 * API refusing it or failing, with the HTTP status when there was one), or it couldn't be sent
 * because no key is set. Nothing came back and the person didn't cause it. This is the one name
 * for that: see neverAnswered below.
 */
export type AIFailureReason = "cut_off" | "refused" | "wrong_shape" | "service" | "empty";

export const FAILURE_WORDS: Record<AIFailureReason, string> = {
  cut_off: "ran out of room",
  refused: "refused",
  wrong_shape: "wrong shape",
  service: "service error",
  empty: "empty answer",
};

export class AIFailure extends Error {
  readonly feature: AIFeature;
  readonly reason: AIFailureReason;
  readonly status?: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** What else is known, in our own words: where a wrong shape went wrong (field paths and issue codes), or that no key was set. Never any text from the person or the model. */
  readonly detail?: string;

  constructor(feature: AIFeature, reason: AIFailureReason, o: { status?: number; inputTokens?: number; outputTokens?: number; detail?: string } = {}) {
    super(`${feature} failed: ${FAILURE_WORDS[reason]}${o.status ? ` (status ${o.status})` : ""}${o.outputTokens ? `, ${o.outputTokens} output tokens` : ""}${o.detail ? ` [${o.detail}]` : ""}`);
    this.name = "AIFailure";
    this.feature = feature;
    this.reason = reason;
    this.status = o.status;
    this.inputTokens = o.inputTokens ?? 0;
    this.outputTokens = o.outputTokens ?? 0;
    this.detail = o.detail;
  }
}

/**
 * True when the service never answered (reason "service"). A limit that is counted before the call
 * gives its count back for this and for nothing else: a figure pick does
 * (app/api/exhbts/figure-pick/route.ts). Any other AIFailure was answered and paid for, and
 * anything that isn't an AIFailure is a failure nobody foresaw; both stay counted.
 */
export const neverAnswered = (e: unknown): boolean => e instanceof AIFailure && e.reason === "service";

/**
 * What a failure event stores: the feature, the reason, the status and the tokens. No text from the
 * person's files or the model's answer. Anything that isn't an AIFailure (a bug in our own code) is
 * recorded as "error" with no message.
 */
export function failureProps(e: unknown, feature: AIFeature): Record<string, unknown> {
  if (e instanceof AIFailure) {
    return { feature: e.feature, reason: e.reason, ...(e.status ? { status: e.status } : {}), inputTokens: e.inputTokens, outputTokens: e.outputTokens, ...(e.detail ? { detail: e.detail.slice(0, 200) } : {}) };
  }
  return { feature, reason: "error", inputTokens: 0, outputTokens: 0 };
}
