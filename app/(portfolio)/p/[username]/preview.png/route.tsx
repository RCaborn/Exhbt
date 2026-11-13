import { portfolioHost } from "@/lib/hosts";
import { photoDataUrl, portfolioCard } from "@/lib/og/card";
import { loadPortfolio } from "@/lib/portfolio";

/**
 * The link preview (Open Graph image) for the at-a-glance page: lib/og/card.tsx. A fixed address,
 * <base>/preview.png, rather than Next's opengraph-image file, whose generated URL carries the
 * internal /p/<name> path (refused on a portfolio host) and a hash. Slugs never contain a dot, so
 * it can't collide with a project. Shown even when the portfolio is hidden from search.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok") return new Response("Not found", { status: 404 });
  return portfolioCard({
    name: p.displayName,
    headline: p.profile.headline,
    photo: await photoDataUrl(p.photoUrl),
    host: portfolioHost(p.profile.username),
  });
}
