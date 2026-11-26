import { formatOf, shownSections, type Format } from "@/lib/exhbt/formats";
import { plain, words, type ExhbtDoc, type Issue } from "@/lib/exhbt/blocks";

/**
 * How long the AI writes each part of an exhbt (decision 0030). Pure, with no `server-only`, so the
 * prompts, the code that reads the AI's answers, the draft eval and the tests share it.
 *
 * People have no word limit on a part of their own: only the whole page has one (LIMITS.totalWords
 * in lib/exhbt/blocks.ts, decision 0009). Rory, 25 Nov 2026: "As long as we keep a 200-ish limit,
 * so it keeps to the point." The AI is still asked to write each part short, to these targets, which
 * are the caps each part had for people until then, layout by layout. Its answer is held to some of them:
 *  - a quote or a pull quote longer than its target is left off, never cut, because a cut quote is
 *    not what was said (quoteFrom in lib/ai/draft-answer.ts, pullquoteFrom in lib/exhbt/references.ts);
 *  - a picked figure's caption is cut to its layout's target (fitCaption in lib/figures/caption.ts);
 *  - the draft eval marks a draft that runs past them (overTargets, scripts/eval-drafts.ts, C2).
 */
export type DraftTargets = {
  /** The one-sentence summary on portfolio cards. */
  summaryWords: number;
  /** The context line under the title. */
  gapWords: number;
  /** Each finding. */
  findingWords: number;
  /** An image's caption. */
  captionWords: number;
  /** Feedback someone gave, copied from the material. */
  quoteWords: number;
  /** What I'd do next (in research, the limitations and next steps). */
  reflectionWords: number;
  /** Research's aim or hypothesis. */
  aimWords: number;
  /** Research's conclusion. */
  conclusionWords: number;
  /** An essay's pull quote, copied from the material. */
  pullquoteWords: number;
};

/** A case study's targets, and every layout's unless it says otherwise. */
export const DRAFT_TARGETS: DraftTargets = {
  summaryWords: 25,
  gapWords: 40,
  findingWords: 20,
  captionWords: 15,
  quoteWords: 30,
  reflectionWords: 35,
  aimWords: 20,
  conclusionWords: 25,
  pullquoteWords: 30,
};

/** What differs from DRAFT_TARGETS in each layout (decisions 0024 and 0028). */
const BY_LAYOUT: Record<Format, Partial<DraftTargets>> = {
  "case-study": {},
  gallery: { gapWords: 30, findingWords: 15, captionWords: 10 },
  research: { gapWords: 25, findingWords: 15, captionWords: 20, reflectionWords: 25 },
  build: { gapWords: 30, findingWords: 15, captionWords: 10 },
  essay: { gapWords: 30, reflectionWords: 25 },
  "before-after": { gapWords: 30, captionWords: 10 },
  event: { gapWords: 30, findingWords: 15, captionWords: 10 },
};

/** A layout's targets. */
export const draftTargets = (f: Format): DraftTargets => ({ ...DRAFT_TARGETS, ...BY_LAYOUT[f] });

/**
 * The parts of a doc that run past the AI's targets for its layout, with the path validateForPublish
 * would give each: for the draft eval, which marks a draft that does (C2). Never shown to the person,
 * and never a reason not to publish. Only the parts the layout draws, as the publish check reads them.
 */
export function overTargets(doc: ExhbtDoc): Issue[] {
  const T = draftTargets(formatOf(doc));
  const out: Issue[] = [];
  const check = (n: number, max: number, path: string, what: string) => {
    if (n > max) out.push({ path, message: `${what}: ${n} words, over the AI's target of ${max}.` });
  };
  check(words(doc.summary ?? ""), T.summaryWords, "summary", "The summary");
  check(words(plain(doc.gap)), T.gapWords, "gap", "The context line");
  for (const { s, i } of shownSections(doc)) {
    const p = `sections.${i}`;
    switch (s.kind) {
      case "findings":
        s.items.forEach((f, k) => check(words(plain(f)), T.findingWords, `${p}.items.${k}`, `Finding ${k + 1}`));
        break;
      case "image":
        check(words(plain(s.caption)), T.captionWords, `${p}.caption`, "The caption");
        break;
      case "quote":
        check(words(s.text), T.quoteWords, `${p}.text`, "The quote");
        break;
      case "reflection":
        check(words(plain(s.text)), T.reflectionWords, `${p}.text`, "What I'd do next");
        break;
      case "aim":
        check(words(plain(s.text)), T.aimWords, `${p}.text`, "The aim");
        break;
      case "conclusion":
        check(words(plain(s.text)), T.conclusionWords, `${p}.text`, "The conclusion");
        break;
      case "pullquote":
        check(words(s.text), T.pullquoteWords, `${p}.text`, "The pull quote");
        break;
    }
  }
  return out;
}
