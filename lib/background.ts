import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lets work carry on after the response has gone. On Cloudflare Workers a request's work is cut
 * off when the response ends unless it is handed to `ctx.waitUntil`; OpenNext exposes that through
 * `getCloudflareContext()`. Under plain Node (development, tests, `next start`) the promise just
 * keeps running, and the context lookup throws, which is fine to ignore. Errors are logged, never
 * thrown: nobody is waiting for this work.
 */
export function runInBackground(work: Promise<unknown>): void {
  const safe = work.catch((e) => console.error("background work failed", (e as Error).message));
  try {
    getCloudflareContext().ctx.waitUntil(safe);
  } catch {
    // Not on Workers: nothing to register with.
  }
}
