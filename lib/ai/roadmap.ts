import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { RoadmapSchema, SITUATIONS, type Roadmap, type RoadmapInput } from "./schemas";
import type { JobProfile } from "@/lib/jobs";

/** Cheapest current model; roadmap generation is structured extraction, not deep reasoning. */
export const ROADMAP_MODEL = "claude-haiku-5-5";
/** USD per million tokens for claude-haiku-5-5 (prompts under 100K tokens). */
const PRICE_IN = 0.1;
const PRICE_OUT = 0.5;

const SYSTEM = `You write skills-gap roadmaps for UK graduates.

Rules:
- Use only facts present in what the graduate told you (the job they want, their situation, education, skills and optional CV). Never invent experience, grades, employers or results.
- If the input does not support a field, leave it empty (empty string or empty list). Do not guess.
- Strengths must point to where they appear in what the graduate told you.
- Gaps are skills the target job needs that the graduate does not show, or shows only weakly. When a job profile from the UK jobs dataset is given, treat its skills list as the authoritative requirements; otherwise use what the job commonly needs.
- Fit the projects to their situation (e.g. a current student can use coursework; someone working can use their job).
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

export async function generateRoadmap(input: RoadmapInput, job: JobProfile | null = null): Promise<RoadmapResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Never hand real visitors a placeholder roadmap.
    if (process.env.NODE_ENV === "production") throw new Error("ANTHROPIC_API_KEY is not set.");
    return mockRoadmap(input, job);
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
          `The job they want: ${input.targetRole}`,
          job
            ? `Job profile from the UK jobs dataset: ${job.title}. Required skills: ${job.skills.join("; ")}.`
            : "No matching job profile in the dataset.",
          `Where they are now: ${SITUATIONS[input.situation]}${input.situationDetail ? ` (${input.situationDetail})` : ""}`,
          `Education: ${input.education || "(none given)"}`,
          `Skills they list: ${input.skills || "(none given)"}`,
          input.cvText ? `CV:\n<cv>\n${input.cvText}\n</cv>` : "No CV given.",
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
function mockRoadmap(input: RoadmapInput, job: JobProfile | null): RoadmapResult {
  const gaps = job
    ? job.skills.slice(0, 3).map((skill, i) => ({
        skill,
        whyItMatters: `Listed for "${job.title}" in the jobs data (${job.source}). Placeholder wording.`,
        currentEvidence: (i === 0 ? "some" : "none") as "some" | "none",
      }))
    : [
        { skill: "Placeholder gap one", whyItMatters: "Shown so the layout can be checked.", currentEvidence: "none" as const },
        { skill: "Placeholder gap two", whyItMatters: "Shown so the layout can be checked.", currentEvidence: "some" as const },
      ];
  return {
    model: "mock",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    roadmap: {
      targetRole: job?.title ?? input.targetRole.slice(0, 80),
      summary: "Development preview: no API key is configured, so this roadmap is placeholder content.",
      strengths: [{ skill: "Placeholder strength", evidence: "Set ANTHROPIC_API_KEY to generate a real roadmap." }],
      gaps,
      projects: [
        {
          title: "Placeholder project",
          brief: "A sample project so the result page renders.",
          closesGaps: [gaps[0].skill],
          deliverable: "A short report",
          weeks: 3,
        },
      ],
    },
  };
}
