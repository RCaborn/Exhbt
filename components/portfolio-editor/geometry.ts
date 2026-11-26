/*
 * The geometry the loading stand-in (StandIn.tsx) and the live editor share, written once, so the fields
 * come alive in place and nothing moves when the editor arrives (decision 0031, "The switch": the editor
 * is drawn only in the browser). Pure strings: the stand-in is in the gate's own chunk.
 */

/** The bar's room: the stand-in leaves exactly this, and the bar is exactly this tall (css/core.css). */
export const BAR_H = "var(--xe-topbar-h, 3.5rem)";

/** The look's ground under the page, and the container the page's own queries measure (as on a visitor's page). */
export const GROUND = "@container bg-[var(--pf-ground)] text-[color:var(--pf-ink)]";
