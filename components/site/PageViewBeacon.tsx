"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MARKETING_HOST, parseHost } from "@/lib/hosts";
import { isCountedPath } from "@/lib/page-views";

/**
 * Counts a page view without a cookie (decision 0021). After the page has loaded it sends the
 * path (no query) and the referring site's name to /api/pv with sendBeacon, so it never slows the
 * page. Nothing else leaves the browser. Skipped for /admin, /api and similar, and when the
 * browser asks not to be tracked. A person's portfolio host serves no API, so it posts to the
 * main site; the server works out which host the page was on from the request's Origin.
 */
let last = "";
let first = true;

export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    // Strict Mode runs effects twice in development; this keeps it to one view per page.
    if (!pathname || pathname === last) return;
    last = pathname;
    if (!isCountedPath(pathname)) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;

    // The referrer belongs to the visit's first page only; later pages are moves inside the site.
    let referrer = "";
    if (first) {
      try {
        referrer = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        referrer = "";
      }
    }
    first = false;

    const { hostname, protocol, port } = window.location;
    const onPortfolio = parseHost(hostname).kind === "portfolio";
    let url = "/api/pv";
    if (onPortfolio) url = hostname.endsWith(".localhost") ? `${protocol}//localhost${port ? `:${port}` : ""}/api/pv` : `https://${MARKETING_HOST}/api/pv`;
    const body = JSON.stringify({ p: pathname, r: referrer });
    try {
      // A string body goes as text/plain, which needs no cross-origin preflight.
      if (!navigator.sendBeacon?.(url, body)) void fetch(url, { method: "POST", body, keepalive: true, mode: "no-cors" });
    } catch {
      // Analytics never breaks a page.
    }
  }, [pathname]);
  return null;
}
