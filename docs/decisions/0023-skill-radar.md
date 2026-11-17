Status: accepted
Date: 17 Nov 2026
Supersedes: the skill radar parts of `docs/decisions/0003-cv-step-and-skill-radar.md` (two charts, the level scale, "after" as level 3, lists capped at three)

# One skill radar, with anchored levels

## Why

Rory's complaint: "The radars are badly computed. Some of them have ticks. Some of them don't have a circle thing at all next to them. The radars just don't even make sense. 'What the job asks for' then changed to 'after the projects'. That doesn't make sense. The 'now' is futile."

He was right, on the chart and on the data:

- Markers looked random. Each list was capped at three skills, so a skill short of the job (or one that met it) had no marker if it was fourth.
- The second chart swapped the comparison. The first was Now against the job, the second Now against After the projects, so the job target disappeared and Now appeared twice.
- After the projects, any skill a project closed went to a fixed 3, whatever the job asked.
- On 59 skills across real roadmaps, "needed" was exactly 3 for 44 (75%), so the job's shape was nearly always a regular hexagon, and "current" was 0 for 22 (37%).

## Decision

**Keep the scale at 0-4.** The levels are AI estimates from a CV. Seven points (1-7) would add precision the evidence cannot support. The fix is to say what each level means.

**One radar per roadmap.** It lives on the Gaps screen.

- "What the job asks for" is always the dark outline.
- "You" is the light fill. A segmented control (buttons with `aria-pressed`, in a labelled group, keyboard operable) switches "You" between **Now** and **After the projects**. Without JS it shows Now. Nothing animates. Two series at a time, so DESIGN.md's rule against a third series still holds.
- The switch only appears when the plan's project ideas exist, the details gate has been filled in (decision 0004: nothing from the plan shows before it) and at least one skill moves. Before that, the radar shows Now only.
- The separate radar on the Projects screen is gone. Projects links back to the Gaps radar.

**Every axis has a marker, with no cap.** For the view shown, a skill with `current >= needed` gets the green tick ("meets the job") and a skill below it gets the ink arrow-up. "Level up next" and "In the bag" list every skill in their group, so the two lists together name each axis once. No numbers on the radar. The hidden table holds Now, After the projects and the job's level for every skill, whichever view shows.

**After the projects:** a skill a suggested project closes goes to `max(current, needed)`. A project never lowers a level and never takes you past what the job asks. Skills no project touches stay put. The note under the chart says "If you do the suggested projects." `LEVEL_AFTER_PROJECT` and `HIGHLIGHT_COUNT` are removed.

**Level anchors** (in the roadmap prompt, `lib/ai/roadmap.ts`, and the schema descriptions in `lib/ai/schemas.ts`):

- 0 = nothing in their material shows it
- 1 = studied it (named in a course or module)
- 2 = used it in a piece of work
- 3 = used it to get a result they describe
- 4 = led or taught it, or used it professionally

"current" must cite its evidence and uses only what the person supplied (when unsure between two levels, take the lower). "needed" for a junior hire must vary with how central the skill is to the job: the one or two core skills 3 or 4, supporting skills 1 or 2, and not a default of 3.

## What stays the same

The schema is still 0-4. Stored roadmaps keep their values: there is no migration, and old ones simply show their old "needed" shapes. The roadmap output cache key version goes from 2 to 3 (`lib/hash.ts`) so new requests don't reuse outputs written before the anchors. The stand-in AI used in development and tests (`mockRoadmap`) now returns varied needs (4, 3, 3, 2, 2, 1) and levels, with one skill a level above the job, so tests see a real shape. The AI still uses only facts the user supplied.

## Callers checked

`levelAfterProjects`, `radarSkills` (new), `chartableSkills` and `sortGapsByShortfall` in `lib/roadmap/skills.ts`; the rules in `lib/roadmap/radar.ts`; the radar in `components/charts/SkillRadar.tsx`; the Gaps and Projects screens in `components/roadmap/RoadmapViews.tsx` (the page loads the ideas for the Gaps view in `app/(app)/roadmap/[id]/page.tsx`); the home example in `components/home/SkillsGapExample.tsx`. Emails, the PDF, project-idea prompts (`lib/ai/projects.ts` only passes the levels as text) and the admin pages don't use the radar functions.

## Not tested against real Haiku

The new prompt wording has not been run against real Claude Haiku. Only the stand-in AI has been exercised. Before relying on it, generate roadmaps for a handful of real CVs and jobs and check that "needed" varies and that "current" cites evidence. If Haiku still returns 3 for most skills, tighten the "needed" rule or give an example.

## Where the skills come from

Unchanged: the AI picks the skills and levels for now, and every chart says so (`SKILLS_SOURCE_NOTE`).
