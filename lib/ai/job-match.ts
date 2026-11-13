import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { plain, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { EXHBTS_PER_JOB_LINK } from "@/lib/entitlements";
import { acceptedPicks, INTRO_WORDS, orderedPicks, trimIntro, type RankedPick } from "@/lib/job-links";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

/**
 * Picks which published exhbts to put on a per-job link, and a short introduction.
 * Facts come only from the pasted description and those exhbts (docs/phase-2.md section 8).
 * With no API key outside production, the picks are portfolio order and the introduction
 * is left blank: nothing is presented as a match that didn't happen.
 */

const MatchSchema = z.object({
  picks: z.array(z.object({ exhbtId: z.string(), reason: z.string() })),
  intro: z.string(),
});

export type JobMatch = {
  picks: RankedPick[];
  intro: string;
  /** False when no model ran, or it named none of this person's exhbts. */
  ranked: boolean;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

const none: Pick<JobMatch, "model" | "inputTokens" | "outputTokens" | "costUsd"> = {
  model: null,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

function brief(doc: ExhbtDoc): string {
  return [doc.title, doc.context, plain(doc.gap), doc.flow.map((s) => s.step).join("; "), doc.findings.map((f) => plain(f)).join(" "), doc.skills.join(", ")]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);
}

export async function matchJob(input: {
  company: string;
  role: string;
  description: string;
  exhbts: { id: string; doc: ExhbtDoc }[];
}): Promise<JobMatch> {
  const ids = input.exhbts.map((e) => e.id);
  const fallback = (): JobMatch => ({ picks: orderedPicks(ids, EXHBTS_PER_JOB_LINK), intro: "", ranked: false, ...none });

  const apiKey = anthropicApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return fallback();
  }

  const client = new Anthropic({ apiKey });
  const catalogue = input.exhbts.map((e) => `<exhbt id="${e.id}">\n${brief(e.doc)}\n</exhbt>`).join("\n\n");
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 1200,
    output_config: { effort: "low", format: zodOutputFormat(MatchSchema) },
    system: `You choose which of a person's published exhbts to show an employer for one job, and write a short introduction.

Rules:
- Use only the job description and the exhbt texts you are given. Never invent experience, results, employers or skills.
- picks: up to ${EXHBTS_PER_JOB_LINK} items, best fit first. exhbtId must be one of the ids you were given. reason is one sentence saying why it fits, using only those texts. If none fit well, still pick the closest and say what is missing.
- intro: at most ${INTRO_WORDS} words, plain British English, no hype. It is what the employer reads above the projects. Leave it empty if the description doesn't support one.`,
    messages: [
      {
        role: "user",
        content: `Company: ${input.company}\nRole: ${input.role}\n\n<job>\n${input.description.slice(0, 20_000)}\n</job>\n\n${catalogue}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Job match failed (stop_reason: ${response.stop_reason})`);
  }
  const parsed = MatchSchema.parse(response.parsed_output);
  const picks = acceptedPicks(parsed.picks, ids, EXHBTS_PER_JOB_LINK);
  const usage = {
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: costUsd(response.usage.input_tokens, response.usage.output_tokens),
  };
  if (picks.length === 0) return { ...fallback(), ...usage };
  return { picks, intro: trimIntro(parsed.intro), ranked: true, ...usage };
}
