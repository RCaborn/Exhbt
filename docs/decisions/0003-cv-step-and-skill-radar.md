Status: accepted
Date: 9 Nov 2026
Supersedes: the builder order in `docs/decisions/0002-plan-tiers.md` ("The roadmap builder is unchanged") and the 6 Nov order
Partly superseded by: `docs/decisions/0004-email-gate-and-plan.md` (the email step moved out of the builder)

# The CV gets its own step, and the roadmap charts the skills gap

## Builder

The order is: the job, the CV, where you are now (with education and skills), then email. The CV is the preferred input and has its own step straight after the job. It can be skipped. When there is a CV, the next page asks only for what it doesn't cover. Without one, education or skills are still needed. It stays four steps. The source is `STEPS` in `app/(app)/roadmap/new/RoadmapWizard.tsx`. Every step uses as few words as possible: a title, the fields, and at most one short line (Rory, 9 Nov).

## Skill radar

The roadmap now includes a skill map: the skills the job asks for most, most important first, each with a "needed" and a "current" level. It is shown as a radar on the Gaps screen (you now against what the job asks for). It is shown again on the Projects screen (you now against where the projects would take you), so people can see what finishing gets them. The home page shows the same chart for the fictional demo graduate.

- Levels run 0 to 4: not shown; named only; used in study; used in a project or job, with what they did described; used repeatedly, with results. The prompt in `lib/ai/roadmap.ts` holds the scale.
- "Current" is scored only from what the person supplied, with the evidence pointed to. "Needed" is the level a junior hire is expected to show.
- The "after the projects" level is worked out in code (`lib/roadmap/skills.ts`), not by the AI. A finished project counts as level 3 for each skill it closes. Skills no project closes stay where they are.
- The chart has between 3 and 6 axes. Six is the most that fits a phone. With fewer than 3 skills, there's no chart and the gap list carries the result.
- The chart prints no numbers (Rory, 9 Nov). The levels are AI estimates, and figures would suggest more precision than they have. Instead, two short lists under each chart, "Level up next" (the biggest shortfalls) and "In the bag" (at or above what the job asks), name up to three skills each, and the same skills are marked on the chart. On the Projects screen, both lists are judged on the after-projects levels. Every level stays in the chart's hidden data table for screen readers.
- Roadmaps saved before this have no skill map and show no chart. The cache key includes an output version, so new requests don't reuse old outputs.

## Where the skills come from

For now, the AI picks the skills and the needed levels, using the job profile from the jobs data when one matches. Every chart says so (`SKILLS_SOURCE_NOTE` in `lib/jobs/claim.ts`). Nothing may say the skills come from job adverts until they do.

Before the MVP launches, the skills and their order must come from real UK job adverts, merged with the European Commission's ESCO skills classification. That is what sets Exhbt apart from asking a general AI. When the data is loaded, update the note through the same gate and review its wording.
