import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

/**
 * The last-resort reader: the model transcribes a scanned PDF or a photo into plain text. Only
 * used when the browser couldn't read the file and the person chose to send it. It copies
 * what's on the page and adds nothing, the same rule as the rest of lib/ai/.
 *
 * Two kinds of material: a CV (the roadmap builder, /api/cv/read) and project material for an
 * exhbt (/exhbts/new, /api/files/transcribe).
 */

export type MediaType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export type Material = "cv" | "project";

const WHAT: Record<Material, { noun: string; ask: string; extra: string }> = {
  cv: { noun: "CVs", ask: "Transcribe this CV.", extra: "" },
  project: {
    noun: "project material (reports, slides, notes, figures, tables, whiteboards)",
    ask: "Transcribe this project material.",
    extra:
      "\n- Copy every number exactly as written, with its units and symbols.\n- For a table, put each row on its own line with cells separated by \" | \".\n- For a chart, copy its title, axis labels and any values printed on it. Do not estimate values that aren't printed.",
  },
};

const system = (m: Material) => `You transcribe ${WHAT[m].noun} into plain text.

Rules:
- Copy the text exactly as written, in reading order. Keep headings, dates, bullet points (as "- ") and line breaks.
- Do not summarise, correct, translate, reorder or add anything. No commentary, no notes, no Markdown formatting.
- For a multi-column layout, transcribe each column in turn, top to bottom.${WHAT[m].extra}
- If the file has no readable text${m === "cv" ? " or is not a CV" : ""}, reply with exactly: NO_TEXT`;

export type TranscribeResult = { text: string; model: string; inputTokens: number; outputTokens: number; costUsd: number };

/** Labelled placeholders for local development without a key. Never used when a key is set. */
const MOCK: Record<Material, string> = {
  cv: "Development preview: no API key is configured, so this CV text is a placeholder. BSc Data Science, University of Example. Used Python and SQL in a final-year project.",
  project:
    "Development preview: no API key is configured, so this text is a placeholder for what the AI reader would copy from the file. The project compared two ways of sending reminders and measured the result.",
};

export async function transcribe(data: Uint8Array, mediaType: MediaType, material: Material): Promise<TranscribeResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return { text: MOCK[material], model: "mock", inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }

  const base64 = Buffer.from(data).toString("base64");
  const file: Anthropic.ContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: material === "cv" ? 8000 : 16000,
    output_config: { effort: "low" },
    system: system(material),
    messages: [{ role: "user", content: [file, { type: "text", text: WHAT[material].ask }] }],
  });

  if (response.stop_reason === "refusal") throw new Error("Transcription refused");
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

/** The file's type from its first bytes (names and browser types can't be trusted). Null if the AI reader can't take it. */
export function mediaTypeOf(b: Uint8Array): MediaType | null {
  const at = (sig: number[], from = 0) => sig.every((v, i) => b[from + i] === v);
  if (at([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (at([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  // Some PDFs carry junk before the header; the format allows it within the first 1 KB.
  const head = new TextDecoder("latin1").decode(b.subarray(0, 1024));
  return head.includes("%PDF-") ? "application/pdf" : null;
}
