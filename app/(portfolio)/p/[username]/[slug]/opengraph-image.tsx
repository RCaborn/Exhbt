import { portfolioHost } from "@/lib/hosts";
import { OG_SIZE, OG_TYPE, photoDataUrl, projectCard } from "@/lib/og/card";
import { loadPortfolio } from "@/lib/portfolio";

/** The link preview for one project (lib/og/card.tsx). Shown even when the portfolio is hidden from search. */
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Project on exhbt";

export default async function Image({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const p = await loadPortfolio(username, `/${slug}`);
  const it = p.status === "ok" ? p.items.find((x) => x.slug === slug) : undefined;
  if (p.status !== "ok" || !it) return new Response("Not found", { status: 404 });
  return projectCard({
    name: p.displayName,
    photo: await photoDataUrl(p.photoUrl),
    host: `${portfolioHost(p.profile.username)}/${slug}`,
    title: it.doc.title,
    headline: it.doc.headline ?? null,
    skills: it.doc.skills,
  });
}
