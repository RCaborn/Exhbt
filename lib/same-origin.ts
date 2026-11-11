import "server-only";
import { headers } from "next/headers";
import { siteOrigin } from "./auth";

/**
 * True when Origin (or Referer) matches this site. State-changing requests without
 * either header are rejected — browsers send Origin on cross-site POSTs and on
 * same-site form posts in modern browsers.
 */
export async function isSameOriginRequest(): Promise<boolean> {
  const h = await headers();
  const site = await siteOrigin();
  const origin = h.get("origin");
  if (origin) return origin === site;
  const referer = h.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === site;
  } catch {
    return false;
  }
}
