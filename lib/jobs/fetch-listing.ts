import "server-only";
import { getStore } from "@/lib/store";
import { htmlToListingText, listingTextProblem } from "./listing-text";

/**
 * Reads a job advert from a link (docs/phase-2.md section 8). Best effort by design: many
 * company career sites, Greenhouse and Lever work; LinkedIn, Indeed and boards that build the
 * page in JavaScript usually block us or send an empty shell. Then the person is asked to paste
 * the description instead, which is the main path anyway.
 *
 * Safety: https only, on the default port, to a named host (never an IP address or a local
 * name), every redirect checked the same way, 10 seconds in all, and at most 1 MB read.
 */

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
/** Link reads per person per hour. */
export const FETCHES_PER_HOUR = 20;

export type ListingResult = { ok: true; text: string; url: string } | { ok: false; reason: string };

const PASTE = "Copy the description from the advert and paste it instead.";
const BOARDS = "LinkedIn, Indeed and boards that load the advert with JavaScript usually do this.";

/**
 * Tests only, never in production: an origin such as http://localhost:3200 whose pages may be
 * read, so the e2e suite can serve a listing from a dev route.
 */
function testOrigin(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return process.env.EXHBT_LISTING_TEST_ORIGIN?.replace(/\/+$/, "") || null;
}

/** Why this address can't be fetched, or null when it can. */
export function urlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That isn't a web address. It should start with https://";
  }
  if (testOrigin() && url.origin === testOrigin()) return null;
  if (url.protocol !== "https:") return "Use an address that starts with https://";
  if (url.username || url.password || (url.port && url.port !== "443")) return "We can't read that address. " + PASTE;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":") || /^\d+$/.test(host);
  if (isIp || !host.includes(".") || /(?:^|\.)(?:localhost|local|internal|lan|home|arpa|test|invalid)$/.test(host)) {
    return "We can only read public job pages. " + PASTE;
  }
  return null;
}

/** Reads up to MAX_BYTES of the body; anything after that is left unread. */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(total, MAX_BYTES));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, all.length - at));
    all.set(part, at);
    at += part.byteLength;
    if (at >= all.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
}

async function fetchChecked(start: string, signal: AbortSignal): Promise<ListingResult> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const problem = urlProblem(url);
    if (problem) return { ok: false, reason: problem };
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.8", "user-agent": "ExhbtJobReader/1.0 (+https://www.exhbt.co.uk)" },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!next) break;
      url = new URL(next, url).toString();
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: `That site didn't let us read the page. ${BOARDS} ${PASTE}` };
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: `That page didn't load (the site answered ${res.status}). Check the link, or ${PASTE.toLowerCase()}` };
    }
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (type && !/text\/html|application\/xhtml|text\/plain/.test(type)) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, reason: `That link isn't a web page we can read (it's a file or something else). ${PASTE}` };
    }
    const body = await readCapped(res);
    const text = type.includes("text/plain") ? body.trim() : htmlToListingText(body);
    const issue = listingTextProblem(text);
    if (issue === "thin") return { ok: false, reason: `We could only read a few lines from that page. ${BOARDS} ${PASTE}` };
    if (issue === "garbled") return { ok: false, reason: `The text on that page didn't come through cleanly. ${PASTE}` };
    return { ok: true, text, url };
  }
  return { ok: false, reason: `That link kept redirecting. ${PASTE}` };
}

/** Fetches the advert at `rawUrl` for this person, within their hourly allowance. */
export async function fetchListing(rawUrl: string, userId: string): Promise<ListingResult> {
  const problem = urlProblem(rawUrl);
  if (problem) return { ok: false, reason: problem };
  const store = getStore();
  if ((await store.countRecentEventsForUser("job_link_fetched", userId, 1)) >= FETCHES_PER_HOUR) {
    return { ok: false, reason: `You've read ${FETCHES_PER_HOUR} links in the last hour. ${PASTE}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let result: ListingResult;
  try {
    result = await fetchChecked(rawUrl.trim(), controller.signal);
  } catch (e) {
    result = controller.signal.aborted
      ? { ok: false, reason: `That page took too long to load. ${PASTE}` }
      : { ok: false, reason: `We couldn't reach that page. ${PASTE}` };
    if (!controller.signal.aborted) console.error("listing fetch failed", (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
  let host: string;
  try {
    host = new URL(rawUrl.trim()).hostname;
  } catch {
    host = "";
  }
  await store.logEvent("job_link_fetched", userId, { host, ok: result.ok });
  return result;
}
