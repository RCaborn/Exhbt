import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { ProjectSchema, SITUATIONS, type Project, type Roadmap, type RoadmapInput } from "./schemas";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

/**
 * Swapping one idea in the plan (docs/decisions/0004): a single new project that replaces the
 * one they didn't like, differs from the two they're keeping, and follows their "Make some
 * tweaks" note if they wrote one (e.g. "use more real data"). Same model and rules as the
 * roadmap's projects; the note steers the idea but never adds facts about the person.
 */

const SwapSchema = z.object({ project: ProjectSchema });

const SYSTEM = `You suggest one project that helps a UK graduate close the skills gaps for the job they want. It replaces a project they didn't want in their plan of three.

Rules:
- Use only facts present in what the graduate told you (the job they want, their situation, education, skills and optional CV). Never invent experience, grades, employers or results.
- Make it clearly different from the project it replaces and from the two they're keeping, so the three cover a good mix.
- If they wrote a note about what they want, follow it as long as it fits these rules. It is a preference about the project, not a fact about them.
- Every name in "closesGaps" must be one of the skill names given, spelt exactly the same. Favour skills the other two projects don't cover, and skills with the biggest gap.
- Fit the project to their situation (e.g. a current student can use coursework; someone working can use their job).
- It must produce a concrete deliverable they can later attach as evidence (a report, repository, dataset, prototype, recording).
- It must be doable by one person without paid tools, in 1-12 weeks.
- Write in plain British English. No hype words, no exclamation marks.`;

export type SwapResult = { project: Project; model: string; inputTokens: number; outputTokens: number; costUsd: number };

export type SwapContext = {
  input: RoadmapInput;
  roadmap: Roadmap;
  /** The project being replaced. */
  replacing: Project;
  /** The two they're keeping. */
  keeping: Project[];
  /** Their "Make some tweaks" note; may be empty. */
  note: string;
  /** Which swap this is (1, 2, ...), for the development placeholder. */
  round: number;
};

export async function generateSwap(ctx: SwapContext): Promise<SwapResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return mockSwap(ctx);
  }

  const { input, roadmap } = ctx;
  const skills = (roadmap.skillMap ?? []).map((s) => `${s.skill} (needed ${s.needed}, current ${s.current})`);
  const describe = (p: Project) => `- ${p.title}: ${p.brief} (closes: ${p.closesGaps.join(", ") || "none"})`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: zodOutputFormat(SwapSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `The job they want: ${input.targetRole}`,
          `Skills to close (0-4 scale): ${skills.length ? skills.join("; ") : roadmap.gaps.map((g) => g.skill).join("; ")}`,
          `Where they are now: ${SITUATIONS[input.situation]}${input.situationDetail ? ` (${input.situationDetail})` : ""}`,
          `Education: ${input.education || "(none given)"}`,
          `Skills they list: ${input.skills || "(none given)"}`,
          input.cvText ? `CV:\n<cv>\n${input.cvText}\n</cv>` : "No CV given.",
          `The project being replaced:\n${describe(ctx.replacing)}`,
          `The projects they're keeping:\n${ctx.keeping.length ? ctx.keeping.map(describe).join("\n") : "(none)"}`,
          ctx.note ? `Their note for the new project:\n<note>\n${ctx.note}\n</note>` : "They didn't write a note.",
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Project swap failed (stop_reason: ${response.stop_reason})`);
  }
  const { input_tokens, output_tokens } = response.usage;
  return {
    project: SwapSchema.parse(response.parsed_output).project,
    model: response.model,
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    costUsd: costUsd(input_tokens, output_tokens),
  };
}

/** Local development and tests without an API key: the round and note show in the title, so a test can see them. */
function mockSwap(ctx: SwapContext): SwapResult {
  return {
    model: "mock",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    project: {
      title: `Swapped idea ${ctx.round}${ctx.note ? `: ${ctx.note.slice(0, 60)}` : ""}`,
      brief: "Development preview: no API key is configured, so this idea is placeholder content.",
      closesGaps: ctx.replacing.closesGaps,
      deliverable: "A short report",
      weeks: 2,
    },
  };
}
