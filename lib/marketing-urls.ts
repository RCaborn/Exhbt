import { demoExhbts } from "@/lib/exhbt";
import { MARKETING_HOST } from "@/lib/hosts";

/**
 * Pages a search engine should list. The tool (roadmap, account, editor) is left out,
 * and so is /start, which exists for ads. Both /sitemap.xml and /sitemap.txt are built
 * from this list.
 */
export const MARKETING_PATHS = [
  "/",
  "/what-is-an-exhbt",
  "/pricing",
  "/universities",
  "/how-to-read-an-exhbt",
  "/demo",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
] as const;

export function marketingUrls(): string[] {
  const base = `https://${MARKETING_HOST}`;
  const paths = [...MARKETING_PATHS, ...demoExhbts.map((e) => `/demo/${e.slug}`)];
  return paths.map((path) => (path === "/" ? base : `${base}${path}`));
}
