import { z } from "zod/v4";

export const SITUATIONS = {
  at_university: "At university",
  recent_graduate: "Recently graduated",
  working_switching: "Working, and want to switch",
  other: "Something else",
} as const;
export type Situation = keyof typeof SITUATIONS;

/** What the four-step builder collects (agreed order: job, situation, education & skills, email). */
export const RoadmapInputSchema = z
  .object({
    /** Step 1: the job they want, in their own words. */
    targetRole: z.string().trim().min(2, "Describe the job you want.").max(300),
    /** Step 2: where they are now. */
    situation: z.enum(Object.keys(SITUATIONS) as [Situation, ...Situation[]], {
      error: "Choose the option closest to where you are now.",
    }),
    situationDetail: z.string().trim().max(200).default(""),
    /** Step 3: education and skills; the CV is optional. */
    education: z.string().trim().max(1_000).default(""),
    skills: z.string().trim().max(1_000).default(""),
    cvText: z.string().trim().max(20_000).default(""),
  })
  .refine((v) => (v.education + v.skills + v.cvText).replace(/\s/g, "").length >= 20, {
    path: ["education"],
    message: "Tell us a little about your education or skills, or add your CV.",
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
});
export type Roadmap = z.infer<typeof RoadmapSchema>;
