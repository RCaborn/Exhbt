/**
 * The one model Exhbt calls, for every AI feature: Claude Haiku (Rory, 9 Nov 2026: Haiku only).
 * It is the cheapest current model, and the work is structured extraction, not deep reasoning.
 * `npm run check:docs` fails if any other Claude model is named in the app's code, so a
 * dearer model can't slip in. To change model, change it here and in that check.
 */
export const AI_MODEL = "claude-haiku-5-5";

/** Preferred env name for the Anthropic key (Cloudflare / .env). Not the Anthropic console label. */
export const ANTHROPIC_API_KEYS_ENV = "ANTHROPIC_API_KEYS";

/** The Anthropic API key from the environment, or undefined if unset.
 * Prefer `ANTHROPIC_API_KEYS`; still accept the older singular name so a Worker
 * that already has that secret keeps working until it is renamed. */
export function anthropicApiKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEYS?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  return key || undefined;
}

/**
 * The highest max_tokens a non-streaming call can ask for with SDK 1.6.0: above about 21,333 the SDK
 * refuses with "Streaming is required" (it expects such a call to take over 10 minutes). Every AI
 * call here is non-streaming, so no cap may go past this. The caps beside each call (decision 0029)
 * are at least three times the largest answer measured, up to this ceiling; the draft's 16,000 is
 * about twice its largest, because three times would pass it.
 */
export const SDK_NONSTREAMING_MAX_TOKENS = 21_333;

/** USD per million tokens for AI_MODEL (prompts up to 100K tokens), for the cost log. */
export const AI_PRICE_IN = 0.1;
export const AI_PRICE_OUT = 0.5;
/** A prompt over this many input tokens is priced higher, input and output: $0.50 / $2.50 per million for Haiku 5.5. */
export const AI_LONG_PROMPT_TOKENS = 100_000;
export const AI_PRICE_IN_LONG = 0.5;
export const AI_PRICE_OUT_LONG = 2.5;

/** What a call cost, from the token counts the API reports (thinking is inside the output tokens). */
export function costUsd(inputTokens: number, outputTokens: number): number {
  const long = inputTokens > AI_LONG_PROMPT_TOKENS;
  return (inputTokens * (long ? AI_PRICE_IN_LONG : AI_PRICE_IN) + outputTokens * (long ? AI_PRICE_OUT_LONG : AI_PRICE_OUT)) / 1_000_000;
}
