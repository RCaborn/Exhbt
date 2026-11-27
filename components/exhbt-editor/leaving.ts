/*
 * Whether the person is on their way off this page, for a chunk that fails to load meanwhile (again.ts).
 *
 * Safari stops a page's loads the moment the person goes somewhere else (Reload, Back, a link out, an address
 * typed), and keeps the page, still running, until the next one arrives. On a slow connection, or from a server
 * still building the next page, that can take many seconds, and a load asked for again in that time fails too.
 * The browser says the page is being left first, with `beforeunload`, before it stops the loads.
 *
 * A leave can come to nothing (a link to a download, an answer with no page, a press on Stop), so it counts as
 * leaving for LEAVE_MS at most, and not once the page is shown again from the back-forward cache. It listens for
 * `beforeunload` only while a load is under way (`watchLeaving`), so a page with nothing loading carries no such
 * listener (one can keep a page out of some browsers' back-forward cache).
 */

/** The longest a leave counts as one: a page still here a minute after it was left was not left. */
const LEAVE_MS = 60_000;

let leftAt: number | null = null;
let watching = 0;
const left = () => {
  leftAt = performance.now();
};

if (typeof window !== "undefined") {
  // Shown again from the back-forward cache: it is in use again. Not the first `pageshow`, which a page that is being
  // left can still fire as the leave stops its loads.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) leftAt = null;
  });
}

/** Whether the person has set off for another page in the last minute and this page is still here. */
export function leaving(): boolean {
  return leftAt !== null && performance.now() - leftAt < LEAVE_MS;
}

/** Listens for the page being left until the function it gives back is called (once a load has settled). */
export function watchLeaving(): () => void {
  if (typeof window === "undefined") return () => {};
  if (watching++ === 0) window.addEventListener("beforeunload", left);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--watching === 0) window.removeEventListener("beforeunload", left);
  };
}
