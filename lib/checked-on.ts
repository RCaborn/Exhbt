/** "12 Nov 2026", for the date beside the checks. Client-safe: the public page and the editor's "See as a visitor" both use it. */
export const checkedOnLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined;
