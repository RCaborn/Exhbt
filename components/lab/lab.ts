/**
 * The design lab's shared facts (app/lab/design): its three levels, its two switches and its
 * screens. Plain data, safe on the server and in the browser.
 *
 * The lab is a set of design mock-ups for Rory and Alex to choose from. It is not the product:
 * it answers only in development and on the preview site (app/lab/design/layout.tsx).
 */

/** How far a screen goes. The same screen is drawn at each, to compare. */
export const LEVELS = ["restrained", "confident", "maximal"] as const;
export type Level = (typeof LEVELS)[number];
export const DEFAULT_LEVEL: Level = "confident";
export const isLevel = (v: unknown): v is Level => LEVELS.includes(v as Level);

/** What each level means, in one line (the lab bar's tooltip and the index page). */
export const LEVEL_NOTE: Record<Level, string> = {
  restrained: "Today's sizes on the new system. Motion is feedback only.",
  confident: "The proposed voice: one loud line a screen, the work raised, motion that confirms.",
  maximal: "The same, turned up: the largest type, scroll-led pages and a finish in ink.",
};

/** "on" unless the lab's Motion off switch is set. A person's own reduced-motion setting still applies on top. */
export type Motion = "on" | "off";

/** The lab bar: shown, folded to a small button, or left out altogether (for a clean screenshot). */
export type Bar = "shown" | "hidden" | "none";
export const isBar = (v: unknown): v is Bar => v === "shown" || v === "hidden" || v === "none";

export type LabState = { level: Level; motion: Motion; bar: Bar };

/**
 * The cookies the switches are kept in. They are scoped to the lab's own path, read on the server
 * by `readLab()` (components/lab/server.ts) and written in the browser by the lab bar. A test can
 * set them before opening a page: `lab-level=maximal`, `lab-motion=off`, `lab-bar=none`.
 */
export const LAB_COOKIE = { level: "lab-level", motion: "lab-motion", bar: "lab-bar" } as const;
export const LAB_PATH = "/lab/design";

/** The lab's screens, in the order the bar lists them. */
export const LAB_SCREENS = [
  { href: `${LAB_PATH}/home`, label: "Home", note: "The home page: the product in the first screen, and its story." },
  { href: `${LAB_PATH}/finish`, label: "Finish", note: "Publishing: the moment an exhbt goes live, and what a Free account sees." },
  { href: `${LAB_PATH}/app`, label: "App", note: "The frame every signed-in page shares, and a person's portfolio inside it." },
  { href: `${LAB_PATH}/kit`, label: "Kit", note: "The voice on one page: type, colour, controls and motion, beside today's." },
] as const;
