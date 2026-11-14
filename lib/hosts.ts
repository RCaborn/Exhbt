/**
 * Public hostnames. One deployment serves every host; the split is the decision in
 * docs/decisions/0001-portfolio-subdomains.md, not a second codebase.
 * Plan counts do not belong here. They live in lib/entitlements.ts.
 */

export const APEX = "exhbt.co.uk";

/** Marketing, pricing, universities, legal. */
export const MARKETING_HOST = `www.${APEX}`;

/** The tool: roadmap, account, building exhbts. */
export const APP_HOST = `app.${APEX}`;

/** A person's public portfolio: alex.exhbt.co.uk */
export function portfolioHost(username: string): string {
  return `${username}.${APEX}`;
}

/**
 * Employer (per-job) links are a path on that host, not a further subdomain.
 * The person chooses a clean slug or one with a short random suffix (decision 0008).
 */
export function portfolioUrl(username: string, collection?: string): string {
  const host = portfolioHost(username);
  return collection ? `${host}/${collection}` : host;
}

/**
 * Names that can never be a username: they are, or may become, our own hosts or mail names
 * (decision 0001). Add to it, never remove.
 */
export const RESERVED_USERNAMES = new Set([
  "www", "app", "api", "mail", "send", "admin", "auth", "login", "static", "demo", "dev", "status",
  "help", "support", "blog", "docs", "assets", "cdn", "media", "files", "img", "images", "email",
  "smtp", "imap", "pop", "mx", "ns", "ns1", "ns2", "dashboard", "account", "billing", "pay", "stripe",
  "careers", "jobs", "employers", "universities", "pricing", "privacy", "legal", "terms", "security",
  "exhbt", "exhbts", "hello", "team", "staff", "root", "test", "staging", "preview", "beta", "new",
]);

/** The shape profiles.username allows (same regex as the database check). */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Why a username can't be used, or null when it can (taken-ness is checked in the store). */
export function usernameProblem(name: string): string | null {
  if (!USERNAME_RE.test(name)) return "Use 3 to 30 lower-case letters, numbers or hyphens, starting and ending with a letter or number.";
  if (name.includes("--")) return "Use single hyphens only.";
  if (RESERVED_USERNAMES.has(name)) return "That name is reserved. Try another.";
  return null;
}

export type HostKind =
  | { kind: "marketing" }
  | { kind: "app" }
  | { kind: "portfolio"; username: string }
  /** A name under the apex that is reserved or malformed: not a portfolio, not ours. */
  | { kind: "unknown" };

/**
 * Paths that belong on the tool host. The notes name /login and /roadmap
 * (docs/phase-2.md). /auth is included too: the sign-in cookie is host-only, so a confirm
 * link opened on www would set it there and the next page would open on app without a session.
 * /account, /exhbts and /start are not in that list, so they stay on the host that was opened.
 */
const TOOL_PATHS = ["/login", "/roadmap", "/auth"];

/**
 * Where www and the apex should send a tool path, or null when the request stays put.
 * Only those two hosts move. Localhost and *.workers.dev are one origin in development
 * and on preview builds; sending them to the production app host would break both.
 */
export function toolRedirectUrl(rawHost: string | null | undefined, pathname: string, search = ""): string | null {
  const host = (rawHost ?? "").toLowerCase().replace(/:\d+$/, "");
  if (host !== APEX && host !== MARKETING_HOST) return null;
  if (!TOOL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return `https://${APP_HOST}${pathname}${search}`;
}

/**
 * What a request's host is. Local development and previews (localhost, *.workers.dev) are
 * treated as one origin serving marketing and the app, except `name.localhost`, which
 * is a portfolio so subdomains can be tested locally.
 */
export function parseHost(rawHost: string | null | undefined): HostKind {
  const host = (rawHost ?? "").toLowerCase().replace(/:\d+$/, "");
  if (host === APEX || host === MARKETING_HOST) return { kind: "marketing" };
  if (host === APP_HOST) return { kind: "app" };
  const sub = host.endsWith(`.${APEX}`) ? host.slice(0, -(APEX.length + 1)) : host.endsWith(".localhost") ? host.slice(0, -".localhost".length) : null;
  if (sub === null) return { kind: "marketing" }; // localhost, workers.dev previews, anything else
  if (sub === "www") return { kind: "marketing" };
  if (sub === "app") return { kind: "app" };
  if (sub.includes(".") || usernameProblem(sub)) return { kind: "unknown" };
  return { kind: "portfolio", username: sub };
}
