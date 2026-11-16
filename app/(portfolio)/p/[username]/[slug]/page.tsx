import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CHECKS_GUIDE } from "@/components/brand/Seal";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { PrintAddress, ProjectPager } from "@/components/portfolio/ProjectNav";
import { TeamByline } from "@/components/portfolio/TeamByline";
import { themeStyle } from "@/components/portfolio/themeFonts";
import { JobLinkView } from "@/components/portfolio/JobLinkView";
import { exhbtSummary } from "@/lib/exhbt/blocks";
import { MARKETING_HOST, parseHost, portfolioHost } from "@/lib/hosts";
import { jobLinkFor } from "@/lib/job-link-request";
import { jobLinkBackTarget } from "@/lib/job-links";
import { previewImage } from "@/lib/og/card";
import { checkedOnLabel, loadPortfolio, mediaFor } from "@/lib/portfolio";

type Params = { params: Promise<{ username: string; slug: string }>; searchParams: Promise<{ for?: string | string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, slug } = await params;
  // A per-job page comes first (decision 0008): never indexed, whatever the portfolio's search setting.
  const job = await jobLinkFor(username, slug);
  if (job) return { title: { absolute: `For ${job.link.company} · ${job.displayName}` }, robots: { index: false, follow: false } };
  const p = await loadPortfolio(username, `/${slug}`);
  const it = p.status === "ok" ? [...p.items, ...p.hiddenItems].find((x) => x.slug === slug) : undefined;
  if (p.status !== "ok" || !it) return { title: "Project not found", robots: { index: false } };
  // An exhbt the person has left off their portfolio still opens from its own link, but isn't for search engines.
  const unlisted = p.hiddenItems.some((x) => x.id === it.id);
  const title = `${it.doc.title} · ${p.displayName}`;
  // The one-sentence summary (or the first finding), then what it is.
  const description = [exhbtSummary(it.doc), it.doc.context.trim()].filter(Boolean).join(" ") || undefined;
  const image = await previewImage(`${p.base}/${slug}`, it.doc.title);
  return {
    title: { absolute: title },
    description,
    icons: { icon: [{ url: `${p.base}/initials.svg`, type: "image/svg+xml" }] },
    // The link preview (preview.png beside this page) shows whatever the search setting; that only stops indexing.
    openGraph: { type: "article", title, description, siteName: "exhbt", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    ...(p.profile.hideFromSearch || unlisted ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * One exhbt, opened from the at-a-glance page (decision 0022): the sidebar leads back to all of the
 * person's work, and the pager goes on to the next. The person's portfolio look carries over:
 * `data-theme` and the look's variables sit on the wrapper, and ProjectView draws every colour,
 * radius and face from them (the --xp-* set in globals.css).
 */
export default async function PortfolioProject({ params, searchParams }: Params) {
  const { username, slug } = await params;
  // A per-job page (alex.exhbt.co.uk/lloyds) comes before the exhbt checks and their not found. A job link's
  // slug can't equal one of the person's exhbt slugs: they share one slug space (lib/slugs.ts).
  const job = await jobLinkFor(username, slug);
  if (job) {
    const onPortfolioHost = parseHost((await headers()).get("host")).kind === "portfolio";
    return <JobLinkView data={job} startHref={onPortfolioHost ? `https://${MARKETING_HOST}/start` : "/start"} />;
  }
  const p = await loadPortfolio(username, `/${slug}`);
  if (p.status === "redirect") redirect(p.to);
  if (p.status !== "ok") notFound();
  const i = p.items.findIndex((x) => x.slug === slug);
  // Hidden from the glance page: still opens from its own link, with no previous or next (it isn't in the run).
  const h = i < 0 ? p.hiddenItems.findIndex((x) => x.slug === slug) : -1;
  if (i < 0 && h < 0) notFound();
  const it = i >= 0 ? p.items[i]! : p.hiddenItems[h]!;
  const { imageUrls, evidenceUrl } = await mediaFor(it.doc);
  // Opened from a job page (?for=<its slug>): offer the way back while that link is live.
  const forParam = (await searchParams).for;
  const back = typeof forParam === "string" && forParam ? await jobLinkBackTarget(username, forParam, it.id) : null;

  return (
    // data-exhbt-route puts the page on the look's ground (globals.css); the layout's own ground is mist.
    <div data-exhbt-route data-theme={p.theme.id} style={themeStyle(p.theme)}>
      <ProjectView
        doc={it.doc}
        owner={{ name: p.displayName, photoUrl: p.photoUrl, shape: p.theme.photo, bio: p.profile.headline, homeHref: p.base || "/" }}
        imageUrls={imageUrls}
        evidenceUrl={evidenceUrl}
        checkedOn={checkedOnLabel(it.publishedAt)}
        team={it.team.length > 0 ? <TeamByline team={it.team} /> : undefined}
        saveAsPdf
        back={back ? { href: back.href, label: `Back to ${back.company}` } : undefined}
        // On alex.exhbt.co.uk a relative guide link would stay on the portfolio host.
        checksHref={p.base ? undefined : `https://${MARKETING_HOST}${CHECKS_GUIDE}`}
      />
      <PrintAddress address={`${portfolioHost(p.profile.username)}/${slug}`} />
      {i >= 0 && <ProjectPager base={p.base} prev={p.items[i - 1]} next={p.items[i + 1]} />}
    </div>
  );
}
