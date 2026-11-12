import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { checkedOnLabel, loadPortfolio, mediaFor } from "@/lib/portfolio";

type Params = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, slug } = await params;
  const p = await loadPortfolio(username, `/${slug}`);
  const it = p.status === "ok" ? p.items.find((x) => x.slug === slug) : undefined;
  if (p.status !== "ok" || !it) return { title: "Project not found", robots: { index: false } };
  return {
    title: { absolute: `${it.doc.title} · ${p.displayName}` },
    description: it.doc.context || undefined,
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
  const prev = p.items[i - 1];
  const next = p.items[i + 1];
  const home = p.base || "/";
  const { imageUrls, evidenceUrl } = await mediaFor(it.doc);

  return (
    <>
      <nav aria-label="Portfolio" className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <Link href={home} className="inline-flex items-center gap-1.5 hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> All projects
        </Link>
        <span className="font-mono text-xs font-normal text-graphite">
          {i + 1} of {p.items.length}
        </span>
      </nav>

      <ProjectView
        doc={it.doc}
        owner={{ name: p.displayName, photoUrl: p.photoUrl }}
        imageUrls={imageUrls}
        evidenceUrl={evidenceUrl}
        checkedOn={checkedOnLabel(it.publishedAt)}
      />

      {(prev || next) && (
        <nav aria-label="Other projects" className="mt-6 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={`${p.base}/${prev.slug}`} className="rounded-[14px] border border-line bg-surface p-4 hover:border-ink">
              <span className="inline-flex items-center gap-1 text-xs text-graphite"><ArrowLeft aria-hidden size={13} /> Previous</span>
              <span className="mt-1 block font-semibold">{prev.doc.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`${p.base}/${next.slug}`} className="rounded-[14px] border border-line bg-surface p-4 text-right hover:border-ink">
              <span className="inline-flex items-center gap-1 text-xs text-graphite">Next <ArrowRight aria-hidden size={13} /></span>
              <span className="mt-1 block font-semibold">{next.doc.title}</span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
