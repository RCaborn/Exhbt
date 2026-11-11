import "server-only";
import { callerIpHash } from "./access";

/**
 * Best-effort sliding-window limiter keyed by bucket + IP (and optional extra).
 * Holds hits in memory for this isolate — enough to blunt spam; not a global quota.
 */

type Hits = Map<string, number[]>;

const g = globalThis as unknown as { __exhbtRateLimit?: Hits };

function store(): Hits {
  return (g.__exhbtRateLimit ??= new Map());
}

function prune(times: number[], windowMs: number, now: number) {
  const cut = now - windowMs;
  let i = 0;
  while (i < times.length && times[i]! < cut) i++;
  if (i > 0) times.splice(0, i);
}

/** True when this key has already hit `limit` inside the window (and records this attempt). */
export async function rateLimited(
  bucket: string,
  limit: number,
  windowMs: number,
  extraKey = "",
): Promise<boolean> {
  const ip = await callerIpHash();
  const key = extraKey ? `${bucket}:${ip}:${extraKey}` : `${bucket}:${ip}`;
  const now = Date.now();
  const hits = store();
  const times = hits.get(key) ?? [];
  prune(times, windowMs, now);
  if (times.length >= limit) {
    hits.set(key, times);
    return true;
  }
  times.push(now);
  hits.set(key, times);
  return false;
}

export const HOUR = 60 * 60 * 1000;
