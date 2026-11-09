/**
 * Public hostnames. One deployment still serves every host; the split is the
 * decision in docs/decisions/0001-portfolio-subdomains.md, not a second codebase.
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
 * Employer links are a path on that host, not a further subdomain.
 * The collection slug includes a short random suffix (see curated_links).
 */
export function portfolioUrl(username: string, collection?: string): string {
  const host = portfolioHost(username);
  return collection ? `${host}/${collection}` : host;
}
