import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/store";
import { SEED_JOBS } from "./seed";

/**
 * UK job profiles with the skills each one needs. Source of truth: the `job_profiles`
 * table, filled from the ~3,000-role dataset by `scripts/import-jobs.mjs`. Until it is
 * loaded (or when Supabase isn't configured), a small seed list is used instead.
 * The roadmap prompt uses the matched profile's skills to decide what counts as a gap.
 */
export type JobProfile = {
  id: string;
  title: string;
  altTitles: string[];
  skills: string[];
  summary?: string;
  source: string;
};

/** Best-matching profile for a free-text job description, or null if nothing fits. */
export async function findJobProfile(description: string): Promise<JobProfile | null> {
  const query = description.trim().slice(0, 200);
  if (!query) return null;

  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseAdmin()
      .from("job_profiles")
      .select("id, title, alt_titles, skills, summary, source")
      .textSearch("search", query, { type: "websearch", config: "english" })
      .limit(1);
    if (!error && data?.[0]) {
      const r = data[0] as { id: string; title: string; alt_titles: string[]; skills: string[]; summary: string | null; source: string };
      return { id: r.id, title: r.title, altTitles: r.alt_titles, skills: r.skills, summary: r.summary ?? undefined, source: r.source };
    }
    // Empty table or no match: fall through to the seed so the feature still works.
  }
  return matchSeed(query);
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9&+ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["the", "and", "for", "with", "in", "at", "role", "job", "work", "working", "junior", "graduate", "using"]);

function matchSeed(query: string): JobProfile | null {
  const q = new Set(words(query));
  let best: { job: JobProfile; score: number } | null = null;
  for (const job of SEED_JOBS) {
    const titles = [job.title, ...job.altTitles];
    const score = Math.max(...titles.map((t) => words(t).filter((w) => q.has(w)).length / Math.max(1, words(t).length)));
    if (score > 0 && (!best || score > best.score)) best = { job, score };
  }
  return best && best.score >= 0.5 ? best.job : null;
}
