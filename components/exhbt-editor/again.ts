import { leaving, watchLeaving } from "./leaving";

/**
 * A chunk asked for again when it fails to load: twice more, a moment apart, before the failure is let
 * through to the crash fallback (EditorGate.tsx, and the portfolio editor's PortfolioGate.tsx).
 *
 * A chunk that was on its way can "fail" while the person goes somewhere else (Reload, Back, a link out, an
 * address typed) and the page is still there, and the fallback then opened the classic editor, which took the
 * person there instead of where they were going. What was seen of this, and what was not, is in leaving.ts
 * ("What was seen"). The two retries were not enough on their own: they are over in two seconds, and a
 * slow next page keeps the page that is being left for longer (the WebKit run of 27 Nov 2026). So a failure while the page is being left (leaving.ts) is not counted:
 * the chunk is asked for again a second later, for as long as the leave lasts, and the page usually goes
 * first. A chunk that fails with nobody leaving reaches the fallback after its three tries, as before.
 * The retries are also what a phone's connection needs: one dropped request should not cost the editor.
 */
export function again<T>(load: () => Promise<T>, waits: readonly number[] = [500, 1500]): Promise<T> {
  const stop = watchLeaving();
  return tryLoad(load, waits).finally(stop);
}

/** While the page is being left, how long between the askings that are not counted. */
const LEAVING_WAIT_MS = 1000;

const later = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

function tryLoad<T>(load: () => Promise<T>, waits: readonly number[]): Promise<T> {
  return load().catch((e: unknown) => {
    if (leaving()) return later(LEAVING_WAIT_MS).then(() => tryLoad(load, waits));
    const [wait, ...rest] = waits;
    if (wait === undefined) throw e;
    return later(wait).then(() => tryLoad(load, rest));
  });
}
