/**
 * When each legal page last changed, as an ISO date. The one owner of these dates: the legal pages
 * print them and the sitemap reads them as `lastmod`. Change the date when the wording changes.
 */
export const LEGAL_UPDATED = {
  privacy: "2026-11-17",
  terms: "2026-11-16",
  cookies: "2026-11-16",
} as const;

export type LegalKey = keyof typeof LEGAL_UPDATED;

/** "16 November 2026" */
export const legalUpdatedLabel = (key: LegalKey) =>
  new Date(`${LEGAL_UPDATED[key]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
