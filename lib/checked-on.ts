/**
 * "12 Nov 2026", for the date beside the checks. Client-safe: the public page, the editing page and the
 * editor's "See as a visitor" all use it. Always the UK date, so a page drawn on the server and the same
 * page drawn in a browser elsewhere say the same day.
 */
export const checkedOnLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : undefined;
