/**
 * The path of a published exhbt on its owner's portfolio host (lib/hosts.ts), after the slash.
 * Made from the title on first publish and kept after that, so shared links keep working
 * when the title changes.
 */

export const SLUG_MAX = 60;

/** Lower case, hyphens between words, nothing else, at most SLUG_MAX characters. */
export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return trimTo(s, SLUG_MAX) || "exhbt";
}

/** Cuts at a hyphen where it can, so a word isn't chopped in half. */
function trimTo(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf("-");
  return (at >= max / 2 ? cut.slice(0, at) : cut).replace(/-+$/, "");
}

/** `base`, or `base-2`, `base-3`… when the person already uses it. Never longer than SLUG_MAX. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${trimTo(base, SLUG_MAX - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
