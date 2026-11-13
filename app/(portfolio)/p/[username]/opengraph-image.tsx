import { portfolioHost } from "@/lib/hosts";
import { OG_SIZE, OG_TYPE, photoDataUrl, portfolioCard } from "@/lib/og/card";
import { loadPortfolio } from "@/lib/portfolio";

/** The link preview for the at-a-glance page (lib/og/card.tsx). Shown even when the page is hidden from search. */
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Portfolio on exhbt";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok") return new Response("Not found", { status: 404 });
  return portfolioCard({
    name: p.displayName,
    headline: p.profile.headline,
    photo: await photoDataUrl(p.photoUrl),
    host: portfolioHost(p.profile.username),
  });
}
