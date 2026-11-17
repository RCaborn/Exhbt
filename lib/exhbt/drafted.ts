import { findingsOf, imagesOf, plain, sectionsOf, type ExhbtDoc } from "./blocks";
import { FORMAT_RULES, formatOf, type Format } from "./formats";

/**
 * What the editor says, once, when it opens after a draft (decision 0025): which layout the AI
 * chose and why, and what came of looking for a figure in the person's files.
 *
 *   "Laid out as Research because your work has an aim and results. Change layout.
 *    The figure is from page 3 of report.pdf. Tick that you may share it before you publish."
 *
 * Every word is fixed here. The draft answers with one of a fixed set of signals, never its own
 * words, and a signal is only said when the draft itself bears it out (checkedReason): the AI can't
 * claim an aim the draft doesn't have, or notes that don't name the layout. Anything else is
 * "default", which gives no reason at all. Pure, so the server, the editor and the tests share it.
 */
export const LAYOUT_REASONS = ["notes", "aim-results", "hypothesis-results", "study", "visual-work", "mostly-pictures", "question-findings", "default"] as const;
export type LayoutReason = (typeof LAYOUT_REASONS)[number];
export const isLayoutReason = (v: unknown): v is LayoutReason => typeof v === "string" && (LAYOUT_REASONS as readonly string[]).includes(v);

/** What follows "because". None for "default". */
const BECAUSE: Record<LayoutReason, string | null> = {
  notes: "your notes name this layout",
  "aim-results": "your work has an aim and results",
  "hypothesis-results": "your work has a hypothesis and results",
  study: "your work is a study with a method and results",
  "visual-work": "your work is something to look at, so the pictures come first",
  "mostly-pictures": "most of what you uploaded is pictures",
  "question-findings": "your work sets out a question and what you found",
  default: null,
};

/** The layouts a signal can explain. */
const FITS: Record<LayoutReason, readonly Format[]> = {
  notes: ["case-study", "gallery", "research"],
  "aim-results": ["research"],
  "hypothesis-results": ["research"],
  study: ["research"],
  "visual-work": ["gallery"],
  "mostly-pictures": ["gallery"],
  "question-findings": ["case-study"],
  default: ["case-study", "gallery", "research"],
};

/** How a layout's name is written in a person's notes. */
const NAMED: Record<Format, RegExp> = { "case-study": /case[\s-]?stud(?:y|ies)/i, gallery: /gallery/i, research: /research/i };

export type UploadSignals = { imageFiles: number; pdfPages: number; pdfPicturePages: number };

/**
 * The signal that may be said for a drafted doc: the one the AI gave, if the doc, the notes and the
 * upload counts bear it out, or else the nearest one that they do, or "default".
 *  - "notes": the notes hold the layout's name.
 *  - research: an aim (or a hypothesis, whichever the draft holds) with results; or results alone
 *    ("study").
 *  - "mostly-pictures": the upload had picture files, or at least half its PDF pages hold pictures.
 *  - "question-findings": the title is a question and there are findings.
 */
export function checkedReason(doc: ExhbtDoc, claimed: unknown, facts: { notes?: string; signals?: UploadSignals } = {}): LayoutReason {
  const f = formatOf(doc);
  const reason: LayoutReason = isLayoutReason(claimed) && FITS[claimed].includes(f) ? claimed : "default";
  const hasFindings = findingsOf(doc).some((it) => plain(it).trim());
  switch (reason) {
    case "notes":
      return NAMED[f].test(facts.notes ?? "") ? "notes" : "default";
    case "aim-results":
    case "hypothesis-results":
    case "study": {
      if (!hasFindings) return "default";
      const aim = sectionsOf(doc, "aim").find((s) => plain(s.text).trim());
      if (!aim) return "study";
      return aim.heading === "hypothesis" ? "hypothesis-results" : "aim-results";
    }
    case "mostly-pictures": {
      const s = facts.signals;
      return s && (s.imageFiles > 0 || (s.pdfPages > 0 && s.pdfPicturePages * 2 >= s.pdfPages)) ? "mostly-pictures" : "visual-work";
    }
    case "question-findings":
      return doc.title.trim().endsWith("?") && hasFindings ? "question-findings" : "default";
    default:
      return reason;
  }
}

/**
 * "Laid out as Research because your work has an aim and results." A reason that doesn't fit the
 * layout (a link opened by hand, a layout switched since) is left out.
 */
export function layoutSentence(f: Format, reason: LayoutReason | undefined): string {
  const because = reason && FITS[reason].includes(f) ? BECAUSE[reason] : null;
  return `Laid out as ${FORMAT_RULES[f].name}${because ? ` because ${because}` : ""}.`;
}

/**
 * What came of looking for a figure, when none went on the exhbt. The draft page passes one on:
 *  - "none": pages were looked at and no figure was found (or no page drew anything but text);
 *  - "failed": it couldn't look, the pick ran late, or the figure couldn't be put on;
 *  - "unread": files were uploaded but none was a PDF whose pages could be looked at.
 * A figure that did go on is read from the doc, not from this.
 */
export const FIGURE_NEWS = ["none", "failed", "unread"] as const;
export type FigureNews = (typeof FIGURE_NEWS)[number];
export const isFigureNews = (v: unknown): v is FigureNews => typeof v === "string" && (FIGURE_NEWS as readonly string[]).includes(v);

/**
 * The sentence about the figure, or null when there's nothing to say. A picked figure on the doc
 * speaks for itself: its file and page come from its own note, never from the address bar.
 */
export function figureSentence(doc: ExhbtDoc, news: FigureNews | undefined): string | null {
  const picked = imagesOf(doc).find((im) => im.picked)?.picked;
  if (picked) {
    const where = picked.page ? `page ${picked.page} of ${picked.from}` : picked.from;
    return `The figure is from ${where}.${picked.shareOk ? "" : " Tick that you may share it before you publish."}`;
  }
  switch (news) {
    case "none":
      return sectionsOf(doc, "graph").length > 0 ? "No figure was found in your files, so the graph uses numbers from your files and notes." : "No figure was found in your files.";
    case "failed":
      return "We couldn't look for a figure in your files this time. You can add an image yourself.";
    case "unread":
      return "A figure can only be taken from a PDF for now.";
    default:
      return null;
  }
}
