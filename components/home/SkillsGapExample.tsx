import { SkillHighlights } from "@/components/charts/SkillHighlights";
import { SkillRadar } from "@/components/charts/SkillRadar";
import type { SkillLevel } from "@/lib/ai/schemas";
import { highlights, nowVersusAfter, nowVersusNeeded, skillsAfterProjects } from "@/lib/roadmap/skills";

/**
 * Home page example of the skill radar, for the fictional demo graduate (Amara, junior data
 * analyst; lib/exhbt.ts). Fixed example data, labelled as such: no claim about real users.
 * The "after" chart uses the same rule as real roadmaps (lib/roadmap/skills.ts).
 */
const AMARA: SkillLevel[] = [
  { skill: "SQL", needed: 3, current: 1, evidence: "" },
  { skill: "Excel", needed: 3, current: 2, evidence: "" },
  { skill: "Data visualisation", needed: 3, current: 2, evidence: "" },
  { skill: "Python", needed: 2, current: 3, evidence: "" },
  { skill: "Statistics", needed: 3, current: 3, evidence: "" },
  { skill: "Dashboards", needed: 3, current: 0, evidence: "" },
];

const AMARA_PROJECTS = {
  projects: [
    { closesGaps: ["SQL"] },
    { closesGaps: ["Dashboards", "Data visualisation"] },
  ].map((p) => ({ title: "", brief: "", deliverable: "", weeks: 3, ...p })),
};

const NOTE = "Example: Amara is fictional.";

export function SkillsGapExample() {
  const now = highlights(AMARA);
  const after = highlights(skillsAfterProjects(AMARA, AMARA_PROJECTS));
  return (
    <section aria-labelledby="gaps-example" className="border-t border-rule bg-surface">
      <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
        <h2 id="gaps-example" className="max-w-[20ch] text-[2.4rem] sm:text-[3.4rem]">
          See where you fall short, and what fixes it
        </h2>
        <p className="mt-4 max-w-[42rem] text-lg text-ink-2">
          Upload your CV and say which job you want. We chart the skills that job asks for, where your CV puts you
          on each, and where the suggested projects would take you.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-rule p-5 sm:p-6">
            <SkillRadar
              title="Amara now, against a junior data analyst job"
              fromLabel="Now"
              toLabel="What the job asks for"
              points={nowVersusNeeded(AMARA)}
              note={NOTE}
              highlight={now}
            />
            <SkillHighlights up={now.up} bag={now.bag} />
          </div>
          <div className="rounded-[var(--radius)] border border-rule p-5 sm:p-6">
            <SkillRadar
              title="After the two suggested projects"
              fromLabel="Now"
              toLabel="After the projects"
              points={nowVersusAfter(AMARA, AMARA_PROJECTS)}
              note={NOTE}
              highlight={after}
            />
            <SkillHighlights up={after.up} bag={after.bag} />
          </div>
        </div>
      </div>
    </section>
  );
}
