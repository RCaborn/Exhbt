import type { MetadataRoute } from "next";
import { demoExhbts } from "@/lib/exhbt";
import { marketingSitemapPages, marketingUrl } from "@/lib/seo";

/**
 * The public marketing pages, with `lastmod` where a date is recorded (the legal pages; lib/legal.ts).
 * Roadmaps, accounts and /start (ads only) are left out. Each portfolio host has its own sitemap
 * (app/(portfolio)/p/[username]/sitemap.xml).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [...marketingSitemapPages(), ...demoExhbts.map((e) => ({ url: marketingUrl(`/demo/${e.slug}`) }))];
}
