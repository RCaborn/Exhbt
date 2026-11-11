/**
 * The one model Exhbt calls, for every AI feature: Claude Haiku (Rory, 9 Nov 2026: Haiku only).
 * It is the cheapest current model, and the work is structured extraction, not deep reasoning.
 * `npm run check:docs` fails if any other Claude model is named in the app's code, so a
 * dearer model can't slip in. To change model, change it here and in that check.
 */
export const AI_MODEL = "claude-haiku-5-5";

/** Env name for the Anthropic key (Cloudflare / .env). Not the Anthropic console label. */
export const ANTHROPIC_API_KEYS_ENV = "ANTHROPIC_API_KEYS";

/** The Anthropic API key from the environment, or undefined if unset. */
export function anthropicApiKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEYS?.trim();
  return key || undefined;
}

/** USD per million tokens for AI_MODEL (prompts under 100K tokens), for the cost log. */
export const AI_PRICE_IN = 0.1;
export const AI_PRICE_OUT = 0.5;

/** What a call cost, from the token counts the API reports. */
export function costUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * AI_PRICE_IN + outputTokens * AI_PRICE_OUT) / 1_000_000;
}
