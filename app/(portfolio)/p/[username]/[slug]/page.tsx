import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { JobLinkView } from "@/components/portfolio/JobLinkView";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { checkedOnLabel, loadPortfolio, loadPublicJobLink, mediaFor } from "@/lib/portfolio";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ username: string; slug: string }>; searchParams: Promise<{ for?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, slug } = await params;
  const p = await loadPortfolio(username, `/${slug}`);
  const it = p.status === "ok" ? p.items.find((x) => x.slug === slug) : undefined;
  if (p.status === "ok" && it) {
    return {
      title: { absolute: `${it.doc.title} · ${p.displayName}` },
      description: it.doc.context || undefined,
      ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
    };
  }
  const job = await loadPublicJobLink(username, slug);
  if (job.status === "ok") {
    return {
      title: { absolute: `For ${job.link.company} · ${job.link.roleTitle}` },
      description: job.link.intro || undefined,
      robots: { index: false, follow: false },
    };
  }
  return { title: "Project not found", robots: { index: false } };
}

/** One project, or a per-job page when the path isn't an exhbt. */
export default async function PortfolioProject({ params, searchParams }: Params) {
  const { username, slug } = await params;
  const fromJob = (await searchParams).for;
  const p = await loadPortfolio(username, `/${slug}`);
  if (p.status === "redirect") redirect(p.to);
  if (p.status === "missing") notFound();
  const i = p.items.findIndex((x) => x.slug === slug);
  if (i < 0) {
    const job = await loadPublicJobLink(username, slug);
    if (job.status !== "ok") notFound();
    await getStore().recordJobLinkView(job.link.id);
    return (
      <JobLinkView
        company={job.link.company}
        role={job.link.roleTitle}
        intro={job.link.intro}
        items={job.items}
        base={job.base}
        slug={job.link.slug}
      />
    );
  }
  const it = p.items[i]!;
  const job = fromJob ? await loadPublicJobLink(username, fromJob) : null;
  const inJob = job?.status === "ok" ? job.items.findIndex((x) => x.id === it.id) : -1;
  const sequence = inJob >= 0 && job?.status === "ok" ? job.items : p.items;
  const at = inJob >= 0 ? inJob : i;
  const prev = sequence[at - 1];
  const next = sequence[at + 1];
  const home = p.base || "/";
  const backHref = inJob >= 0 && job?.status === "ok" ? `${p.base}/${job.link.slug}` : home;
  const backLabel = inJob >= 0 && job?.status === "ok" ? `Back to ${job.link.company}` : "All projects";
  const here = (itemSlug: string) => {
    const q = inJob >= 0 && fromJob ? `?for=${encodeURIComponent(fromJob)}` : "";
    return `${p.base}/${itemSlug}${q}`;
  };
  const { imageUrls, evidenceUrl } = await mediaFor(it.doc);

  return (
    <>
      <nav aria-label="Portfolio" className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <Link href={backHref} className="inline-flex items-center gap-1.5 hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> {backLabel}
        </Link>
        <span className="font-mono text-xs font-normal text-graphite">
          {at + 1} of {sequence.length}
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
            <Link href={here(prev.slug)} className="rounded-[14px] border border-line bg-surface p-4 hover:border-ink">
              <span className="inline-flex items-center gap-1 text-xs text-graphite"><ArrowLeft aria-hidden size={13} /> Previous</span>
              <span className="mt-1 block font-semibold">{prev.doc.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={here(next.slug)} className="rounded-[14px] border border-line bg-surface p-4 text-right hover:border-ink">
              <span className="inline-flex items-center gap-1 text-xs text-graphite">Next <ArrowRight aria-hidden size={13} /></span>
              <span className="mt-1 block font-semibold">{next.doc.title}</span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
