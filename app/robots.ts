import type { MetadataRoute } from "next";
import { MARKETING_HOST } from "@/lib/hosts";
import { isPrivatePreview } from "@/lib/site";

/**
 * Paths that are the tool, not the public site. Prefixes, so /roadmap also covers
 * /roadmap/new. /admin is deliberately absent: listing it would advertise the panel
 * (decision 0021).
 */
const PRIVATE = [
  "/roadmap",
  "/account",
  "/api/",
  "/auth/",
  "/dev/",
  "/login",
  "/exhbts",
  "/portfolio",
  "/job-links",
  "/team",
  "/start",
  "/check-email",
  "/unsubscribed",
  "/r/",
  "/p/",
];

export default function robots(): MetadataRoute.Robots {
  if (isPrivatePreview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `https://${MARKETING_HOST}/sitemap.xml`,
  };
}
