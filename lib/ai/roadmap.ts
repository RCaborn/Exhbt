import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  RoadmapModelSchema,
  SITUATIONS,
  SKILL_MAP_MAX,
  SKILL_MAP_MIN,
  type GeneratedRoadmap,
  type RoadmapInput,
} from "./schemas";
import type { JobProfile } from "@/lib/jobs";
import { AI_MODEL, ANTHROPIC_API_KEYS_ENV, anthropicApiKey, costUsd } from "./model";
import { structuredCall } from "./call";
import { repairRoadmap, ROADMAP_LIST_MAX } from "./repair";

/** What the roadmap call sends as output_config (also checked by scripts/probe-ai-shapes.ts). */
export const ROADMAP_OUTPUT_CONFIG = { effort: "low" as const, format: zodOutputFormat(RoadmapModelSchema) };

const SYSTEM = `You write skills-gap roadmaps for UK graduates.

Rules:
- Use only facts present in what the graduate told you (the job they want, their situation, education, skills and optional CV). Never invent experience, grades, employers or results.
- If the input does not support a field, leave it empty (empty string or empty list). Do not guess.
- List at most ${ROADMAP_LIST_MAX} strengths and at most ${ROADMAP_LIST_MAX} gaps, the most important first.
- Strengths must point to where they appear in what the graduate told you.
- Gaps are skills the target job needs that the graduate does not show, or shows only weakly. When a job profile from the UK jobs dataset is given, treat its skills list as the authoritative requirements; otherwise use what the job commonly needs.
- skillMap lists the ${SKILL_MAP_MIN}-${SKILL_MAP_MAX} skills this job asks for most, most important first. Use short names (one to four words). When a job profile is given, take them from its skills list.
- For each skill, "needed" and "current" are levels from 0 to 4. The levels mean:
  0 = nothing in their material shows it
  1 = studied it (named in a course or module)
  2 = used it in a piece of work
  3 = used it to get a result they describe
  4 = led or taught it, or used it professionally
- "current" is the level the graduate's own material shows. Score it only from what they told you, and put where it shows in "evidence" (point to the line, course, project or job). When current is 0, evidence is empty. If you are unsure between two levels, take the lower one. Never score a skill above what a described piece of work supports.
- "needed" is the level a junior hire in this job is expected to show, and it must vary with how central the skill is to this job. The one or two skills the job is mostly about are 3 or 4. Supporting skills are 1 or 2. Do not give every skill the same level and do not default to 3. "needed" is about the job, not the graduate: do not lower it because they lack the skill.
- Every gap's "skill" and every name in a project's "closesGaps" must be one of the skillMap names, spelt exactly the same.
- Do not suggest projects. They are written in a separate step.
- Write in plain British English. No hype words, no exclamation marks.`;

export type RoadmapResult = {
  roadmap: GeneratedRoadmap;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** The roadmap request the app sends, so a script can send exactly the same. */
export function roadmapRequest(input: RoadmapInput, job: JobProfile | null = null) {
  return {
    model: AI_MODEL,
    // A ceiling, not a cost (npm run measure:ai, 23 Nov 2026): the model thinks first, and a heavy roadmap (a
    // 20,000-character CV, a 15-skill job) used up to 2,809 tokens and was cut off once at the old 3,000.
    max_tokens: 12000,
    output_config: ROADMAP_OUTPUT_CONFIG,
    system: SYSTEM,
    messages: [
      {
        role: "user" as const,
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
  };
}

export async function generateRoadmap(input: RoadmapInput, job: JobProfile | null = null): Promise<RoadmapResult> {
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    // Never hand real visitors a placeholder roadmap.
    if (process.env.NODE_ENV === "production") throw new Error(`${ANTHROPIC_API_KEYS_ENV} is not set.`);
    return mockRoadmap(input, job);
  }

  const { value, model, inputTokens, outputTokens } = await structuredCall({
    feature: "roadmap",
    client: new Anthropic({ apiKey }),
    request: roadmapRequest(input, job),
    schema: RoadmapModelSchema,
    repair: repairRoadmap,
  });
  return { roadmap: { ...value, projects: [] }, model, inputTokens, outputTokens, costUsd: costUsd(inputTokens, outputTokens) };
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
  // Fixed placeholder levels so the chart can be checked. The job's needs vary with how central the
  // skill is (the first is the core one). A gap is a skill below its need (the first shows some
  // evidence, the others none); the rest meet it, the first of those with a level to spare.
  const skillNames = job
    ? job.skills.slice(0, SKILL_MAP_MAX)
    : [...gaps.map((g) => g.skill), "Placeholder skill three", "Placeholder skill four"];
  const NEEDED = [4, 3, 3, 2, 2, 1];
  let spare = true;
  const skillMap = skillNames.map((skill, i) => {
    const needed = NEEDED[i] ?? 1;
    const gap = gaps.find((g) => g.skill === skill);
    let current: number;
    if (gap) current = gap.currentEvidence === "some" ? 1 : 0;
    else {
      current = Math.min(4, needed + (spare ? 1 : 0));
      spare = false;
    }
    return { skill, needed, current, evidence: current > 0 ? "Placeholder evidence." : "" };
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
      // The ideas are made separately (mockIdeas in lib/ai/projects.ts).
      projects: [],
      skillMap,
    },
  };
}
