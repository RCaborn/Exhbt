import { loadPortfolio } from "@/lib/portfolio";
import { portfolioCanonical, sitemapXml } from "@/lib/seo";

/**
 * A person's sitemap, at <their host>/sitemap.xml (the middleware rewrites the host to /p/<name>).
 * It lists the home page and the exhbts live on it: not job links (never indexed), not exhbts left
 * off the home page (noindex), not drafts (loadPortfolio only returns published, plan-visible ones).
 * A portfolio hidden from search gets an empty list, as the pages themselves are noindex.
 * Addresses are always on the person's own https host, whichever address this was asked on.
 * Slugs never contain a dot, so this can't collide with a project.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok" || p.items.length === 0) return new Response("Not found", { status: 404 });
  const entries = p.profile.hideFromSearch
    ? []
    : [
        { url: portfolioCanonical(p.profile.username), lastmod: latest(p.items.map((i) => i.publishedAt)) },
        ...p.items.map((i) => ({ url: portfolioCanonical(p.profile.username, `/${i.slug}`), lastmod: day(i.publishedAt) })),
      ];
  return new Response(sitemapXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}

/** "2026-11-17" from a stored timestamp, or null. */
const day = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toISOString().slice(0, 10) : null);

/** The newest of several timestamps, as a day. */
const latest = (list: (string | null)[]) => list.map(day).filter((d): d is string => d !== null).sort().at(-1) ?? null;
