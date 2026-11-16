import type { MetadataRoute } from "next";
import { demoExhbts } from "@/lib/exhbt";
import { MARKETING_HOST } from "@/lib/hosts";

/** The public marketing pages. Roadmaps, accounts and /start (ads only) are left out. */
const PAGES = ["/", "/what-is-an-exhbt", "/pricing", "/universities", "/how-to-read-an-exhbt", "/demo", "/legal/privacy", "/legal/terms", "/legal/cookies"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${MARKETING_HOST}`;
  return [...PAGES, ...demoExhbts.map((e) => `/demo/${e.slug}`)].map((path) => ({ url: `${base}${path === "/" ? "" : path}` }));
}
