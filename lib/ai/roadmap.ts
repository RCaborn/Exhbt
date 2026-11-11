import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  RoadmapSchema,
  SITUATIONS,
  SKILL_MAP_MAX,
  SKILL_MAP_MIN,
  type GeneratedRoadmap,
  type RoadmapInput,
} from "./schemas";
import type { JobProfile } from "@/lib/jobs";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";

const SYSTEM = `You write skills-gap roadmaps for UK graduates.

Rules:
- Use only facts present in what the graduate told you (the job they want, their situation, education, skills and optional CV). Never invent experience, grades, employers or results.
- If the input does not support a field, leave it empty (empty string or empty list). Do not guess.
- Strengths must point to where they appear in what the graduate told you.
- Gaps are skills the target job needs that the graduate does not show, or shows only weakly. When a job profile from the UK jobs dataset is given, treat its skills list as the authoritative requirements; otherwise use what the job commonly needs.
- skillMap lists the ${SKILL_MAP_MIN}-${SKILL_MAP_MAX} skills this job asks for most, most important first. Use short names (one to four words). When a job profile is given, take them from its skills list.
- For each skill, "needed" is the level a junior hire in this job is expected to show, and "current" is the level the graduate's own input shows. Both use this scale:
  0 = not shown anywhere in what they told you
  1 = named or listed only, with no use described
  2 = used in study or coursework
  3 = used in a project or job, with what they did described
  4 = used repeatedly, with results described
  Score "current" from their input only. Put where it shows in "evidence"; when current is 0, evidence is empty.
- Every gap's "skill" and every name in a project's "closesGaps" must be one of the skillMap names, spelt exactly the same.
- Suggest exactly 3 projects: their plan of three. Between them, cover the biggest gaps, each project closing different ones where possible.
- Fit the projects to their situation (e.g. a current student can use coursework; someone working can use their job).
- Each suggested project must produce a concrete deliverable the graduate can later attach as evidence (a report, repository, dataset, prototype, recording).
- Projects must be doable by one person without paid tools, in 1-12 weeks.
- Write in plain British English. No hype words, no exclamation marks.`;

export type RoadmapResult = {
  roadmap: GeneratedRoadmap;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export async function generateRoadmap(input: RoadmapInput, job: JobProfile | null = null): Promise<RoadmapResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    // Never hand real visitors a placeholder roadmap.
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return mockRoadmap(input, job);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model: AI_MODEL,
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
    costUsd: costUsd(input_tokens, output_tokens),
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
  // Fixed placeholder levels so the chart can be checked: the first gap shows some evidence,
  // the other gaps none, and the remaining skills are already at the level needed.
  const skillNames = job
    ? job.skills.slice(0, SKILL_MAP_MAX)
    : [...gaps.map((g) => g.skill), "Placeholder skill three", "Placeholder skill four"];
  const skillMap = skillNames.map((skill) => {
    const gap = gaps.find((g) => g.skill === skill);
    const current = !gap ? 3 : gap.currentEvidence === "some" ? 1 : 0;
    return { skill, needed: 3, current, evidence: current > 0 ? "Placeholder evidence." : "" };
  });
  return {
    model: "mock",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    roadmap: {
      targetRole: job?.title ?? input.targetRole.slice(0, 80),
      summary: "Development preview: no API key is configured, so this roadmap is placeholder content.",
      strengths: [{ skill: "Placeholder strength", evidence: `Set ${ANTHROPIC_API_KEYS_ENV} to generate a real roadmap.` }],
      gaps,
      // Three, as the prompt asks. The third repeats the first gap, so one gap stays open
      // and the after-projects chart shows both highlight lists.
      projects: [gaps[0], gaps[1] ?? gaps[0], gaps[0]].map((g, i) => ({
        title: `Placeholder project ${i + 1}`,
        brief: "A sample project so the result page renders.",
        closesGaps: [g.skill],
        deliverable: "A short report",
        weeks: 3,
      })),
      skillMap,
    },
  };
}
