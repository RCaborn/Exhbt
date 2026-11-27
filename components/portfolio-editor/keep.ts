import type { BuilderState } from "@/app/(app)/portfolio/steps";

/*
 * The unsaved state, kept in the browser when the site was updated under this tab (decision 0031,
 * "Saving": "After a deploy"). The tab's save action no longer exists, so nothing more can be saved
 * from it; what is on the page is put by here, and after the reload the editor offers it back once.
 *
 * Kept by person: on a shared computer the next person to sign in must never be offered someone else's
 * words. Kept for a day: after that the page has moved on. Storage can be full, off or blocked, so
 * every call is inside try and catch, and losing the copy only loses the offer.
 */

const KEY = "exhbt-portfolio-unsaved";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Why the state was kept: "stale", the site was updated under the tab and its save action is gone; "left",
 * the person left the page by a link inside the app while a save was refused or had failed.
 */
export type KeptWhy = "stale" | "left";

type Kept = { owner: string; at: number; state: BuilderState; why?: KeptWhy };

/** Puts the state by for `owner`. */
export function keepUnsaved(owner: string, state: BuilderState, why: KeptWhy = "stale"): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ owner, at: Date.now(), state, why } satisfies Kept));
  } catch {
    // No storage: the status still says to reload, and the words stay on screen until then.
  }
}

/**
 * Takes out what was kept for `owner` if it is `state`: the server has it after all (a save that landed after the
 * editor had gone, leaving.ts), so there is nothing to offer back. Anything else kept stays.
 */
export function forgetUnsaved(owner: string, state: BuilderState): void {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const kept = JSON.parse(raw) as Partial<Kept> | null;
    if (kept?.owner === owner && JSON.stringify(kept.state) === JSON.stringify(state)) window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked, or something unreadable kept: the next visit's offer is checked against the server anyway.
  }
}

/**
 * Takes the kept state out of the browser and returns it if it is this person's and recent: it is
 * offered once, so it is gone from the browser whether or not it is taken. Null when there is none.
 */
export function takeUnsaved(owner: string): { state: BuilderState; why: KeptWhy } | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const kept = JSON.parse(raw) as Partial<Kept> | null;
    if (!kept || kept.owner !== owner || typeof kept.at !== "number" || Date.now() - kept.at > DAY_MS) return null;
    const s = kept.state;
    // Only something shaped like a state is ever offered back; the server checks every word of it on the save.
    if (!s || typeof s !== "object" || typeof s.profile !== "object" || !s.profile || typeof s.arrangement !== "object" || !s.arrangement || !Array.isArray(s.arrangement.order) || !Array.isArray(s.arrangement.sections)) return null;
    return { state: s, why: kept.why === "left" ? "left" : "stale" };
  } catch {
    return null;
  }
}
