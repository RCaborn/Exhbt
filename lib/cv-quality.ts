/**
 * Whether text pulled out of a CV file is worth using. Used in the browser to decide when to
 * fall back to another reader, and on the server to check what the AI transcribed.
 *
 * A PDF can "succeed" and still give rubbish: a scan gives almost nothing, and a PDF with a
 * broken font map gives letters that aren't words. So this checks the shape of the text, not
 * just its length.
 */

export const MIN_CV_CHARS = 80;

/** Characters kept from one file of project material (CVs keep 20,000). Here so server code can read it without the browser readers. */
export const MAX_DOC_CHARS = 60_000;

/** Common words in English CVs. Real CV text always contains several of them. */
const COMMON = new Set(
  (
    "the and of to in for with a an on at by as from is was are be my i " +
    "university college school degree bsc ba msc ma phd gcse a-level a-levels " +
    "experience work skills education project projects team data management " +
    "customer sales service manager assistant intern internship analyst " +
    "developed led managed built using including responsible worked"
  ).split(/\s+/),
);

export type CvTextCheck = { ok: boolean; reason?: "too_short" | "garbled" };

/** Tidies extracted text. `max` caps its length: a CV needs 20,000 characters; project material gets more. */
export function cleanCvText(text: string, max = 20_000): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function checkCvText(text: string): CvTextCheck {
  const t = text.trim();
  if (t.length < MIN_CV_CHARS) return { ok: false, reason: "too_short" };

  const visible = t.replace(/\s/g, "");
  // Replacement characters, private-use glyphs and control characters mean a font couldn't be mapped.
  const junk = (visible.match(/[�-\u0001-\u001f]/g) ?? []).length;
  if (junk / visible.length > 0.05) return { ok: false, reason: "garbled" };

  // Most of a CV is letters, in any script.
  const letters = (visible.match(/\p{L}/gu) ?? []).length;
  if (letters / visible.length < 0.5) return { ok: false, reason: "garbled" };

  // Text in Latin script should contain ordinary words; shifted font maps produce none.
  const latin = (visible.match(/[A-Za-z]/g) ?? []).length;
  if (latin / Math.max(letters, 1) > 0.8) {
    const words = t.toLowerCase().match(/[a-z][a-z-]*/g) ?? [];
    const hits = words.filter((w) => COMMON.has(w)).length;
    if (hits < Math.min(5, Math.ceil(words.length / 40))) return { ok: false, reason: "garbled" };
  }
  return { ok: true };
}
