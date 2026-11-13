import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GlanceView } from "@/components/portfolio/GlanceView";
import { loadPortfolio } from "@/lib/portfolio";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok") return { title: "Portfolio not found", robots: { index: false } };
  const title = `${p.displayName} · Portfolio`;
  const description = p.profile.headline ?? `Projects by ${p.displayName}.`;
  return {
    title: { absolute: title },
    description,
    // Link previews (opengraph-image.tsx beside this page) show whatever the search setting; it only stops indexing.
    openGraph: { type: "profile", title, description, siteName: "exhbt" },
    twitter: { card: "summary_large_image", title, description },
    ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
  };
}

/** The at-a-glance page: who they are, and every project as a tile. Every shared link lands here. */
export default async function PortfolioGlance({ params }: Params) {
  const p = await loadPortfolio((await params).username);
  if (p.status === "redirect") redirect(p.to);
  if (p.status === "missing") notFound();
  return <GlanceView profile={p.profile} displayName={p.displayName} photoUrl={p.photoUrl} items={p.items} base={p.base} />;
}
