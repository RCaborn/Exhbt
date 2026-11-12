import { APEX, portfolioHost } from "./hosts";

/**
 * Where "View my portfolio" should go from the page the person is on. On a real exhbt.co.uk
 * host it's their subdomain; in development and previews (localhost, workers.dev), where
 * subdomains don't resolve, it's the /p/<username> path the same deployment serves.
 * Safe to import from client components.
 */
export function portfolioHref(username: string, currentHost: string | null | undefined): string {
  const host = (currentHost ?? "").toLowerCase().replace(/:\d+$/, "");
  const live = host === APEX || host.endsWith(`.${APEX}`);
  return live ? `https://${portfolioHost(username)}` : `/p/${username}`;
}
