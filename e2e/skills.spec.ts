import { expect, test } from "@playwright/test";
import {
  chartableSkills,
  highlights,
  inTheBag,
  levelUpNext,
  nowVersusAfter,
  skillsAfterProjects,
  sortGapsByShortfall,
} from "../lib/roadmap/skills";

// Pure checks of the skill-radar rules (lib/roadmap/skills.ts). No browser needed.

const skill = (name: string, current: number, needed = 3) => ({ skill: name, current, needed, evidence: "" });
const projects = (...closes: string[][]) => ({
  projects: closes.map((c) => ({ title: "", brief: "", deliverable: "", weeks: 2, closesGaps: c })),
});

test.describe("skill radar rules", () => {
  test("a project lifts the skills it closes to level 3, matching names case-insensitively", () => {
    const skills = [skill("SQL", 1), skill("Excel", 0), skill("Python", 4)];
    const after = nowVersusAfter(skills, projects(["sql"], ["Python"]));
    expect(after).toEqual([
      { skill: "SQL", from: 1, to: 3 },
      // Not closed by any project: stays where it is.
      { skill: "Excel", from: 0, to: 0 },
      // Already above 3: a project never lowers a level.
      { skill: "Python", from: 4, to: 4 },
    ]);
  });

  test("level up next: the largest shortfalls, ties in the job's order, at most three, none when nothing is short", () => {
    const skills = [skill("A", 2), skill("B", 0), skill("C", 0), skill("D", 3), skill("E", 1)];
    expect(levelUpNext(skills).map((s) => s.skill)).toEqual(["B", "C", "E"]);
    expect(levelUpNext([skill("A", 3), skill("B", 4)])).toEqual([]);
  });

  test("in the bag: at or above what the job asks, biggest margin first, at most three, none when all are short", () => {
    const skills = [skill("A", 3), skill("B", 4), skill("C", 1), skill("D", 3, 2), skill("E", 3)];
    // B and D are one above what the job asks (B first, in the job's order), then A, which just meets it.
    expect(inTheBag(skills).map((s) => s.skill)).toEqual(["B", "D", "A"]);
    expect(inTheBag([skill("A", 1), skill("B", 2)])).toEqual([]);
  });

  test("highlights after the projects judge the lifted levels against what the job asks", () => {
    const skills = [skill("SQL", 1), skill("Excel", 0), skill("Python", 3)];
    const after = skillsAfterProjects(skills, projects(["SQL"]));
    expect(highlights(after)).toEqual({ up: ["Excel"], bag: ["SQL", "Python"] });
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
