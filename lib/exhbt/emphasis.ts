import { plain, text, words, type RichText, type Run } from "./blocks";

/**
 * The AI's emphasis (decision 0029, "Emphasis inside the answer"). Rory, 25 Nov 2026: "Maybe we could do some AI
 * bolding where we think it should be, or italics where it's important information; make it really skimmable within
 * the AI-generated bit." The draft and the rewrite mark what matters inline, in the text they already return, as
 * `**bold**` and `*italic*`: no field is added to their answers. This turns the marks into runs in the fields that are
 * formatted text, and takes them out of every other field. Pure, so the server, the stand-in AI and the tests share it.
 *
 * The prompts give the rules, and this holds the answer to them whatever the model sends:
 *  - A mark hugs a word: `**` or `*` at the start of a word opens, at the end of one closes. One inside a word, or with
 *    a space on both sides, is part of the words ("2 * 3", "x**2").
 *  - In each field (a paragraph, a finding, a caption): at most one bold phrase, of at most six words, for the key
 *    result or number; at most one italic phrase, of at most eight, for a term or the title of a work. Neither is ever
 *    a whole sentence.
 *  - Marks that pair with nothing, that sit inside another pair, or that go past those limits are dropped, and their
 *    words kept. A mark that pairs with nothing is kept as written only where the material has it so: an A* grade, a
 *    significance star (0.42**).
 *  - A field that isn't formatted text gets the plain words, and so does the context line: its bold is the gap it
 *    highlights, from gapHighlight (decision 0022).
 * Word counts, the number checks and the checks that keep only what the person supplied all read the plain words, so
 * emphasis can never change what is said.
 */

export const EMPHASIS = {
  /** Bold: one phrase in a field, of at most this many words. The key result or number. */
  bold: { max: 1, words: 6 },
  /** Italic: one phrase in a field, of at most this many words. A term, or the title of a work. */
  italic: { max: 1, words: 8 },
} as const;

/** Which marks a field may keep. */
export type Allow = { bold: boolean; italic: boolean };
const BOTH: Allow = { bold: true, italic: true };
const NONE: Allow = { bold: false, italic: false };

/** A run of asterisks that can open or close emphasis: `at` is where it starts, `len` how many. */
type Mark = { at: number; len: number; open: boolean; close: boolean };

const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/u.test(c);

/** Every run of asterisks that hugs a word on one side, in order. Any other asterisk is part of the words. */
function marksIn(s: string): Mark[] {
  const out: Mark[] = [];
  for (const m of s.matchAll(/\*+/g)) {
    const at = m.index;
    const len = m[0].length;
    const before = at > 0 ? s[at - 1] : undefined;
    const after = s[at + len];
    // Opens at the start of a word: a word after it, and no letter or digit before it. Closes at the end of one.
    const open = !isSpace(after) && !isWord(before);
    const close = !isSpace(before) && !isWord(after);
    if (open || close) out.push({ at, len, open, close });
  }
  return out;
}

/** Pairs of marks, left to right, of the same length (`**` with `**`, `*` with `*`), with no mark between them. Any other mark is stray. */
function pairUp(marks: Mark[]): { pairs: [Mark, Mark][]; stray: Mark[] } {
  const pairs: [Mark, Mark][] = [];
  const stray: Mark[] = [];
  let open: Mark | null = null;
  for (const m of marks) {
    if (!open) {
      if (m.open && m.len <= 2) open = m;
      else stray.push(m);
    } else if (m.close && m.len === open.len) {
      pairs.push([open, m]);
      open = null;
    } else {
      // A mark inside an open pair: nested or crossed. Neither is kept as emphasis.
      stray.push(open, m);
      open = null;
    }
  }
  if (open) stray.push(open);
  return { pairs, stray };
}

/** Whether a stray mark is the material's own, as written there with the word it hugs: an A* grade, a significance star. */
function inMaterial(s: string, m: Mark, source: string): boolean {
  const run = s.slice(m.at, m.at + m.len);
  const left = /\S*$/u.exec(s.slice(0, m.at))![0];
  const right = /^\S*/u.exec(s.slice(m.at + m.len))![0];
  const lefts = [left, left.replace(/^[^\p{L}\p{N}]+/u, "")].filter(Boolean);
  const rights = [right, right.replace(/[^\p{L}\p{N}]+$/u, "")].filter(Boolean);
  return lefts.some((l) => source.includes(l + run)) || rights.some((r) => source.includes(run + r));
}

/** A phrase or a sentence without the quotes, brackets and punctuation round it, to tell whether one is the other. */
const bare = (x: string) => x.replace(/^[\s"'“”‘’([]+|[\s"'“”‘’)\].,;:!?]+$/gu, "").toLowerCase();

/** Whether `phrase` is the whole of one of the sentences in `all`. */
const wholeSentence = (phrase: string, all: string) => all.split(/(?<=[.!?]["'”’)\]]?)\s+/u).some((sentence) => bare(sentence) === bare(phrase));

/**
 * The text as runs. `allow` says which marks may become emphasis; `keepStray` whether a mark that pairs with nothing
 * stays as written (otherwise it is dropped). Text with no marks is exactly `text(s)`.
 */
function parse(s: string, allow: Allow, keepStray: (m: Mark) => boolean): RichText {
  const marks = marksIn(s);
  if (!marks.length) return text(s);
  const { pairs, stray } = pairUp(marks);
  const dropped = new Set<Mark>(stray.filter((m) => !keepStray(m)));
  const kept = new Map<Mark, "b" | "i">();
  // The field's words with every mark out, for "never a whole sentence".
  let all = "";
  let from = 0;
  for (const m of marks) {
    all += s.slice(from, m.at);
    from = m.at + m.len;
  }
  all += s.slice(from);
  const used = { b: 0, i: 0 };
  for (const [o, c] of pairs) {
    const kind = o.len === 2 ? "b" : "i";
    const rule = kind === "b" ? EMPHASIS.bold : EMPHASIS.italic;
    const phrase = s.slice(o.at + o.len, c.at);
    const ok = (kind === "b" ? allow.bold : allow.italic) && used[kind] < rule.max && words(phrase) <= rule.words && /[\p{L}\p{N}]/u.test(phrase) && !wholeSentence(phrase, all);
    if (ok) {
      used[kind]++;
      kept.set(o, kind);
      kept.set(c, kind);
    } else {
      dropped.add(o);
      dropped.add(c);
    }
  }
  const out: Run[] = [];
  let style: "b" | "i" | null = null;
  const push = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && Boolean(last.b) === (style === "b") && Boolean(last.i) === (style === "i")) last.t += t;
    else out.push(style === "b" ? { t, b: true } : style === "i" ? { t, i: true } : { t });
  };
  let at = 0;
  for (const m of marks) {
    push(s.slice(at, m.at));
    at = m.at + m.len;
    if (dropped.has(m)) continue;
    const kind = kept.get(m);
    // A kept pair's first mark starts its style and its second ends it; no other mark is ever between them.
    if (kind) style = style ? null : kind;
    else push(s.slice(m.at, m.at + m.len));
  }
  push(s.slice(at));
  return out;
}

/**
 * The AI's text for a formatted field, as runs: its bold and italic within the rules above, every other mark dropped
 * or, where the material has it as written, kept. `source` is the material (everything the person supplied).
 */
export const emphasisRuns = (s: string, source: string, allow: Allow = BOTH): RichText => parse(s, allow, (m) => inMaterial(s, m, source));

/** The AI's text for a field that isn't formatted (a title, a flowchart box, a chart label, a quote): its words, with no marks. */
export const unmarked = (s: string, source: string): string => plain(parse(s, NONE, (m) => inMaterial(s, m, source)));

let lastMaterial: [string, string] | null = null;
/**
 * The material with its own emphasis taken out (a Markdown file's `**bold**`), every other asterisk kept: what a quote
 * the AI copied from it, with the marks taken out, is compared with. Kept for the last material, which is read often.
 */
export function materialWords(source: string): string {
  if (lastMaterial?.[0] !== source) lastMaterial = [source, plain(parse(source, NONE, () => true))];
  return lastMaterial[1];
}
