import { slugify } from "./exhbt/slug";
import type { Store } from "./store";

/**
 * One slug space per person. Exhbts (alex.exhbt.co.uk/gp-reminders) and job links
 * (alex.exhbt.co.uk/lloyds-x7k2) share the path after the host, so a new slug of either kind
 * must miss both. Decision 0008: a job link is clean (`lloyds`, guessable) or suffixed
 * (`lloyds-x7k2`, the default, can't be guessed).
 *
 * No "server-only" here, so the rules can be tested directly; the store is passed in, or
 * loaded on the server when it isn't.
 */

export const JOB_LINK_SLUG_MAX = 40;
const SUFFIX_LENGTH = 4;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export type SlugStyle = "clean" | "suffix";

/** The two reads the slug space needs. */
export type SlugSource = Pick<Store, "listExhbts" | "listJobLinks">;

async function defaultSource(): Promise<SlugSource> {
  return (await import("./store")).getStore();
}

/**
 * Every slug the person already uses: every exhbt that has one (live or not, as it keeps it
 * for when it goes live again) and every job link (on or off).
 */
export async function takenSlugs(
  userId: string,
  opts: { exceptExhbtId?: string; exceptJobLinkId?: string; source?: SlugSource } = {},
): Promise<Set<string>> {
  const source = opts.source ?? (await defaultSource());
  const [exhbts, links] = await Promise.all([source.listExhbts(userId), source.listJobLinks(userId)]);
  const taken = new Set<string>();
  for (const e of exhbts) if (e.slug && e.id !== opts.exceptExhbtId) taken.add(e.slug);
  for (const l of links) if (l.id !== opts.exceptJobLinkId) taken.add(l.slug);
  return taken;
}

/** Whether this person already uses the slug, for an exhbt or a job link. */
export async function slugTaken(userId: string, slug: string, source?: SlugSource): Promise<boolean> {
  return (await takenSlugs(userId, { source })).has(slug);
}

/** Four random lower-case letters and digits. */
export function randomSuffix(random: () => number = secureRandom): string {
  let s = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

function secureRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! / 2 ** 32;
}

/** Lower case and hyphens from the company name, at most `max` characters, cut between words. */
function companyBase(company: string, max: number): string {
  const s = /[a-z0-9]/i.test(company.normalize("NFKD")) ? slugify(company) : "job";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf("-");
  return (at >= max / 2 ? cut.slice(0, at) : cut).replace(/-+$/, "");
}

/**
 * A job link's slug from the company name: `lloyds` (clean) or `lloyds-x7k2` (suffixed),
 * lower case, hyphens, at most JOB_LINK_SLUG_MAX characters, and not in `taken`.
 * A clean slug already in use becomes `lloyds-2`, `lloyds-3`…; a suffixed one draws again.
 */
export function jobLinkSlug(company: string, style: SlugStyle, taken: Iterable<string>, random?: () => number): string {
  const used = new Set(taken);
  if (style === "suffix") {
    const base = companyBase(company, JOB_LINK_SLUG_MAX - SUFFIX_LENGTH - 1);
    for (let i = 0; i < 50; i++) {
      const candidate = `${base}-${randomSuffix(random)}`;
      if (!used.has(candidate)) return candidate;
    }
    // 36^4 endings: only a broken random source gets here. Fall through to numbering.
  }
  const base = companyBase(company, JOB_LINK_SLUG_MAX);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const end = `-${n}`;
    const candidate = `${companyBase(company, JOB_LINK_SLUG_MAX - end.length)}${end}`;
    if (!used.has(candidate)) return candidate;
  }
}
