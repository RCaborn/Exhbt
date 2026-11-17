import { loadPortfolio } from "@/lib/portfolio";
import { portfolioCanonical } from "@/lib/seo";
import { isPrivatePreview } from "@/lib/site";

/**
 * robots.txt on a person's host (the middleware sends it here; it used to fall through to the www
 * one). Private preview keeps everything blocked. A portfolio hidden from search stays crawlable
 * with no sitemap: its pages say noindex, and a crawler blocked by robots.txt would never see that.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok" || p.items.length === 0) return new Response("Not found", { status: 404 });
  const body = isPrivatePreview
    ? "User-agent: *\nDisallow: /\n"
    : p.profile.hideFromSearch
      ? "User-agent: *\nAllow: /\n"
      : `User-agent: *\nAllow: /\n\nSitemap: ${portfolioCanonical(p.profile.username)}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
