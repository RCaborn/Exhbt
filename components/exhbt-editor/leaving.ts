/*
 * Whether the person is on their way off this page, for a chunk that fails to load meanwhile (again.ts).
 *
 * Why it is here, as far as it is known. The reading behind it is that Safari stops a page's loads once the person goes
 * somewhere else (Reload, Back, a link out, an address typed) and keeps the old page, still running, until the next one
 * arrives; that a load asked for again in that time fails too, so a slow next page (a slow connection, or a server
 * still building it) makes every retry fail; and that the browser says the page is being left, with `beforeunload`,
 * before it stops the loads. All of that is inferred from the run below. None of it has been watched happen in WebKit,
 * the order of `beforeunload` and the failing loads included.
 *
 * What was seen. In the WebKit CI run 45932577883 (27 Nov 2026), e2e/safari.webkit.ts:27 and e2e/your-way.spec.ts:369
 * failed: the crash fallback's redirect to `?editor=classic` interrupted the navigation the test had asked for (commit
 * 7f8b314 added this guard for that). Why the fallback ran is inferred, not observed: a chunk on its way failed after
 * the person went elsewhere, and its retries too, because the next page was slow and the old page was kept until it
 * came. e2e/editor-classic.spec.ts makes Chromium do the same, by holding the next page back and failing the chunk from
 * the moment of leaving; there the guard saw `beforeunload` first and the old page opened no fallback.
 *
 * What was not seen. Whether Safari on an iPhone fires `beforeunload` at all, for Reload, Back or a link out, is
 * unknown: it has not been tried on a device. If it does not, nothing here is set and a failure is counted as before.
 *
 * How long it holds. A leave can come to nothing (a link to a download, an answer with no page, a press on Stop,
 * "Stay" on the browser's prompt about unsaved changes), so it counts as leaving for LEAVE_MS at most, and not once the
 * page is shown again from the back-forward cache. A "Stay" press does not end it: for up to a minute after
 * `beforeunload`, a real failure is retried (again.ts) rather than counted. That was accepted on purpose. An earlier
 * change ended the guard on the first press or key after `beforeunload` (commits fc4ea71 and 84eed5a), and a review
 * showed that during a real, slow leave one press anywhere on the old page then ended the guard, the cut-off chunk's
 * failure was counted, and the fallback's redirect to `?editor=classic` replaced the page the person had asked for.
 * That change was taken out. The repro is scratchpad/else/tidy-rev2/repro/zz-review-press-while-loading.spec.ts, in
 * the session folder of the 27 Nov 2026 review (not in the repository).
 *
 * It listens for `beforeunload` only while a load is under way (`watchLeaving`), so a page with nothing loading
 * carries no such listener (one can keep a page out of some browsers' back-forward cache).
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
