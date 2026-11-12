import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

/**
 * The last-resort CV reader: the model transcribes a scanned PDF or a photo of a CV into
 * plain text. Only used when the browser couldn't read the file and the visitor chose to send
 * it. It copies what's on the page and adds nothing, the same rule as the rest of lib/ai/.
 */

export type CvMediaType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const SYSTEM = `You transcribe CVs into plain text.

Rules:
- Copy the text exactly as written, in reading order. Keep headings, dates, bullet points (as "- ") and line breaks.
- Do not summarise, correct, translate, reorder or add anything. No commentary, no notes, no Markdown formatting.
- For a multi-column layout, transcribe each column in turn, top to bottom.
- If the file is not a CV or has no readable text, reply with exactly: NO_TEXT`;

export type CvReadResult = { text: string; model: string; inputTokens: number; outputTokens: number; costUsd: number };

export async function transcribeCv(data: Uint8Array, mediaType: CvMediaType): Promise<CvReadResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    // Local development: a labelled placeholder so the flow can be checked without a key.
    return {
      text: "Development preview: no API key is configured, so this CV text is a placeholder. BSc Data Science, University of Example. Used Python and SQL in a final-year project.",
      model: "mock",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  const base64 = Buffer.from(data).toString("base64");
  const file: Anthropic.ContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: [file, { type: "text", text: "Transcribe this CV." }] }],
  });

  if (response.stop_reason === "refusal") throw new Error("CV read refused");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const { input_tokens, output_tokens } = response.usage;
  return {
    text: text === "NO_TEXT" ? "" : text,
    model: response.model,
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    costUsd: costUsd(input_tokens, output_tokens),
  };
}
