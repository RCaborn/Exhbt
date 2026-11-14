import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GlanceView } from "@/components/portfolio/GlanceView";
import { previewImage } from "@/lib/og/card";
import { loadPortfolio } from "@/lib/portfolio";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok") return { title: "Portfolio not found", robots: { index: false } };
  const title = `${p.displayName} · Portfolio`;
  const description = p.profile.headline ?? `Projects by ${p.displayName}.`;
  const image = await previewImage(p.base, `${p.displayName}'s portfolio`);
  return {
    title: { absolute: title },
    description,
    // The link preview (preview.png beside this page) shows whatever the search setting; that only stops indexing.
    openGraph: { type: "profile", title, description, siteName: "exhbt", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
  };
}

/** The at-a-glance page: who they are, and every project as a tile. Every shared link lands here. */
export default async function PortfolioGlance({ params }: Params) {
  const p = await loadPortfolio((await params).username);
  if (p.status === "redirect") redirect(p.to);
  if (p.status === "missing") notFound();
  return <GlanceView profile={p.profile} displayName={p.displayName} photoUrl={p.photoUrl} items={p.items} base={p.base} theme={p.theme} />;
}
