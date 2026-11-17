import { expect, test } from "@playwright/test";
import { groupsFor, statesFor } from "../lib/roadmap/radar";
import { chartableSkills, levelAfterProjects, radarSkills, skillsClosedByProjects, sortGapsByShortfall } from "../lib/roadmap/skills";

// Pure checks of the skill-radar rules (lib/roadmap/skills.ts, lib/roadmap/radar.ts). No browser needed.

const skill = (name: string, current: number, needed = 3) => ({ skill: name, current, needed, evidence: "" });
const projects = (...closes: string[][]) => ({
  projects: closes.map((c) => ({ title: "", brief: "", deliverable: "", weeks: 2, closesGaps: c })),
});

test.describe("skill radar rules", () => {
  test("a project lifts the skills it closes to what the job asks, matching names case-insensitively", () => {
    const skills = [skill("SQL", 1, 4), skill("Excel", 0, 2), skill("Python", 4, 3), skill("Stats", 1, 3)];
    const radar = radarSkills(skills, projects(["sql"], ["PYTHON", "excel"]));
    expect(radar).toEqual([
      // Closed: goes to what the job asks (4), not a fixed 3.
      { skill: "SQL", needed: 4, now: 1, after: 4 },
      // Closed, and the job asks little: stops there.
      { skill: "Excel", needed: 2, now: 0, after: 2 },
      // Already above what the job asks: a project never lowers a level.
      { skill: "Python", needed: 3, now: 4, after: 4 },
      // Not closed by any project: stays where it is.
      { skill: "Stats", needed: 3, now: 1, after: 1 },
    ]);
    expect(levelAfterProjects(skill("SQL", 1, 4), skillsClosedByProjects(projects(["SQL"])))).toBe(4);
  });

  test("every axis is in exactly one state, and the lists hold every skill once", () => {
    const radar = radarSkills([skill("A", 2), skill("B", 0), skill("C", 0), skill("D", 3), skill("E", 1), skill("F", 4, 2)], projects());
    for (const view of ["now", "after"] as const) {
      const states = statesFor(radar, view);
      expect(states).toHaveLength(radar.length);
      const { up, bag } = groupsFor(radar, view);
      expect(up.length + bag.length).toBe(radar.length);
      expect(new Set([...up, ...bag]).size).toBe(radar.length);
      expect(states.filter((s) => s === "below")).toHaveLength(up.length);
      expect(states.filter((s) => s === "meets")).toHaveLength(bag.length);
    }
  });

  test("level up next lists every skill below the job, largest shortfall first, ties in the job's order, with no cap", () => {
    const radar = radarSkills([skill("A", 2), skill("B", 0), skill("C", 0), skill("D", 3), skill("E", 1), skill("F", 2)], projects());
    expect(groupsFor(radar, "now").up).toEqual(["B", "C", "E", "A", "F"]);
    expect(groupsFor(radarSkills([skill("A", 3), skill("B", 4)], projects()), "now").up).toEqual([]);
  });

  test("in the bag lists every skill at or above the job, biggest margin first, with no cap", () => {
    const skills = [skill("A", 3), skill("B", 4), skill("C", 1), skill("D", 3, 2), skill("E", 3), skill("F", 4, 1)];
    // F is three above, B and D one above (B first, in the job's order), then A and E, which just meet it.
    expect(groupsFor(radarSkills(skills, projects()), "now").bag).toEqual(["F", "B", "D", "A", "E"]);
    expect(groupsFor(radarSkills([skill("A", 1), skill("B", 2)], projects()), "now").bag).toEqual([]);
  });

  test("the after view judges the lifted levels against what the job asks", () => {
    const radar = radarSkills([skill("SQL", 1, 4), skill("Excel", 0), skill("Python", 3)], projects(["SQL"]));
    expect(groupsFor(radar, "now")).toEqual({ up: ["SQL", "Excel"], bag: ["Python"] });
    expect(groupsFor(radar, "after")).toEqual({ up: ["Excel"], bag: ["SQL", "Python"] });
  });

  test("gap rows sort by shortfall, unmapped gaps last in their original order", () => {
    const skills = [skill("SQL", 2), skill("Excel", 0)];
    const gaps = [{ skill: "Unmapped one" }, { skill: "sql" }, { skill: "Unmapped two" }, { skill: "Excel" }];
    expect(sortGapsByShortfall(gaps, skills).map((g) => g.skill)).toEqual(["Excel", "sql", "Unmapped one", "Unmapped two"]);
  });

  test("no chart for older roadmaps or fewer than three skills", () => {
    expect(chartableSkills({})).toBeNull();
    expect(chartableSkills({ skillMap: [skill("A", 1), skill("B", 1)] })).toBeNull();
    expect(chartableSkills({ skillMap: [skill("A", 1), skill("B", 1), skill("C", 1)] })).toHaveLength(3);
  });
});
