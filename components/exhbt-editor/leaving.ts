/*
 * Whether the person is on their way off this page, for a chunk that fails to load meanwhile (again.ts).
 *
 * What was seen. In the WebKit run of 27 Nov 2026 (CI; e2e/safari.webkit.ts), a chunk on its way failed after the person
 * went elsewhere, and so did its retries, because the next page was slow and the page was kept, still running, until it
 * came. Chromium does not do that unprompted: e2e/editor-classic.spec.ts makes it, by holding the next page back and
 * failing the chunk from the moment of leaving. There the guard below saw `beforeunload` first, and the page that was
 * left opened no fallback. That order, `beforeunload` and then the failing loads, was not looked at in WebKit itself:
 * only that the run failed before this guard and the test is written to pass with it.
 *
 * What was not seen. Whether Safari on an iPhone fires `beforeunload` at all, for Reload, Back or a link out, is
 * unknown: it has not been tried on a device, and WebKit on Linux is the same engine, not the same browser. If it does
 * not, nothing here is set and a failure is counted as before, so the guard does no harm there; it just does not help.
 *
 * A leave can come to nothing (a link to a download, an answer with no page, a press on Stop, "Stay" on the browser's
 * prompt about unsaved changes), so it counts as leaving for LEAVE_MS at most, not once the page is shown again from the
 * back-forward cache, and not after the person's next press or key: someone who is still using the page has not left it
 * (the press or key that started the leave is not that press: see `used`). It listens for `beforeunload` only while a
 * load is under way (`watchLeaving`), so a page with nothing loading carries no such listener (one can keep a page out
 * of some browsers' back-forward cache).
 */

/** The longest a leave counts as one: a page still here a minute after it was left was not left. */
const LEAVE_MS = 60_000;

let leftAt: number | null = null;
let watching = 0;
const left = () => {
  leftAt = performance.now();
  window.addEventListener("pointerdown", used, { capture: true, passive: true });
  window.addEventListener("keydown", used, { capture: true, passive: true });
};

/** Clears the leave. */
const clear = () => {
  leftAt = null;
  window.removeEventListener("pointerdown", used, true);
  window.removeEventListener("keydown", used, true);
};

/**
 * The first press or key after the leave began, from someone who stayed ("Stay" on the browser's prompt). Not the press
 * or key that started the leave: a link pressed, or a Reload key, is over before `beforeunload` fires, so its event is
 * stamped no later than the leave; and a key held down repeats, which is not a new key.
 */
function used(e: Event) {
  if (leftAt === null || e.timeStamp <= leftAt || (e as KeyboardEvent).repeat) return;
  clear();
}

if (typeof window !== "undefined") {
  // Shown again from the back-forward cache: it is in use again. Not the first `pageshow`, which a page that is being
  // left can still fire as the leave stops its loads.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) clear();
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
