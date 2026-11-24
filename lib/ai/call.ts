import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod/v4";
import { AIFailure, type AIFeature } from "./failure";

export { AIFailure, type AIFeature, type AIFailureReason } from "./failure";

/** What every structured call sends: a module's request builder makes it (draftRequest and the rest). */
export type StructuredRequest = {
  model: string;
  max_tokens: number;
  output_config: { effort: "low" | "medium" | "high"; format: { type: "json_schema"; schema: Record<string, unknown> } };
  system: string;
  messages: Anthropic.MessageParam[];
};

export type StructuredResult<T> = { value: T; model: string; inputTokens: number; outputTokens: number };

/**
 * The one way the app makes a structured AI call (decision 0029). It sends the request exactly as
 * built (messages.create), looks at why the model stopped before it reads a word, then reads the
 * answer loosely: JSON first, then `repair` (fixes what the API couldn't enforce, such as a list
 * over its maximum), then the strict schema. Any failure throws one AIFailure that says which
 * feature, why (cut off, refused, wrong shape, service error with its status, empty) and how many
 * tokens it spent, and never carries text from the person's files or the model's answer.
 *
 * Also used by scripts/measure-ai-room.ts, so the measurement reads answers as the app does.
 */
export async function structuredCall<T>(opts: {
  feature: AIFeature;
  client: Anthropic;
  request: StructuredRequest;
  schema: z.ZodType<T>;
  repair?: (raw: unknown) => unknown;
  /** For scripts/measure-ai-room.ts only: sees the raw response (stop reason, usage) before it is read. */
  onResponse?: (response: Anthropic.Message) => void;
}): Promise<StructuredResult<T>> {
  const { feature, client, request, schema, repair, onResponse } = opts;
  let response: Anthropic.Message;
  try {
    response = await client.messages.create(request as unknown as Anthropic.MessageCreateParamsNonStreaming);
  } catch (e) {
    throw new AIFailure(feature, "service", { status: e instanceof Anthropic.APIError ? e.status : undefined });
  }
  onResponse?.(response);
  const tokens = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  if (response.stop_reason === "refusal") throw new AIFailure(feature, "refused", tokens);
  if (response.stop_reason === "max_tokens") throw new AIFailure(feature, "cut_off", tokens);
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new AIFailure(feature, "empty", tokens);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AIFailure(feature, "wrong_shape", { ...tokens, detail: "not JSON" });
  }
  const parsed = schema.safeParse(repair ? repair(raw) : raw);
  if (!parsed.success) {
    // Where it went wrong, never what was written there.
    const where = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(top)"}: ${i.code}`).join("; ");
    throw new AIFailure(feature, "wrong_shape", { ...tokens, detail: where });
  }
  return { value: parsed.data, model: response.model, ...tokens };
}
