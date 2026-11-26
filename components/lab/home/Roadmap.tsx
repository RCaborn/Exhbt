"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SkillRadar } from "@/components/charts/SkillRadar";
import type { SkillLevel } from "@/lib/ai/schemas";
import { radarSkills } from "@/lib/roadmap/skills";

/**
 * The made-up graduate's skills against a junior data analyst job, as the live home page draws
 * them (components/home/SkillsGapExample.tsx keeps the same figures, which aren't exported).
 * Fixed example data, labelled as such: no claim about real people.
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

/**
 * "Not sure what to make? Build your roadmap." (beat six): the way in for someone with nothing to
 * show yet. The real radar beside the real way into the builder: the job field, which opens the
 * builder with the job filled in (GET /roadmap/new?role=), as the live StartForm does. Its button is
 * ink, not mint: the page's one mint action stays "Start your portfolio".
 */
export function Roadmap() {
  const [role, setRole] = useState("");
  return (
    <section id="roadmap" aria-labelledby="hl-roadmap-title" className="hl-section hl-roadmap">
      <div className="lab-content hl-roadmap-grid">
        <div className="hl-roadmap-words">
          <Heading level={2} type="display-2" id="hl-roadmap-title">
            Not sure what to make? Build your roadmap.
          </Heading>
          <Text as="p" display="block" type="large" color="secondary">
            It&rsquo;s free. Say which job you want: we chart the skills it asks for, where you stand on each, and projects that would close the gaps. You see
            it before we ask for anything.
          </Text>
          <form action="/roadmap/new" method="get" className="hl-roadmap-form">
            <TextInput label="The job you want" htmlName="role" value={role} onChange={setRole} size="lg" placeholder="Junior data analyst" autoComplete="organization-title" />
            <Button label="Build your roadmap" type="submit" variant="ink" size="lg" />
          </form>
        </div>
        <div className="hl-roadmap-radar">
          <SkillRadar
            title="Amara, against a junior data analyst job"
            skills={radarSkills(AMARA, AMARA_PROJECTS)}
            showAfter
            note="Example: Amara is made up."
          />
        </div>
      </div>
    </section>
  );
}
