import { z } from "zod/v4";

export const SITUATIONS = {
  at_university: "At university",
  recent_graduate: "Recently graduated",
  working_switching: "Working, and want to switch",
  other: "Something else",
} as const;
export type Situation = keyof typeof SITUATIONS;

/** A radar needs at least 3 axes to mean anything; more than 6 won't fit a phone with values printed. */
export const SKILL_MAP_MIN = 3;
export const SKILL_MAP_MAX = 6;

/**
 * What the four-step builder collects. Order (docs/decisions/0003-cv-step-and-skill-radar.md):
 * job, CV (skippable), situation with education and skills, email.
 */
export const RoadmapInputSchema = z
  .object({
    /** Step 1: the job they want, in their own words. */
    targetRole: z.string().trim().min(2, "Describe the job you want.").max(300),
    /** Step 2: the CV. Preferred, but the step can be skipped. */
    cvText: z.string().trim().max(20_000, "That CV is too long. Paste the most relevant parts.").default(""),
    /** Step 3: where they are now, plus anything the CV doesn't cover. */
    situation: z.enum(Object.keys(SITUATIONS) as [Situation, ...Situation[]], {
      error: "Choose the option closest to where you are now.",
    }),
    situationDetail: z.string().trim().max(200).default(""),
    education: z.string().trim().max(1_000).default(""),
    skills: z.string().trim().max(1_000).default(""),
  })
  .refine((v) => (v.education + v.skills + v.cvText).replace(/\s/g, "").length >= 20, {
    path: ["education"],
    message: "Add your education or skills, or go back and add your CV.",
  });
export type RoadmapInput = z.infer<typeof RoadmapInputSchema>;

/**
 * Model output. Every field may be empty: the prompt tells the model to leave a field
 * empty rather than guess, so the UI must handle empty arrays and strings.
 */
export const RoadmapSchema = z.object({
  targetRole: z.string(),
  summary: z.string().describe("Two sentences at most, based only on the CV and inputs."),
  strengths: z
    .array(
      z.object({
        skill: z.string(),
        evidence: z.string().describe("Where in the CV this shows up, quoted or paraphrased."),
      }),
    )
    .max(6),
  gaps: z
    .array(
      z.object({
        skill: z.string(),
        whyItMatters: z.string().describe("One sentence on why the target role needs it."),
        currentEvidence: z.enum(["none", "some"]),
      }),
    )
    .max(6),
  projects: z
    .array(
      z.object({
        title: z.string(),
        brief: z.string().describe("Two sentences: what to build or study and for whom."),
        closesGaps: z.array(z.string()),
        deliverable: z.string().describe("The concrete thing that becomes the evidence."),
        weeks: z.number().int().min(1).max(12),
      }),
    )
    .max(4),
  skillMap: z
    .array(
      z.object({
        skill: z.string(),
        needed: z.number().int().min(0).max(4).describe("Level a junior hire in this job is expected to show, 0-4."),
        current: z.number().int().min(0).max(4).describe("Level the graduate's own input shows, 0-4, on the evidence scale."),
        evidence: z.string().describe("Where in their input the current level shows. Empty when current is 0."),
      }),
    )
    .max(SKILL_MAP_MAX)
    .describe("The skills this job asks for most, most important first."),
});

/** What the model must return. */
export type GeneratedRoadmap = z.infer<typeof RoadmapSchema>;
export type SkillLevel = GeneratedRoadmap["skillMap"][number];

/**
 * A stored roadmap. Roadmaps saved before the skill map existed don't have one,
 * so the UI hides the chart when it's missing.
 */
export type Roadmap = Omit<GeneratedRoadmap, "skillMap"> & { skillMap?: SkillLevel[] };
