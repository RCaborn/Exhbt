import type { ItemAs } from "@/lib/exhbt/layouts";

/*
 * The geometry the loading stand-in (StandIn.tsx) and the live editor share, written once, so the
 * fields come alive in place and nothing moves when the editor arrives (decision 0026, "The crash
 * fallback"). Pure strings: StandIn is in the gate's own chunk.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** A skill pill, as the page draws it (ProjectView.tsx); the "Add a skill" box is the same size. */
export const PILL = "xp-pill px-2 py-[0.2rem] text-[0.78rem] font-medium";

/** The skills list's classes, as the page draws it. */
export const SKILLS_LIST = "flex flex-wrap gap-1 @2xl/main:justify-end";

/** The edit-mode-only placeholder colour, as an inline style. */
export const MUTED = { color: "var(--xp-muted)" } as const;

/**
 * An image's description field is one line in its caption's type, under the caption (exhbt-parts.tsx:
 * a tile's caption is smaller, the lead image's is inset). It wraps as a textarea does.
 */
const DESCRIPTION_TYPE: Partial<Record<ItemAs, string>> = {
  tile: "text-[0.8125rem] leading-snug",
  lead: "px-1 text-sm leading-snug",
};
export const descriptionClass = (as: ItemAs | undefined) => cx("mt-1 block whitespace-pre-wrap [overflow-wrap:break-word]", (as && DESCRIPTION_TYPE[as]) ?? "text-sm leading-snug");

/** The description field's placeholder, and its name for picture `n` (from 1). */
export const DESCRIPTION_PLACEHOLDER = "Describe it for people who can't see it";
export const descriptionLabel = (n: number) => `Image ${n}: describe it for people who can't see it`;

/** The work button's words: "See the work: …", or "Add the work" when there is none. */
export const workWords = (label: string | undefined) => (label !== undefined ? `See the work: ${label}` : "Add the work");

/** The canvas: the public frame's width (app/(portfolio)/p/[username]/[slug]/layout.tsx), with its padding. */
export const CANVAS = "mx-auto max-w-[64rem] px-4 pt-8 pb-10 sm:px-8 sm:pt-12";
/** The look's ground under the canvas. */
export const LOOK_GROUND = "min-h-svh bg-[var(--pf-ground)] text-[color:var(--pf-ink)]";
/** The top bar's room: the stand-in leaves exactly this, and the top bar is exactly this tall (css/core.css). */
export const TOPBAR_H = "var(--xe-topbar-h, 3.5rem)";
