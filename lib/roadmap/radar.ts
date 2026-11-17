/**
 * The pure rules of the skill radar, with no imports so the client component can use them
 * (lib/roadmap/skills.ts pulls in the schema, and with it zod).
 *
 * One radar per roadmap (docs/decisions/0023-skill-radar.md): the job's levels are always drawn,
 * and "you" is either where you are now or where the suggested projects would take you.
 */

/** One axis: what the job asks for, and where you stand now and after the projects. */
export type RadarSkill = { skill: string; needed: number; now: number; after: number };

/** Which of the two "you" series is showing. */
export type RadarView = "now" | "after";

/** "meets": at or above what the job asks. "below": short of it. Every axis is one or the other. */
export type SkillState = "meets" | "below";

export const stateOf = (you: number, needed: number): SkillState => (you >= needed ? "meets" : "below");

export const youLevel = (s: RadarSkill, view: RadarView): number => (view === "after" ? s.after : s.now);

/** Every axis's state for the view shown, in the job's order. */
export function statesFor(skills: RadarSkill[], view: RadarView): SkillState[] {
  return skills.map((s) => stateOf(youLevel(s, view), s.needed));
}

/**
 * The two lists under the chart, for the view shown, with no cap: "Level up next" holds every
 * skill below the job (largest shortfall first) and "In the bag" every skill that meets it
 * (biggest margin first). Ties keep the job's order. Together they hold every axis once.
 */
export function groupsFor(skills: RadarSkill[], view: RadarView): { up: string[]; bag: string[] } {
  const rows = skills.map((s, i) => ({ s, i, margin: youLevel(s, view) - s.needed }));
  const up = rows.filter((r) => r.margin < 0).sort((a, b) => a.margin - b.margin || a.i - b.i);
  const bag = rows.filter((r) => r.margin >= 0).sort((a, b) => b.margin - a.margin || a.i - b.i);
  return { up: up.map((r) => r.s.skill), bag: bag.map((r) => r.s.skill) };
}
