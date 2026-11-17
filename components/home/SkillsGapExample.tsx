import { SkillRadar } from "@/components/charts/SkillRadar";
import type { SkillLevel } from "@/lib/ai/schemas";
import { SOURCING_LINE } from "@/lib/jobs/claim";
import { radarSkills } from "@/lib/roadmap/skills";

/**
 * Home page example of the skill radar, for the fictional demo graduate (Amara, junior data
 * analyst; lib/exhbt.ts). Fixed example data, labelled as such: no claim about real users.
 * It is the same single radar as a real roadmap, with the Now / After the projects switch, and
 * the after levels come from the same rule (lib/roadmap/skills.ts). The levels follow the scale in
 * lib/ai/roadmap.ts: SQL is the core skill for the job, so it asks the most and Amara is furthest
 * from it. Statistics is touched by no project, so it is still short after them.
 */
const AMARA: SkillLevel[] = [
  { skill: "SQL", needed: 4, current: 1, evidence: "" },
  { skill: "Data visualisation", needed: 3, current: 2, evidence: "" },
  { skill: "Statistics", needed: 3, current: 2, evidence: "" },
  { skill: "Excel", needed: 2, current: 2, evidence: "" },
  { skill: "Python", needed: 2, current: 3, evidence: "" },
  { skill: "Dashboards", needed: 2, current: 0, evidence: "" },
];

const AMARA_PROJECTS = {
  projects: [{ closesGaps: ["SQL"] }, { closesGaps: ["Dashboards", "Data visualisation"] }].map((p) => ({
    title: "",
    brief: "",
    deliverable: "",
    weeks: 3,
    ...p,
  })),
};

const NOTE = "Example: Amara is fictional.";

export function SkillsGapExample() {
  return (
    <section aria-labelledby="gaps-example" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[72rem] px-4 py-20 sm:px-8 lg:py-28">
        <h2 id="gaps-example" className="display-2 max-w-[20ch]">
          See where you fall short, and what fixes it
        </h2>
        <p className="mt-4 max-w-[42rem] text-lg text-graphite">
          Upload your CV and say which job you want. We chart the skills that job asks for, where your CV puts you
          on each, and where small projects would take you. {SOURCING_LINE}
        </p>
        <div className="mt-12 max-w-[40rem] rounded-[var(--radius)] border border-line p-5 sm:p-6">
          <SkillRadar
            title="Amara, against a junior data analyst job"
            skills={radarSkills(AMARA, AMARA_PROJECTS)}
            showAfter
            note={NOTE}
          />
        </div>
      </div>
    </section>
  );
}
