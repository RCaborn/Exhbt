import { SKILL_MAP_MIN, type Roadmap, type SkillLevel } from "@/lib/ai/schemas";
import type { RadarSkill } from "@/lib/roadmap/radar";

/**
 * Pure helpers for the skill radar. The "after the projects" level is worked out here, not by
 * the AI: a skill a suggested project closes rises to what the job asks for (never lowered),
 * because that is what finishing a project aimed at that skill is meant to show. Skills no
 * project closes stay where they are. Drawing and the Now/After switch are in
 * lib/roadmap/radar.ts and components/charts/SkillRadar.tsx.
 */

const key = (s: string) => s.trim().toLowerCase();

/** Skills named in any project's "closes" list, matched case-insensitively. */
export function skillsClosedByProjects(roadmap: Pick<Roadmap, "projects">): Set<string> {
  return new Set(roadmap.projects.flatMap((p) => p.closesGaps.map(key)));
}

/** A closed skill goes to what the job asks for, or stays put if it is already higher. */
export function levelAfterProjects(skill: SkillLevel, closed: Set<string>): number {
  return closed.has(key(skill.skill)) ? Math.max(skill.current, skill.needed) : skill.current;
}

/** The skill map, or null when there's too little of it to chart (or an older roadmap has none). */
export function chartableSkills(roadmap: Pick<Roadmap, "skillMap">): SkillLevel[] | null {
  const skills = roadmap.skillMap ?? [];
  return skills.length >= SKILL_MAP_MIN ? skills : null;
}

/** Each axis with the job's level, where you are now, and where the projects would take you. */
export function radarSkills(skills: SkillLevel[], roadmap: Pick<Roadmap, "projects">): RadarSkill[] {
  const closed = skillsClosedByProjects(roadmap);
  return skills.map((s) => ({ skill: s.skill, needed: s.needed, now: s.current, after: levelAfterProjects(s, closed) }));
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
