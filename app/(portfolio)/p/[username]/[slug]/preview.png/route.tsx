import { headlineFor } from "@/lib/exhbt/headline";
import { portfolioHost } from "@/lib/hosts";
import { photoDataUrl, projectCard } from "@/lib/og/card";
import { loadPortfolio } from "@/lib/portfolio";

/** The link preview for one project (lib/og/card.tsx), at <base>/<slug>/preview.png. See ../../preview.png/route.tsx. */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const p = await loadPortfolio(username, `/${slug}`);
  const it = p.status === "ok" ? p.items.find((x) => x.slug === slug) : undefined;
  if (p.status !== "ok" || !it) return new Response("Not found", { status: 404 });
  return projectCard({
    name: p.displayName,
    photo: await photoDataUrl(p.photoUrl),
    host: `${portfolioHost(p.profile.username)}/${slug}`,
    title: it.doc.title,
    headline: headlineFor(it.doc),
    skills: it.doc.skills,
  });
}
