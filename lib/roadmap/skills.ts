import { SKILL_MAP_MIN, type Roadmap, type SkillLevel } from "@/lib/ai/schemas";

/**
 * Pure helpers for the skill radar. The "after the projects" level is worked out here,
 * not by the AI: a finished project is evidence at level 3 on the scale in lib/ai/roadmap.ts
 * ("used in a project, with what they did described"), so a skill a project closes
 * rises to at least 3. Skills no project covers stay where they are.
 */

export const LEVEL_AFTER_PROJECT = 3;

const key = (s: string) => s.trim().toLowerCase();

export type SkillPoint = { skill: string; from: number; to: number };

/** Skills named in any project's "closes" list, matched case-insensitively. */
export function skillsClosedByProjects(roadmap: Pick<Roadmap, "projects">): Set<string> {
  return new Set(roadmap.projects.flatMap((p) => p.closesGaps.map(key)));
}

export function levelAfterProjects(skill: SkillLevel, closed: Set<string>): number {
  return closed.has(key(skill.skill)) ? Math.max(skill.current, LEVEL_AFTER_PROJECT) : skill.current;
}

/** The skill map, or null when there's too little of it to chart (or an older roadmap has none). */
export function chartableSkills(roadmap: Pick<Roadmap, "skillMap">): SkillLevel[] | null {
  const skills = roadmap.skillMap ?? [];
  return skills.length >= SKILL_MAP_MIN ? skills : null;
}

/** Where they are now against what the job asks for. */
export function nowVersusNeeded(skills: SkillLevel[]): SkillPoint[] {
  return skills.map((s) => ({ skill: s.skill, from: s.current, to: s.needed }));
}

/** Where they are now against where the suggested projects would take them. */
export function nowVersusAfter(skills: SkillLevel[], roadmap: Pick<Roadmap, "projects">): SkillPoint[] {
  const closed = skillsClosedByProjects(roadmap);
  return skills.map((s) => ({ skill: s.skill, from: s.current, to: levelAfterProjects(s, closed) }));
}

/** The skills with the largest shortfall (needed minus current), largest first. Ties keep the job's order. */
export function biggestGaps(skills: SkillLevel[], count = 2): SkillLevel[] {
  return skills
    .map((s, i) => ({ s, i, gap: s.needed - s.current }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.i - b.i)
    .slice(0, count)
    .map((x) => x.s);
}

/**
 * Gap rows sorted by shortfall (needed minus current), largest first. Gaps whose skill
 * isn't on the map keep their place after the mapped ones. Stable, so ties keep the AI's order.
 */
export function sortGapsByShortfall<T extends { skill: string }>(gaps: T[], skills: SkillLevel[]): T[] {
  const shortfall = (skill: string) => {
    const s = skills.find((x) => key(x.skill) === key(skill));
    return s ? s.needed - s.current : Number.NEGATIVE_INFINITY;
  };
  return gaps
    .map((g, i) => ({ g, i, f: shortfall(g.skill) }))
    .sort((a, b) => (a.f === b.f ? a.i - b.i : b.f > a.f ? 1 : -1))
    .map((x) => x.g);
}
