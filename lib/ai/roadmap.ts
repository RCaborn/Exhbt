import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { RoadmapSchema, type Roadmap, type RoadmapInput } from "./schemas";

/** Cheapest current model; roadmap generation is structured extraction, not deep reasoning. */
export const ROADMAP_MODEL = "claude-haiku-5-5";
/** USD per million tokens for claude-haiku-5-5 (prompts under 100K tokens). */
const PRICE_IN = 0.1;
const PRICE_OUT = 0.5;

const SYSTEM = `You write skills-gap roadmaps for UK graduates.

Rules:
- Use only facts present in the CV, skills, target role and ambitions you are given. Never invent experience, grades, employers or results.
- If the input does not support a field, leave it empty (empty string or empty list). Do not guess.
- Strengths must point to where they appear in the CV.
- Gaps are skills the target role commonly needs that the CV does not show, or shows only weakly.
- Each suggested project must produce a concrete deliverable the graduate can later attach as evidence (a report, repository, dataset, prototype, recording).
- Projects must be doable by one person without paid tools, in 1-12 weeks.
- Write in plain British English. No hype words, no exclamation marks.`;

export type RoadmapResult = {
  roadmap: Roadmap;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export async function generateRoadmap(input: RoadmapInput): Promise<RoadmapResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Never hand real visitors a placeholder roadmap.
    if (process.env.NODE_ENV === "production") throw new Error("ANTHROPIC_API_KEY is not set.");
    return mockRoadmap(input);
  }

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: ROADMAP_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(RoadmapSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Target role: ${input.targetRole}`,
          `Skills they list: ${input.skills || "(none given)"}`,
          `Ambitions: ${input.ambitions || "(none given)"}`,
          "CV:",
          "<cv>",
          input.cvText,
          "</cv>",
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Roadmap generation failed (stop_reason: ${response.stop_reason})`);
  }
  const { input_tokens, output_tokens } = response.usage;
  return {
    roadmap: RoadmapSchema.parse(response.parsed_output),
    model: response.model,
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    costUsd: (input_tokens * PRICE_IN + output_tokens * PRICE_OUT) / 1_000_000,
  };
}

/** Local development without an API key. Clearly labelled; never used when a key is set. */
function mockRoadmap(input: RoadmapInput): RoadmapResult {
  return {
    model: "mock",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    roadmap: {
      targetRole: input.targetRole,
      summary: "Development preview: no API key is configured, so this roadmap is placeholder content.",
      strengths: [{ skill: "Placeholder strength", evidence: "Set ANTHROPIC_API_KEY to generate a real roadmap." }],
      gaps: [
        { skill: "Placeholder gap one", whyItMatters: "Shown so the layout can be checked.", currentEvidence: "none" },
        { skill: "Placeholder gap two", whyItMatters: "Shown so the layout can be checked.", currentEvidence: "some" },
      ],
      projects: [
        {
          title: "Placeholder project",
          brief: "A sample project so the result page renders.",
          closesGaps: ["Placeholder gap one"],
          deliverable: "A short report",
          weeks: 3,
        },
      ],
    },
  };
}
