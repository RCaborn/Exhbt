import "server-only";
import { callerIpHash } from "./access";
import { getStore } from "./store";

/**
 * Shared sliding-window limiter. Counters live in the Store (Supabase in production,
 * in-memory in development), so every Worker isolate sees the same hits.
 */

/** True when this key has already hit `limit` inside the window (and records this attempt when allowed). */
export async function rateLimited(
  bucket: string,
  limit: number,
  windowMs: number,
  extraKey = "",
): Promise<boolean> {
  const ip = await callerIpHash();
  const key = extraKey ? `${bucket}:${ip}:${extraKey}` : `${bucket}:${ip}`;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  return !(await getStore().takeRateLimit(key, limit, windowSeconds));
}

export const HOUR = 60 * 60 * 1000;
