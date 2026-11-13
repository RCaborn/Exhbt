import { EXHBTS_PER_JOB_LINK } from "../entitlements";

/**
 * The rules around matching exhbts to a job (docs/phase-2.md section 8), kept pure so they can
 * be tested: what the matcher sees of each exhbt, how its answer is tidied, and the
 * deterministic stand-in used in development without an API key. The AI call is
 * lib/ai/job-match.ts.
 */

/** Words in a pick's reason, and in the suggested intro. */
export const REASON_WORDS = 20;
export const INTRO_WORDS = 40;

/** One published exhbt, as the matcher sees it: only what the person wrote and published. */
export type MatchCandidate = {
  id: string;
  title: string;
  context: string;
  skills: string[];
  findings: string[];
};

export type MatchPick = { exhbtId: string; reason: string };
export type MatchResult = { picks: MatchPick[]; intro: string };

/** At most `n` words, without a dangling comma or dash. */
export function clipWords(s: string, n: number): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= n) return words.join(" ");
  return words.slice(0, n).join(" ").replace(/[,;:–—-]+$/, "") + "…";
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;

/** The candidate's skills that the description names, in the candidate's order. */
export function sharedSkills(description: string, c: MatchCandidate): string[] {
  const d = norm(description);
  return c.skills.filter((s) => {
    const k = norm(s).trim();
    return k.length > 0 && d.includes(` ${k} `);
  });
}

/**
 * The stand-in ranker: most skills named in the description first, then the person's own
 * order. Reasons say only which skills overlap. Labelled, so it is never mistaken for the AI.
 */
export function mockRank(description: string, candidates: MatchCandidate[], company = ""): MatchResult {
  const scored = candidates.map((c, i) => ({ c, i, shared: sharedSkills(description, c) }));
  scored.sort((a, b) => b.shared.length - a.shared.length || a.i - b.i);
  const picks = scored.slice(0, EXHBTS_PER_JOB_LINK).map(({ c, shared }) => ({
    exhbtId: c.id,
    reason: clipWords(
      shared.length
        ? `Placeholder match: uses ${shared.slice(0, 3).join(", ")}, which the description asks for.`
        : "Placeholder match: none of its skills appear in the description.",
      REASON_WORDS,
    ),
  }));
  const intro = clipWords(
    `Placeholder intro, written without the AI. These are the projects of mine that fit the ${company || "role"} description best.`,
    INTRO_WORDS,
  );
  return { picks, intro };
}

/**
 * The model's answer made safe to store: only ids that were offered, each once, at most
 * EXHBTS_PER_JOB_LINK, reasons and intro clipped. When it picked fewer than it could, the
 * stand-in order fills the rest so every link shows as many as the person has.
 */
export function tidyMatch(raw: MatchResult, description: string, candidates: MatchCandidate[]): MatchResult {
  const offered = new Set(candidates.map((c) => c.id));
  const seen = new Set<string>();
  const picks: MatchPick[] = [];
  for (const p of raw.picks) {
    if (!offered.has(p.exhbtId) || seen.has(p.exhbtId)) continue;
    seen.add(p.exhbtId);
    picks.push({ exhbtId: p.exhbtId, reason: clipWords(p.reason, REASON_WORDS) });
    if (picks.length === EXHBTS_PER_JOB_LINK) break;
  }
  const want = Math.min(EXHBTS_PER_JOB_LINK, candidates.length);
  if (picks.length < want) {
    for (const c of [...candidates].sort((a, b) => sharedSkills(description, b).length - sharedSkills(description, a).length)) {
      if (picks.length >= want) break;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const shared = sharedSkills(description, c);
      picks.push({ exhbtId: c.id, reason: shared.length ? clipWords(`Uses ${shared.slice(0, 3).join(", ")}, named in the description.`, REASON_WORDS) : "" });
    }
  }
  return { picks, intro: clipWords(raw.intro, INTRO_WORDS) };
}

/** Characters allowed in a link's intro (curated_links.intro), roughly INTRO_WORDS words. */
export const INTRO_MAX_CHARS = 400;
