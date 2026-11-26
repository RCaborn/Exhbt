import { LAB_PATH } from "../lab";

/**
 * The App screen's states (/lab/design/app?screen=…&show=…). Plain data, for the page (server) and
 * the frame (browser). Each screen and each feedback state has its own address, so it can be sent
 * to someone and a screenshot can open it.
 */
export const APP_SCREENS = [
  {
    id: "first-run",
    tab: "First run",
    note: "Amara has just signed up, on Free. Her page already has her name on it. It is drawn in a frame here; in the real editor she types on it.",
  },
  {
    id: "work",
    tab: "With work",
    note: "The same person on Max, with four exhbts: three live and one draft.",
  },
  {
    id: "account",
    tab: "Account and billing",
    note: "Her account and her plan on one settings page, with deleting the account last.",
  },
] as const;

/** The three screens, and "roadmaps": the nav's second item, which the lab doesn't draw. */
export type AppScreen = (typeof APP_SCREENS)[number]["id"] | "roadmaps";
export const isAppScreen = (v: unknown): v is AppScreen => v === "roadmaps" || APP_SCREENS.some((s) => s.id === v);

/**
 * What the lab can show on top of a screen: two toasts, an inline banner for a save that failed,
 * and the screen while it loads. The toasts play once when the address asks for them; the banner
 * and the loading state stay until the address changes.
 */
export const APP_SHOWS = [
  { id: "copied", label: "Link copied", kind: "toast" },
  { id: "saved", label: "Saved", kind: "toast" },
  { id: "failed", label: "A failed save", kind: "state" },
  { id: "loading", label: "Loading", kind: "state" },
] as const;
export type AppShow = (typeof APP_SHOWS)[number]["id"];
export const isAppShow = (v: unknown): v is AppShow => APP_SHOWS.some((s) => s.id === v);

/** A screen's address, with a feedback state if one is asked for. */
export function appHref(screen: AppScreen, show?: AppShow | null): string {
  const q = new URLSearchParams({ screen });
  if (show) q.set("show", show);
  return `${LAB_PATH}/app?${q.toString()}`;
}
