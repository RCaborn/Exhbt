import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { LIMITS, SCHEMA_VERSION, text, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { numbersIn } from "@/lib/exhbt/verify";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

/**
 * Drafts an exhbt from the person's own material (docs/phase-2.md section 6, decision 0007):
 * the text read from their files, their notes and an optional link. The model fills the fixed
 * blocks as plain strings; this file turns them into an ExhbtDoc. Images and evidence are not
 * drafted: the person adds them in the editor.
 *
 * Every number must be quoted from the material. The model lists each one with the quote it
 * came from, and lib/exhbt/verify.ts checks the draft against the source text anyway.
 */

const L = LIMITS;
/** Roughly 15-20k tokens of material: enough for a report, and keeps a draft well under a penny. */
export const MAX_MATERIAL_CHARS = 80_000;

const SYSTEM = `You draft "exhbts": short, checked write-ups of a UK student's or graduate's project, read by recruiters in about 30 seconds.

Rules:
- Use only facts in the material you are given (text from their files, their notes, a link they gave). Never invent results, numbers, methods, tools, organisations or dates.
- Every number you write must appear in the material, copied as written there. Do not calculate new figures (no percentage changes, totals or averages the material doesn't state). List every number you used in "numbers", each with "sourceQuote": the exact words from the material that contain it, copied character for character.
- If the material doesn't support a field, leave it empty (empty string or empty list). Do not guess.
- Write for a recruiter's quick read: short, concrete, plain British English. No hype words, no exclamation marks, no first person plural.

Fields:
- title: what was done and what came of it, at most ${L.titleChars} characters.
- context: one line under the title, at most ${L.contextChars} characters, e.g. "BSc Economics, final-year project". Empty if the material doesn't say.
- headline: the one number that sums the project up, with a two-to-four word label. Null if there is no such number.
- skills: up to ${L.skills.max} skills the material shows being used, each at most ${L.skills.wordsEach} words (e.g. "Python", "Regression analysis").
- gap: the question and why it mattered, at most ${L.gapWords} words, at most 2 short sentences.
- flow: ${L.flow.min} to ${L.flow.max} steps of the process, in order, each at most ${L.flow.stepWords} words. "detail" is an optional note of at most ${L.flow.detailWords} words (e.g. "14,200 rows"), or null.
- findings: ${L.findings.min} to ${L.findings.max} short bullets of what was found or achieved, each at most ${L.findings.wordsEach} words.
- charts: at most ${L.charts.max} before/after charts, each with 1 to ${L.charts.rows} rows, only when the material gives both the before and the after values. Otherwise an empty list.
- In total, aim for about ${L.targetWords} words across title, gap, flow and findings, and never more than ${L.totalWords}.`;

const DraftSchema = z.object({
  title: z.string(),
  context: z.string(),
  headline: z.object({ value: z.string(), label: z.string() }).nullable(),
  skills: z.array(z.string()),
  gap: z.string(),
  flow: z.array(z.object({ step: z.string(), detail: z.string().nullable() })),
  findings: z.array(z.string()),
  charts: z.array(
    z.object({
      title: z.string(),
      beforeLabel: z.string(),
      afterLabel: z.string(),
      lowerIsBetter: z.boolean(),
      unit: z.string().nullable(),
      rows: z.array(z.object({ label: z.string(), before: z.number(), after: z.number() })),
    }),
  ),
  numbers: z.array(z.object({ value: z.string(), sourceQuote: z.string() })),
});
type Draft = z.infer<typeof DraftSchema>;

export type DraftInput = { text: string; notes?: string; link?: string };
export type DraftNumber = { value: string; sourceQuote: string };
export type DraftResult = {
  doc: ExhbtDoc;
  numbers: DraftNumber[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** Everything the model may draw on, as one string. Also what the numbers are checked against. */
export function materialText({ text, notes, link }: DraftInput): string {
  return [text.trim(), notes?.trim() ? `Notes:\n${notes.trim()}` : "", link?.trim() ? `Link: ${link.trim()}` : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_MATERIAL_CHARS);
}

export async function draftExhbt(input: DraftInput): Promise<DraftResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    // Never hand real people a placeholder draft.
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return mockDraft(input);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(DraftSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `<material>\n${input.text.trim().slice(0, MAX_MATERIAL_CHARS) || "(no files)"}\n</material>`,
          input.notes?.trim() ? `<notes>\n${input.notes.trim()}\n</notes>` : "No notes.",
          input.link?.trim() ? `Link to the work: ${input.link.trim()}` : "No link.",
        ].join("\n\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Exhbt draft failed (stop_reason: ${response.stop_reason})`);
  }
  const { input_tokens, output_tokens } = response.usage;
  const draft = DraftSchema.parse(response.parsed_output);
  return {
    doc: toDoc(draft),
    numbers: draft.numbers,
    model: response.model,
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    costUsd: costUsd(input_tokens, output_tokens),
  };
}

/**
 * The model's strings as an ExhbtDoc, trimmed to the block counts. Word limits are left to the
 * editor (drafts may run over; publishing may not), but counts are clamped so the layout holds.
 */
export function toDoc(d: Draft): ExhbtDoc {
  const nonEmpty = (s: string) => s.trim().length > 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    title: d.title.trim().slice(0, L.titleChars),
    context: d.context.trim().slice(0, L.contextChars),
    ...(d.headline && nonEmpty(d.headline.value) ? { headline: { value: d.headline.value.trim(), label: d.headline.label.trim() } } : {}),
    skills: d.skills.map((s) => s.trim()).filter(nonEmpty).slice(0, L.skills.max),
    gap: text(d.gap.trim()),
    flow: d.flow
      .filter((s) => nonEmpty(s.step))
      .slice(0, L.flow.max)
      .map((s) => (s.detail?.trim() ? { step: s.step.trim(), detail: s.detail.trim() } : { step: s.step.trim() })),
    findings: d.findings.map((f) => f.trim()).filter(nonEmpty).slice(0, L.findings.max).map(text),
    charts: d.charts
      .filter((c) => c.rows.length > 0)
      .slice(0, L.charts.max)
      .map((c) => ({
        title: c.title.trim(),
        beforeLabel: c.beforeLabel.trim(),
        afterLabel: c.afterLabel.trim(),
        lowerIsBetter: c.lowerIsBetter,
        ...(c.unit?.trim() ? { unit: c.unit.trim() } : {}),
        rows: c.rows.slice(0, L.charts.rows),
      })),
    images: [],
  };
}

/**
 * Local development without an API key: a clearly labelled placeholder built from the
 * material, so the flow (upload, draft, number check, editor) can be tried end to end. Its one
 * finding quotes the material's first sentence, so its numbers are real ones.
 */
function mockDraft(input: DraftInput): DraftResult {
  const source = materialText(input).replace(/^File: .*$/gm, "");
  const firstSentence = (source.replace(/\s+/g, " ").match(/[^.!?]{12,}[.!?]/)?.[0] ?? source.slice(0, 120)).trim();
  const quote = firstSentence.split(" ").slice(0, L.findings.wordsEach).join(" ");
  const numbers = numbersIn(quote).map((value) => ({ value, sourceQuote: quote }));
  return {
    model: "mock",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    numbers,
    doc: toDoc({
      title: "Development preview: a placeholder draft",
      context: "Placeholder context line",
      headline: null,
      skills: ["Placeholder skill"],
      gap: `No API key is configured, so this draft is placeholder text. Set ${ANTHROPIC_API_KEYS_ENV} to draft from your files.`,
      flow: [
        { step: "Read the material", detail: null },
        { step: "Drafted the blocks", detail: null },
        { step: "Checked every number", detail: null },
      ],
      findings: [quote, "This finding is a placeholder."],
      charts: [],
      numbers,
    }),
  };
}
