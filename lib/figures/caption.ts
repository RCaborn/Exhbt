/**
 * Cutting a caption to its word limit (decision 0025). Pure: shared by the browser and the server
 * through lib/figures/rules.ts, which re-exports it as `fitCaption`. It runs only when a figure is
 * picked and when it is placed, never on a caption that is already stored.
 *
 * The rule (release 2 review, caption-cut-early-clause):
 *
 *  1. A caption within the limit comes back as it was.
 *  2. A longer one is cut to the limit. It is cut back to an earlier end of a sentence or a clause
 *     only when that keeps at least two thirds of the limit, rounded up: 10 words of 15, 7 of 10.
 *     An earlier cut than that can leave a caption that says something else ("Sales for 2019").
 *  3. These are not the end of a clause:
 *      - a comma inside a list, which is one with "and" or "or" after it before the sentence ends;
 *      - a comma before a number ("2019, 2020"), and a comma or point inside one ("12,000", "3.5"),
 *        which is never at the end of a word anyway;
 *      - a full stop after a single letter ("J. Smith", "Group A.") or an abbreviation ("approx.");
 *      - a full stop, ! or ? with a digit or a small letter after it.
 *  4. With no such end, the cut at the limit stands. If that leaves a bracket or a double quote
 *     open, the caption is cut back to before the opening mark when that still keeps two thirds.
 *  5. A comma, semicolon or colon left at the end is dropped, and so is a dash standing on its own.
 *  6. A cut that stops inside a sentence ends with one ellipsis character, joined to the last word,
 *     so the caption reads as shortened and not as a finished sentence that says less.
 *
 * Words are only ever taken away, from the end. None is added or changed, and a caption that had
 * words never comes back empty.
 */

/** Two thirds of the limit, rounded up: the fewest words a cut at a sentence or clause end may keep. */
const leastWords = (max: number): number => Math.ceil((2 * max) / 3);

/** Marks that open a bracket or a quote at the start of a word, and ones that close after it. */
const OPENING = /^["'([{“‘]+/;
const CLOSING = /["')\]}”’]+$/;

/**
 * Abbreviations written with a full stop that doesn't end the sentence, in small letters and without
 * the stop. A long list is the safe side: a full stop wrongly taken for an abbreviation only loses a
 * tidier cut, while an abbreviation taken for the end of a sentence leaves "Sales rose by approx."
 */
const ABBREVIATIONS = new Set([
  "approx", "e.g", "i.e", "fig", "figs", "no", "nos", "vs", "etc", "dr", "st", "mr", "mrs", "ms", "prof", "eq", "eqs", "cf", "ca", "al", "ed", "eds",
  "vol", "pp", "ch", "sec", "sect", "dept", "est", "incl", "excl", "max", "min", "avg", "ltd", "inc", "co", "jr", "sr", "viz", "resp", "tab", "ref", "refs",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

/** The words that carry a list on: "red, green and blue". */
const JOINS_A_LIST = new Set(["and", "or", "nor", "&", "and/or"]);

/** The first letter or digit of a word, past any opening bracket or quote; "" when it has none. */
const firstOf = (word: string): string => {
  const ch = word.replace(OPENING, "")[0] ?? "";
  return /[\p{L}\p{N}]/u.test(ch) ? ch : "";
};
const isDigit = (ch: string): boolean => /\p{N}/u.test(ch);
const isSmallLetter = (ch: string): boolean => ch !== "" && ch === ch.toLowerCase() && ch !== ch.toUpperCase();
/** Already trailing off: the word ends with an ellipsis, typed as one character or as dots. */
const trailsOff = (word: string): boolean => /(?:…|\.\.)$/.test(word.replace(CLOSING, ""));

/** Whether a sentence ends at this word: a full stop, ! or ? (perhaps inside a closing quote or bracket) that really ends one. */
function endsSentence(words: string[], i: number): boolean {
  const word = (words[i] ?? "").replace(CLOSING, "");
  const mark = word.slice(-1);
  if (mark !== "." && mark !== "!" && mark !== "?") return false;
  if (trailsOff(word)) return false;
  // What follows decides it: "approx. 12,000", "No. 3" and "vs. the control" carry on. The last word of all ends the caption.
  if (i + 1 < words.length) {
    const next = firstOf(words[i + 1]!);
    if (!next || isDigit(next) || isSmallLetter(next)) return false;
  }
  if (mark !== ".") return true;
  const stem = word.slice(0, -1).replace(OPENING, "");
  // An initial or a label ("J.", "A."), initials run together ("U.K.", "e.g."), or a known abbreviation.
  if (/^\p{L}$/u.test(stem) || /^(?:\p{L}\.)+\p{L}$/u.test(stem)) return false;
  return !ABBREVIATIONS.has(stem.toLowerCase());
}

/**
 * Whether the comma at this word is inside a list: "and" or "or" comes after it before the sentence
 * ends. Further commas on the way are taken as more of the same list ("red, green, blue and
 * yellow"). It reads the whole caption, not only the words kept, since the "and" is often past the
 * limit.
 */
function inList(words: string[], i: number): boolean {
  for (let k = i + 1; k < words.length; k++) {
    const word = words[k]!;
    if (JOINS_A_LIST.has(word.replace(OPENING, "").replace(/["')\]}”’.,;:!?…]+$/, "").toLowerCase())) return true;
    const mark = word.replace(CLOSING, "").slice(-1);
    if (mark === ";" || mark === ":" || endsSentence(words, k)) return false;
  }
  return false;
}

/** Whether a clause ends at this word: a semicolon or colon, or a comma that isn't inside a list, after an abbreviation or before a number. */
function endsClause(words: string[], i: number): boolean {
  const word = words[i] ?? "";
  const mark = word.slice(-1);
  if (mark === ";" || mark === ":") return true;
  if (mark !== ",") return false;
  const stem = word.slice(0, -1).replace(OPENING, "").replace(/\.$/, "");
  if (ABBREVIATIONS.has(stem.toLowerCase())) return false;
  if (isDigit(firstOf(words[i + 1] ?? ""))) return false;
  return !inList(words, i);
}

const CLOSES: Record<string, string> = { ")": "(", "]": "[", "}": "{", "”": "“" };

/**
 * Among the first `n` words: the word that holds the first bracket or double quote opened and not
 * closed, or -1 when everything opened is closed. Single quote marks are left out, since an
 * apostrophe looks the same ("students' union"). A straight double quote straight after a digit is
 * an inch or seconds mark unless a quote is open.
 */
function firstLeftOpen(words: string[], n: number): number {
  const open: { mark: string; word: number }[] = [];
  const lastOpen = (mark: string) => open.map((o) => o.mark).lastIndexOf(mark);
  for (let w = 0; w < n; w++) {
    const word = words[w]!;
    for (let k = 0; k < word.length; k++) {
      const ch = word[k]!;
      if (ch === "(" || ch === "[" || ch === "{" || ch === "“") open.push({ mark: ch, word: w });
      else if (CLOSES[ch]) {
        // Closes its own opening mark, and with it anything opened inside and left open.
        const at = lastOpen(CLOSES[ch]);
        if (at >= 0) open.length = at;
      } else if (ch === '"') {
        const at = lastOpen('"');
        if (at >= 0) open.length = at;
        else if (!(k > 0 && isDigit(word[k - 1]!))) open.push({ mark: ch, word: w });
      }
    }
  }
  return open.length ? open[0]!.word : -1;
}

/** Without what would hang at the end: a comma, semicolon or colon, and a dash standing on its own. */
function tidy(text: string): string {
  let t = text;
  for (;;) {
    const next = t.replace(/[\s,;:]+$/, "").replace(/\s+[–—-]+$/, "");
    if (next === t) return t;
    t = next;
  }
}

/** A caption cut to `max` words by the rule at the top of this file. One that fits is left alone. */
export function cutCaption(s: string, max: number): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  // A limit under one word is read as one word, so a caption that had words never comes back empty.
  const limit = max >= 1 ? Math.floor(max) : 1;
  if (words.length <= limit) return words.join(" ");
  const least = leastWords(limit);
  // The last end of a sentence or a clause that keeps enough, with every bracket and quote closed.
  let n = 0;
  for (let k = limit; k >= least && !n; k--) {
    if ((endsSentence(words, k - 1) || endsClause(words, k - 1)) && firstLeftOpen(words, k) < 0) n = k;
  }
  if (!n) {
    // None: the cut at the limit, or back to before a bracket or quote left open when that keeps enough.
    const open = firstLeftOpen(words, limit);
    n = open >= least ? open : limit;
  }
  const kept = words.slice(0, n).join(" ");
  const text = tidy(kept) || kept;
  // Stopped inside a sentence: say so, once.
  return endsSentence(words, n - 1) || trailsOff(text) ? text : `${text}…`;
}
