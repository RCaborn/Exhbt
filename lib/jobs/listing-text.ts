import { checkCvText, cleanCvText } from "../cv-quality";

/**
 * Turning a job page's HTML into the description, and deciding whether what came back is
 * worth matching against. Pure, so it can be tested without the network; the fetch itself is
 * lib/jobs/fetch-listing.ts.
 */

/** Characters of description kept: plenty for any advert. */
export const MAX_LISTING_CHARS = 20_000;
/** Fewer words than this and it isn't a job description (a cookie wall, a "turn on JavaScript" page). */
export const MIN_LISTING_WORDS = 60;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", pound: "£", euro: "€", copy: "©",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Tags that start a new line or paragraph when the markup is flattened. */
const BLOCK = /<\/?(?:p|div|section|article|main|h[1-6]|li|ul|ol|tr|table|br|hr|dd|dt|dl|blockquote)\b[^>]*>/gi;

/** Markup to text: scripts, styles, navigation and forms go; block tags become line breaks. */
function flatten(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|head|nav|header|footer|form|aside|button|select)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(BLOCK, "\n")
    .replace(/<[^>]+>/g, " ");
  return cleanCvText(decodeEntities(stripped), MAX_LISTING_CHARS);
}

/**
 * Many career sites (Greenhouse, Lever, Workday and others) put the advert in a JobPosting
 * block for search engines. When there is one, its description is the cleanest copy.
 */
function jobPostingDescription(html: string): string | null {
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const nodes: unknown[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        nodes.push(v);
        const graph = (v as { "@graph"?: unknown })["@graph"];
        if (graph) walk(graph);
      }
    };
    walk(data);
    for (const n of nodes) {
      const o = n as { "@type"?: unknown; description?: unknown; title?: unknown };
      const types = Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]];
      if (types.includes("JobPosting") && typeof o.description === "string") {
        const body = flatten(o.description);
        const title = typeof o.title === "string" ? decodeEntities(o.title).trim() : "";
        return title ? `${title}\n\n${body}` : body;
      }
    }
  }
  return null;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** The readable text of a job page: its JobPosting description if it has one, else its main content. */
export function htmlToListingText(html: string): string {
  const posting = jobPostingDescription(html);
  if (posting && wordCount(posting) >= MIN_LISTING_WORDS) return posting;
  // Prefer <main> or the longest <article> when they hold most of the words.
  const whole = flatten(html);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]!);
  for (const part of [main, ...articles.sort((a, b) => b.length - a.length)]) {
    if (!part) continue;
    const text = flatten(part);
    if (wordCount(text) >= MIN_LISTING_WORDS) return text;
  }
  return whole;
}

/** Why this text can't be used as a job description, or null when it can. */
export function listingTextProblem(text: string): "thin" | "garbled" | null {
  if (wordCount(text) < MIN_LISTING_WORDS) return "thin";
  const check = checkCvText(text);
  return check.ok ? null : check.reason === "too_short" ? "thin" : "garbled";
}
