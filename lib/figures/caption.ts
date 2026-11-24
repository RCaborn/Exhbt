/**
 * Cutting a caption to its word limit (decision 0025). Pure: shared by the browser and the server
 * through lib/figures/rules.ts, which re-exports it as `fitCaption`.
 */

/** Whether every bracket opened in the words is closed in them. */
const bracketsClosed = (words: string[]): boolean => {
  let open = 0;
  for (const ch of words.join(" ")) {
    if (ch === "(" || ch === "[" || ch === "{") open++;
    else if ((ch === ")" || ch === "]" || ch === "}") && open > 0) open--;
  }
  return open === 0;
};

/** The fewest words a caption is cut back to at a clause: a bare "Figure 1." is a label, not a caption. */
const LEAST_WORDS = 3;

/** A word that ends a sentence or a clause: a full stop, !, ?, comma, semicolon or colon, perhaps then a closing quote or bracket. */
const ENDS_CLAUSE = /[.!?,;:]["')\]]?$/;

/**
 * A caption cut to `max` words. One that fits is left alone. One that doesn't is cut where a sentence
 * or a clause ends within the limit, with every bracket closed and no comma left hanging, so it never
 * stops in the middle of a phrase ("... by condition (n = 24 in each"). Words are only ever taken
 * away, never added. With no such place it is cut at the limit, back past an unclosed bracket, and a
 * trailing comma, colon, semicolon or dash is dropped.
 */
export function cutCaption(s: string, max: number): string {
  const all = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (all.length <= max) return all.join(" ");
  const cut = all.slice(0, max);
  const tidy = (words: string[]) => words.join(" ").replace(/[\s,;:–—-]+$/, "");
  for (let n = cut.length; n >= LEAST_WORDS; n--) {
    if (ENDS_CLAUSE.test(cut[n - 1]!) && bracketsClosed(cut.slice(0, n))) return tidy(cut.slice(0, n));
  }
  let n = cut.length;
  while (n > 0 && !bracketsClosed(cut.slice(0, n))) n--;
  return tidy(cut.slice(0, n));
}
