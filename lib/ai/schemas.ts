import { z } from "zod/v4";

export const RoadmapInputSchema = z.object({
  cvText: z.string().trim().min(80, "Add a bit more of your CV (at least a few lines).").max(20_000),
  skills: z.string().trim().max(1_000).default(""),
  targetRole: z.string().trim().min(2, "Enter the role you are aiming for.").max(120),
  ambitions: z.string().trim().max(1_000).default(""),
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
