import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LEVEL, isBar, isLevel, LAB_COOKIE, type LabState } from "./lab";

/**
 * Whether the design lab answers at all. Read on each request, never at build time, so one build
 * serves the preview Worker (EXHBT_LAB=1 in wrangler.jsonc's preview vars) and the live one, where
 * it is never set and every lab address is not found. The same rule as app/dev/editor-timing.
 */
export const labEnabled = () => process.env.NODE_ENV !== "production" || process.env.EXHBT_LAB === "1";

/**
 * A lab page's title, for `export const generateMetadata = labMetadata("Home")`. Where the lab is
 * switched off it gives nothing, so the not-found page a lab address answers with doesn't carry
 * the lab's name. (A plain `export const metadata` would: Next reads it before the layout's gate.)
 */
export const labMetadata =
  (title: string) =>
  (): Metadata =>
    labEnabled() ? { title } : {};

/**
 * The lab's switches as this request has them (the cookies the lab bar writes): the level, whether
 * motion is on, and whether the bar shows. For a server component that draws something different at
 * each level. In the browser use `useLab()` (components/lab/LabFrame.tsx), and in CSS the lab root's
 * `data-level` and `data-motion` attributes.
 */
export async function readLab(): Promise<LabState> {
  const jar = await cookies();
  const level = jar.get(LAB_COOKIE.level)?.value;
  const bar = jar.get(LAB_COOKIE.bar)?.value;
  return {
    level: isLevel(level) ? level : DEFAULT_LEVEL,
    motion: jar.get(LAB_COOKIE.motion)?.value === "off" ? "off" : "on",
    bar: isBar(bar) ? bar : "shown",
  };
}
