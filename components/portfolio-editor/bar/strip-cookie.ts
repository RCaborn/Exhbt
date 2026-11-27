// No imports: the /portfolio server page reads the cookie's name and rule from here.

/**
 * "Hide this" is kept in a first-party cookie, not in browser storage, so the server knows it: /portfolio
 * reads it (page.tsx, as `PortfolioData.stripHidden`), and neither the loading view nor the editor draws
 * the strip, so nothing moves when the editor arrives. It holds the account's id, so another account in the
 * same browser still gets its own strip, and lasts a year. Named in the cookie policy.
 */
export const STRIP_COOKIE = "exhbt_strip_hidden";
const STRIP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Whether the cookie's value says this account hid the strip (page.tsx reads the value from cookies()). */
export const stripHiddenFor = (value: string | undefined, owner: string) => value === owner;

/** Keeps "Hide this" for this account in this browser. */
export function writeStripHidden(owner: string): void {
  try {
    document.cookie = `${STRIP_COOKIE}=${encodeURIComponent(owner)}; Path=/; SameSite=Lax; Max-Age=${STRIP_COOKIE_MAX_AGE}${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    // Kept for this visit only.
  }
}
