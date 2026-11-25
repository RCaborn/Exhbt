/**
 * How much of a person's own files an AI draft reads, and what is kept of a file too long to read
 * whole. Rory, 25 Nov 2026: his 15,000-word dissertation was read only as far as about 7,000 words,
 * because each file was cut at 60,000 characters and the material at 80,000, both from the start,
 * so a dissertation's results and conclusion, which come last, were lost.
 *
 * The budget, MAX_MATERIAL_CHARS, is for everything a draft or a rewrite reads: the files, the
 * notes and the link together. 240,000 characters, because:
 *  - English prose comes to about four characters a token, so it is about 60,000 tokens, and with
 *    the draft's instructions a request stays near 65,000 input tokens. That is a third under the
 *    100,000 at which the model's price goes up five times (AI_LONG_PROMPT_TOKENS in
 *    lib/ai/model.ts), and still under it for text of three characters a token, as figures and
 *    tables are. Four characters a token is an estimate: no draft this long has run against the
 *    real model yet. Each draft's input tokens are in ai_call_logs, so the first long one will say.
 *  - A 20,000-word dissertation, references and all, is 120,000 to 170,000 characters, so it is
 *    read whole, with room left for the notes and a few smaller files.
 *  - At the model's price that input costs about 0.6 US cents a draft (lib/ai/model.ts).
 *
 * A file the budget can't hold whole keeps its start and its end (keepStartAndEnd): about two
 * thirds from the start, where the question and the method are, and one third from the end, where
 * the results and the conclusion are, with the gap marked so the AI knows the text jumps. The draft
 * page reads each file whole, shares the budget between the files (sharesOf), cuts each to its share
 * and says on each file what was read. The AI calls cut once more (lib/ai/exhbt-draft.ts,
 * lib/ai/exhbt-rewrite.ts) only when a request carries more than the budget, which the page never
 * sends.
 *
 * Pure, with no browser or server APIs: the draft page, the AI calls and the tests share it.
 */

/** Everything a draft or a rewrite reads, in characters: the files, the notes and the link together. */
export const MAX_MATERIAL_CHARS = 240_000;

/** Kept back from the files for the notes (up to 5,000 characters, /api/exhbts/draft), the link (up to 500) and their labels. */
export const NOTES_ROOM = 5_600;

/** Put where the middle of a file was left out, on a line of its own, so the AI knows the text jumps there. */
export const LEFT_OUT = "[the middle of this file was left out]";
/** The same, where an AI call cuts the material as a whole (more than the budget, which the draft page never sends). */
export const LEFT_OUT_OF_MATERIAL = "[part of the material was left out here]";

/** The part of a cut file taken from its start; the rest comes from its end. */
const START_SHARE = 2 / 3;

/**
 * The characters the files may take between them: the budget less the notes' room and the line that
 * names each file over its text ("File: report.pdf", and the blank line between files).
 */
export const filesBudget = (names: string[]): number => Math.max(0, MAX_MATERIAL_CHARS - NOTES_ROOM - names.reduce((n, name) => n + name.length + 9, 0));

/**
 * Each file's share of `budget` characters, in the order given. A file that fits in an equal share
 * keeps all of it, and what it doesn't use goes to the others, so only the longest files are cut and
 * they get equal shares. The shares never add up to more than the budget.
 */
export function sharesOf(lengths: number[], budget: number): number[] {
  const shares = lengths.map(() => 0);
  let left = Math.max(0, Math.floor(budget));
  const shortestFirst = lengths.map((n, i) => ({ n: Math.max(0, n), i })).sort((a, b) => a.n - b.n);
  for (const [k, { n, i }] of shortestFirst.entries()) {
    const share = Math.min(n, Math.floor(left / (shortestFirst.length - k)));
    shares[i] = share;
    left -= share;
  }
  return shares;
}

/**
 * `text` in at most `max` characters: all of it when it fits. Otherwise about two thirds from the
 * start and one third from the end, each cut at a paragraph break near the cut (else a line break,
 * else a space, so no word is split), with `mark` between them on a line of its own.
 */
export function keepStartAndEnd(text: string, max: number, mark: string = LEFT_OUT): string {
  if (text.length <= max) return text;
  const joint = `\n\n${mark}\n\n`;
  const room = Math.floor(max) - joint.length;
  // Too little room for both ends to say anything: the start alone.
  if (room < 200) return text.slice(0, Math.max(0, Math.floor(max)));
  const startRoom = Math.floor(room * START_SHARE);
  const start = endAtBreak(text.slice(0, startRoom)).trimEnd();
  const end = startAtBreak(text.slice(text.length - (room - startRoom))).trimStart();
  return `${start}${joint}${end}`;
}

/** The text up to its last paragraph break in its second half (else line break, else space). */
function endAtBreak(s: string): string {
  for (const sep of ["\n\n", "\n", " "]) {
    const at = s.lastIndexOf(sep);
    if (at >= s.length / 2) return s.slice(0, at);
  }
  return s;
}

/** The text from its first paragraph break in its first half (else line break, else space). */
function startAtBreak(s: string): string {
  for (const sep of ["\n\n", "\n", " "]) {
    const at = s.indexOf(sep);
    if (at >= 0 && at <= s.length / 2) return s.slice(at + sep.length);
  }
  return s;
}
