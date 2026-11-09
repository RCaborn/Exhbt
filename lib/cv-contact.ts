/**
 * Lifts a name, email and LinkedIn profile out of CV text, to prefill the project-ideas gate
 * (docs/decisions/0004). Every value is a suggestion the person can change, so this errs on the
 * side of returning nothing rather than something wrong. Pure: no network, no AI.
 */

export type Contact = { name: string | null; email: string | null; linkedin: string | null };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINKEDIN_ANYWHERE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})/i;
const LINKEDIN_EXACT = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})\/?(?:[?#].*)?$/i;

/** "linkedin.com/in/amara-o", "https://uk.linkedin.com/in/amara-o/?x=1" → "https://www.linkedin.com/in/amara-o". */
export function normaliseLinkedin(input: string): string | null {
  const m = input.trim().match(LINKEDIN_EXACT);
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

/** Lines that open a CV but aren't a name. */
const HEADINGS = /^(curriculum vitae|cv|resume|résumé|profile|personal (statement|profile|details)|contact( details)?|about( me)?)$/i;
/** Lower-case parts allowed inside a name: "Ludwig van Beethoven". */
const PARTICLES = new Set(["van", "von", "de", "der", "den", "da", "di", "du", "le", "la", "bin", "binti", "al", "el"]);
const WORD = /^\p{Lu}[\p{L}'’.-]*$/u;

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** The name, if one of the first few lines starts with something that reads like one. */
function nameFrom(text: string): string | null {
  for (const raw of text.split(/\r?\n/).slice(0, 6)) {
    // The part before any separator: "Amara Okafor | Data analyst", "Amara Okafor. BSc Data Science".
    const chunk = raw
      .split(/[|•·,;:–—]|\s-\s|\.\s|\.$|\s{2,}|\t/)[0]
      .trim()
      .replace(/\s+/g, " ");
    if (!chunk || HEADINGS.test(chunk) || chunk.length > 50 || /[\d@/]/.test(chunk)) continue;
    const words = chunk.split(" ");
    if (words.length < 2 || words.length > 4) continue;
    const allCaps = chunk === chunk.toUpperCase();
    const ok = words.every((w, i) => {
      if (i > 0 && i < words.length - 1 && PARTICLES.has(w.toLowerCase())) return true;
      return allCaps ? /^\p{L}[\p{L}'’.-]*$/u.test(w) : WORD.test(w);
    });
    if (ok) return allCaps ? titleCase(chunk) : chunk;
  }
  return null;
}

export function extractContact(cvText: string): Contact {
  const text = cvText.slice(0, 5_000); // contact details sit at the top
  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;
  const handle = text.match(LINKEDIN_ANYWHERE)?.[1];
  return {
    name: nameFrom(text),
    email,
    linkedin: handle ? `https://www.linkedin.com/in/${handle}` : null,
  };
}
