/**
 * Repairs for answers the model wrote outside the rules the API couldn't enforce. The SDK (1.6)
 * sends an enum, a list's maximum and a number's range only as description text, so the grammar
 * lets the model write a 7th gap, a level of 5 or a project of 24 weeks, and the strict schema
 * would then fail the whole feature for one stray value. Each repair fixes only what can be fixed
 * without guessing at the person's facts; the strict schema still reads the result. The request on
 * the wire is unchanged.
 *
 * Pure (no server-only), so e2e/ai-answers.spec.ts can test every repair. The draft's own repair
 * is repairDraft in ./draft-answer.ts.
 */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A number pulled into [min, max] and rounded; anything else left for the schema to reject. */
export function clampInt(v: unknown, min: number, max: number): unknown {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : v;
}

/** The roadmap's lists are at most this long (RoadmapSchema in ./schemas.ts). */
export const ROADMAP_LIST_MAX = 6;

/**
 * A roadmap answer: each list cut to 6, each level pulled into 0 to 4, and an evidence value
 * other than "none" or "some" read as "none", the cautious one: it never claims the person shows
 * a skill the model wasn't sure of.
 */
export function repairRoadmap(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };
  for (const k of ["strengths", "gaps", "skillMap"]) if (Array.isArray(out[k])) out[k] = (out[k] as unknown[]).slice(0, ROADMAP_LIST_MAX);
  if (Array.isArray(out.gaps)) {
    out.gaps = out.gaps.map((g) => (isObject(g) && g.currentEvidence !== "none" && g.currentEvidence !== "some" ? { ...g, currentEvidence: "none" } : g));
  }
  if (Array.isArray(out.skillMap)) {
    out.skillMap = out.skillMap.map((s) => (isObject(s) ? { ...s, needed: clampInt(s.needed, 0, 4), current: clampInt(s.current, 0, 4) } : s));
  }
  return out;
}

/** One project idea: its length pulled into 1 to 12 weeks. */
export function repairProject(p: unknown): unknown {
  return isObject(p) ? { ...p, weeks: clampInt(p.weeks, 1, 12) } : p;
}

/** The plan's ideas: at most `planSize` of them, each repaired. */
export function repairIdeas(raw: unknown, planSize: number): unknown {
  if (!isObject(raw) || !Array.isArray(raw.projects)) return raw;
  return { ...raw, projects: raw.projects.slice(0, planSize).map(repairProject) };
}

/** A swapped idea. */
export function repairSwap(raw: unknown): unknown {
  return isObject(raw) ? { ...raw, project: repairProject(raw.project) } : raw;
}
