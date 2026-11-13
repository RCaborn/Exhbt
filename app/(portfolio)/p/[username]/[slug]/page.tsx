import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CHECKS_GUIDE } from "@/components/brand/Seal";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { PrintAddress, ProjectPager, ProjectTopNav } from "@/components/portfolio/ProjectNav";
import { headlineFor } from "@/lib/exhbt/headline";
import { MARKETING_HOST, portfolioHost } from "@/lib/hosts";
import { previewImage } from "@/lib/og/card";
import { checkedOnLabel, loadPortfolio, mediaFor } from "@/lib/portfolio";

type Params = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, slug } = await params;
  const p = await loadPortfolio(username, `/${slug}`);
  const it = p.status === "ok" ? p.items.find((x) => x.slug === slug) : undefined;
  if (p.status !== "ok" || !it) return { title: "Project not found", robots: { index: false } };
  const title = `${it.doc.title} · ${p.displayName}`;
  const h = headlineFor(it.doc);
  const description = [h && `${h.value} ${h.label}.`, it.doc.context].filter(Boolean).join(" ") || undefined;
  const image = await previewImage(`${p.base}/${slug}`, it.doc.title);
  return {
    title: { absolute: title },
    description,
    // The link preview (preview.png beside this page) shows whatever the search setting; that only stops indexing.
    openGraph: { type: "article", title, description, siteName: "exhbt", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
  };
}

/** One project, opened from the at-a-glance page, with the way back and on to the next. */
export default async function PortfolioProject({ params }: Params) {
  const { username, slug } = await params;
  const p = await loadPortfolio(username, `/${slug}`);
  if (p.status === "redirect") redirect(p.to);
  if (p.status === "missing") notFound();
  const i = p.items.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const it = p.items[i]!;
  const { imageUrls, evidenceUrl } = await mediaFor(it.doc);

  return (
    <>
      <ProjectTopNav home={p.base || "/"} position={i + 1} />
      <ProjectView
        doc={it.doc}
        owner={{ name: p.displayName, photoUrl: p.photoUrl }}
        imageUrls={imageUrls}
        evidenceUrl={evidenceUrl}
        checkedOn={checkedOnLabel(it.publishedAt)}
        position={i + 1}
        // On alex.exhbt.co.uk a relative guide link would stay on the portfolio host.
        checksHref={p.base ? undefined : `https://${MARKETING_HOST}${CHECKS_GUIDE}`}
      />
      <PrintAddress address={`${portfolioHost(p.profile.username)}/${slug}`} />
      <ProjectPager base={p.base} prev={p.items[i - 1]} next={p.items[i + 1]} />
    </>
  );
}
