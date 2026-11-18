import { APEX } from "./hosts";

/**
 * Anonymous page views (decision 0021). A view is a path with nothing personal in it, the site
 * that sent the visitor, and whether it was a portfolio. No cookie, no IP, no user agent and no
 * signed-in user are stored. These helpers clean what the browser sends; /api/pv uses them and
 * nothing is trusted from the client.
 */

/** Pages that are not counted: the admin panel, the API, the lab's try-out pages and the dev, auth and build routes. */
const SKIP = ["/admin", "/api", "/dev", "/lab", "/auth", "/_next"];
export const isCountedPath = (path: string) => !SKIP.some((p) => path === p || path.startsWith(`${p}/`));

/** A segment that is, or may be, someone's own id: a UUID, a number, or a short code with a digit in it. */
const idLike = (seg: string) => /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(seg) || /^\d+$/.test(seg) || (seg.length >= 8 && /\d/.test(seg) && /^[a-z0-9_-]+$/i.test(seg));

/**
 * The path as stored: pathname only, ids replaced with ":id" so a person's roadmap or exhbt link
 * never becomes a row. A portfolio is stored as "/" or "/:page", never under the person's name.
 * Null when the path should not be counted.
 */
export function cleanPath(raw: unknown, portfolioHost: boolean): { path: string; isPortfolio: boolean } | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const pathname = raw.split(/[?#]/)[0]!.slice(0, 200);
  if (!isCountedPath(pathname)) return null;
  const segs = pathname.split("/").filter(Boolean);
  // On localhost and previews a portfolio is /p/<name>/<page>.
  const viaP = segs[0] === "p";
  if (portfolioHost || viaP) {
    const rest = viaP ? segs.slice(2) : segs;
    return { path: rest.length === 0 ? "/" : "/:page", isPortfolio: true };
  }
  const out = segs.map((s, i) => (idLike(s) || (segs[0] === "r" && i === 1) ? ":id" : s.toLowerCase().slice(0, 60)));
  return { path: `/${out.join("/")}`, isPortfolio: false };
}

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** The referring site's name ("google.com"), or "" for none, ourselves, or anything that is not a plain hostname. */
export function cleanReferrerHost(raw: unknown, ownHost?: string): string {
  if (typeof raw !== "string") return "";
  const h = raw.trim().toLowerCase().replace(/^www\./, "").slice(0, 100);
  if (!HOST_RE.test(h)) return "";
  if (h === APEX || h.endsWith(`.${APEX}`) || h === (ownHost ?? "").replace(/^www\./, "")) return "";
  return h;
}

/** Obvious robots and link-preview fetchers. A visitor with no user agent is skipped too. */
const BOT = /bot|crawl|spider|preview|slurp|facebookexternalhit|lighthouse|pingdom|uptimerobot|monitor/i;
export const isBot = (ua: string | null) => !ua || BOT.test(ua);

/**
 * A crude per-connection limit, kept in this process's memory only (nothing is written down), so
 * one connection cannot fill the table. Allows `limit` views a minute.
 */
const seen = new Map<string, { n: number; resetAt: number }>();
export function allowView(key: string, limit: number, now = Date.now()): boolean {
  if (seen.size > 5000) for (const [k, v] of seen) if (v.resetAt <= now) seen.delete(k);
  const cur = seen.get(key);
  if (!cur || cur.resetAt <= now) {
    seen.set(key, { n: 1, resetAt: now + 60_000 });
    return true;
  }
  cur.n += 1;
  return cur.n <= limit;
}
